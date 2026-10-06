// Intel Arc A370M — Xe-HPG (Alchemist), DG2-128 / ACM-G11.
// Every figure here is from a published vendor source; see `sources`.

import { band, field, memBand, MAP_NOTE } from "./_floorplan.js";

// DG2-128 is the smallest Xe-HPG configuration: 8 Xe-cores, 16 execution
// units each, 192 KB of L1/SLM behind each core. The discrete Xe2 parts on
// this site are drawn from _battlemage.js; this generation differs in every
// one of those numbers, so the structure is defined here.
function xeCore(i) {
  return {
    id: "xc" + i, label: "Xe-core " + i, kind: "compute", count: null,
    note: "the block a thread group is scheduled onto: sixteen execution units, eight matrix engines, and 192 KB of L1 and shared-local memory behind them. Eight of these make the DG2-128",
    specs: [
      ["Execution units", "16"],
      ["Matrix engines", "8"],
      ["Shared L1 / SLM", "192 KB"],
    ],
    cols: 4,
    children: [
      {
        id: "eu", label: "Execution Units ×16", kind: "compute", span: 2,
        note: "the vector lanes — where ordinary shader and kernel arithmetic runs, and where work that is not a matrix multiply lives. Sixteen per Xe-core, eight resident hardware threads per unit, and matrix instructions are issued at SIMD8 sub-group width on this generation",
        specs: [
          ["Per Xe-core", "16"],
          ["Threads per unit", "8"],
          ["Sub-group width", "SIMD8"],
        ],
      },
      {
        id: "xrm", label: "Matrix Engines ×8", kind: "matrix", span: 2,
        note: "the Xe-HPG matrix engine — the block that executes DPAS, the sub-group matrix multiply-accumulate instruction. This is where the card's INT8 and FP16 matrix work runs: fp16 over K=16, int8 over K=32, int4 over K=64, each as an 8×8 output tile per sub-group. Eight per Xe-core, sixty-four on the die",
        specs: [
          ["Per Xe-core", "8"],
          ["On the die", "64"],
          ["fp16 tile", "8×8×16"],
          ["int8 tile", "8×8×32"],
          ["int4 tile", "8×8×64"],
        ],
      },
      {
        id: "slm", label: "Shared L1 cache / SLM", kind: "cache", span: 2,
        specs: [["Capacity", "192 KB per Xe-core"]],
        note: "one pool serving both the L1 and the shared-local-memory role for the Xe-core's units — the Xe-HPG amount, 192 KB against the 256 KB the Xe2 generation moved to",
      },
      { id: "ls", label: "Load / store", kind: "io",
        note: "the Xe-core's path to memory: it resolves addresses for the vector engines and moves data between them and the 192 KB L1/SLM block, coalescing lanes into as few transactions as it can" },
      { id: "thread", label: "Thread dispatch", kind: "sched",
        note: "hands threads to the execution units and tracks the ones in flight. It is fed by the global command streamer at die level, so this is the local half of a two-level dispatch scheme" },
    ],
  };
}

export default {
  id: "a370m",
  name: "Arc A370M",
  vendor: "Intel",
  vendorKey: "intel",
  arch: "Xe-HPG (Alchemist)",
  die: "DG2-128",
  tagline:
    "The smallest first-generation Arc: 8 Xe-cores and 4 GB of GDDR6 across a 64-bit bus — the same DPAS matrix path as the bigger Alchemist cards, at an eighth of the memory width.",

  spec: {
    "Architecture": "Xe-HPG (Alchemist)",
    "Die": "DG2-128 (ACM-G11)",
    "Process node": "—",
    "Transistors": "—",
    "Die area": "—",
    "Execution unit": "Xe-core (16 EUs)",
    "Units enabled": "8 Xe-cores / 128 execution units",
    "Matrix engines": "64 matrix engines (8 per Xe-core), DPAS path",
    "On-chip memory": "192 KB L1/SLM per Xe-core · L2 not published",
    "Memory": "4 GB GDDR6",
    "Memory bus": "64-bit",
    "Memory bandwidth": "112 GB/s",
    "Board power": "35–50 W TGP (platform-defined)",
    "Cooling": "— (cooled by the laptop design)",
    "Host interface": "PCIe 4.0 ×8",
    "Scale-out link": "None — PCIe only",
  },

  extra: [
    ["Execution units", "128 (8 Xe-cores × 16 units each)"],
    ["Sub-group (DPAS)", "SIMD8 — matrix ops require sub-group size 8 on this generation"],
    ["Graphics clock", "up to 1,550 MHz (published maximum)"],
    ["Memory speed", "14 Gbps"],
    ["Host link bandwidth", "~16 GB/s per direction (PCIe 4.0 ×8 nominal)"],
    ["Launch price", "—"],
  ],

  compare: {
    "Execution unit": "Xe-core",
    "Units on die": "8 Xe-cores / 128 execution units",
    "SIMD width": "SIMD8 sub-groups; 8 threads per EU",
    "Matrix engine": "Xe-HPG matrix engine (DPAS), 8 per Xe-core",
    "Matrix engines total": "64",
    "Last-level cache": "—",
    "Memory": "4 GB GDDR6",
    "Bandwidth": "112 GB/s",
    "Board power": "35–50 W TGP",
    "Host link": "PCIe 4.0 ×8",
  },

  dieMap: {
    title: "Die map — DG2-128",
    cols: 8, rows: 7, cell: 58, cellH: 42,
    lede: "All 8 Xe-cores of the DG2-128 configuration, in a four-by-two field. Each Xe-core carries 16 execution units and 8 matrix engines, so the field below is where all 64 matrix engines live.",
    hint: "Hover a block for detail. Every Xe-core opens at its own place in the hierarchy below.",
    dataflow: {
      label: "Traced read",
      title: "One read: Xe-core → fabric → L2 → GDDR6",
      kind: "stops",
      stops: [[3, 4], [3, 3], [3, 2], [3, 1]],
      note: "A core that misses in its own 192 KB of L1/SLM crosses the fabric to L2, and a miss there goes to a memory controller. Three stops, not a route — the hierarchy decides where a read lands, and the only lever a kernel has is whether the data was already in cache.",
    },
    interconnect: "Drawn as a labelled fabric band between the compute field and the cache, because the claim is only that every Xe-core reaches L2 and memory through it. Xe-HPG has no per-tile router to draw.",
    tiles: [
      ...band(0, [
        { w: 2, kind: "io", label: "PCIe 4.0 ×8", path: "pcie",
          detail: "The host link: eight lanes of PCIe 4.0, about 16 GB/s each way as a link nominal — an eighth of the 112 GB/s the card reaches its own GDDR6 at. Model weights cross here once at load; anything that has to keep crossing it during inference is in a fundamentally slower regime." },
        { w: 3, kind: "sched", label: "Command streamer", sub: "global thread dispatch", path: "cs",
          detail: "The global front end. It consumes the command buffers the driver builds and dispatches thread groups down to the Xe-cores, where each core's own thread dispatcher takes over — a two-level scheme, this being the die-wide half." },
        { w: 3, kind: "fixed", label: "Display + Media", path: "media",
          detail: "The display engine, which scans finished framebuffers out to the panel and external outputs, alongside the fixed-function media block that encodes and decodes video without spending any compute. Neither participates in inference." },
      ]),
      ...memBand(1, 2, 8, "GDDR6", () => "controller split not published",
        "The 64-bit GDDR6 interface — 112 GB/s, which is 64 × 14 / 8 = 112. Intel does not publish how the bus splits across controllers on this configuration, so the two blocks are a drawing convenience, NOT a controller count.",
        [["This block", "1 of 2 drawn — not a controller count"],
         ["Its share of bandwidth", "— (split not published)"],
         ["Whole memory subsystem", "64-bit, 112 GB/s"],
         ["DRAM on the board", "4 GB GDDR6"]]),
      ...band(2, [{ w: 8, kind: "cache", label: "L2 cache", sub: "capacity not published · banked with the memory controllers", path: "l2",
        detail: "The shared last level on the Xe-HPG design is banked with the memory controllers rather than being one central slab. Intel publishes no L2 size for the A370M, so the capacity reads — rather than being estimated from a bigger Alchemist part.",
        specs: [["Capacity", "—"], ["Physically", "banked with the memory controllers"]] }]),
      ...band(3, [{ w: 8, kind: "link", label: "Xe fabric", sub: "Xe-cores ⇄ L2 ⇄ memory controllers",
        detail: "The on-die interconnect between the compute field and the memory side. Every Xe-core reaches L2 and the GDDR6 controllers across it. Drawn as a band rather than a specific topology.",
        specs: [["Reaches", "all 8 Xe-cores"]] }]),
      ...field({
        y0: 4, perRow: 4, rows: 2, w: 2,
        make: (i) => ({
          kind: "compute", label: "Xe-core", sub: `#${i}`,
          path: "xc" + i,
          detail: `Xe-core ${i}. 16 execution units at SIMD8 sub-group width, 8 matrix engines running DPAS, and 192 KB of shared L1/SLM behind them.`,
          specs: [["Execution units", "16"], ["Matrix engines", "8 × DPAS"], ["Shared L1 / SLM", "192 KB"]],
        }),
      }),
      ...band(6, [{ w: 8, kind: "fixed", label: "Geometry + rasterization front ends", sub: "the graphics path of each Xe-core group",
        detail: "The fixed-function graphics front end. It carries this part from an AI accelerator back to being a laptop GPU — screens, video, games. Idle during inference." }]),
    ],
    note: "Nothing here is drawn as disabled: 8 Xe-cores is the whole configuration this product ships, and Intel does not publish a larger enabled count for DG2-128 to mark a harvest against. " + MAP_NOTE,
    source: "Intel's Arc A370M product specifications and its Xe-HPG DPAS extension documentation",
  },

  root: {
    id: "card", label: "Arc A370M", kind: "compute",
    note: "one DG2-128 configuration of the Xe-HPG die on a laptop mainboard — 8 Xe-cores, 128 execution units and 64 DPAS matrix engines behind a 64-bit GDDR6 interface at 112 GB/s. The AI-relevant line of first-generation Arc cut to its smallest: the matrix path is the same instruction family as the desktop cards, and the 4 GB × 112 GB/s behind it is what a workload actually runs against",
    cols: 4,
    children: [
      xeCore(0), xeCore(1), xeCore(2), xeCore(3),
      xeCore(4), xeCore(5), xeCore(6), xeCore(7),
      {
        id: "l2", label: "L2 cache", kind: "cache", span: 2,
        specs: [["Capacity", "—"]],
        note: "the shared last level between the Xe-cores and the memory controllers, banked along the memory side rather than sitting as one block. Its capacity on this configuration is not published, and a figure carried over from a bigger Alchemist part would be a different product's number",
      },
      {
        id: "gddr", label: "GDDR6 memory controllers", kind: "memory", span: 2,
        specs: [["Capacity", "4 GB"], ["Bus", "64-bit"], ["Bandwidth", "112 GB/s"]],
        note: "the controllers driving the 4 GB of GDDR6 across a 64-bit bus at 14 Gbps, for 112 GB/s. This is the number that bounds token generation: in a memory-bound decode every weight is read once per token, so the model's size divided by this rate is the floor on time per token no amount of compute can undercut — and at half the B50's 224 GB/s and under a fifth of the B70's 608 GB/s, this floor sits a long way above theirs",
      },
      { id: "cs", label: "Command streamer", kind: "sched",
        note: "the die-wide front end. It reads the command buffers the driver builds and dispatches thread groups out to the Xe-cores, where each core's own thread dispatcher places them on its execution units. Every kernel launch enters the GPU through this block" },
      { id: "pcie", label: "PCIe 4.0 ×8", kind: "io",
        note: "the host link. Eight lanes of PCIe 4.0 — about 16 GB/s each way as a link nominal, an eighth of this card's own 112 GB/s, so a model that does not fit in 4 GB is in a different performance regime rather than a slower mode of the same one",
        specs: [["Lanes", "8"], ["Generation", "PCIe 4.0"], ["Bandwidth", "~16 GB/s per direction (nominal)"]] },
      { id: "media", label: "Media engine", kind: "fixed",
        note: "fixed-function video encode and decode, independent of the Xe-cores, so a transcode runs at full rate without spending any compute. Part of why this silicon ships in laptops at all; entirely unused by inference" },
      { id: "display", label: "Display engine", kind: "io",
        note: "scanout — drives the panel and the physical outputs from finished framebuffers. Idle on a card doing only inference" },
    ],
  },

  sources: [
    ["Intel — Arc A370M product specifications (SKU 228342)", "https://www.intel.com/content/www/us/en/products/sku/228342/specifications.html"],
    ["Khronos — cl_intel_subgroup_matrix_multiply_accumulate (the DPAS instruction surface)", "https://registry.khronos.org/OpenCL/extensions/intel/cl_intel_subgroup_matrix_multiply_accumulate.html"],
  ],
};
