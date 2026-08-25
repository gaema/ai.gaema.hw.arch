// Landing page: the six SKU cards and the cross-vendor matrix, both built from
// the same registry the explorer pages read.
import { loadAll, COMPARE_ROWS } from "../data/index.js";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// The four card rows worth showing at a glance, in matrix-key terms.
const CARD_ROWS = ["Units on die", "Matrix engines total", "Memory", "Bandwidth"];

loadAll().then((skus) => {
  const cards = document.getElementById("cards");
  for (const s of skus) {
    const a = el("a", "card");
    a.href = s.id + "/";
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
    a.href = s.id + "/";
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
});
