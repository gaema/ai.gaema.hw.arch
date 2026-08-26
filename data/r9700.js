// AMD Radeon AI PRO R9700 -- RDNA 4 (Navi 48).
// Every figure here is from a published vendor or press source; see `sources`.

import { band, field, memBand, MAP_NOTE } from "./_floorplan.js";

const simd32 = {
  id: "simd32", label: "SIMD32", kind: "compute", count: "2 per CU",
  note: "32-lane vector unit",
  specs: [
    ["Lanes", "32"],
    ["Wave modes", "wave32 / wave64"],
    ["Per SIMD", "2 ALUs + 1 TLU"],
  ],
  cols: 3,
  children: [
    { id: "alu-a", label: "ALU", kind: "compute", note: "FMA / INT" },
    { id: "alu-b", label: "ALU", kind: "compute", note: "FMA / INT" },
    { id: "tlu", label: "TLU", kind: "compute", note: "transcendentals" },
    { id: "vgpr", label: "Vector register file", kind: "cache", span: 3,
      note: "192 KB per SIMD. RDNA 4 allocates it DYNAMICALLY — a kernel takes what it asks for rather than a fixed slice, so a register-hungry kernel runs with fewer waves instead of failing to fit, and a lean one gets more. At 96 or fewer registers per lane all 16 wave slots fill",
      specs: [["Per SIMD", "192 KB"], ["Wave slots", "16"], ["Full occupancy at", "≤96 VGPRs"], ["Allocation", "dynamic (new in RDNA 4)"]] },
  ],
};

const cu = {
  id: "cu", label: "Compute Unit", kind: "compute", count: "64 on the die",
  note: "2 SIMD32 + 2 AI accelerators + 1 RT core",
  specs: [
    ["CUs on die", "64"],
    ["Stream processors / CU", "64"],
    ["AI accelerators / CU", "2 (2nd gen)"],
    ["Ray tracing cores / CU", "1 (3rd gen)"],
  ],
  cols: 4,
  children: [
    { ...simd32, id: "simd32-a" },
    { ...simd32, id: "simd32-b" },
    {
      id: "ai-acc", label: "AI Accelerator ×2", kind: "matrix",
      note: "2× RDNA 3 rate at FP16/BF16, 4× at INT8/INT4",
      specs: [
        ["Per CU", "2"],
        ["On the die", "128"],
        ["vs RDNA 3, FP16 / BF16", "2× per CU"],
        ["vs RDNA 3, INT8 / INT4", "4× per CU"],
      ],
    },
    { id: "rt", label: "Ray Tracing core", kind: "fixed", note: "3rd generation" },
    { id: "scalar", label: "Scalar unit", kind: "sched", note: "uniform work + branch" },
    { id: "l0", label: "L0 vector cache", kind: "cache",
      note: "32 KB per compute unit — the first thing a vector memory access hits, about 30 cycles away. RDNA 4 reorganised the L0: 64 KB per WGP in total, against RDNA 3's larger-but-differently-split arrangement",
      specs: [["Per CU", "32 KB"], ["Per WGP", "64 KB"], ["Latency", "~30 cycles"]] },
    { id: "tex", label: "Texture units", kind: "fixed", note: "4 per CU" },
    { id: "sched-cu", label: "Instruction issue", kind: "sched",
      note: "fetches and issues for the waves resident on this CU, choosing among them each cycle and steering each instruction to the right pipe — vector, scalar, matrix, memory or branch. As on every GPU here, latency is hidden by switching waves rather than by reordering" },
  ],
};

const wgp = {
  id: "wgp", label: "Work Group Processor", kind: "compute", count: "32 on the die",
  note: "a CU pair sharing one LDS",
  specs: [["Compute units", "2"], ["WGPs on die", "32"]],
  cols: 3,
  children: [
    { ...cu, id: "cu-a", label: "Compute Unit 0", count: null },
    { ...cu, id: "cu-b", label: "Compute Unit 1", count: null },
    { id: "lds", label: "Local Data Share", kind: "cache", note: "shared by both CUs" },
  ],
};

const shaderArray = {
  id: "sa", label: "Shader Array", kind: "compute",
  note: "4 WGPs behind a shared L1",
  specs: [["WGPs", "4"], ["Compute units", "8"]],
  cols: 4,
  children: [
    { ...wgp, id: "wgp0", label: "WGP 0", count: null },
    { ...wgp, id: "wgp1", label: "WGP 1", count: null },
    { ...wgp, id: "wgp2", label: "WGP 2", count: null },
    { ...wgp, id: "wgp3", label: "WGP 3", count: null },
    { id: "l1", label: "L1 cache", kind: "cache", span: 4, note: "shared across the array" },
  ],
};

const shaderEngine = {
  id: "se", label: "Shader Engine", kind: "compute", count: "4 on the die",
  note: "2 shader arrays + geometry front end",
  specs: [["Shader arrays", "2"], ["WGPs", "8"], ["Compute units", "16"]],
  cols: 2,
  children: [
    { ...shaderArray, id: "sa0", label: "Shader Array 0" },
    { ...shaderArray, id: "sa1", label: "Shader Array 1" },
    { id: "geo", label: "Geometry + rasterizer", kind: "fixed", span: 2,
      note: "the shader engine's own graphics front end: primitive assembly, culling and rasterization into fragments. One per shader engine, so geometry throughput scales with the four engines rather than sitting in a single central block. Idle in pure compute" },
  ],
};

export default {
  id: "r9700",
  name: "Radeon AI PRO R9700",
  vendor: "AMD",
  vendorKey: "amd",
  arch: "RDNA 4",
  die: "Navi 48",
  tagline:
    "AMD's first RDNA 4 professional card: 64 compute units, 128 second-generation AI accelerators, and 32 GB of GDDR6 behind a 64 MB Infinity Cache.",

  headline: [
    ["Architecture", "RDNA 4"],
    ["Die", "Navi 48, 4 nm"],
    ["Transistors", "53.9 B"],
    ["Die area", "356.5 mm²"],
    ["Compute units", "64"],
    ["Stream processors", "4,096"],
    ["AI accelerators", "128 (2nd gen)"],
    ["Ray tracing cores", "64 (3rd gen)"],
    ["Memory", "32 GB GDDR6"],
    ["Memory bus", "256-bit"],
    ["Memory bandwidth", "640 GB/s"],
    ["L2 cache", "8 MB"],
    ["Infinity Cache", "64 MB (3rd gen)"],
    ["Board power", "300 W"],
    ["Host interface", "PCIe 5.0 ×16"],
  ],

  // Rows the cross-vendor matrix on the landing page reads.
  compare: {
    "Execution unit": "Compute Unit (CU)",
    "Units on die": "64 CU / 32 WGP",
    "SIMD width": "2 × SIMD32 per CU",
    "Matrix engine": "AI Accelerator, 2 per CU",
    "Matrix engines total": "128",
    "Last-level cache": "64 MB Infinity Cache",
    "Memory": "32 GB GDDR6",
    "Bandwidth": "640 GB/s",
    "Board power": "300 W",
    "Host link": "PCIe 5.0 ×16",
  },

  dieMap: {
    title: "Die map — Navi 48",
    cols: 16, rows: 12, cell: 58, cellH: 42,
    lede: "All 32 work group processors — the 64 compute units — sitting between the two cache levels that feed them and the GDDR6 controllers on the die edges. Four shader engines, two shader arrays each, four WGPs per array.",
    hint: "Hover a block for detail. Every WGP opens at its own place in the hierarchy below.",
    dataflow: {
      label: "Trace a read",
      title: "One read: WGP → Infinity Fabric → L2 → Infinity Cache → GDDR6",
      kind: "stops",
      stops: [[6, 5], [6, 4], [6, 3], [6, 2], [6, 1]],
      note: "A WGP that misses locally crosses the Infinity Fabric to L2; a miss there goes to the Infinity Cache, and only a miss THERE reaches GDDR6. That extra level is the whole argument for a 64 MB memory-side cache on a 256-bit bus: most of the traffic that would have become DRAM reads stops one level early, so the part behaves as though its bus were wider than it is.",
    },
    interconnect: "Drawn as the two Infinity Fabric bands the compute field sits between. Unlike Blackhole, this is not a mesh with a router in every tile: the WGPs reach L2, the Infinity Cache and the memory controllers through a shared fabric, so the honest picture is a bus band rather than tile-to-tile links. Both bands are the same interconnect reaching both memory edges.",
    tiles: [
      ...band(0, [
        { w: 5, kind: "io", label: "PCIe 5.0 ×16", path: "pcie",
          detail: "Host interface. PCIe 5.0 ×16." },
        { w: 6, kind: "sched", label: "Command processor", sub: "+ ACEs", path: "cp",
          detail: "The graphics/compute front end: it takes work from the host and hands it to the shader engines." },
        { w: 5, kind: "fixed", label: "Display + Media", path: "media",
          detail: "Display engine and the media block — video encode and decode." },
      ]),
      ...memBand(1, 2, 16, "GDDR6", (i) => `4×16-bit ctrl ${i}`,
        "One of the FOUR memory controllers that make the 256-bit GDDR6 interface. AMD's own block diagram describes them as four 4×16 controllers — 64 bits each — not as eight 32-bit ones. 640 GB/s comes from 256 bits × 20 Gbps.",
        [["This block", "1 of 4 · 4×16-bit (64-bit)"], ["Its share of bandwidth", "160 GB/s"],
         ["Whole memory subsystem", "four 4×16 controllers, 256-bit, 640 GB/s"], ["DRAM on the board", "32 GB GDDR6"]]),
      ...band(2, [{ w: 16, kind: "cache", label: "Infinity Cache — 64 MB", sub: "3rd generation, memory-attached · banked", path: "mall",
        detail: "The last level before GDDR6. It sits in front of memory, so a hit here never leaves for the bus at all — the reason a 256-bit part keeps up. Memory-attached means exactly that: it is banked with the memory controllers along the die edges, not the single central slab drawn here.",
        specs: [["Capacity", "64 MB"], ["Generation", "3rd"], ["Physically", "banked with the memory controllers"]] }]),
      ...band(3, [{ w: 16, kind: "cache", label: "L2 cache — 8 MB", sub: "shared by all four shader engines · banked", path: "l2",
        detail: "8 MB shared across the die, between the per-array L1s and the Infinity Cache. Also banked into slices rather than one block; drawn as a band here for legibility.",
        specs: [["Capacity", "8 MB"], ["Physically", "banked into slices"]] }]),
      ...band(4, [{ w: 16, kind: "link", label: "Infinity Fabric", sub: "shader engines ⇄ L2 ⇄ Infinity Cache ⇄ memory controllers",
        detail: "AMD's on-die interconnect. Every WGP reaches the cache levels and the memory controllers through it — there is no direct path from a compute unit to DRAM that does not cross this fabric, which is why the cache levels above sit between it and memory.",
        specs: [["Reaches", "all 32 WGPs"], ["Ties together", "L2, Infinity Cache, memory, front end"]] }]),
      ...field({
        y0: 5, perRow: 8, rows: 4, w: 2,
        make: (i, c, r) => {
          const se = (r < 2 ? 0 : 2) + (c < 4 ? 0 : 1);
          const within = (r % 2) * 4 + (c % 4);   // 0..7 inside this shader engine
          const sa = within < 4 ? 0 : 1;
          return {
            kind: "compute", label: "WGP", sub: `SE${se} · ${within}`,
            path: `se${se}/sa${sa}/wgp${within % 4}`,
            detail: `Work group processor ${within} of shader engine ${se}, in shader array ${sa}. Two compute units sharing one Local Data Share — 4 SIMD32 vector units, 4 AI accelerators and 2 ray tracing cores in all.`,
            specs: [["Compute units", "2"], ["SIMD32 units", "4"], ["AI accelerators", "4"]],
          };
        },
      }),
      ...band(9, [{ w: 16, kind: "link", label: "Infinity Fabric", sub: "the same fabric, reaching the other memory edge",
        detail: "The compute field is drawn between two runs of the same fabric because it reaches both memory edges — the two bands are one interconnect, not two.",
        specs: [["Reaches", "all 32 WGPs"], ["Ties together", "L2, Infinity Cache, memory, front end"]] }]),
      ...memBand(10, 2, 16, "GDDR6", (i) => `4×16-bit ctrl ${2 + i}`,
        "One of the FOUR memory controllers that make the 256-bit GDDR6 interface. AMD's own block diagram describes them as four 4×16 controllers — 64 bits each — not as eight 32-bit ones. 640 GB/s comes from 256 bits × 20 Gbps.",
        [["This block", "1 of 4 · 4×16-bit (64-bit)"], ["Its share of bandwidth", "160 GB/s"],
         ["Whole memory subsystem", "four 4×16 controllers, 256-bit, 640 GB/s"], ["DRAM on the board", "32 GB GDDR6"]]),
      ...band(11, [{ w: 16, kind: "fixed", label: "Geometry + rasterizers", sub: "one front end per shader engine",
        detail: "The fixed-function graphics front end of each shader engine — geometry setup and rasterization." }]),
    ],
    note: "Nothing on this die is drawn as disabled, and that is the fact rather than an omission: the R9700 takes all 64 of Navi 48's compute units, so unlike the Blackwell and Blackhole parts here it is a full die with no harvest to mark. " + MAP_NOTE,
    source: "AMD's RDNA 4 architecture material (Hot Chips 2025) and the R9700 datasheet",
  },

  root: {
    id: "card", label: "Radeon AI PRO R9700", kind: "compute",
    note: "single Navi 48 die on a PCIe 5.0 ×16 card",
    cols: 4,
    children: [
      { ...shaderEngine, count: null, id: "se0", label: "Shader Engine 0" },
      { ...shaderEngine, count: null, id: "se1", label: "Shader Engine 1" },
      { ...shaderEngine, count: null, id: "se2", label: "Shader Engine 2" },
      { ...shaderEngine, count: null, id: "se3", label: "Shader Engine 3" },
      {
        id: "l2", label: "L2 cache", kind: "cache", span: 2,
        specs: [["Capacity", "8 MB"]],
        note: "8 MB, shared by all four shader engines",
      },
      {
        id: "mall", label: "Infinity Cache", kind: "cache", span: 2,
        specs: [["Capacity", "64 MB"], ["Generation", "3rd"]],
        note: "64 MB memory-attached last level, in front of GDDR6",
      },
      {
        id: "gddr", label: "GDDR6 memory controllers", kind: "memory", span: 2,
        specs: [["Capacity", "32 GB"], ["Bus", "256-bit"], ["Bandwidth", "640 GB/s"]],
        note: "256-bit bus, 32 GB, 640 GB/s",
      },
      { id: "cp", label: "Command processor", kind: "sched", note: "front end + ACEs" },
      { id: "pcie", label: "PCIe 5.0 ×16", kind: "io",
        note: "the host link. 16 lanes of PCIe 5.0, about 63 GB/s each way — roughly a tenth of this card's own 640 GB/s, so anything that has to cross it is a different performance regime from anything that stays in VRAM",
        specs: [["Lanes", "16"], ["Generation", "PCIe 5.0"], ["Bandwidth", "~63 GB/s per direction"]] },
      { id: "media", label: "Media engine", kind: "fixed", note: "encode / decode" },
      { id: "display", label: "Display engine", kind: "io",
        note: "scanout — reads finished framebuffers and drives the outputs. Idle on a card doing only inference" },
    ],
  },

  sources: [
    ["AMD — Radeon AI PRO R9700 datasheet (PDF)", "https://www.amd.com/content/dam/amd/en/documents/partner-hub/radeon-pro/radeon-ai-pro-r9700-datasheet.pdf"],
    ["AMD — RDNA 4 architecture, Hot Chips 2025 (PDF)", "https://hc2025.hotchips.org/assets/program/conference/day1/8_amd_pomianowski_final.pdf"],
    ["VideoCardz — AMD introduces Radeon AI PRO R9700", "https://videocardz.com/newz/amd-introduces-radeon-ai-pro-r9700-with-32gb-vram-and-navi-48-gpu"],
  ],
};
