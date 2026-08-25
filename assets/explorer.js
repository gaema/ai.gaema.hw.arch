// The interactive block-diagram explorer.
//
// A SKU's data module is a tree of nodes. The stage always shows ONE node's
// children as a block diagram; clicking a block that has children descends into
// it, and the breadcrumb walks back out. The path lives in the URL hash, so any
// view is linkable and the back button works.

import { load, KINDS } from "../data/index.js";
import { renderDieMap } from "./diemap.js";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

let SKU = null;

function childrenOf(node) {
  return Array.isArray(node.children) ? node.children : [];
}

// Resolve a list of ids into the chain of nodes from the root.
function resolve(root, ids) {
  const chain = [root];
  let cur = root;
  for (const id of ids) {
    const next = childrenOf(cur).find((c) => c.id === id);
    if (!next) break;
    chain.push(next);
    cur = next;
  }
  return chain;
}

function pathFromHash() {
  const h = location.hash.replace(/^#\/?/, "");
  return h ? h.split("/").filter(Boolean) : [];
}

function goto(ids) {
  const next = "#/" + ids.join("/");
  if (location.hash === next || (!ids.length && !location.hash)) render();
  else location.hash = next;
}

// ---------------------------------------------------------------- rendering

function tileFor(node, onOpen) {
  const kids = childrenOf(node);
  const t = el("button", "tile" + (kids.length ? " has-children" : "")
    + (node.dense ? " dense" : "") + (node.kind === "off" ? " is-off" : ""));
  t.type = "button";
  t.style.setProperty("--tile-ink", `var(--k-${node.kind || "io"}-ink)`);
  t.style.setProperty("--tile-bg", `var(--k-${node.kind || "io"}-bg)`);
  if (node.span) t.style.setProperty("--span", String(node.span));

  if (node.count && !node.dense) t.append(el("span", "t-count", node.count));
  t.append(el("span", "t-label", node.label));
  if (node.note && !node.dense) t.append(el("span", "t-note", node.note));
  if (kids.length && !node.dense) t.append(el("span", "t-more", "open ›"));

  t.setAttribute("aria-label",
    node.label + (kids.length ? " — " + kids.length + " parts, open" : ""));
  if (node.dense) t.title = node.label + (node.note ? " — " + node.note : "");

  t.addEventListener("click", () => onOpen(node));
  return t;
}

function renderPanel(node) {
  const p = document.getElementById("panel");
  p.textContent = "";
  p.style.setProperty("--tile-ink", `var(--k-${node.kind || "io"}-ink)`);

  p.append(el("div", "kind", KINDS[node.kind] || "Block"));
  p.append(el("h3", null, node.label));
  if (node.count) p.append(el("p", null, node.count));
  if (node.note) p.append(el("p", null, node.note));

  const specs = node.specs || [];
  if (specs.length) {
    const dl = el("dl");
    for (const [k, v] of specs) {
      dl.append(el("dt", null, k));
      dl.append(el("dd", null, v));
    }
    p.append(dl);
  }

  const kids = childrenOf(node);
  if (kids.length) {
    p.append(el("p", null,
      "Contains " + kids.length + " blocks — click one on the left to go inside it."));
  }
}

function renderCrumbs(chain) {
  const c = document.getElementById("crumbs");
  c.textContent = "";
  chain.forEach((node, i) => {
    if (i) c.append(el("span", "sep", "›"));
    const b = el("button", null, i === 0 ? SKU.name : node.label);
    b.type = "button";
    if (i === chain.length - 1) b.disabled = true;
    else b.addEventListener("click", () => goto(chain.slice(1, i + 1).map((n) => n.id)));
    c.append(b);
  });
}

function renderStage(chain) {
  const node = chain[chain.length - 1];
  const kids = childrenOf(node);
  const stage = document.getElementById("stage");
  stage.textContent = "";

  const head = el("div", "stage-head");
  head.append(el("h2", null, chain.length === 1 ? SKU.name : node.label));
  const sub = kids.length
    ? kids.length + (kids.length === 1 ? " block" : " blocks")
    : "no further detail published";
  head.append(el("span", "sub", sub));
  stage.append(head);

  if (!kids.length) {
    stage.append(el("p", "note", "This block is a leaf here — the vendor does not publish structure below it."));
  } else {
    const grid = el("div", "grid");
    grid.style.setProperty("--cols", String(node.cols || 4));
    for (const k of kids) grid.append(tileFor(k, open));
    stage.append(grid);
  }

  if (node.gridNote) stage.append(el("p", "note", node.gridNote));
  if (chain.length === 1 && SKU.dieNote) stage.append(el("p", "note", SKU.dieNote));

  // Legend for the kinds actually on screen.
  const kinds = [...new Set(kids.map((k) => k.kind || "io"))];
  if (kinds.length) {
    const leg = el("div", "legend");
    for (const k of kinds) {
      const s = el("span");
      const i = el("i");
      i.style.setProperty("--tile-ink", `var(--k-${k}-ink)`);
      i.style.setProperty("--tile-bg", `var(--k-${k}-bg)`);
      s.append(i, document.createTextNode(KINDS[k] || k));
      leg.append(s);
    }
    stage.append(leg);
  }

  renderPanel(node);
}

function open(node) {
  if (childrenOf(node).length) goto(pathFromHash().concat(node.id));
  else renderPanel(node);
}

function render() {
  const ids = pathFromHash();
  const chain = resolve(SKU.root, ids);
  // Drop any hash segment that did not resolve, so a stale link self-corrects.
  const valid = chain.slice(1).map((n) => n.id);
  if (valid.join("/") !== ids.join("/")) {
    history.replaceState(null, "", "#/" + valid.join("/"));
  }
  renderCrumbs(chain);
  renderStage(chain);
}

// ---------------------------------------------------------------- head matter

function renderHeadline() {
  document.title = SKU.name + " — GPU architecture explorer";
  const h = document.getElementById("sku-head");
  if (h) {
    h.textContent = "";
    h.append(el("h1", null, SKU.name));
    h.append(el("p", null, SKU.tagline));
  }
  const dl = document.getElementById("headline");
  if (dl) {
    dl.textContent = "";
    // <div> grouping inside <dl> is valid HTML and keeps each pair in one cell.
    for (const [k, v] of SKU.headline) {
      const cell = el("div");
      cell.append(el("dt", null, k), el("dd", null, v));
      dl.append(cell);
    }
  }
  const s = document.getElementById("sources");
  if (s && SKU.sources) {
    const ul = el("ul");
    for (const [label, url] of SKU.sources) {
      const li = el("li");
      const a = el("a", null, label);
      a.href = url;
      a.rel = "noopener";
      li.append(a);
      ul.append(li);
    }
    s.append(ul);
  }
}

const id = document.body.dataset.sku;
load(id).then((sku) => {
  SKU = sku;
  renderHeadline();
  // The die map hands a hierarchy path back; jumping there scrolls the
  // explorer into view so the click visibly lands somewhere.
  renderDieMap(sku, (path) => {
    goto(path.split("/").filter(Boolean));
    document.getElementById("stage").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  render();
  window.addEventListener("hashchange", render);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const ids = pathFromHash();
      if (ids.length) goto(ids.slice(0, -1));
    }
  });
}).catch((err) => {
  const stage = document.getElementById("stage");
  if (!stage) return;
  stage.textContent = "";
  const p = el("p", "load-error");
  p.append(el("strong", null, `This page could not load ${id}. `));
  p.append(document.createTextNode(
    "The diagrams are built in the browser from ES modules; if you are on an old "
    + "browser, or something between you and the site is blocking or rewriting "
    + "JavaScript, the page will come up empty. Error: "
    + (err && err.message ? err.message : String(err))));
  stage.append(p);
});
