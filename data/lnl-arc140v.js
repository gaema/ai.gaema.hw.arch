// Intel Arc Graphics 140V — the Xe2-LPG integrated GPU in Lunar Lake
// (Core Ultra Series 2). Every figure here is from a published vendor document
// or from a capability read of the silicon itself; see `sources`.
//
// The Xe2 cores here are the same design as the discrete Battlemage parts, so
// the matrix surface answers identically — but the package geometry does not:
// this GPU is a block on the Lunar Lake compute tile, its memory is LPDDR5X
// soldered into the same package, shared with the CPU cores, and it has no
// PCIe link, no board power and no cooler of its own. The map is therefore
// built standalone rather than from the discrete Xe2 template, whose render-
// slice grouping this part does not publish.

import { band, field, memBand, MAP_NOTE } from "./_floorplan.js";

function xeCore(i) {
  return {
    id: "xc" + i, label: "Xe-core " + i, kind: "compute", count: null,
    note: "the Xe2 execution block a thread group is scheduled onto: eight vector engines, eight XMX matrix engines and 192 KB of L1 and shared-local memory they all sit behind. Eight of these make the 140V",
    specs: [
      ["Vector engines", "8"],
      ["XMX engines", "8"],
      ["Shared L1 / SLM", "192 KB"],
    ],
    cols: 4,
    children: [
      {
        id: "ve", label: "Vector Engine ×8", kind: "compute", span: 2,
        note: "the general-purpose SIMD ALUs — where ordinary shader and kernel arithmetic runs, everything that is not a matrix multiply. Eight per Xe-core, and the reason elementwise work between matrix ops does not stall waiting on XMX",
        specs: [["Per Xe-core", "8"]],
      },
      {
        id: "xmx", label: "XMX Engine ×8", kind: "matrix", span: 2,
        note: "Xe Matrix eXtensions: the systolic array that takes a whole small matrix multiply-accumulate as one DPAS instruction. The integrated part runs the same matrix surface as the discrete Xe2 cards — fp16, bf16 and tf32, int8 down to int2, at sub-group size 16 — the only Xe2 thing about it is how many cores carry it",
        specs: [
          ["Per Xe-core", "8"],
          ["On the block", "64"],
          ["Sub-group (DPAS)", "SIMD16"],
        ],
      },
      {
        id: "slm", label: "Shared L1 cache / SLM", kind: "cache", span: 2,
        specs: [["Capacity", "192 KB per Xe-core"]],
        note: "one pool serving both the L1 and the shared-local-memory role — the Xe2-LPG amount, 192 KB against the 256 KB the discrete Battlemage cores carry",
      },
      { id: "ls", label: "Load / store", kind: "io",
        note: "the Xe-core's path to memory: it resolves addresses for the vector engines and moves data between them and the 192 KB L1/SLM block, coalescing lanes into as few transactions as it can" },
      { id: "thread", label: "Thread dispatch", kind: "sched",
        note: "hands threads to the eight vector engines and tracks the ones in flight. It is fed by the GPU's global command streamer, so this is the local half of a two-level dispatch scheme" },
    ],
  };
}

export default {
  id: "lnl-arc140v",
  name: "Arc Graphics 140V",
  vendor: "Intel",
  vendorKey: "intel",
  arch: "Xe2-LPG (Lunar Lake)",
  die: "Lunar Lake compute tile",
  tagline:
    "The Xe2 graphics block inside Lunar Lake: eight Xe2 cores with the same XMX matrix surface as the discrete Battlemage cards, reading the LPDDR5X soldered into the package — memory shared with the CPU, not a frame buffer.",

  spec: {
    "Architecture": "Xe2-LPG (integrated Xe2)",
    "Die": "Lunar Lake compute tile (with memory on package)",
    "Process node": "—",
    "Transistors": "—",
    "Die area": "—",
    "Execution unit": "Xe-core (Xe2)",
    "Units enabled": "8 Xe-cores / 64 vector engines",
    "Matrix engines": "64 XMX engines (8 per Xe-core)",
    "On-chip memory": "192 KB L1/SLM per Xe-core · 8 MiB L2",
    "Memory": "LPDDR5X on the package — shared with the CPU, no frame buffer",
    "Memory bus": "128-bit (on-package)",
    "Memory bandwidth": "136.5 GB/s package peak — shared with the CPU",
    "Board power": "— (the power budget is the processor package's)",
    "Cooling": "— (cooled with the processor)",
    "Host interface": "None — the GPU is in the CPU package",
    "Scale-out link": "None",
  },

  extra: [
    ["Vector engines", "64 (8 per Xe-core)"],
    ["Sub-group (DPAS)", "SIMD16"],
    ["Boost clock", "up to 2,050 MHz (reported by the part)"],
    ["GPU AI throughput (vendor)", "“more than 60 TOPS” — Intel names neither the operand format nor a clock"],
    ["Launch price", "—"],
  ],

  compare: {
    "Execution unit": "Xe-core",
    "Units on die": "8 Xe-cores / 64 vector engines",
    "SIMD width": "8 vector engines per Xe-core; SIMD16 sub-groups",
    "Matrix engine": "XMX, 8 per Xe-core",
    "Matrix engines total": "64",
    "Last-level cache": "8 MiB L2",
    "Memory": "LPDDR5X on package (shared)",
    "Bandwidth": "136.5 GB/s (shared with the CPU)",
    "Board power": "—",
    "Host link": "None — in the CPU package",
  },

  dieMap: {
    title: "Die map — Lunar Lake GPU block (Xe2-LPG)",
    cols: 8, rows: 6, cell: 58, cellH: 42,
    lede: "All 8 Xe2 cores of the 140V configuration, in a four-by-two field. Each core carries 8 vector engines and 8 XMX engines, so the field below is where all 64 XMX engines live — behind 8 MiB of L2 and the on-package LPDDR5X the whole tile shares.",
    hint: "Hover a block for detail. Every Xe-core opens at its own place in the hierarchy below.",
    dataflow: {
      label: "Traced read",
      title: "One read: Xe-core → fabric → L2 → on-package LPDDR5X",
      kind: "stops",
      stops: [[3, 4], [3, 3], [3, 2], [3, 1]],
      note: "An Xe-core that misses in its own 192 KB of L1/SLM crosses the fabric to the 8 MiB L2, and a miss there goes to the LPDDR5X on the package — the same memory the CPU cores on the tile are reading. The last stop is not a frame buffer: capacity and bandwidth are shared with the processor, so a kernel competes with the operating system for both.",
    },
    interconnect: "Drawn as labelled bands rather than a topology: the claim is only that every Xe-core reaches L2 and the package memory through the fabric, and that the memory itself is reached through the same path the CPU uses.",
    tiles: [
      ...band(0, [
        { w: 2, kind: "io", label: "CPU + NPU", sub: "same tile, same memory", path: "pkg",
          detail: "Not a peer on a bus: the P-cores, E-cores and NPU 4 share the compute tile and the on-package memory with this GPU. There is no host-copy step in front of a kernel here — the CPU wrote the weights into the pool the GPU reads them from — and no link a reader can name that is not internal to the package." },
        { w: 3, kind: "sched", label: "Command streamer", sub: "global thread dispatch", path: "cs",
          detail: "The GPU's front end. It consumes the command buffers the driver builds and dispatches thread groups down to the Xe-cores, where each core's own thread dispatcher takes over." },
        { w: 3, kind: "fixed", label: "Display + Media", path: "media",
          detail: "Lunar Lake's new display and media engine microarchitecture — the block that drives panels and transcodes video without spending compute. Neither participates in inference." },
      ]),
      ...memBand(1, 2, 8, "LPDDR5X", () => "on package · shared with the CPU",
        "The 128-bit LPDDR5X interface soldered into the package — 136.5 GB/s at the part's 8,533 MT/s, and that is the whole machine's figure, not the GPU's alone: the CPU cores draw from it too. The blocks are a drawing convenience, NOT a controller count.",
        [["This block", "1 of 2 drawn — not a controller count"],
         ["Its share of bandwidth", "— (split not published)"],
         ["Whole memory subsystem", "128-bit on-package LPDDR5X, 136.5 GB/s peak"],
         ["Owned by", "the package — GPU, CPU and NPU share it; capacity is the processor SKU's"]], "lpddr"),
      ...band(2, [{ w: 8, kind: "cache", label: "L2 cache — 8 MiB", sub: "shared across the GPU block · banked", path: "l2",
        detail: "8 MiB of shared last level — the GPU's own, and the last stop before the on-package memory the rest of the tile also reads. With 136 GB/s behind it rather than discrete-card figures of it, what fits here decides how often a kernel is memory-bound.",
        specs: [["Capacity", "8 MiB"], ["Physically", "banked, not one slab"]] }]),
      ...band(3, [{ w: 8, kind: "link", label: "Xe fabric", sub: "Xe-cores ⇄ L2 ⇄ package memory",
        detail: "The on-block interconnect. Every Xe-core reaches L2 and the package-memory path across it. Drawn as a band rather than a specific topology.",
        specs: [["Reaches", "all 8 Xe-cores"]] }]),
      ...field({
        y0: 4, perRow: 4, rows: 2, w: 2,
        make: (i) => ({
          kind: "compute", label: "Xe-core", sub: `#${i}`,
          path: "xc" + i,
          detail: `Xe-core ${i}. 8 vector engines, 8 XMX engines running DPAS at sub-group 16, and 192 KB of shared L1/SLM — the Xe2 core design, in its integrated 8-core configuration.`,
          specs: [["Vector engines", "8"], ["XMX engines", "8"], ["Shared L1 / SLM", "192 KB"]],
        }),
      }),
    ],
    note: "Nothing here is drawn as disabled: 8 Xe-cores is what this product exposes, and Intel does not publish a larger enabled count on the tile to mark a harvest against. The map draws the GPU block; the CPU cores and NPU it shares the tile with are represented by the one edge they meet at, the package memory. " + MAP_NOTE,
    source: "Intel's Lunar Lake architecture fact sheet and its Xe-architecture documentation for the DPAS surface, with the enabled-unit and matrix facts confirmed by capability reads of the silicon",
  },

  root: {
    id: "card", label: "Arc Graphics 140V", kind: "compute",
    note: "the Xe2 graphics block on the Lunar Lake compute tile — 8 Xe-cores, 64 XMX engines and 8 MiB of L2 in front of LPDDR5X soldered into the package. The interesting difference from the discrete cards is what is not here: no frame buffer, no PCIe endpoint, no power socket. The CPU beside it is its host and its competitor for the same 136.5 GB/s",
    cols: 4,
    children: [
      xeCore(0), xeCore(1), xeCore(2), xeCore(3),
      xeCore(4), xeCore(5), xeCore(6), xeCore(7),
      {
        id: "l2", label: "L2 cache — 8 MiB", kind: "cache", span: 2,
        specs: [["Capacity", "8 MiB"]],
        note: "the shared last level of the GPU block, banked rather than sitting as one slab. Anything that misses here goes to the on-package LPDDR5X at the whole package's 136.5 GB/s — which the CPU is using too, so an L2 miss on a unified part costs more than the same miss on a discrete card",
      },
      {
        id: "lpddr", label: "LPDDR5X on the package", kind: "memory", span: 2,
        specs: [["Bus", "128-bit, on-package"], ["Bandwidth", "136.5 GB/s peak"], ["Owned by", "GPU + CPU + NPU, coherently"]],
        note: "memory soldered into the same package, addressed by the CPU cores beside this GPU as naturally as by the GPU itself — no device allocation, no transfer, no second copy of the weights, and no private pool to budget either: capacity is the laptop's, shared with the operating system. This is the figure a decode loop is really bound by",
      },
      {
        id: "pkg", label: "CPU cores + NPU (same tile)", kind: "sched",
        note: "the rest of the compute tile: the P- and E-cores and the NPU 4 neural engine, reaching the same memory coherently. Not a host across a bus — a set of neighbours drawing from the same pool and cooling budget this block lives in",
      },
      { id: "cs", label: "Command streamer", kind: "sched",
        note: "the GPU's front end. It reads the command buffers the driver builds and dispatches thread groups out to the Xe-cores, where each core's own thread dispatcher places them on its vector engines. Every kernel launch enters the GPU through this block" },
      { id: "media", label: "Media engine", kind: "fixed",
        note: "Lunar Lake's redesigned fixed-function encode and decode, independent of the Xe-cores. Unused by inference, central to what the laptop asks of the chip" },
      { id: "display", label: "Display engine", kind: "io",
        note: "scanout — drives the panel. The always-on job of an integrated GPU, even when its compute side is idle" },
    ],
  },

  sources: [
    ["Intel — Lunar Lake architecture fact sheet (newsroom, June 2024)", "https://download.intel.com/newsroom/2024/client-computing/Lunar-Lake-Architecture-Fact-Sheet.pdf"],
    ["Intel — 2024 Technology Tour Taiwan: Lunar Lake AI hardware accelerators", "https://cdrdv2-public.intel.com/824436/2024_Intel_Tech%20Tour%20TW_Lunar%20Lake%20AI%20Hardware%20Accelerators.pdf"],
    ["Intel — oneAPI GPU Optimization Guide: Intel Xe GPU architecture", "https://www.intel.com/content/www/us/en/docs/oneapi/optimization-guide-gpu/2025-2/intel-xe-gpu-architecture.html"],
    ["Khronos — cl_intel_subgroup_matrix_multiply_accumulate (the DPAS instruction surface)", "https://registry.khronos.org/OpenCL/extensions/intel/cl_intel_subgroup_matrix_multiply_accumulate.html"],
  ],
};
