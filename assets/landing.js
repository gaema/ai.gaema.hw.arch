// Landing page: the SKU cards and the cross-vendor matrix, both built from
// the same registry the explorer pages read.
import { loadAll, COMPARE_ROWS, pageHref } from "../data/index.js";
import { ROWS as DTYPE_ROWS, ARCH, ARCH_ORDER } from "../data/_dtypes.js";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// The four card rows worth showing at a glance, in matrix-key terms.
const CARD_ROWS = ["Units on die", "Matrix engines total", "Memory", "Bandwidth"];

// Everything below this line is built by script, so a failure here used to
// leave an empty page with no explanation. Say what went wrong instead.
function fail(err) {
  const box = document.getElementById("cards") || document.body;
  const p = el("p", "load-error");
  p.append(el("strong", null, "This page could not load its data. "));
  p.append(document.createTextNode(
    "The catalogue is built in the browser from ES modules; if you are on an old "
    + "browser, or something between you and the site is blocking or rewriting "
    + "JavaScript, the page will come up empty. Error: " + (err && err.message ? err.message : String(err))));
  box.append(p);
}

loadAll().then((skus) => {
  const cards = document.getElementById("cards");
  for (const s of skus) {
    const a = el("a", "card");
    a.href = pageHref(s);
    a.style.setProperty("--card-accent", `var(--v-${s.vendorKey})`);
    a.append(el("span", "vendor", s.vendor));
    a.append(el("h3", null, s.name));
    // The die is only worth naming when it is not just the architecture again.
    const sub = s.die && s.die !== s.arch ? s.arch + " · " + s.die : s.arch;
    a.append(el("p", "arch", sub));
    const dl = el("dl");
    for (const k of CARD_ROWS) {
      dl.append(el("dt", null, k));
      dl.append(el("dd", null, s.compare[k] || "—"));
    }
    a.append(dl);
    cards.append(a);
  }

  const table = document.getElementById("matrix");
  const thead = el("thead");
  const hr = el("tr");
  hr.append(el("th", null, ""));
  for (const s of skus) {
    const th = el("th");
    const a = el("a", null, s.name);
    a.href = pageHref(s);
    th.append(a);
    hr.append(th);
  }
  thead.append(hr);
  table.append(thead);

  const tbody = el("tbody");
  for (const row of COMPARE_ROWS) {
    const tr = el("tr");
    tr.append(el("th", null, row));
    for (const s of skus) tr.append(el("td", null, s.compare[row] || "—"));
    tbody.append(tr);
  }
  table.append(tbody);

  buildDtypes();
}).catch(fail);

// The numeric-format table. One column per ARCHITECTURE, not per card: which
// formats an engine takes is a property of the design, so the two cards on each
// of the NVIDIA and Tenstorrent rows would otherwise be duplicate columns.
function buildDtypes() {
  const table = document.getElementById("dtypes");
  if (!table) return;

  const thead = el("thead");
  const hr = el("tr");
  hr.append(el("th", null, "Bits"));
  hr.append(el("th", null, "Format"));
  for (const k of ARCH_ORDER) {
    const th = el("th");
    th.append(el("span", null, ARCH[k].label));
    th.append(el("small", "sub", ARCH[k].engine));
    hr.append(th);
  }
  thead.append(hr);
  table.append(thead);

  const tbody = el("tbody");
  for (const [key, label, bits] of DTYPE_ROWS) {
    const tr = el("tr");
    tr.append(el("td", "bits", String(bits)));
    tr.append(el("th", null, label));
    for (const k of ARCH_ORDER) {
      const d = ARCH[k].dtypes[key] || { level: "none" };
      const td = el("td", "dt-" + d.level);
      if (d.level === "matrix") {
        // The operand is the row; the value in the cell is what it adds into.
        td.append(el("span", "acc", "→ " + d.acc));
      } else if (d.level === "vector") {
        td.textContent = "vector";
      } else if (d.level === "convert") {
        td.textContent = "convert";
      } else {
        td.textContent = "—";
      }
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(tbody);

  // Per-architecture notes + sources, below the table rather than inside it:
  // the table carries values, and a cell is not the place for a paragraph.
  const box = document.getElementById("dtype-notes");
  if (!box) return;
  for (const k of ARCH_ORDER) {
    const a = ARCH[k];
    const d = el("details", "dtype-note");
    const s = el("summary");
    s.append(el("strong", null, a.label));
    s.append(document.createTextNode(" · " + a.engine));
    d.append(s);
    d.append(el("p", "lede", a.note));
    const ul = el("ul", "srcs");
    for (const [text, href] of a.source) {
      const li = el("li");
      const link = el("a", null, text);
      link.href = href;
      link.rel = "noopener";
      li.append(link);
      ul.append(li);
    }
    d.append(ul);
    box.append(d);
  }
}
