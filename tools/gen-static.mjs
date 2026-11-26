// Writes the files a reader without JavaScript depends on, from the same
// registry the pages read, so they cannot drift from the site:
//
//   index.html   the card list between the sku-index markers (landing.js
//                replaces it with the full cards once it runs)
//   sitemap.xml  every page with its own URL; redirect stubs are left out
//   llms.txt     a short plain-text index of the site
//
// robots.txt is static and is not written here.
//
//   node tools/gen-static.mjs          rewrite the three files
//   node tools/gen-static.mjs --check  exit 1 if any of them is out of date
//   node tools/gen-static.mjs --touch  also set every sitemap lastmod to today
//
// A sitemap URL keeps the lastmod it already has; a new URL gets today's date.
// Run with Node 22 or later, from anywhere.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://arch.hw.gaema.ai/";
const START = "<!-- sku-index:start -->";
const END = "<!-- sku-index:end -->";

const args = new Set(process.argv.slice(2));
const CHECK = args.has("--check");
const TOUCH = args.has("--touch");
const TODAY = new Date().toISOString().slice(0, 10);

const { loadAll, pageHref } = await import(pathToFileURL(join(ROOT, "data/index.js")).href);
const skus = await loadAll();

const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The first sentence of a card's tagline: one plain line per part.
function firstSentence(text) {
  const m = /^(.*?[.!?])\s+(?=[A-Z])/.exec(text);
  return (m ? m[1] : text).trim();
}

// The same subtitle landing.js puts on a card.
const subtitle = (s) => (s.die && s.die !== s.arch ? s.arch + " · " + s.die : s.arch);

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen", "twenty"];
const count = (n) => WORDS[n] || String(n);

// Every page with its own URL: an index.html one or two directories down that
// is not a redirect stub (stubs carry robots noindex).
function pages() {
  const found = [];
  const walk = (rel, depth) => {
    for (const ent of readdirSync(join(ROOT, rel), { withFileTypes: true })) {
      if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
      const sub = rel ? `${rel}/${ent.name}` : ent.name;
      const file = join(ROOT, sub, "index.html");
      if (existsSync(file)) {
        const html = readFileSync(file, "utf8");
        if (!/<meta name="robots" content="noindex">/.test(html)) {
          const title = (/<title>(.*?)<\/title>/.exec(html) || [, sub])[1]
            .replace(/ — (arch\.hw\.gaema\.ai|GPU architecture explorer)$/, "");
          found.push({ path: sub + "/", title });
        }
      }
      if (depth < 2) walk(sub, depth + 1);
    }
  };
  walk("", 1);
  return found;
}

const all = pages();
const skuPaths = new Set(skus.map(pageHref));
const others = all.filter((p) => !skuPaths.has(p.path)).sort((a, b) => a.path.localeCompare(b.path));
for (const s of skus) {
  if (!all.some((p) => p.path === pageHref(s))) throw new Error(`no page shell for ${s.id} at ${pageHref(s)}`);
}

// index.html: the static card list.
function cardsHtml() {
  const lines = skus.map((s) =>
    `    <a class="card" href="${esc(pageHref(s))}" style="--card-accent: var(--v-${esc(s.vendorKey)})">`
    + `<span class="vendor">${esc(s.vendor)}</span>`
    + `<h3>${esc(s.name)}</h3>`
    + `<p class="arch">${esc(subtitle(s))}</p>`
    + `<p class="blurb">${esc(firstSentence(s.tagline))}</p></a>`);
  return `${START}\n${lines.join("\n")}\n    ${END}`;
}

function indexHtml(current) {
  const a = current.indexOf(START);
  const b = current.indexOf(END);
  if (a < 0 || b < a) throw new Error("index.html: sku-index markers not found");
  return current.slice(0, a) + cardsHtml() + current.slice(b + END.length);
}

// sitemap.xml
function sitemap(current) {
  const prior = new Map();
  for (const m of current.matchAll(/<loc>(.*?)<\/loc>\s*<lastmod>(.*?)<\/lastmod>/g)) prior.set(m[1], m[2]);
  const locs = [ORIGIN, ...skus.map((s) => ORIGIN + pageHref(s)), ...others.map((p) => ORIGIN + p.path)];
  const body = locs.map((loc) => {
    const lastmod = (!TOUCH && prior.get(loc)) || TODAY;
    return `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body.join("\n")}\n</urlset>\n`;
}

// llms.txt
function llms() {
  const vendors = [...new Set(skus.map((s) => s.vendor))];
  const vendorList = vendors.slice(0, -1).join(", ") + " and " + vendors[vendors.length - 1];
  const out = [
    "# arch.hw.gaema.ai",
    "",
    `> Interactive architecture diagrams of ${count(skus.length)} AI accelerators from ${vendorList}, `
      + "each drawn to the same structure: a die map showing where every block sits, and a hierarchy "
      + "that opens from the card down to the unit that does the multiply. Comparison pages set the "
      + "published throughput, memory bandwidth and numeric formats of every part side by side. "
      + "Every figure comes from published specifications; no measurements of our own appear here.",
    "",
    "## Accelerators",
    "",
    ...skus.map((s) => `- [${s.vendor} ${s.name}](${ORIGIN}${pageHref(s)}): ${firstSentence(s.tagline)}`),
    "",
    "## Comparisons",
    "",
    ...others.map((p) => `- [${p.title}](${ORIGIN}${p.path})`),
    "",
  ];
  return out.join("\n");
}

const read = (f) => (existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f), "utf8") : "");
const outputs = {
  "index.html": indexHtml(read("index.html")),
  "sitemap.xml": sitemap(read("sitemap.xml")),
  "llms.txt": llms(),
};

let stale = 0;
for (const [f, text] of Object.entries(outputs)) {
  if (read(f) === text) continue;
  if (CHECK) {
    console.error(`out of date: ${f}`);
    stale++;
  } else {
    writeFileSync(join(ROOT, f), text);
    console.log(`wrote ${f}`);
  }
}
if (CHECK) {
  if (stale) {
    console.error("run: node tools/gen-static.mjs");
    process.exit(1);
  }
  console.log(`up to date: ${skus.length} cards, ${1 + skus.length + others.length} sitemap URLs`);
}
