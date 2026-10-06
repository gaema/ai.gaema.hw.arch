// AMD Radeon 610M (gfx1036) — RDNA 2 integrated graphics, 2 compute units.
// The graphics block found inside the Ryzen Raphael / Granite Ridge desktop
// packages, and branded Radeon 610M in its mobile form. Every figure here is
// from a published vendor document; see `sources`.
//
// This is the site's first iGPU drawn as such: the part is a block inside a
// processor package, so Board power, Cooling and Host interface describe a
// discrete card's rows and this part has no equivalents — power belongs to the
// package, the host IS the neighbouring CPU cores, and the memory is the
// machine's own DDR5, whose capacity and rate are host-configuration facts,
// not silicon facts. Those cells read “—”.

import { band, field, MAP_NOTE } from "./_floorplan.js";

function cu(i) {
  return {
    id: "cu" + i, label: "Compute Unit " + i, kind: "compute", count: null,
    note: "the smallest block that independently executes a wave: two 32-lane SIMDs, a scalar unit and its own 16 KiB L0, plus the Local Data Share the pair of units cooperate through. Two of these are the entire compute side of this part",
    specs: [
      ["Stream processors", "64"],
      ["SIMD32 units", "2"],
      ["L0 vector cache", "16 KiB"],
    ],
    cols: 3,
    children: [
      { id: "simd-a", label: "SIMD32", kind: "compute",
        note: "32 lanes of general vector ALU. A wave32 runs on one SIMD, a wave64 across both; the dot-product instructions — the matrix-analog path on this generation — issue here" },
      { id: "simd-b", label: "SIMD32", kind: "compute",
        note: "the second 32-lane vector unit of the pair. RDNA 2 issues one vector operation per lane per clock on these parts — no dual-issue path until the next generation" },
      { id: "tlu", label: "Transcendental unit", kind: "compute",
        note: "reciprocal, square root, exponent, logarithm and the trig functions. Narrower than the main ALUs, so activation and normalisation work costs more per lane than plain multiply-add" },
      { id: "scalar", label: "Scalar unit", kind: "sched",
        note: "handles values identical across every lane of a wave — loop counters, base addresses, branch conditions, constants. Keeping uniform work here instead of replicating it across lanes is a large part of why GPU code is efficient at all" },
      { id: "l0", label: "L0 vector cache", kind: "cache",
        note: "16 KiB — the first thing a vector memory access hits inside the unit",
        specs: [["Per CU", "16 KiB"]] },
      { id: "ls", label: "Export / load-store", kind: "io",
        note: "the unit's path out: results and memory traffic leave through here toward the shader array's L1" },
    ],
  };
}

export default {
  id: "gfx1036",
  name: "Radeon 610M (gfx1036)",
  vendor: "AMD",
  vendorKey: "amd",
  arch: "RDNA 2 (integrated)",
  die: "gfx1036 graphics block",
  tagline:
    "The two-compute-unit RDNA 2 block inside the Ryzen Raphael / Granite Ridge packages: 128 stream processors, 256 KiB of L2, no matrix engine at all — RDNA 2 predates WMMA, so the closest thing to one is the vector dot4 instruction.",

  spec: {
    "Architecture": "RDNA 2",
    "Die": "gfx1036 graphics block",
    "Process node": "—",
    "Transistors": "—",
    "Die area": "—",
    "Execution unit": "Compute Unit (CU)",
    "Units enabled": "2 of 2 — the whole block",
    "Matrix engines": "None — vector V_DOT4 is the matrix path",
    "On-chip memory": "256 KiB L2 · 128 KiB L1 per shader array",
    "Memory": "host DDR5 — shared, no frame buffer",
    "Memory bus": "—",
    "Memory bandwidth": "—",
    "Board power": "— (the power budget is the processor package's)",
    "Cooling": "— (cooled with the processor)",
    "Host interface": "None — the GPU is in the CPU package",
    "Scale-out link": "None",
  },

  extra: [
    ["Stream processors", "128 (2 CU × 64)"],
    ["Wave size", "wave32 / wave64"],
    ["Sub-groups", "32 / 64"],
    ["Shader arrays", "1"],
    ["L2 bank structure", "2 TCC blocks, 256 KiB total"],
  ],

  compare: {
    "Execution unit": "Compute Unit (CU)",
    "Units on die": "2 CU / 1 shader array",
    "SIMD width": "2 × SIMD32 per CU",
    "Matrix engine": "None — RDNA 2 predates WMMA; V_DOT4 on the vector ALU",
    "Matrix engines total": "0 — vector dot4 only",
    "Last-level cache": "256 KiB L2",
    "Memory": "host DDR5 (shared)",
    "Bandwidth": "— (host-dependent)",
    "Board power": "—",
    "Host link": "None — in the CPU package",
  },

  dieMap: {
    title: "Die map — gfx1036 graphics block",
    cols: 8, rows: 5, cell: 62, cellH: 42,
    lede: "The entire graphics block: two compute units, behind 128 KiB of L1 at the array level and a 256 KiB L2 banked into two TCC blocks. Small on purpose — a discrete card's field of tens of units against this part's two is the difference this map makes visible.",
    hint: "Hover a block for detail. Every compute unit opens at its own place in the hierarchy below.",
    dataflow: {
      label: "Traced read",
      title: "One read: CU → fabric → L2 → host DDR5",
      kind: "stops",
      stops: [[5, 4], [5, 3], [5, 2], [5, 1]],
      note: "A compute unit that misses locally crosses to the array's L1, then the 256 KiB L2, and a miss there leaves the graphics block entirely for the CPU's memory controllers and the machine's DDR5. That last hop has no published figure on this page: the capacity and the bandwidth belong to the host configuration, and an iGPU inherits them rather than owning them.",
    },
    interconnect: "Drawn as a labelled band: the two units reach L1, L2 and the host-memory path through the array fabric. This is not a mesh; there is no router-per-tile geometry to draw.",
    tiles: [
      ...band(0, [
        { w: 3, kind: "sched", label: "Command processor", sub: "+ compute queues", path: "cp",
          detail: "The front end: it takes work from the host — here, from the CPU cores that share the package rather than across a PCIe slot — and dispatches waves onto the two compute units." },
        { w: 2, kind: "io", label: "Display engine", path: "display",
          detail: "Scanout for the desktop outputs. On an iGPU this is the block's day job; inference never touches it." },
        { w: 3, kind: "fixed", label: "Media engine", path: "media",
          detail: "Fixed-function video encode and decode, independent of the two compute units." },
      ]),
      ...band(1, [{ w: 8, kind: "memory", label: "Host memory path — DDR5 (shared)", sub: "the CPU's memory controllers · off this block", path: "mem",
        detail: "There is no frame buffer on this part. Every byte of weight or activation lives in the machine's system memory, reached through the CPU's DDR5 controllers, and the capacity and bandwidth are properties of the host configuration rather than of the graphics block. That is why no figure sits on this tile: any number here would be one machine's memory kit, not the silicon's.",
        specs: [["Frame buffer", "none — shared system memory"], ["Capacity", "—"], ["Bandwidth", "— (host-dependent)"]] }]),
      ...band(2, [{ w: 8, kind: "cache", label: "L2 cache — 256 KiB", sub: "2 TCC blocks · last level before the host path", path: "l2",
        detail: "256 KiB total, banked into two TCC blocks, the last level the graphics block owns before a read goes to system memory. It is a rounding error against the tens of megabytes on the discrete cards here, and that is the architectural story of a two-unit iGPU.",
        specs: [["Capacity", "256 KiB"], ["Banks", "2 TCC blocks"], ["Physically", "banked, not one slab"]] }]),
      ...band(3, [{ w: 8, kind: "link", label: "Shader array fabric", sub: "CUs ⇄ L1 ⇄ L2 ⇄ host-memory path",
        detail: "The interconnect inside the block. Both compute units reach the array's shared L1, the L2 banks and the host-memory path across it.",
        specs: [["Reaches", "both compute units"]] }]),
      ...field({
        y0: 4, perRow: 2, rows: 1, w: 4,
        make: (i) => ({
          kind: "compute", label: "Compute Unit", sub: `#${i}`,
          path: "array/cu" + i,
          detail: `Compute unit ${i}: two 32-lane SIMDs, a scalar unit, 16 KiB of L0, and the integer dot-product path (V_DOT4) that stands in for a matrix engine RDNA 2 does not have.`,
          specs: [["Stream processors", "64"], ["SIMD32 units", "2"], ["Matrix engine", "— none"]],
        }),
      }),
    ],
    note: "This map draws the graphics block, not the processor package: the CPU cores and DDR5 controllers this iGPU lives beside are represented only by the host-memory edge, because they are not on the block being drawn. Nothing is disabled — two compute units is the whole design of this part. " + MAP_NOTE,
    source: "AMD's RDNA 2 instruction-set guide",
  },

  root: {
    id: "card", label: "Radeon 610M (gfx1036)", kind: "compute",
    note: "a two-compute-unit RDNA 2 graphics block inside the processor package — 128 stream processors and 256 KiB of L2, with no matrix engine, no frame buffer and no PCIe of its own. The CPU it sits beside is its host, and the machine's DDR5 is its memory; everything a discrete card owns privately, this part shares",
    cols: 4,
    children: [
      {
        id: "array", label: "Shader array", kind: "compute", span: 2,
        note: "the compute units sit behind one shared read cache at the level RDNA 2 replicates — the shader array — and this part carries a single array's worth of it",
        specs: [["Compute units", "2"], ["L1", "128 KiB"]],
        cols: 2,
        children: [
          cu(0), cu(1),
          { id: "l1", label: "L1 cache — 128 KiB", kind: "cache", span: 2,
            note: "the array's shared read cache between the units and the L2 — 128 KiB for both compute units together",
            specs: [["Capacity", "128 KiB"]] },
        ],
      },
      {
        id: "l2", label: "L2 cache — 256 KiB", kind: "cache",
        specs: [["Capacity", "256 KiB"], ["Banks", "2 TCC blocks"]],
        note: "the last level the block owns, banked into two TCCs. What misses here leaves for system memory — and on this part there is no memory-side cache between the two events, so L2 residency is the whole difference between on-block and off-block traffic",
      },
      {
        id: "mem", label: "Host memory path", kind: "memory",
        specs: [["Frame buffer", "none — shared system memory"], ["Capacity", "—"], ["Bandwidth", "— (host-dependent)"]],
        note: "not a block on this die: the route into the CPU's memory controllers and the machine's DDR5. Capacity and bandwidth are host-configuration facts rather than silicon facts, which is why they read — here; every weight read streams across the same fabric the CPU cores are using",
      },
      { id: "cp", label: "Command processor", kind: "sched",
        note: "the front end — it reads the command buffers the driver writes and dispatches waves onto the two compute units. Its host is the CPU on the same package rather than a PCIe peer, which removes the copy but not the queue" },
      { id: "media", label: "Media engine", kind: "fixed",
        note: "fixed-function video encode and decode, independent of the compute units. The reason iGPUs of this generation still carry media hardware an inference run will never touch" },
      { id: "display", label: "Display engine", kind: "io",
        note: "scanout — drives the physical outputs. On a desktop iGPU this is the part of the block that is never idle" },
    ],
  },

  sources: [
    ["AMD — RDNA 2 “Shader” Instruction Set Architecture Reference Guide", "https://docs.amd.com/v/u/en-US/rdna2-shader-instruction-set-architecture"],
  ],
};
