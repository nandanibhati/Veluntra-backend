/** Compares the Phone Shop CSV catalog against production's existing real-brand products
 * (Samsung/Apple/Google/OnePlus under "My Store") to flag likely duplicate model+storage
 * combinations before importing — run read-only, makes no DB writes. */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { parse } = require("csv-parse/sync");
const { PrismaClient } = require("@prisma/client");

const CSV_PATH = process.argv[2] || path.join(os.homedir(), "Downloads", "products_export_1.csv");

function extractStorage(name) {
  const m = name.match(/(\d+)\s?gb/i);
  return m ? `${m[1]}gb` : null;
}

function extractModel(name) {
  const n = name.toLowerCase();
  let m;
  if ((m = n.match(/iphone\s*(\d+)\s*(pro\s*max|pro|plus|mini|e)?/))) {
    return `iphone ${m[1]}${m[2] ? " " + m[2].trim() : ""}`.trim();
  }
  if ((m = n.match(/ipad\s*(pro\s*)?(\d+)\w*\s*gen/))) {
    return `ipad ${m[1] || ""}${m[2]}gen`.trim();
  }
  if ((m = n.match(/galaxy\s*(tab\s*)?([a-z]?\d+\w*)\s*(ultra|plus|fe)?/))) {
    return `galaxy ${m[1] || ""}${m[2]}${m[3] ? " " + m[3] : ""}`.trim();
  }
  if ((m = n.match(/\b([as]\d{2,3}\w*)\b/))) {
    return `galaxy ${m[1]}`;
  }
  if ((m = n.match(/\btab\s*([a-z0-9]+)\b/))) {
    return `tab ${m[1]}`;
  }
  if ((m = n.match(/z\s*(fold|flip)\s*(\d+)?/))) {
    return `z ${m[1]}${m[2] ? m[2] : ""}`;
  }
  if ((m = n.match(/pixel\s*(\d+\w*)/))) {
    return `pixel ${m[1]}`;
  }
  if ((m = n.match(/oneplus\s*(\d+\w*)/))) {
    return `oneplus ${m[1]}`;
  }
  return null;
}

function keyFor(name) {
  const model = extractModel(name);
  const storage = extractStorage(name);
  if (!model) return null;
  return `${model}|${storage || "?"}`;
}

async function main() {
  const prisma = new PrismaClient();
  const prodProducts = await prisma.product.findMany({
    where: { brand: { name: { in: ["Samsung", "Apple", "Google", "OnePlus"] } } },
    select: { name: true, sku: true },
  });
  await prisma.$disconnect();

  const prodByKey = new Map();
  for (const p of prodProducts) {
    const key = keyFor(p.name);
    if (!key) continue;
    if (!prodByKey.has(key)) prodByKey.set(key, []);
    prodByKey.get(key).push(p.name);
  }

  const content = fs.readFileSync(CSV_PATH, "utf8");
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });
  const byHandle = new Map();
  for (const row of records) {
    if (!byHandle.has(row.Handle)) byHandle.set(row.Handle, []);
    byHandle.get(row.Handle).push(row);
  }
  for (const rows of byHandle.values()) {
    const first = rows[0];
    for (const row of rows) if (!row.Title) row.Title = first.Title;
  }

  const matches = [];
  const noMatch = [];
  for (const [handle, rows] of byHandle) {
    const title = rows[0].Title?.trim();
    if (!title) continue;
    const key = keyFor(title);
    if (key && prodByKey.has(key)) {
      matches.push({ csvTitle: title, key, existing: prodByKey.get(key) });
    } else if (key) {
      noMatch.push({ csvTitle: title, key });
    }
  }

  console.log(`CSV products with a recognized phone/tablet model+storage key: ${matches.length + noMatch.length}`);
  console.log(`Likely duplicates (same model+storage already in "My Store"): ${matches.length}\n`);
  matches.slice(0, 40).forEach((m) => {
    console.log(`CSV: "${m.csvTitle}"`);
    console.log(`  -> matches existing: ${m.existing.join(" | ")}\n`);
  });
  if (matches.length > 40) console.log(`... and ${matches.length - 40} more matches\n`);

  console.log(`\nNo likely duplicate found for ${noMatch.length} CSV products (sample):`);
  noMatch.slice(0, 15).forEach((m) => console.log(`  - ${m.csvTitle}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
