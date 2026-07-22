/** Fills in images/description/specifications on EXISTING real-brand products (Samsung/Apple/
 * Google/OnePlus) that currently have none, by matching them to the Phone Shop CSV export via
 * a model+storage key — no new products are created, only enrichment of what's already there.
 *
 * Usage: node scripts/enrichExistingPhonesFromCsv.js [path-to-csv]
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { parse } = require("csv-parse/sync");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const CSV_PATH = process.argv[2] || path.join(os.homedir(), "Downloads", "products_export_1.csv");

// ---------- Model+storage matcher (same heuristic used for the overlap check) ----------

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
  if ((m = n.match(/\btab\s*([a-z0-9]+(\s*plus)?)\b/))) {
    return `tab ${m[1].replace(/\s+/g, "")}`;
  }
  if ((m = n.match(/galaxy\s*(tab\s*)?([a-z]?\d+\w*)\s*(ultra|plus|fe)?/))) {
    return `galaxy ${m[1] || ""}${m[2]}${m[3] ? " " + m[3] : ""}`.trim();
  }
  if ((m = n.match(/\b([as]\d{2,3}\w*)\b/))) {
    return `galaxy ${m[1]}`;
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

function dupeKeyFor(name) {
  const model = extractModel(name);
  const storage = extractStorage(name);
  if (!model) return null;
  return `${model}|${storage || "?"}`;
}

// ---------- Text helpers (same as importPhoneShopCsv.js) ----------

const HTML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
function decodeEntities(str) {
  return str.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => HTML_ENTITIES[e]);
}
function stripHtml(html) {
  if (!html) return "";
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h[1-6]|div)>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "");
  text = decodeEntities(text);
  return text.split("\n").map((l) => l.trim()).filter(Boolean).join("\n").trim();
}

const ACRONYMS = {
  gps: "GPS", nfc: "NFC", lte: "LTE", "5g": "5G", "4g": "4G", "3g": "3G", sim: "SIM",
  ip68: "IP68", ip67: "IP67", ip65: "IP65", ip54: "IP54", oled: "OLED", lcd: "LCD",
  amoled: "AMOLED", usb: "USB", hd: "HD", uk: "UK", led: "LED",
};
const TOKEN_OVERRIDES = {
  "wi-fi": "Wi-Fi", "usb-c": "USB-C", "usb-type-c": "USB Type-C", "usb type-c": "USB Type-C",
  "type-c": "Type-C",
};
function titleCaseWord(w) {
  const key = w.toLowerCase();
  if (ACRONYMS[key]) return ACRONYMS[key];
  if (!w) return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}
function humanizeToken(raw) {
  const cleaned = raw.trim().replace(/-\d+$/, "");
  const override = TOKEN_OVERRIDES[cleaned.toLowerCase()];
  if (override) return override;
  return cleaned.split(/[-_]/).map(titleCaseWord).join(" ");
}
function humanizeValueList(raw) {
  return raw.split(";").map((s) => s.trim()).filter(Boolean).map(humanizeToken).join(", ");
}

const SPEC_COLUMNS = [
  "Battery technology", "Biometric authentication method", "Cellular capability",
  "Charging interface type", "Color", "Computer form", "Connectivity technology",
  "Cosmetic condition", "Data network", "Display resolution", "Display technology",
  "Energy efficiency class", "Graphics card type", "Ingress protection (IP) rating",
  "Memory technology", "Mobile phone form factor", "Operating system", "Power source",
  "Processor cores", "Processor family", "SIM card capability", "SIM card type",
  "Storage drive type installed", "Stylus support type", "Wi-Fi standard",
];

function buildSpecifications(row, columnLookup) {
  const specs = [];
  for (const label of SPEC_COLUMNS) {
    const header = columnLookup[label];
    const value = header && row[header];
    if (!value || !value.trim()) continue;
    specs.push({ label: label === "Color" ? "Available Colours" : label, value: humanizeValueList(value) });
  }
  return specs;
}

async function main() {
  console.log("Reading CSV from", CSV_PATH);
  const content = fs.readFileSync(CSV_PATH, "utf8");
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });

  const columnLookup = {};
  for (const header of Object.keys(records[0])) {
    for (const label of SPEC_COLUMNS) {
      if (header.startsWith(label)) columnLookup[label] = header;
    }
  }

  const byHandle = new Map();
  for (const row of records) {
    if (!byHandle.has(row.Handle)) byHandle.set(row.Handle, []);
    byHandle.get(row.Handle).push(row);
  }
  for (const rows of byHandle.values()) {
    const first = rows[0];
    for (const row of rows) if (!row.Title) row.Title = first.Title;
  }

  // Build model+storage -> best CSV candidate (prefer the one with the most images).
  const csvByKey = new Map();
  for (const rows of byHandle.values()) {
    const title = rows[0].Title?.trim();
    if (!title) continue;
    const key = dupeKeyFor(title);
    if (!key) continue;

    const images = [];
    const seen = new Set();
    for (const r of rows) {
      const src = (r["Image Src"] || "").trim();
      if (!src || seen.has(src)) continue;
      seen.add(src);
      images.push({ url: src, position: Number(r["Image Position"]) || images.length + 1 });
    }
    images.sort((a, b) => a.position - b.position);
    if (images.length === 0) continue;

    const candidate = {
      title,
      images,
      description: stripHtml(rows[0]["Body (HTML)"]),
      specifications: buildSpecifications(rows[0], columnLookup),
    };
    const existing = csvByKey.get(key);
    if (!existing || images.length > existing.images.length) csvByKey.set(key, candidate);
  }
  console.log(`Built ${csvByKey.size} model+storage -> image lookup keys from the CSV`);

  const prodProducts = await prisma.product.findMany({
    where: { brand: { name: { in: ["Samsung", "Apple", "Google", "OnePlus"] } } },
    include: { images: true },
  });

  let updated = 0;
  let noMatch = 0;
  let alreadyHasImages = 0;

  for (const p of prodProducts) {
    if (p.images.length > 0) { alreadyHasImages++; continue; }
    const key = dupeKeyFor(p.name);
    const match = key && csvByKey.get(key);
    if (!match) { noMatch++; continue; }

    const hasRealDescription = p.description && p.description.trim().length > 5;
    const hasRealSpecs = Array.isArray(p.specifications) && p.specifications.length > 0;

    await prisma.product.update({
      where: { id: p.id },
      data: {
        description: hasRealDescription ? undefined : match.description,
        specifications: hasRealSpecs ? undefined : match.specifications,
        images: { create: match.images.map((img) => ({ url: img.url, position: img.position })) },
      },
    });
    updated++;
    console.log(`Enriched "${p.name}" <- CSV "${match.title}" (${match.images.length} images)`);
  }

  console.log(`\nDone. Enriched ${updated}, no CSV match for ${noMatch}, already had images ${alreadyHasImages} (untouched). Total real-brand products: ${prodProducts.length}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
