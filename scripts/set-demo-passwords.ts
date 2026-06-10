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

  console.log(`\nDemo password: ${password}`);
  await conn.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
