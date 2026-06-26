import http2 from "node:http2";
import { importPKCS8, SignJWT } from "jose";
import { getDeviceTokensForFamily, getChildForNotify, removeDeviceToken } from "../moduleDb";

/**
 * Apple Push Notification service (APNs) sender.
 *
 * Configured entirely via env so it ships dormant and "flips on" once the keys
 * are present:
 *   APNS_KEY         the .p8 private key contents (PEM; literal \n is fine)
 *   APNS_KEY_ID      the key's 10-char Key ID
 *   APNS_TEAM_ID     your Apple Developer Team ID
 *   APNS_BUNDLE_ID   the app's bundle id (apns-topic), e.g. org.childflow.ChildFlow
 *   APNS_PRODUCTION  "true" for the prod gateway, else sandbox
 *
 * When unconfigured, sends are a logged no-op — so dev and tests never fail.
 */
export function hasPushConfigured(): boolean {
  return !!(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_BUNDLE_ID);
}

let cachedToken: { jwt: string; iat: number } | null = null;

async function apnsAuthToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // APNs provider tokens are valid up to 1h; refresh well before that.
  if (cachedToken && now - cachedToken.iat < 3000) return cachedToken.jwt;
  const key = await importPKCS8(process.env.APNS_KEY!.replace(/\\n/g, "\n"), "ES256");
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APNS_KEY_ID! })
    .setIssuedAt(now)
    .setIssuer(process.env.APNS_TEAM_ID!)
    .sign(key);
  cachedToken = { jwt, iat: now };
  return jwt;
}

export async function sendPushToTokens(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  if (tokens.length === 0) return;
  if (!hasPushConfigured()) {
    console.log(`[Push] (APNs not configured) would notify ${tokens.length} device(s): "${title}" — ${body}`);
    return;
  }

  const host = process.env.APNS_PRODUCTION === "true" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
  let jwt: string;
  try {
    jwt = await apnsAuthToken();
  } catch (e) {
    console.warn("[Push] failed to build APNs auth token:", e);
    return;
  }

  const client = http2.connect(host);
  client.on("error", (e) => console.warn("[Push] APNs connection error:", e.message));
  const payload = JSON.stringify({ aps: { alert: { title, body }, sound: "default" }, ...data });

  await Promise.all(
    tokens.map(
      (token) =>
        new Promise<void>((resolve) => {
          const req = client.request({
            ":method": "POST",
            ":path": `/3/device/${token}`,
            authorization: `bearer ${jwt}`,
            "apns-topic": process.env.APNS_BUNDLE_ID!,
            "apns-push-type": "alert",
          });
          let status = 0;
          let resBody = "";
          req.on("response", (h) => { status = Number(h[":status"]) || 0; });
          req.setEncoding("utf8");
          req.on("data", (d) => { resBody += d; });
          req.on("end", () => {
            // Prune tokens Apple says are dead so we don't keep pushing to them.
            if (status === 410 || (status === 400 && resBody.includes("BadDeviceToken"))) {
              removeDeviceToken(token).catch(() => {});
            }
            resolve();
          });
          req.on("error", () => resolve());
          req.end(payload);
        })
    )
  );
  client.close();
}

export async function sendPushToFamily(familyId: number, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  const tokens = await getDeviceTokensForFamily(familyId);
  await sendPushToTokens(tokens, title, body, data ?? {});
}

/** Notify a child's family that a new moment was posted. Fire-and-forget safe. */
export async function notifyMomentPosted(childId: number, description: string): Promise<void> {
  try {
    const child = await getChildForNotify(childId);
    if (!child || child.familyId == null) return;
    await sendPushToFamily(child.familyId, `New update for ${child.firstName}`, description, { type: "moment", childId: String(childId) });
  } catch (e) {
    console.warn("[Push] notifyMomentPosted failed:", e);
  }
}
