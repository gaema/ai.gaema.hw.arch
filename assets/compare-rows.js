// The DOM-free half of the comparison pages: number formatting, the accumulate
// and support-level lookups, and the words a row or a section is built from.
//
// compare.js draws the tables and bars from these in the browser, and
// tools/gen-static.mjs writes the same rows as plain HTML for readers without
// scripting, so the two cannot say different things.
import { ARCH, SKU_ARCH } from "../data/_dtypes.js";
import { FORMATS, CLASSES } from "../data/_throughput.js";

// Keep a fractional digit below four figures: rounding 104.88 to 105 in the bar
// while the basis line under it shows the arithmetic that gives 104.88 makes the
// page disagree with itself.
export const fmtNum = (v) =>
  v.toLocaleString("en-US", { maximumFractionDigits: v >= 1000 ? 0 : 2 });

// What the architecture behind this part accumulates a given operand into.
// The rate is quoted for the OPERAND; the accumulate is a separate axis and
// this is where it comes from — never from the figure itself.
export function accFor(skuId, format) {
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
export function levelFor(skuId, format) {
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

// The cell a part gets when it has no figure for this class and format.
export function gapText(cls, lvl) {
  if (lvl === "none") return "∅  no hardware path";
  if (cls === "systolic" && lvl !== "matrix") return "∅  not a matrix operand — " + lvl;
  if (cls === "vector") return "—  no vector rate published";
  return "—  matrix operand, no rate published";
}

export const throughputTitle = (cls, fk, prefix = "") =>
  `${prefix}${CLASSES[cls].label} — ${FORMATS[fk].label}`;

export const throughputLede = (cls, fk, hasFigures) => (hasFigures
  ? `Peak ${FORMATS[fk].label} rate on the ${cls === "vector" ? "general-purpose lanes" : "matrix engine"}. `
    + `A unit of work here is ${CLASSES[cls].unitWork}.`
  : `No part on this site publishes a ${FORMATS[fk].label} rate for this class.`);

export const THROUGHPUT_HEAD = ["Part", "Vendor", "Operand, as the vendor names it",
  "Accumulates into", "Basis", "Peak", "Source"];

export const BANDWIDTH_HEAD = ["Part", "Vendor", "Memory", "Scope", "Peak bandwidth", "Source"];

export const UNSTATED_HEAD = ["Part", "As printed", "Figure", "Source"];

export const BANDWIDTH_LEDE =
  "Eleven of the thirteen parts publish a GB/s figure, and that rate sets the "
  + "floor on time per token in a memory-bound decode: every weight is read "
  + "once per token, so this figure divides into the model size to give the "
  + "fastest a part can go regardless of its arithmetic. Eight figures are a "
  + "whole card. Two of these cards are two ASICs and their vendor quotes the "
  + "figure per ASIC — those bars say so, and are not combined into a card "
  + "figure the vendor does not claim. One figure is system memory shared with "
  + "the CPU. The Radeon 610M publishes none, and Arc 140V publishes up to "
  + "LPDDR5X 8533 MT/s rather than a GB/s, so neither is a bar here.";

export const UNSTATED_LEDE =
  "A vendor headline figure that names no operand format, no accumulate width "
  + "and no sparsity basis cannot be reconstructed, so it is not drawn as a "
  + "bar beside figures that can be. It is quoted here instead, with what the "
  + "vendor does and does not say about it.";
