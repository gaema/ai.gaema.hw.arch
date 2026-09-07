// The comparison pages: throughput and bandwidth across parts, as a table and
// as bars.
//
// Both come from `data/_throughput.js` and the accumulate column comes from
// `data/_dtypes.js`, so nothing on these pages is a number typed into chart
// code. The table is the data; the bars are a second reading of the same rows
// and are hidden from assistive technology for exactly that reason.
//
// Three separations this file will not collapse:
//
//   * one chart per SPARSITY basis, never a mixed one;
//   * one chart per THROUGHPUT CLASS, because a vector FLOP and a systolic
//     FLOP are different units of work;
//   * an absence the silicon has no path for is drawn differently from an
//     absence nobody published a number for.
import { loadAll, pageHref } from "../data/index.js";
import { ARCH, SKU_ARCH } from "../data/_dtypes.js";
import {
  FORMATS, FORMAT_ORDER, FIGURES, UNSTATED, BANDWIDTH, BANDWIDTH_UNIT,
  CLASSES, SPARSITY, SRC_CLASS,
} from "../data/_throughput.js";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const base = document.body.dataset.base || "";

function fail(err) {
  const box = document.getElementById("view") || document.body;
  const p = el("p", "load-error");
  p.append(el("strong", null, "This page could not load its data. "));
  p.append(document.createTextNode(
    "The tables and the bars are both built in the browser from the same ES "
    + "modules; if something between you and the site is blocking or rewriting "
    + "JavaScript, the page comes up empty. Error: "
    + (err && err.message ? err.message : String(err))));
  box.append(p);
}

// Keep a fractional digit below four figures: rounding 104.9 to 105 in the bar
// while the basis line under it shows the arithmetic that gives 104.9 makes the
// page disagree with itself.
const fmtNum = (v) =>
  v.toLocaleString("en-US", { maximumFractionDigits: v >= 1000 ? 0 : 2 });

// A source cell. `site` points at the part's own page here, which lists where
// the figure came from; `vendor` points at the vendor; `derived` shows its
// arithmetic and points at the page the inputs are on.
function srcCell(src, sku) {
  const td = el("td", "src");
  if (src.cls === "site") {
    const a = el("a", null, "on this site");
    a.href = base + pageHref(sku);
    td.append(a);
    td.append(el("small", "src-cls", " · " + SRC_CLASS.site));
    return td;
  }
  const a = el("a", null, src.text);
  a.href = src.href;
  a.rel = "noopener";
  td.append(a);
  if (src.cls === "derived") {
    td.append(el("small", "src-cls", " · " + src.formula + " — " + SRC_CLASS.derived));
  } else {
    td.append(el("small", "src-cls", " · " + SRC_CLASS.vendor));
  }
  return td;
}

// What the architecture behind this part accumulates a given operand into.
// The rate is quoted for the OPERAND; the accumulate is a separate axis and
// this is where it comes from — never from the figure itself.
function accFor(skuId, format) {
  const arch = ARCH[SKU_ARCH[skuId]];
  if (!arch) return null;
  const levels = FORMATS[format].rows.map((r) => arch.dtypes[r] || { level: "none" });
  const matrix = levels.find((d) => d.level === "matrix");
  if (matrix) return matrix.acc;
  return null;
}

// The strongest support level the architecture has for this format, across the
// rows the format covers. This is what separates "no hardware path" from
// "supported, rate unpublished".
function levelFor(skuId, format) {
  const arch = ARCH[SKU_ARCH[skuId]];
  if (!arch) return "none";
  const rank = { none: 0, convert: 1, vector: 2, matrix: 3 };
  let best = "none";
  for (const r of FORMATS[format].rows) {
    const d = arch.dtypes[r] || { level: "none" };
    if (rank[d.level] > rank[best]) best = d.level;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Bars. One chart is one basis and one class, always, and its caption says so.
function chart(caption, rows) {
  const fig = el("figure", "chart");
  fig.append(el("figcaption", null, caption));
  const max = Math.max(...rows.map((r) => r.value));
  const ol = el("ol", "bars");
  ol.setAttribute("aria-hidden", "true");
  for (const r of rows) {
    const li = el("li");
    li.style.setProperty("--bar-ink", `var(--v-${r.vendorKey})`);
    const lab = el("span", "bar-label");
    lab.append(el("span", "bar-name", r.name));
    if (r.sub) lab.append(el("small", "bar-sub", r.sub));
    li.append(lab);
    const track = el("span", "bar-track");
    const bar = el("span", "bar");
    bar.style.setProperty("--w", (100 * r.value / max).toFixed(2) + "%");
    track.append(bar);
    li.append(track);
    li.append(el("span", "bar-value", fmtNum(r.value) + " " + r.unit));
    ol.append(li);
  }
  fig.append(ol);
  return fig;
}

function table(head, rows) {
  const wrap = el("div", "scroll-x");
  const t = el("table", "matrix");
  const thead = el("thead");
  const hr = el("tr");
  for (const h of head) hr.append(el("th", null, h));
  thead.append(hr);
  t.append(thead);
  const tb = el("tbody");
  for (const r of rows) tb.append(r);
  t.append(tb);
  wrap.append(t);
  return wrap;
}

function section(title, lede) {
  const s = el("section", "block");
  s.append(el("h2", null, title));
  if (lede) s.append(el("p", "lede", lede));
  return s;
}

// ---------------------------------------------------------------------------
// One throughput class, for one format or for everything in that class.
function throughputBlock(skus, cls, formats, headingPrefix) {
  const byId = new Map(skus.map((s) => [s.id, s]));
  const out = [];

  for (const fk of formats) {
    const figs = FIGURES.filter((f) => f.cls === cls && f.format === fk);
    const bases = ["dense", "sparse", "unstated"].filter(
      (b) => figs.some((f) => f.sparsity === b));

    const s = section(
      `${headingPrefix}${CLASSES[cls].label} — ${FORMATS[fk].label}`,
      figs.length
        ? `Peak ${FORMATS[fk].label} rate on the ${cls === "vector" ? "general-purpose lanes" : "matrix engine"}. `
          + `A unit of work here is ${CLASSES[cls].unitWork}.`
        : `No part on this site publishes a ${FORMATS[fk].label} rate for this class.`);

    // One chart per basis. Never one chart across two.
    for (const b of bases) {
      if (b === "unstated") continue;      // no basis, no bar — see the table
      const rows = figs.filter((f) => f.sparsity === b).map((f) => {
        const sku = byId.get(f.sku);
        const acc = accFor(f.sku, fk);
        return {
          name: sku.name, vendorKey: sku.vendorKey, value: f.value, unit: f.unit,
          sub: acc ? "→ " + acc : (cls === "vector" ? "vector lanes" : null),
        };
      });
      s.append(chart(
        `${FORMATS[fk].label} ${cls === "vector" ? "vector" : "matrix"} peak — `
        + `${SPARSITY[b].label} only (${SPARSITY[b].note}). `
        + `Bars are labelled with what the architecture accumulates into; `
        + `the same figures are in the table below.`,
        rows));
    }

    // The table: every part, including the ones with nothing to draw, because
    // the two kinds of empty cell are half of what this page is for.
    const trs = [];
    for (const sku of skus) {
      const mine = figs.filter((f) => f.sku === sku.id);
      const lvl = levelFor(sku.id, fk);
      const acc = accFor(sku.id, fk);
      if (mine.length === 0) {
        const tr = el("tr", "is-empty");
        tr.append(el("th", null, sku.name));
        tr.append(el("td", null, sku.vendor));
        const td = el("td", "gap");
        if (lvl === "none") {
          td.textContent = "∅  no hardware path";
        } else if (cls === "systolic" && lvl !== "matrix") {
          td.textContent = "∅  not a matrix operand — " + lvl;
        } else if (cls === "vector") {
          td.textContent = "—  no vector rate published";
        } else {
          td.textContent = "—  matrix operand, no rate published";
        }
        td.colSpan = 5;
        tr.append(td);
        trs.push(tr);
        continue;
      }
      for (const f of mine) {
        const tr = el("tr");
        tr.append(el("th", null, sku.name));
        tr.append(el("td", null, sku.vendor));
        tr.append(el("td", null, f.quoted || FORMATS[fk].label));
        tr.append(el("td", "acc", acc || (cls === "vector" ? "vector lanes" : "—")));
        tr.append(el("td", "basis-" + f.sparsity, SPARSITY[f.sparsity].label));
        tr.append(el("td", "num", fmtNum(f.value) + " " + f.unit));
        tr.append(srcCell(f.src, sku));
        trs.push(tr);

        const nt = el("tr", "basis-row");
        const ntd = el("td", null, f.basis);
        ntd.colSpan = 7;
        nt.append(ntd);
        trs.push(nt);
      }
    }
    s.append(table(
      ["Part", "Vendor", "Operand, as the vendor names it", "Accumulates into",
       "Basis", "Peak", "Source"],
      trs));
    out.push(s);
  }
  return out;
}

// ---------------------------------------------------------------------------
function bandwidthView(skus) {
  const byId = new Map(skus.map((s) => [s.id, s]));
  const s = section(
    "Memory bandwidth",
    "The one rate every part here publishes, and the one that sets the floor on "
    + "time per token in a memory-bound decode: every weight is read once per "
    + "token, so this figure divides into the model size to give the fastest a "
    + "part can go regardless of its arithmetic. Two of these cards are two "
    + "ASICs and their vendor quotes the figure PER ASIC — those bars say so, "
    + "and are not silently doubled into a card figure the vendor does not "
    + "claim.");

  const rows = BANDWIDTH.map((b) => {
    const sku = byId.get(b.sku);
    return {
      name: sku.name, vendorKey: sku.vendorKey, value: b.value,
      unit: BANDWIDTH_UNIT,
      sub: b.scope === "whole card" ? null : b.scope,
    };
  }).sort((a, x) => x.value - a.value);

  s.append(chart(
    "Peak memory bandwidth, as published. A bar marked “per ASIC” is one ASIC "
    + "of a two-ASIC card, not the card; the same figures are in the table below.",
    rows));

  const trs = [];
  for (const b of BANDWIDTH) {
    const sku = byId.get(b.sku);
    const tr = el("tr");
    tr.append(el("th", null, sku.name));
    tr.append(el("td", null, sku.vendor));
    tr.append(el("td", null, sku.compare["Memory"] || "—"));
    tr.append(el("td", "scope", b.scope));
    tr.append(el("td", "num", fmtNum(b.value) + " " + BANDWIDTH_UNIT));
    tr.append(srcCell(b.src, sku));
    trs.push(tr);
    const nt = el("tr", "basis-row");
    const ntd = el("td", null, b.basis);
    ntd.colSpan = 6;
    nt.append(ntd);
    trs.push(nt);
  }
  s.append(table(["Part", "Vendor", "Memory", "Scope", "Peak bandwidth", "Source"], trs));
  return [s];
}

// The figures with no stated basis, quoted and kept out of every chart.
function unstatedBlock(skus) {
  if (!UNSTATED.length) return [];
  const byId = new Map(skus.map((s) => [s.id, s]));
  const s = section(
    "Quoted with no stated basis",
    "A vendor headline figure that names no operand format, no accumulate width "
    + "and no sparsity basis cannot be reconstructed, so it is not drawn as a "
    + "bar beside figures that can be. It is quoted here instead, with what the "
    + "vendor does and does not say about it.");
  const trs = [];
  for (const u of UNSTATED) {
    const sku = byId.get(u.sku);
    const tr = el("tr");
    tr.append(el("th", null, sku.name));
    tr.append(el("td", null, u.quoted));
    tr.append(el("td", "num", fmtNum(u.value) + " " + u.unit));
    tr.append(srcCell(u.src, sku));
    trs.push(tr);
    const nt = el("tr", "basis-row");
    const ntd = el("td", null, u.why);
    ntd.colSpan = 4;
    nt.append(ntd);
    trs.push(nt);
  }
  s.append(table(["Part", "As printed", "Figure", "Source"], trs));
  return [s];
}

// How to read any of these pages. Stated once, on every page, because a bar
// without its basis is not a fact.
function basisBlock(cls) {
  const s = section("The comparison basis", null);
  const ul = el("ul", "basis-list");
  const items = [
    ["Dense and sparse are separate charts.",
     "A 2:4-sparse figure skips half the operands and is roughly twice its own "
     + "dense figure. Two vendors here publish sparse rates and two do not, so a "
     + "single chart mixing them would rank parts by which vendor quotes which "
     + "number. Each chart states its basis in the caption."],
    ["Every peak names its clock, or says the vendor did not.",
     "A peak is lanes × operations per lane × clock. Where the clock is "
     + "published the basis row under each figure names it and shows the "
     + "arithmetic; where it is not, the basis row says so. A boost bin is a "
     + "ceiling, not an operating point — a part running a sustained matrix "
     + "workload need not be at it."],
    ["The operand is not the accumulator.",
     "The rate is quoted for what goes IN. What the engine adds into is a "
     + "separate axis, and it changes the number: on RDNA 4 and on Tensix a "
     + "16-bit float product can land in 16 bits or in 32, and none of the "
     + "published rates says which it was measured for. The accumulate column "
     + "comes from the numeric-format table, which is keyed by architecture."],
    ["Vector and systolic are different units of work.",
     "A vector FLOP is one lane's multiply-add on any shape of problem; a "
     + "systolic FLOP is one cell of a matrix array, and only on a matrix "
     + "multiply the engine's shape accepts. They are never on one axis here."],
    ["Two kinds of empty cell.",
     "“∅ no hardware path” means the architecture has no route to that format "
     + "at all. “— supported, no rate published” means the silicon does it and "
     + "the vendor has not said how fast. They are different facts and they are "
     + "drawn differently."],
  ];
  for (const [strong, rest] of items) {
    const li = el("li");
    li.append(el("strong", null, strong + " "));
    li.append(document.createTextNode(rest));
    ul.append(li);
  }
  s.append(ul);
  if (cls) s.append(el("p", "lede", CLASSES[cls].lede));
  return s;
}

// ---------------------------------------------------------------------------
loadAll().then((skus) => {
  const view = document.body.dataset.view || "";
  const format = document.body.dataset.format || "";
  const root = document.getElementById("view");
  if (!root) return;

  if (format) {
    const f = FORMATS[format];
    document.getElementById("page-title").textContent = f.label + " — throughput across parts";
    document.getElementById("page-lede").textContent = f.lede;
    for (const s of throughputBlock(skus, "vector", [format], "")) root.append(s);
    for (const s of throughputBlock(skus, "systolic", [format], "")) root.append(s);
    root.append(basisBlock(null));
  } else if (view === "bandwidth") {
    for (const s of bandwidthView(skus)) root.append(s);
    root.append(basisBlock(null));
  } else if (view === "vector" || view === "systolic") {
    const present = FORMAT_ORDER.filter(
      (k) => FIGURES.some((f) => f.cls === view && f.format === k));
    for (const s of throughputBlock(skus, view, present, "")) root.append(s);
    if (view === "systolic") for (const s of unstatedBlock(skus)) root.append(s);
    root.append(basisBlock(view));
  }
}).catch(fail);
