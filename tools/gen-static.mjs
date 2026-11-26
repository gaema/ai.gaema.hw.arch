// Writes the files a reader without JavaScript depends on, from the same
// registry the pages read, so they cannot drift from the site:
//
//   index.html   the card list between the sku-index markers (landing.js
//                replaces it with the full cards once it runs), and the
//                site's WebSite JSON-LD between the page-meta markers
//   sitemap.xml  every page with its own URL; redirect stubs are left out
//   llms.txt     a short plain-text index of the site
//   <page>/index.html, for every sitemap page but the home page:
//                a canonical link (and a description if the shell has none)
//                and the page's JSON-LD (TechArticle; a part page's names the
//                accelerator) between the page-meta markers, and its content as
//                plain HTML between the page-static markers -- a part's spec
//                card, or a comparison page's tables. explorer.js and
//                compare.js remove that block once they have built the page.
//                On a shell with no markers yet, the block takes the place of
//                the shell's <noscript> note.
//
// robots.txt is static and is not written here.
//
//   node tools/gen-static.mjs          rewrite the files
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

const META_START = "<!-- page-meta:start -->";
const META_END = "<!-- page-meta:end -->";
const BODY_START = "<!-- page-static:start -->";
const BODY_END = "<!-- page-static:end -->";

const mod = (rel) => import(pathToFileURL(join(ROOT, rel)).href);
const { loadAll, pageHref, specRows } = await mod("data/index.js");
const {
  FORMATS, FORMAT_ORDER, FIGURES, UNSTATED, BANDWIDTH, BANDWIDTH_UNIT, SPARSITY, SRC_CLASS,
} = await mod("data/_throughput.js");
const {
  fmtNum, accFor, levelFor, gapText, throughputTitle, throughputLede,
  THROUGHPUT_HEAD, BANDWIDTH_HEAD, UNSTATED_HEAD, BANDWIDTH_LEDE, UNSTATED_LEDE,
} = await mod("assets/compare-rows.js");
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
  const html = current.slice(0, a) + cardsHtml() + current.slice(b + END.length);
  const metaRegion = `${META_START}\n${ldScript(homeLd())}\n${META_END}`;
  return splice(html, META_START, META_END, metaRegion,
    (h) => h.replace(/(\n)(<link rel="stylesheet")/, `$1${metaRegion}\n$2`), "index.html");
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

// ---------------------------------------------------------------------------
// Deep pages: the same content the page scripts build, as plain HTML.

const byId = new Map(skus.map((s) => [s.id, s]));
const NOSCRIPT_TAIL = " There is no tracking here and no third-party code &mdash; everything is "
  + "served from this domain.";

const dl = (rows, id) => `    <dl class="spec-grid"${id ? ` id="${id}"` : ""}>\n`
  + rows.map(([k, v]) => `      <div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("\n")
  + "\n    </dl>";

// The spec card explorer.js renders: name, tagline, the spine, the
// vendor-specific rows and the sources.
function skuBlock(s) {
  const out = [
    `    <h1>${esc(s.name)}</h1>`,
    `    <p>${esc(s.vendor)} · ${esc(subtitle(s))}</p>`,
    `    <p>${esc(s.tagline)}</p>`,
    dl(specRows(s)),
  ];
  if (s.extra && s.extra.length) {
    out.push(`    <h2 class="section-h sub">${esc(s.arch)} specifics</h2>`, dl(s.extra));
  }
  if (s.dieNote) out.push(`    <p class="note">${esc(s.dieNote)}</p>`);
  if (s.sources && s.sources.length) {
    out.push(`    <div class="sources"><h2>Sources</h2><ul>`
      + s.sources.map(([label, url]) => `<li><a href="${esc(url)}" rel="noopener">${esc(label)}</a></li>`).join("")
      + `</ul></div>`);
  }
  return {
    noscript: "<strong>The diagrams need JavaScript.</strong> The die map and the hierarchy "
      + "are built in the browser from the same data module as the spec card below, so with "
      + "scripting off only the card is shown." + NOSCRIPT_TAIL,
    body: out.join("\n"),
    description: firstSentence(s.tagline),
  };
}

// The source cell compare.js draws, as text and a link.
function srcHtml(src, sku, base) {
  if (src.cls === "site") {
    return `<a href="${esc(base + pageHref(sku))}">on this site</a> <small>· ${esc(SRC_CLASS.site)}</small>`;
  }
  const a = `<a href="${esc(src.href)}" rel="noopener">${esc(src.text)}</a>`;
  if (src.cls === "derived") return `${a} <small>· ${esc(src.formula)} — ${esc(SRC_CLASS.derived)}</small>`;
  return `${a} <small>· ${esc(SRC_CLASS.vendor)}</small>`;
}

const tr = (cells) => "        <tr>" + cells.join("") + "</tr>";
const td = (html, attrs = "") => `<td${attrs}>${html}</td>`;

function tableHtml(head, rows) {
  return `    <div class="scroll-x"><table class="matrix">\n`
    + `      <thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>\n`
    + `      <tbody>\n${rows.join("\n")}\n      </tbody>\n    </table></div>`;
}

const sectionHtml = (title, lede, inner) => `    <section class="block">\n`
  + `    <h2>${esc(title)}</h2>\n`
  + (lede ? `    <p class="lede">${esc(lede)}</p>\n` : "")
  + `${inner}\n    </section>`;

// compare.js throughputBlock, without the bars (the table holds the same rows).
function throughputHtml(cls, formats, base) {
  return formats.map((fk) => {
    const figs = FIGURES.filter((f) => f.cls === cls && f.format === fk);
    const rows = [];
    for (const sku of skus) {
      const mine = figs.filter((f) => f.sku === sku.id);
      const acc = accFor(sku.id, fk);
      if (!mine.length) {
        rows.push(tr([`<th>${esc(sku.name)}</th>`, td(esc(sku.vendor)),
          td(esc(gapText(cls, levelFor(sku.id, fk))), ' colspan="5"')]));
        continue;
      }
      for (const f of mine) {
        rows.push(tr([`<th>${esc(sku.name)}</th>`, td(esc(sku.vendor)),
          td(esc(f.quoted || FORMATS[fk].label)),
          td(esc(acc || (cls === "vector" ? "vector lanes" : "—"))),
          td(esc(SPARSITY[f.sparsity].label)),
          td(esc(fmtNum(f.value) + " " + f.unit)),
          td(srcHtml(f.src, sku, base))]));
        rows.push(tr([td(esc(f.basis), ' colspan="7"')]));
      }
    }
    return sectionHtml(throughputTitle(cls, fk), throughputLede(cls, fk, figs.length > 0),
      tableHtml(THROUGHPUT_HEAD, rows));
  });
}

function bandwidthHtml(base) {
  const rows = [];
  for (const b of BANDWIDTH) {
    const sku = byId.get(b.sku);
    rows.push(tr([`<th>${esc(sku.name)}</th>`, td(esc(sku.vendor)),
      td(esc(sku.compare["Memory"] || "—")), td(esc(b.scope)),
      td(esc(fmtNum(b.value) + " " + BANDWIDTH_UNIT)), td(srcHtml(b.src, sku, base))]));
    rows.push(tr([td(esc(b.basis), ' colspan="6"')]));
  }
  return [sectionHtml("Memory bandwidth", BANDWIDTH_LEDE, tableHtml(BANDWIDTH_HEAD, rows))];
}

function unstatedHtml(base) {
  if (!UNSTATED.length) return [];
  const rows = [];
  for (const u of UNSTATED) {
    const sku = byId.get(u.sku);
    rows.push(tr([`<th>${esc(sku.name)}</th>`, td(esc(u.quoted)),
      td(esc(fmtNum(u.value) + " " + u.unit)), td(srcHtml(u.src, sku, base))]));
    rows.push(tr([td(esc(u.why), ' colspan="4"')]));
  }
  return [sectionHtml("Quoted with no stated basis", UNSTATED_LEDE, tableHtml(UNSTATED_HEAD, rows))];
}

// The same branches as compare.js's entry point.
function compareBlock(path, html, base) {
  const view = (/<body[^>]*\sdata-view="([^"]*)"/.exec(html) || [])[1] || "";
  const format = (/<body[^>]*\sdata-format="([^"]*)"/.exec(html) || [])[1] || "";
  const parts = [];
  let description = null;
  if (format) {
    const f = FORMATS[format];
    if (!f) throw new Error(`${path}: unknown data-format "${format}"`);
    parts.push(`    <p>${esc(f.lede)}</p>`);
    parts.push(...throughputHtml("vector", [format], base), ...throughputHtml("systolic", [format], base));
    description = firstSentence(f.lede);
  } else if (view === "bandwidth") {
    parts.push(...bandwidthHtml(base));
  } else if (view === "vector" || view === "systolic") {
    const present = FORMAT_ORDER.filter((k) => FIGURES.some((f) => f.cls === view && f.format === k));
    parts.push(...throughputHtml(view, present, base));
    if (view === "systolic") parts.push(...unstatedHtml(base));
  } else {
    throw new Error(`${path}: not a part page and names no data-view or data-format`);
  }
  return {
    noscript: "<strong>The charts need JavaScript.</strong> The bars are drawn in the browser "
      + "from the same data module as the tables below, so with scripting off only the tables "
      + "are shown." + NOSCRIPT_TAIL,
    body: parts.join("\n"),
    description,
  };
}

// Replace the text between two markers, or insert the marked region where
// `fallback` says if the markers are not there yet.
function splice(html, start, end, region, fallback, file) {
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  if (a >= 0 && b > a) return html.slice(0, a) + region + html.slice(b + end.length);
  if (a >= 0 || b >= 0) throw new Error(`${file}: unpaired ${start} / ${end}`);
  const out = fallback(html);
  if (out === html) throw new Error(`${file}: no place to put ${start}`);
  return out;
}

// ---------------------------------------------------------------------------
// JSON-LD: a type for every page, so a crawler knows a part page describes one
// accelerator and a comparison page compares them, and that both belong to one
// site published by gaema.

const PUBLISHER = { "@type": "Organization", name: "gaema", url: "https://gaema.ai/" };
const WEBSITE = { "@type": "WebSite", name: "arch.hw.gaema.ai", url: ORIGIN, publisher: PUBLISHER };

// "<" is escaped so no string in the data can close the script element.
const ldScript = (obj) => `<script type="application/ld+json">`
  + JSON.stringify({ "@context": "https://schema.org", ...obj }).replace(/</g, "\\u003c")
  + `</script>`;

const shellDescription = (html) => {
  const m = /<meta name="description" content="([^"]*)"/.exec(html);
  return m ? m[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") : "";
};

function pageLd(page, sku, description) {
  const base = {
    "@type": "TechArticle",
    url: ORIGIN + page.path,
    description,
    inLanguage: "en",
    isAccessibleForFree: true,
    isPartOf: WEBSITE,
    publisher: PUBLISHER,
  };
  if (!sku) return { ...base, headline: page.title };
  return {
    ...base,
    headline: `${sku.vendor} ${sku.name} architecture`,
    about: {
      "@type": "Product",
      name: `${sku.vendor} ${sku.name}`,
      brand: { "@type": "Brand", name: sku.vendor },
      category: "AI accelerator",
    },
  };
}

function homeLd() {
  return {
    ...WEBSITE,
    description: "Interactive architecture diagrams of AI accelerators, each drawn to the same structure.",
    inLanguage: "en",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: skus.map((s, i) => ({
        "@type": "ListItem", position: i + 1, name: `${s.vendor} ${s.name}`, url: ORIGIN + pageHref(s),
      })),
    },
  };
}

function deepPage(page, current) {
  const file = page.path + "index.html";
  const base = "../".repeat(page.path.split("/").filter(Boolean).length);
  const sku = skus.find((s) => pageHref(s) === page.path);
  const block = sku ? skuBlock(sku) : compareBlock(page.path, current, base);

  // Head: canonical, plus a description only when the shell has none of its own,
  // plus the page's JSON-LD.
  const unmarked = current.replace(
    new RegExp(`${META_START}[\\s\\S]*?${META_END}`), "");
  const meta = [`<link rel="canonical" href="${esc(ORIGIN + page.path)}">`];
  const ownDescription = shellDescription(unmarked);
  if (!ownDescription) {
    if (!block.description) throw new Error(`${file}: no description in the shell and none in the registry`);
    meta.push(`<meta name="description" content="${esc(block.description)}">`);
  }
  meta.push(ldScript(pageLd(page, sku, ownDescription || block.description)));
  const metaRegion = `${META_START}\n${meta.join("\n")}\n${META_END}`;
  let html = splice(current, META_START, META_END, metaRegion,
    (h) => h.replace(/(\n)(<link rel="stylesheet")/, `$1${metaRegion}\n$2`), file);

  // Body: the shell's noscript note plus the static content.
  const bodyRegion = `${BODY_START}\n`
    + `  <noscript>\n    <p class="load-error">${block.noscript}</p>\n  </noscript>\n`
    + `  <div class="static-page" id="static-page">\n${block.body}\n  </div>\n  ${BODY_END}`;
  html = splice(html, BODY_START, BODY_END, bodyRegion,
    (h) => h.replace(/<noscript>[\s\S]*?<\/noscript>/, bodyRegion), file);
  return [file, html];
}

const read = (f) => (existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f), "utf8") : "");
const deep = [...skus.map((s) => all.find((p) => p.path === pageHref(s))), ...others];
const outputs = {
  "index.html": indexHtml(read("index.html")),
  "sitemap.xml": sitemap(read("sitemap.xml")),
  "llms.txt": llms(),
  ...Object.fromEntries(deep.map((p) => deepPage(p, read(p.path + "index.html")))),
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
  console.log(`up to date: ${skus.length} cards, ${1 + skus.length + others.length} sitemap URLs, `
    + `${deep.length} page bodies`);
}
