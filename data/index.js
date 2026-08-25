// The SKU registry. Everything else on the site is driven from here.

export const ORDER = ["r9700", "b70", "rtx-pro-6000", "rtx-5090", "p150a", "p300c"];

// Static specifiers so the modules resolve without a bundler.
const LOADERS = {
  "r9700": () => import("./r9700.js"),
  "b70": () => import("./b70.js"),
  "rtx-pro-6000": () => import("./rtx-pro-6000.js"),
  "rtx-5090": () => import("./rtx-5090.js"),
  "p150a": () => import("./p150a.js"),
  "p300c": () => import("./p300c.js"),
};

export function load(id) {
  const l = LOADERS[id];
  if (!l) return Promise.reject(new Error("unknown SKU: " + id));
  return l().then((m) => m.default);
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
  link: "Chip-to-chip link",
  off: "Harvested",
};
