// Fills the header nav from the SKU registry so the six pages stay in step.
import { ORDER, load, pageHref } from "../data/index.js";

const nav = document.getElementById("nav");
if (nav) {
  const here = document.body.dataset.sku || "";
  const base = document.body.dataset.base || "";
  Promise.all(ORDER.map(load)).then((skus) => {
    for (const s of skus) {
      const a = document.createElement("a");
      a.href = base + pageHref(s);
      a.textContent = s.name;
      if (s.id === here) a.setAttribute("aria-current", "page");
      nav.append(a);
    }
  });
}
