// The SKU registry. Everything else on the site is driven from here.

export const ORDER = ["r9700", "b70", "rtx-pro-6000", "rtx-5090", "p150a", "p300c"];

// Pages live under their vendor, so a URL says who makes the part before it
// says which part. `vendorKey` is the short token used for colour tokens;
// the directory spells the vendor out.
export const VENDOR_DIR = {
  amd: "amd", intel: "intel", nvidia: "nvidia", tt: "tenstorrent",
};

export function pageHref(sku) {
  return `${VENDOR_DIR[sku.vendorKey]}/${sku.id}/`;
}

// Static specifiers so the modules resolve without a bundler.
const LOADERS = {
  "r9700": () => import("./r9700.js"),
  "b70": () => import("./b70.js"),
  "rtx-pro-6000": () => import("./rtx-pro-6000.js"),
  "rtx-5090": () => import("./rtx-5090.js"),
  "p150a": () => import("./p150a.js"),
  "p300c": () => import("./p300c.js"),
};

// The spec card's fixed spine: every SKU answers these, in this order, so the
// card reads the same on all six pages and a reader can compare down a column
// instead of hunting for whichever field a given vendor happened to publish.
// A field nobody publishes is answered "Not published" rather than dropped --
// an absent row and an unanswerable one look identical once the row is gone.
export const SPEC_SPINE = [
  "Architecture",
  "Die",
  "Process node",
  "Transistors",
  "Die area",
  "Execution unit",
  "Units enabled",
  "Matrix engines",
  "On-chip memory",
  "Memory",
  "Memory bus",
  "Memory bandwidth",
  "Board power",
  "Cooling",
  "Host interface",
  "Scale-out link",
];

// Enforced at load, not left to discipline: the card drifted out of shape once
// already (six pages, 53 distinct fields, 5 of them common to all six).
export function specRows(sku) {
  const missing = SPEC_SPINE.filter((k) => !sku.spec || !sku.spec[k]);
  if (missing.length) {
    throw new Error(`${sku.id}: spec card missing ${missing.join(", ")}`);
  }
  const extra = Object.keys(sku.spec).filter((k) => !SPEC_SPINE.includes(k));
  if (extra.length) {
    throw new Error(`${sku.id}: spec card has non-spine keys ${extra.join(", ")}`);
  }
  return SPEC_SPINE.map((k) => [k, sku.spec[k]]);
}

export function load(id) {
  const l = LOADERS[id];
  if (!l) return Promise.reject(new Error("unknown SKU: " + id));
  return l().then((m) => {
    specRows(m.default);            // throw at load, not at render
    return m.default;
  });
}

export function loadAll() {
  return Promise.all(ORDER.map(load));
}

// Row order for the cross-vendor matrix. A SKU that omits a key renders "—".
export const COMPARE_ROWS = [
  "Execution unit",
  "Units on die",
  "SIMD width",
  "Matrix engine",
  "Matrix engines total",
  "Last-level cache",
  "Memory",
  "Bandwidth",
  "Board power",
  "Host link",
];

export const KINDS = {
  compute: "Compute",
  matrix: "Matrix / AI engine",
  cache: "Cache / local store",
  memory: "Off-chip memory",
  sched: "Scheduling / control",
  fixed: "Fixed function",
  io: "I/O + interconnect",
  link: "Interconnect / fabric",
  off: "Disabled",
};
