// AMD Radeon AI PRO R9700 -- RDNA 4 (Navi 48).
// Every figure here is from a published vendor or press source; see `sources`.

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
    { id: "vgpr", label: "Vector register file", kind: "cache", span: 3 },
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
    { id: "l0", label: "L0 vector cache", kind: "cache" },
    { id: "tex", label: "Texture units", kind: "fixed", note: "4 per CU" },
    { id: "sched-cu", label: "Instruction issue", kind: "sched" },
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
    { id: "geo", label: "Geometry + rasterizer", kind: "fixed", span: 2 },
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
    ["Die area", "357 mm²"],
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
      { id: "pcie", label: "PCIe 5.0 ×16", kind: "io" },
      { id: "media", label: "Media engine", kind: "fixed", note: "encode / decode" },
      { id: "display", label: "Display engine", kind: "io" },
    ],
  },

  sources: [
    ["AMD — Radeon AI PRO R9700 datasheet (PDF)", "https://www.amd.com/content/dam/amd/en/documents/partner-hub/radeon-pro/radeon-ai-pro-r9700-datasheet.pdf"],
    ["AMD — RDNA 4 architecture, Hot Chips 2025 (PDF)", "https://hc2025.hotchips.org/assets/program/conference/day1/8_amd_pomianowski_final.pdf"],
    ["VideoCardz — AMD introduces Radeon AI PRO R9700", "https://videocardz.com/newz/amd-introduces-radeon-ai-pro-r9700-with-32gb-vram-and-navi-48-gpu"],
  ],
};
