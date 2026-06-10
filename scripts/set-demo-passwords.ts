/**
 * Sets passwords for the seeded demo accounts WITHOUT touching any other data
 * (unlike seed.ts, which truncates every table).
 *
 * Run: npx tsx scripts/set-demo-passwords.ts
 * Override the password with SEED_DEMO_PASSWORD.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import { hashPassword } from "../server/_core/password";

const DEMO_ACCOUNTS = ["admin@childflow.org", "maria.lopez@childflow.org"];

const DEMO_PARENT_EMAIL = "parent@childflow.org";
const DEMO_INVITE_CODE = "CF-DEMO-1";

async function main() {
  const password = process.env.SEED_DEMO_PASSWORD ?? "ChildFlow!2026";
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  for (const email of DEMO_ACCOUNTS) {
    const hash = await hashPassword(password);
    const [result] = await conn.execute(
      "UPDATE users SET passwordHash = ? WHERE email = ?",
      [hash, email]
    );
    const affected = (result as { affectedRows: number }).affectedRows;
    console.log(
      affected > 0
        ? `✓ ${email} — password set`
        : `✗ ${email} — no such user (run scripts/seed.ts first)`
    );
  }

  // Demo parent account, linked to family 1 (requires seeded families).
  const [families] = await conn.execute("SELECT id, organizationId FROM families ORDER BY id LIMIT 1");
  const family = (families as Array<{ id: number; organizationId: number }>)[0];
  if (!family) {
    console.log("✗ no families found — run scripts/seed.ts first; skipping parent demo");
  } else {
    const parentHash = await hashPassword(password);
    const [existing] = await conn.execute("SELECT id FROM users WHERE email = ?", [DEMO_PARENT_EMAIL]);
    if ((existing as unknown[]).length === 0) {
      await conn.execute(
        `INSERT INTO users (openId, name, email, loginMethod, passwordHash, role, familyId)
         VALUES ('parent-demo', 'Demo Parent', ?, 'email', ?, 'parent', ?)`,
        [DEMO_PARENT_EMAIL, parentHash, family.id]
      );
      console.log(`✓ ${DEMO_PARENT_EMAIL} — parent account created (family ${family.id})`);
    } else {
      await conn.execute(
        "UPDATE users SET passwordHash = ?, role = 'parent', familyId = ? WHERE email = ?",
        [parentHash, family.id, DEMO_PARENT_EMAIL]
      );
      console.log(`✓ ${DEMO_PARENT_EMAIL} — parent account updated (family ${family.id})`);
    }

    // Reusable demo invitation code for testing the onboarding flow.
    const [codes] = await conn.execute("SELECT id FROM family_invitations WHERE code = ?", [DEMO_INVITE_CODE]);
    if ((codes as unknown[]).length === 0) {
      await conn.execute(
        `INSERT INTO family_invitations (organizationId, familyId, code, adultEmail, expiresAt)
         VALUES (?, ?, ?, NULL, DATE_ADD(NOW(), INTERVAL 1 YEAR))`,
        [family.organizationId, family.id, DEMO_INVITE_CODE]
      );
      console.log(`✓ invitation ${DEMO_INVITE_CODE} created (family ${family.id})`);
    } else {
      await conn.execute(
        "UPDATE family_invitations SET usedAt = NULL, expiresAt = DATE_ADD(NOW(), INTERVAL 1 YEAR) WHERE code = ?",
        [DEMO_INVITE_CODE]
      );
      console.log(`✓ invitation ${DEMO_INVITE_CODE} reset to unused`);
    }
  }

  console.log(`\nDemo password (all accounts): ${password}`);
  await conn.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
