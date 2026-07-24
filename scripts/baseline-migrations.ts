/**
 * One-time-per-environment migration baseline.
 *
 * Some databases were provisioned before every migration was recorded in
 * drizzle's `__drizzle_migrations` journal (schema was applied via an early
 * `push`/manual step, leaving newer migration files unrecorded). `drizzle-kit
 * migrate` then tries to re-run those already-applied migrations and collides
 * ("table ... already exists"), which breaks `npm run db:push`.
 *
 * This marks every migration file that the DB already reflects as applied, so
 * `migrate` becomes a clean no-op now and only runs genuinely new migrations
 * going forward. It ONLY writes to the `__drizzle_migrations` tracking table —
 * it never touches real data or schema. Idempotent: safe to run repeatedly.
 *
 * Run once against any DB that predates full migration tracking:
 *   npm run db:baseline
 * A brand-new DB doesn't need this — plain `migrate` applies everything.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import { readMigrationFiles } from "drizzle-orm/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
const conn = await mysql.createConnection(url);

await conn.query(
  "CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)",
);

const [rows] = (await conn.query("SELECT hash, created_at FROM `__drizzle_migrations`")) as unknown as [
  Array<{ hash: string; created_at: number | string }>,
];
const appliedMillis = new Set(rows.map((r) => String(r.created_at)));

// Sanity check: for migrations already recorded, our locally computed hash
// must match what's stored — proof we hash identically to whatever wrote them.
let mismatches = 0;
for (const m of migrations) {
  const rec = rows.find((r) => String(r.created_at) === String(m.folderMillis));
  if (rec && rec.hash !== m.hash) mismatches++;
}
console.log(
  `recorded: ${rows.length} | migration files: ${migrations.length} | hash mismatches on overlap: ${mismatches}`,
);
if (mismatches > 0) {
  console.error("Refusing to baseline: hashing differs from stored rows. Investigate before proceeding.");
  await conn.end();
  process.exit(1);
}

let inserted = 0;
for (const m of migrations) {
  if (appliedMillis.has(String(m.folderMillis))) continue;
  await conn.query("INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES (?, ?)", [m.hash, m.folderMillis]);
  inserted++;
}
console.log(
  inserted === 0
    ? "Nothing to baseline — journal already reflects every migration."
    : `Baselined ${inserted} migration(s). \`migrate\` will now be a no-op and apply only future migrations.`,
);
await conn.end();
