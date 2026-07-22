/** One-off import of the "The Phone Shop" Shopify product export into the live catalog.
 * Reads the CSV from Downloads, groups the Shopify row-per-image/variant layout back into
 * one product per Handle, and creates products with images, colour variants, and a
 * specifications list built from the Shopify metafield columns.
 *
 * Usage: node scripts/importPhoneShopCsv.js [path-to-csv]
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { randomBytes } = require("crypto");
const { parse } = require("csv-parse/sync");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const CSV_PATH = process.argv[2] || path.join(os.homedir(), "Downloads", "products_export_1.csv");
const STORE_NAME = process.argv[3] || "Veluntra";
// When true, phone/tablet CSV rows whose (model, storage) already exists among the store's
// real-brand products are skipped instead of created — used on production's "My Store",
// which already stocks an overlapping refurbished-phone catalog under a different SKU scheme.
const SKIP_MODEL_DUPES = process.argv[4] === "--skip-dupes";

// ---------- Duplicate-model detection (only used when SKIP_MODEL_DUPES is set) ----------

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

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function randomCode(length = 5) {
  return randomBytes(length).toString("hex").slice(0, length).toUpperCase();
}

// ---------- Category mapping ----------

const NEW_CATEGORIES = ["Phone Cases", "Screen & Camera Protection", "Chargers & Cables", "Phone Holders & Mounts"];

function categoryForRow(row) {
  const type = (row.Type || "").trim().toLowerCase();
  const byType = {
    phone: "Mobile & Tablets",
    tab: "Mobile & Tablets",
    cases: "Phone Cases",
    "screen protector": "Screen & Camera Protection",
    "camera protector": "Screen & Camera Protection",
    "phone holder": "Phone Holders & Mounts",
    charger: "Chargers & Cables",
    cables: "Chargers & Cables",
    adapter: "Chargers & Cables",
    "power bank": "Chargers & Cables",
    speaker: "Audio",
    "head phone": "Audio",
  };
  if (byType[type]) return byType[type];

  const productCategory = (row["Product Category"] || "").toLowerCase();
  if (productCategory.includes("tablet") || productCategory.includes("telephony") || productCategory.includes("mobile")) {
    return "Mobile & Tablets";
  }
  return "Mobile & Tablets";
}

// ---------- Brand detection ----------

const BRAND_KEYWORDS = [
  ["Apple", ["iphone", "ipad", "apple"]],
  ["Samsung", ["samsung", "galaxy"]],
  ["Google", ["google", "pixel"]],
  ["Huawei", ["huawei"]],
  ["Xiaomi", ["xiaomi", "redmi", "poco"]],
  ["OnePlus", ["oneplus"]],
  ["Oppo", ["oppo"]],
  ["Vivo", ["vivo"]],
  ["Realme", ["realme"]],
  ["Sony", ["sony", "xperia"]],
  ["Nokia", ["nokia"]],
  ["Motorola", ["motorola", "moto "]],
  ["Honor", ["honor"]],
  ["Nothing", ["nothing phone"]],
  ["Microsoft", ["microsoft", "surface"]],
  ["Amazon", ["kindle", "fire hd", "amazon"]],
  ["ZTE", ["zte"]],
  ["Alcatel", ["alcatel"]],
  ["Doro", ["doro "]],
];
// Accessory house-brands used by this supplier — identified by title prefix, not a
// substring anywhere in the title (avoids false hits from generic words).
const PREFIX_BRANDS = [
  [/^wyeflow/i, "WYEFLOW"],
  [/^wyelock/i, "WYELOCK"],
  [/^wyeflux/i, "WYEFLUX"],
  [/^wyflux/i, "WYEFLUX"], // supplier typo variant seen in the source data
  [/^wyewave/i, "WYEWAVE"],
  [/^earldom/i, "Earldom"],
  [/^top ?gift/i, "Top Gift"],
];
const FALLBACK_BRAND = "The Phone Shop";

function brandForTitle(title) {
  const prefixMatch = PREFIX_BRANDS.find(([re]) => re.test(title));
  if (prefixMatch) return prefixMatch[1];
  const t = title.toLowerCase();
  for (const [brand, keywords] of BRAND_KEYWORDS) {
    if (keywords.some((k) => t.includes(k))) return brand;
  }
  return FALLBACK_BRAND;
}

// ---------- Text helpers ----------

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
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

const ACRONYMS = {
  gps: "GPS", nfc: "NFC", lte: "LTE", "5g": "5G", "4g": "4G", "3g": "3G", sim: "SIM",
  ip68: "IP68", ip67: "IP67", ip65: "IP65", ip54: "IP54", oled: "OLED", lcd: "LCD",
  amoled: "AMOLED", usb: "USB", hd: "HD", uk: "UK", led: "LED",
};

// Whole-token overrides for compounds that shouldn't be split-and-space-joined generically.
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
  const cleaned = raw.trim().replace(/-\d+$/, ""); // strip Shopify swatch-disambiguation suffix like "black-5"
  const override = TOKEN_OVERRIDES[cleaned.toLowerCase()];
  if (override) return override;
  return cleaned.split(/[-_]/).map(titleCaseWord).join(" ");
}

function humanizeValueList(raw) {
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(humanizeToken)
    .join(", ");
}

// Metafield columns worth surfacing as product specifications (label -> CSV header substring).
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

function detectCondition(title) {
  if (/brand new/i.test(title)) return "Brand New";
  if (/open(ed)?[\s-]*(never used|box)/i.test(title)) return "Open Box";
  return null;
}

function mapStatus(csvStatus) {
  if (csvStatus === "active") return "published";
  if (csvStatus === "unlisted") return "hidden";
  return "draft";
}

async function generateUniqueSlug(base, existingSlugs) {
  let candidate = base;
  let i = 1;
  while (existingSlugs.has(candidate) || (await prisma.product.findUnique({ where: { slug: candidate } }))) {
    candidate = `${base}-${i++}`;
  }
  existingSlugs.add(candidate);
  return candidate;
}

async function generateUniqueSku(prefix, existingSkus) {
  let candidate = `${prefix}-${randomCode()}`;
  while (existingSkus.has(candidate) || (await prisma.product.findUnique({ where: { sku: candidate } }))) {
    candidate = `${prefix}-${randomCode()}`;
  }
  existingSkus.add(candidate);
  return candidate;
}

async function main() {
  console.log("Reading CSV from", CSV_PATH);
  const content = fs.readFileSync(CSV_PATH, "utf8");
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });
  console.log(`Parsed ${records.length} rows`);

  // Build a lookup from short label -> exact CSV header (headers include the full metafield path).
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
  // Shopify continuation rows leave Title/Body/Vendor/etc. blank; carry the first row's values forward.
  for (const rows of byHandle.values()) {
    const first = rows[0];
    for (const row of rows) {
      if (!row.Title) row.Title = first.Title;
    }
  }
  console.log(`Grouped into ${byHandle.size} products`);

  const store = await prisma.store.findFirst({ where: { name: STORE_NAME } });
  if (!store) throw new Error(`Store "${STORE_NAME}" not found`);

  const categories = await prisma.category.findMany();
  const categoryByName = new Map(categories.map((c) => [c.name, c]));
  for (const name of NEW_CATEGORIES) {
    if (categoryByName.has(name)) continue;
    const created = await prisma.category.create({ data: { name, slug: slugify(name) } });
    categoryByName.set(name, created);
    console.log("Created category:", name);
  }

  const brands = await prisma.brand.findMany();
  const brandByName = new Map(brands.map((b) => [b.name, b]));
  const neededBrands = new Set([
    FALLBACK_BRAND,
    ...BRAND_KEYWORDS.map(([b]) => b),
    ...PREFIX_BRANDS.map(([, b]) => b),
  ]);
  for (const name of neededBrands) {
    if (brandByName.has(name)) continue;
    const created = await prisma.brand.create({ data: { name, slug: slugify(name) } });
    brandByName.set(name, created);
    console.log("Created brand:", name);
  }

  const existingSlugs = new Set((await prisma.product.findMany({ select: { slug: true } })).map((p) => p.slug));
  const existingSkus = new Set((await prisma.product.findMany({ select: { sku: true } })).map((p) => p.sku));

  let existingDupeKeys = new Set();
  if (SKIP_MODEL_DUPES) {
    const realBrandProducts = await prisma.product.findMany({
      where: { brand: { name: { in: ["Samsung", "Apple", "Google", "OnePlus"] } } },
      select: { name: true },
    });
    existingDupeKeys = new Set(realBrandProducts.map((p) => dupeKeyFor(p.name)).filter(Boolean));
    console.log(`Duplicate-skip enabled: ${existingDupeKeys.size} existing model+storage keys loaded`);
  }

  let created = 0;
  let skipped = 0;
  let skippedDupes = 0;
  const errors = [];

  for (const [handle, rows] of byHandle) {
    try {
      const first = rows[0];
      const title = first.Title.trim();
      if (!title) { skipped++; continue; }

      const slug = slugify(handle) || slugify(title);
      if (existingSlugs.has(slug)) { skipped++; continue; } // already imported (safe re-run)

      if (SKIP_MODEL_DUPES) {
        const key = dupeKeyFor(title);
        if (key && existingDupeKeys.has(key)) { skippedDupes++; continue; }
      }

      const category = categoryByName.get(categoryForRow(first));
      const brandName = brandForTitle(title);
      const brand = brandByName.get(brandName);

      const variantRows = rows.filter((r) => (r["Variant Price"] || "").trim() !== "");
      if (variantRows.length === 0) { skipped++; continue; }

      const images = [];
      const seenImg = new Set();
      for (const r of rows) {
        const src = (r["Image Src"] || "").trim();
        if (!src || seenImg.has(src)) continue;
        seenImg.add(src);
        images.push({ url: src, position: Number(r["Image Position"]) || images.length + 1 });
      }
      images.sort((a, b) => a.position - b.position);

      const specifications = buildSpecifications(first, columnLookup);
      const description = stripHtml(first["Body (HTML)"]);
      const condition = detectCondition(title);
      const status = mapStatus((first.Status || "").trim());
      const tags = (first.Tags || "").split(",").map((t) => t.trim()).filter(Boolean);

      const parentPrice = Number(variantRows[0]["Variant Price"]);
      const parentOldPrice = variantRows[0]["Variant Compare At Price"]
        ? Number(variantRows[0]["Variant Compare At Price"])
        : null;
      const totalStock = variantRows.reduce((sum, r) => sum + (Number(r["Variant Inventory Qty"]) || 0), 0);

      const skuPrefix = `${(category?.slug || "gen").slice(0, 3)}-${(brand?.slug || "gen").slice(0, 3)}`.toUpperCase();
      const productSku = await generateUniqueSku(skuPrefix, existingSkus);
      const uniqueSlug = await generateUniqueSlug(slug, existingSlugs);

      let options = [];
      let variants = [];
      if (variantRows.length > 1) {
        const colourFor = (r) => humanizeToken(r["Option1 Value"] || "");
        const distinctColours = [...new Set(variantRows.map(colourFor).filter(Boolean))];
        options = distinctColours.map((label) => ({ kind: "color", label, extra: null, inStock: true }));
        variants = [];
        for (const r of variantRows) {
          const colour = colourFor(r);
          const price = Number(r["Variant Price"]);
          variants.push({
            sku: await generateUniqueSku(`${skuPrefix}-VAR`, existingSkus),
            combination: colour ? { color: colour } : {},
            price: price !== parentPrice ? price : null,
            stock: Number(r["Variant Inventory Qty"]) || 0,
            imageUrl: r["Variant Image"] || null,
          });
        }
      }

      await prisma.product.create({
        data: {
          storeId: store.id,
          categoryId: category.id,
          brandId: brand.id,
          name: title,
          slug: uniqueSlug,
          sku: productSku,
          description,
          price: parentPrice,
          oldPrice: parentOldPrice,
          stock: totalStock,
          status,
          condition,
          tags,
          specifications,
          images: { create: images },
          options: options.length ? { create: options } : undefined,
          variants: variants.length ? { create: variants } : undefined,
        },
      });
      created++;
      if (created % 50 === 0) console.log(`... ${created} created`);
    } catch (err) {
      errors.push({ handle, message: err.message });
    }
  }

  console.log(
    `\nDone. Created ${created}, skipped ${skipped} (already existed / no data)` +
      (SKIP_MODEL_DUPES ? `, skipped ${skippedDupes} (duplicate model already in catalog).` : ".")
  );
  if (errors.length) {
    console.log(`${errors.length} errors:`);
    errors.slice(0, 20).forEach((e) => console.log(`  - ${e.handle}: ${e.message}`));
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
