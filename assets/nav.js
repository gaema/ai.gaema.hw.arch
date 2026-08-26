// Fills the header nav from the SKU registry so every page stays in step.
//
// This was a horizontal row of links, which does not survive the part count:
// seven names wrap onto a second line on a laptop and push the theme toggle
// around. A <select> holds any number of parts in fixed width, groups them by
// vendor, and shows the current page as the selected option — which the link
// row could only do with a colour.
import { ORDER, load, pageHref } from "../data/index.js";

const nav = document.getElementById("nav");
if (nav) {
  const here = document.body.dataset.sku || "";
  const base = document.body.dataset.base || "";
  Promise.all(ORDER.map(load)).then((skus) => {
    const sel = document.createElement("select");
    sel.id = "sku-select";
    sel.setAttribute("aria-label", "Choose an accelerator");

    // Landing page is reachable from the dropdown too, so the brand link is
    // not the only way back.
    const top = document.createElement("option");
    top.value = base || "./";
    top.textContent = "All accelerators";
    if (!here) top.selected = true;
    sel.append(top);

    // Group by vendor, in registry order, so the list reads as a catalogue
    // rather than a flat pile of product names.
    const seen = new Map();
    for (const s of skus) {
      if (!seen.has(s.vendor)) {
        const g = document.createElement("optgroup");
        g.label = s.vendor;
        seen.set(s.vendor, g);
        sel.append(g);
      }
      const o = document.createElement("option");
      o.value = base + pageHref(s);
      o.textContent = s.name;
      if (s.id === here) o.selected = true;
      seen.get(s.vendor).append(o);
    }

    sel.addEventListener("change", () => {
      if (sel.value) location.href = sel.value;
    });
    nav.append(sel);
  });
}
