// Peak throughput figures, and the basis each one was quoted at.
//
// This is the one home for every rate on the site: the comparison pages and the
// per-format pages read it, and both the tables and the bar charts are built
// from these same records, so a chart can never disagree with the table beside
// it.
//
// Three rules this file exists to enforce, because a cross-vendor throughput
// chart is easy to get quietly wrong:
//
//   1. DENSE AND SPARSE ARE NOT THE SAME NUMBER. Vendors quote the sparse
//      figure in marketing — NVIDIA's headline petaFLOP is a 2:4-sparse figure,
//      and its own footnote says so. Every record carries `sparsity`, and a
//      chart draws one of them at a time.
//   2. A PEAK NAMES ITS CLOCK, or says the vendor did not. `basis` is the
//      sentence a reader needs to reconstruct the bar; where it can be checked
//      against the part's own structure the check is written out.
//   3. THE OPERAND IS NOT THE ACCUMULATOR. The rate is quoted for an operand
//      format; what the engine adds into is a separate axis, and it lives in
//      `_dtypes.js` keyed by architecture. The pages join the two rather than
//      collapsing them, because on RDNA 4 and on Tensix one operand has two
//      accumulate widths and the quoted rate does not say which it is for.
//
// Where a figure has no published source it is simply absent, and the pages
// distinguish that from a format the silicon has no path for at all.

// Source classes. `site` means the figure is already on this site's own page
// for that part, which lists where it came from; `vendor` is a vendor page
// named here; `derived` is arithmetic over two figures on one vendor page, and
// the arithmetic is printed rather than the answer alone.
export const SRC_CLASS = {
  site: "already on this site's page for the part",
  vendor: "vendor-published",
  derived: "derived from vendor figures, arithmetic shown",
};

const AMD_R9700 = ["AMD — Radeon AI PRO R9700 specifications",
  "https://www.amd.com/en/products/graphics/workstations/radeon-ai-pro/ai-9000-series/amd-radeon-ai-pro-r9700.html"];
const NV_PRO_6000 = ["NVIDIA — RTX PRO 6000 Blackwell Workstation Edition",
  "https://www.nvidia.com/en-us/products/workstations/professional-desktop-gpus/rtx-pro-6000/"];
const NV_5090 = ["NVIDIA — GeForce RTX 5090 specifications",
  "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5090/"];
const NV_SPARK = ["NVIDIA — DGX Spark specifications",
  "https://www.nvidia.com/en-us/products/workstations/dgx-spark/"];
const TT_BLACKHOLE = ["Tenstorrent — Blackhole cards",
  "https://tenstorrent.com/hardware/blackhole"];

const vendor = (s) => ({ cls: "vendor", text: s[0], href: s[1] });
const site = { cls: "site" };
const derived = (formula, s) => ({ cls: "derived", formula, text: s[0], href: s[1] });

// How a figure was qualified. `unstated` is a real answer and is kept out of
// the charts: a bar whose basis nobody published cannot be compared with one
// whose basis is known, and putting them side by side would invent the
// comparison.
export const SPARSITY = {
  dense: { label: "dense", note: "every element multiplied" },
  sparse: { label: "2:4 sparse", note: "structured sparsity, half the operands skipped" },
  unstated: { label: "basis not stated", note: "the vendor quotes the figure without saying dense or sparse" },
};

// The two throughput classes. They measure different work and never share an
// axis: a vector FLOP is one lane's multiply-add, a systolic FLOP is one cell
// of a matrix engine's array, and the second only counts if the problem is a
// matrix multiply in the first place.
export const CLASSES = {
  vector: {
    label: "Vector throughput",
    unitWork: "one multiply-add per lane per clock, on any shape of problem",
    lede:
      "What the general-purpose lanes do — the rate that applies to elementwise "
      + "work, normalisation, activation and anything that is not a matrix "
      + "multiply. It is the smaller number on every part here, and it is the "
      + "one a kernel falls back to when its shape does not fit the matrix "
      + "engine.",
  },
  systolic: {
    label: "Systolic throughput",
    unitWork: "one multiply-add per cell of the matrix array per clock, on a matrix multiply only",
    lede:
      "What the matrix engine does — a tensor core, an XMX array, an AI "
      + "accelerator, a Tensix FPU. It is an order of magnitude above the vector "
      + "rate and it is unreachable by anything that is not a matrix multiply of "
      + "the shape the engine takes, so the two numbers answer different "
      + "questions and are drawn as two charts rather than one.",
  },
};

// Formats a detail page exists for, and which rows of the numeric-format table
// send the reader to it. A row is linked only where more than one part has a
// published rate for that operand; the rest are left as plain labels, because a
// comparison page with one bar on it is not a comparison.
export const FORMATS = {
  fp32: {
    label: "FP32",
    rows: ["fp32"],
    lede:
      "The widest operand here, and on every one of these architectures it is a "
      + "VECTOR type rather than a matrix one. That is the whole shape of this "
      + "page: six parts have a published FP32 rate and none of them has a "
      + "systolic FP32 rate, because none of these matrix engines takes FP32 as "
      + "an operand — it is what several of them accumulate INTO.",
  },
  fp16: {
    label: "FP16",
    rows: ["fp16"],
    lede:
      "The one operand on this site with both a published vector rate and a "
      + "published matrix rate on the same part, which is what makes it the "
      + "clearest illustration of the gap between the two classes. It is also "
      + "where the accumulate axis bites hardest: two of these four "
      + "architectures will add an FP16 product into either FP16 or FP32, and "
      + "not one of the published rates says which it is for.",
  },
  fp8: {
    label: "FP8",
    rows: ["fp8e4m3", "fp8e5m2"],
    lede:
      "Two encodings, E4M3 and E5M2, and the vendors who publish a rate publish "
      + "one rate for both — AMD names the pair in the row label, Tenstorrent "
      + "names neither. Both rows of the format table therefore point here, "
      + "because there is one published number and it belongs to both of them.",
  },
  int8: {
    label: "INT8",
    rows: ["int8"],
    lede:
      "The most widely published operand of the set: three of the four "
      + "architectures quote a whole-part INT8 matrix rate, and it is the format "
      + "on which the Intel parts are quoted at all — Xe2 has no 8-bit float "
      + "matrix path, so low precision on those parts means integer.",
  },
  fp4: {
    label: "4-bit float",
    rows: ["fp4e2m1", "nvfp4"],
    lede:
      "Only one architecture here has a 4-bit FLOAT matrix path, and its "
      + "published rates are the largest numbers on this site. They are also the "
      + "most easily misread: both figures NVIDIA publishes with a basis are "
      + "2:4-SPARSE, by its own footnote, so the dense chart on this page is "
      + "empty and the sparse one is not. NVIDIA quotes a single 4-bit-float "
      + "rate and does not break it out by encoding, so both the FP4 E2M1 and "
      + "the NVFP4 rows of the format table point here.",
  },
  bfp8: {
    label: "BFP8",
    rows: ["bfp8"],
    lede:
      "Block float — a block of values sharing one exponent — and the only "
      + "format on this site where the empty cells mean something stronger than "
      + "“unpublished”. Three of these four architectures have no hardware path "
      + "for it at all, so this page compares three Tenstorrent cards against "
      + "three genuine absences rather than three unknowns.",
  },
};

// Order the format pages appear in, and the order parts appear along an axis.
export const FORMAT_ORDER = ["fp4", "bfp8", "fp8", "int8", "fp16", "fp32"];

// One record per published rate.
//   sku       the part, by registry id
//   cls       "vector" | "systolic"
//   format    a key of FORMATS
//   sparsity  a key of SPARSITY
//   value     in `unit`, as published
//   quoted    the vendor's own words for the row, where they carry a caveat
//   basis     what the figure was quoted at; a reader reconstructs the bar
//             from this, or reads that nobody published enough to
//   src       site | vendor(...) | derived(...)
export const FIGURES = [
  // --- AMD, RDNA 4 -------------------------------------------------------
  { sku: "r9700", cls: "vector", format: "fp32", sparsity: "dense",
    value: 47.8, unit: "TFLOPS",
    quoted: "Peak Single Precision (FP32 Vector) Performance",
    basis: "4,096 stream processors in 64 CUs at up to 2,920 MHz boost. Reconstructs as 4,096 lanes × 2 FLOP × 2 (dual-issue) × 2.92 GHz.",
    src: vendor(AMD_R9700) },
  { sku: "r9700", cls: "vector", format: "fp16", sparsity: "dense",
    value: 47.8, unit: "TFLOPS",
    quoted: "Peak Half Precision (FP16 Vector) Performance",
    basis: "The same 4,096 lanes at up to 2,920 MHz — the vector FP16 rate on this part equals its FP32 rate rather than doubling it.",
    src: vendor(AMD_R9700) },
  { sku: "r9700", cls: "systolic", format: "fp16", sparsity: "dense",
    value: 191, unit: "TFLOPS",
    quoted: "Peak Half Precision (FP16 Matrix) Performance",
    basis: "128 AI Accelerators in 64 CUs at up to 2,920 MHz. Reconstructs as 64 CU × 1,024 FLOP per clock × 2.92 GHz.",
    src: vendor(AMD_R9700) },
  { sku: "r9700", cls: "systolic", format: "fp16", sparsity: "sparse",
    value: 383, unit: "TFLOPS",
    quoted: "Peak Half Precision (FP16 Matrix) Performance with Structured Sparsity",
    basis: "The dense figure doubled by skipping half the operands; same clock and same engines.",
    src: vendor(AMD_R9700) },
  { sku: "r9700", cls: "systolic", format: "fp8", sparsity: "dense",
    value: 383, unit: "TFLOPS",
    quoted: "Peak 8-bit Precision (FP8 Matrix) Performance (E5M2, E4M3)",
    basis: "128 AI Accelerators at up to 2,920 MHz — twice the FP16 matrix rate, and quoted for both 8-bit float encodings together.",
    src: vendor(AMD_R9700) },
  { sku: "r9700", cls: "systolic", format: "fp8", sparsity: "sparse",
    value: 766, unit: "TFLOPS",
    quoted: "Peak 8-bit Precision (FP8 Matrix) Performance with Structured Sparsity (E5M2, E4M3)",
    basis: "The dense 8-bit float figure doubled by structured sparsity.",
    src: vendor(AMD_R9700) },
  { sku: "r9700", cls: "systolic", format: "int8", sparsity: "dense",
    value: 383, unit: "TOPS",
    quoted: "Peak 8-bit Precision (INT8 Matrix) Performance",
    basis: "128 AI Accelerators at up to 2,920 MHz. Reconstructs as 64 CU × 2,048 ops per clock × 2.92 GHz.",
    src: vendor(AMD_R9700) },
  { sku: "r9700", cls: "systolic", format: "int8", sparsity: "sparse",
    value: 766, unit: "TOPS",
    quoted: "Peak 8-bit Precision (INT8 Matrix) Performance with Structured Sparsity",
    basis: "The dense INT8 figure doubled by structured sparsity.",
    src: vendor(AMD_R9700) },

  // --- Intel, Xe2 --------------------------------------------------------
  { sku: "b50", cls: "vector", format: "fp32", sparsity: "dense",
    value: 10.65, unit: "TFLOPS",
    basis: "16 Xe-cores enabled at 2,600 MHz max dynamic frequency. Reconstructs as 16 × 256 FLOP per clock × 2.6 GHz.",
    src: site },
  { sku: "b50", cls: "systolic", format: "int8", sparsity: "dense",
    value: 170, unit: "TOPS",
    basis: "128 XMX arrays in 16 Xe-cores at 2,600 MHz max dynamic frequency, which puts it within a quarter of a percent of 4,096 ops per Xe-core per clock — the same per-core rate the B70 reconstructs to exactly.",
    src: site },
  { sku: "b70", cls: "vector", format: "fp32", sparsity: "dense",
    value: 22.9, unit: "TFLOPS",
    basis: "32 Xe-cores at 2,800 MHz max dynamic frequency. Reconstructs as 32 × 256 FLOP per clock × 2.8 GHz.",
    src: site },
  { sku: "b70", cls: "systolic", format: "int8", sparsity: "dense",
    value: 367, unit: "TOPS",
    basis: "256 XMX arrays in 32 Xe-cores at 2,800 MHz max dynamic frequency. Reconstructs as 32 × 4,096 ops per clock × 2.8 GHz.",
    src: site },

  // --- NVIDIA, Blackwell -------------------------------------------------
  { sku: "rtx-pro-6000", cls: "vector", format: "fp32", sparsity: "dense",
    value: 125, unit: "TFLOPS",
    quoted: "Single-Precision Performance — 125 TFLOPS",
    basis: "NVIDIA publishes no boost clock for this part on the specification page, so the figure names no clock.",
    src: vendor(NV_PRO_6000) },
  { sku: "rtx-pro-6000", cls: "systolic", format: "fp4", sparsity: "sparse",
    value: 4000, unit: "TOPS",
    quoted: "AI Performance — 4000 TOPS, footnoted “Theoretical FP4 TOPS using sparsity”",
    basis: "2:4 sparse, by NVIDIA's own footnote. No clock is published for this part, so the figure names none; the dense rate is not published either.",
    src: vendor(NV_PRO_6000) },
  { sku: "rtx-5090", cls: "vector", format: "fp32", sparsity: "dense",
    value: 104.9, unit: "TFLOPS",
    basis: "21,760 CUDA cores × 2 FLOP × 2.41 GHz boost = 104.9 TFLOPS. Both inputs are on NVIDIA's specification page; the product is not, so this bar is arithmetic rather than a quotation.",
    src: derived("21,760 × 2 × 2.41 GHz", NV_5090) },
  { sku: "dgx-spark", cls: "vector", format: "fp32", sparsity: "dense",
    value: 31, unit: "TFLOPS",
    basis: "No GPU clock is published for GB10, so the figure names none.",
    src: site },
  { sku: "dgx-spark", cls: "systolic", format: "fp4", sparsity: "sparse",
    value: 1000, unit: "TFLOPS",
    quoted: "Tensor Performance — Up to 1 PFLOP FP4, footnoted “Theoretical FP4 TOPS using the sparsity feature”",
    basis: "2:4 sparse, by NVIDIA's own footnote — the headline petaFLOP is not a dense number. No clock is published, and neither is the dense rate.",
    src: vendor(NV_SPARK) },

  // --- Tenstorrent, Tensix ----------------------------------------------
  { sku: "n150d", cls: "systolic", format: "fp8", sparsity: "dense",
    value: 262, unit: "TFLOPS",
    quoted: "FP8 — the encoding is not named",
    basis: "72 Tensix enabled at the 1 GHz AI clock. Tenstorrent does not publish a per-tile rate, and this figure does not land on a round one.",
    src: site },
  { sku: "n150d", cls: "systolic", format: "bfp8", sparsity: "dense",
    value: 148, unit: "TFLOPS",
    quoted: "BLOCKFP8",
    basis: "72 Tensix at the 1 GHz AI clock, which puts it within half a percent of 2,048 FLOP per tile per clock.",
    src: site },
  { sku: "n150d", cls: "systolic", format: "fp16", sparsity: "dense",
    value: 74, unit: "TFLOPS",
    basis: "72 Tensix at the 1 GHz AI clock — half the block-float rate on the same engines.",
    src: site },
  { sku: "n300d", cls: "systolic", format: "fp8", sparsity: "dense",
    value: 466, unit: "TFLOPS",
    quoted: "FP8 — the encoding is not named",
    basis: "128 Tensix across the card's two ASICs at the 1 GHz AI clock. Whole-card, not per ASIC.",
    src: site },
  { sku: "n300d", cls: "systolic", format: "bfp8", sparsity: "dense",
    value: 262, unit: "TFLOPS",
    quoted: "BLOCKFP8",
    basis: "128 Tensix across two ASICs at the 1 GHz AI clock. Whole-card.",
    src: site },
  { sku: "n300d", cls: "systolic", format: "fp16", sparsity: "dense",
    value: 131, unit: "TFLOPS",
    basis: "128 Tensix across two ASICs at the 1 GHz AI clock. Whole-card.",
    src: site },
  { sku: "p150a", cls: "systolic", format: "bfp8", sparsity: "dense",
    value: 664, unit: "TFLOPS",
    quoted: "TeraFLOPS (BLOCKFP8) — 664",
    basis: "120 Tensix at the 1.35 GHz AI clock, which puts it within a tenth of a percent of 4,096 FLOP per tile per clock — twice Wormhole's block-float rate on the same axis.",
    src: vendor(TT_BLACKHOLE) },
];

// Headline figures a vendor publishes with no stated format, accumulate or
// sparsity basis. They are real and they are quoted here, and they are kept out
// of every chart: a bar that cannot be reconstructed cannot be compared, and
// drawing it beside bars that can would manufacture the comparison.
export const UNSTATED = [
  { sku: "rtx-5090", value: 3352, unit: "AI TOPS",
    quoted: "Tensor Cores (AI) — 5th Generation, 3352 AI TOPS",
    why: "NVIDIA's GeForce specification page carries no footnote defining AI TOPS: it names no operand format, no accumulate width and no sparsity basis. The professional part on the same die publishes its comparable figure as “Theoretical FP4 TOPS using sparsity”, but that footnote is on the other page and is not this one's.",
    src: vendor(NV_5090) },
];

// Memory bandwidth, the one rate every part on the site publishes. `scope` is
// load-bearing: two of these cards are two ASICs, and the vendor quotes the
// figure PER ASIC. Drawing that against a single-die card's whole-card figure
// without saying so would be a different chart than it looks like.
export const BANDWIDTH = [
  { sku: "r9700", value: 640, scope: "whole card", src: vendor(AMD_R9700),
    basis: "256-bit GDDR6." },
  { sku: "b50", value: 224, scope: "whole card", src: site, basis: "128-bit GDDR6." },
  { sku: "b70", value: 608, scope: "whole card", src: site, basis: "256-bit GDDR6 at 19 Gbps." },
  { sku: "rtx-pro-6000", value: 1792, scope: "whole card", src: vendor(NV_PRO_6000),
    basis: "512-bit GDDR7 with ECC." },
  { sku: "rtx-5090", value: 1792, scope: "whole card", src: vendor(NV_5090),
    basis: "512-bit GDDR7." },
  { sku: "dgx-spark", value: 273, scope: "shared with the CPU", src: site,
    basis: "256-bit LPDDR5X. This is system memory, not a frame buffer: the twenty Arm cores on the package are drawing from the same figure." },
  { sku: "n150d", value: 288, scope: "whole card", src: site, basis: "GDDR6, one ASIC on the card." },
  { sku: "n300d", value: 288, scope: "per ASIC", src: site,
    basis: "GDDR6. Tenstorrent quotes this per ASIC and the card carries two, each with its own pool — it is not one 576 GB/s pool and is not drawn as one." },
  { sku: "p150a", value: 512, scope: "whole card", src: vendor(TT_BLACKHOLE),
    basis: "GDDR6, one ASIC on the card." },
  { sku: "p300c", value: 512, scope: "per ASIC", src: site,
    basis: "GDDR6, quoted per ASIC; the card carries two, each with its own pool." },
];

export const BANDWIDTH_UNIT = "GB/s";

// Helpers the pages share, so the filtering rule lives in one place.
export const figuresFor = (format, cls) =>
  FIGURES.filter((f) => f.format === format && f.cls === cls);

export const figuresIn = (cls) => FIGURES.filter((f) => f.cls === cls);

// Which format keys a numeric-format-table row links to, if any.
export const ROW_FORMAT = (() => {
  const m = {};
  for (const [key, f] of Object.entries(FORMATS)) for (const r of f.rows) m[r] = key;
  return m;
})();
