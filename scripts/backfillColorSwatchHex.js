/** One-off: fills in ProductOption.extra (hex swatch) for existing "color" options that have
 * none — the UI renders the swatch from `extra`, falling back to a flat grey when it's null,
 * which is why every colour option looked identical before this ran. */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const COLOR_HEX_RULES = [
  [/rose\s*gold/, "#B76E79"],
  [/space\s*gr[ae]y/, "#4B4B4D"],
  [/midnight/, "#1B1B2F"],
  [/phantom\s*black/, "#0B0B0C"],
  [/jet\s*black/, "#0A0A0A"],
  [/graphite/, "#48494B"],
  [/titanium/, "#8A8D8F"],
  [/icy\s*blue/, "#A8C6DA"],
  [/navy/, "#1F2A44"],
  [/lavender/, "#C4B7DE"],
  [/lilac/, "#C8A2C8"],
  [/violet/, "#7F5AA3"],
  [/mint/, "#98D8C1"],
  [/sage/, "#9CAF88"],
  [/champagne/, "#E8DAB2"],
  [/cream/, "#F2E8D5"],
  [/beige/, "#D8C4A5"],
  [/bronze/, "#8C5A2B"],
  [/copper/, "#B06A3A"],
  [/coral/, "#FF7F6B"],
  [/mauve/, "#9C7C8C"],
  [/burgundy/, "#5E1F30"],
  [/maroon/, "#5C1A24"],
  [/teal/, "#1F7A73"],
  [/turquoise/, "#30C6C0"],
  [/charcoal/, "#3A3B3C"],
  [/slate/, "#6B7684"],
  [/oxford\s*gr[ae]y/, "#41444B"],
  [/pearl/, "#EDEDED"],
  [/ivory/, "#F4F0E6"],
  [/black/, "#161616"],
  [/white/, "#FAFAFA"],
  [/silver/, "#C7C9CC"],
  [/gr[ae]y/, "#8B8D90"],
  [/gold/, "#D4AF6A"],
  [/blue/, "#2F6FB0"],
  [/green/, "#3E8E5A"],
  [/red/, "#C4342B"],
  [/pink/, "#E58AA5"],
  [/purple/, "#7A4FA0"],
  [/yellow/, "#E8C93A"],
  [/orange/, "#E07A2F"],
  [/brown/, "#6B4A31"],
  [/khaki/, "#B3A369"],
  [/olive/, "#6B6E3A"],
  [/peach/, "#F5B695"],
  [/lime/, "#A8D64A"],
  [/chocolate/, "#4A2E1F"],
  [/melon/, "#F7A399"],
  [/starlight/, "#EDE6D6"],
];

function colorNameToHex(label) {
  const n = label.toLowerCase();
  for (const [re, hex] of COLOR_HEX_RULES) {
    if (re.test(n)) return hex;
  }
  return null;
}

async function main() {
  const options = await prisma.productOption.findMany({
    where: { kind: "color", OR: [{ extra: null }, { extra: "" }] },
    select: { id: true, label: true },
  });
  console.log(`Found ${options.length} color options with no swatch hex`);

  let updated = 0;
  let unmatched = 0;
  const unmatchedLabels = new Set();
  for (const opt of options) {
    const hex = colorNameToHex(opt.label);
    if (!hex) {
      unmatched++;
      unmatchedLabels.add(opt.label);
      continue;
    }
    await prisma.productOption.update({ where: { id: opt.id }, data: { extra: hex } });
    updated++;
  }

  console.log(`Updated ${updated}, no match for ${unmatched}`);
  if (unmatchedLabels.size) {
    console.log("Unmatched labels (sample):", [...unmatchedLabels].slice(0, 30).join(", "));
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
