/**
 * Seeds the PIR question catalog (pir_questions) from docs/pir/pir-catalog.json.
 * Idempotent: clears pir_questions, then bulk-inserts the catalog in order.
 * Reference data only — does NOT touch org-scoped pir_data / pir_reports.
 *
 * Run: npx tsx scripts/seed-pir-questions.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { pirQuestions, type InsertPirQuestion } from "../drizzle/schema";

type CatalogField = {
  code: string;
  label: string;
  type: InsertPirQuestion["valueType"];
  subject: InsertPirQuestion["subject"];
  options?: string[];
  paired?: "enrollment" | "eoy";
  note?: string;
};
type CatalogSubsection = { id: string; title: string; note?: string; fields: CatalogField[] };
type CatalogSection = { id: string; title: string; subsections: CatalogSubsection[] };
type Catalog = { sections: CatalogSection[] };

async function main() {
  const catalogPath = new URL("../docs/pir/pir-catalog.json", import.meta.url);
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as Catalog;

  const rows: InsertPirQuestion[] = [];
  let order = 0;
  for (const section of catalog.sections) {
    for (const sub of section.subsections) {
      for (const f of sub.fields) {
        rows.push({
          code: f.code,
          sectionId: section.id,
          section: section.title,
          subsectionId: sub.id,
          subsection: sub.title,
          label: f.label,
          valueType: f.type,
          subject: f.subject,
          options: f.options ?? null,
          paired: f.paired ?? null,
          note: f.note ?? sub.note ?? null,
          sortOrder: order++,
        });
      }
    }
  }

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = await mysql.createPool(process.env.DATABASE_URL);
  const db = drizzle(pool);

  console.log(`Seeding ${rows.length} PIR questions across ${catalog.sections.length} sections…`);
  await db.delete(pirQuestions);
  // Chunk inserts to stay well under MySQL's bound-parameter limit.
  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(pirQuestions).values(rows.slice(i, i + 100));
  }
  console.log(`Done. Seeded ${rows.length} PIR questions.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
