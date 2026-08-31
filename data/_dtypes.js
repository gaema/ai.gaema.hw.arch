// Numeric formats each matrix engine accepts as an operand, and what it
// accumulates into. Shared across SKUs the way the other `_`-prefixed modules
// are: this is an ARCHITECTURE property, so the two Blackwell cards answer
// identically and so do the two Blackhole cards.
//
// Every figure is from the vendor's own ISA or extension documentation -- the
// per-architecture `source` below names it. Rows run smallest operand first.
//
// Two things a support table usually leaves out and this one carries:
//
//   1. The ACCUMULATOR. A matrix instruction multiplies in one format and adds
//      in another, and the second is almost never the same width as the first.
//      Without it "INT4" looks like 4-bit arithmetic, which it is not.
//   2. The distinction between an operand the MATRIX engine takes and one only
//      the vector ALU takes. Both are "supported"; only the first runs at
//      matrix rate.

export const LEVEL = {
  matrix: "matrix operand",
  vector: "vector ALU only",
  convert: "convert to a wider type first",
  none: "—",
};

// [key, label, operand width in bits]. TF32 sits at 19 -- its information
// width, 8 exponent + 10 mantissa + sign -- rather than at the 32-bit container
// it travels in, because 19 is what makes it comparable to its neighbours here.
export const ROWS = [
  ["int1", "INT1", 1],
  ["int2", "INT2", 2],
  ["int4", "INT4", 4],
  ["fp4e2m1", "FP4 E2M1", 4],
  ["nvfp4", "NVFP4", 4],
  ["mxfp4", "MXFP4", 4],
  ["bfp4", "BFP4", 4],
  ["fp6e3m2", "FP6 E3M2", 6],
  ["fp6e2m3", "FP6 E2M3", 6],
  ["mxfp6", "MXFP6", 6],
  ["int8", "INT8", 8],
  ["uint8", "UINT8", 8],
  ["fp8e4m3", "FP8 E4M3", 8],
  ["fp8e5m2", "FP8 E5M2", 8],
  ["mxfp8", "MXFP8", 8],
  ["bfp8", "BFP8", 8],
  ["fp16", "FP16", 16],
  ["bf16", "BF16", 16],
  ["tf32", "TF32", 19],
  ["fp32", "FP32", 32],
  ["fp64", "FP64", 64],
];

// m(acc) = a matrix operand accumulating into `acc`.
const m = (acc) => ({ level: "matrix", acc });
const v = { level: "vector" };
const c = { level: "convert" };
const n = { level: "none" };

export const ARCH = {
  blackwell: {
    label: "Blackwell",
    engine: "5th-generation Tensor Core",
    note:
      "The widest float operand range here: 4-, 6- and 8-bit floats are all "
      + "tensor-core inputs in their own right, and each has a block-scaled form "
      + "sharing one exponent across a block. The sub-byte INTEGER operand its "
      + "two predecessors had is gone — the 4-bit path this generation added is "
      + "float. INT4 and INT1 still assemble and still compute the right answer, "
      + "but they lower to a software sequence around the 8-bit tensor path, so "
      + "they are a compatibility route rather than a fast one.",
    source: [
      ["NVIDIA — CUDA C++ Programming Guide, tensor-core input types by compute capability",
       "https://docs.nvidia.com/cuda/cuda-c-programming-guide/index.html"],
      ["NVIDIA — PTX ISA, warp-level matrix instructions",
       "https://docs.nvidia.com/cuda/parallel-thread-execution/index.html"],
      ["Open Compute Project — OCP Microscaling Formats (MX) specification",
       "https://www.opencompute.org/documents/ocp-microscaling-formats-mx-v1-0-spec-final-pdf"],
    ],
    dtypes: {
      int1: c, int2: c, int4: c,
      fp4e2m1: m("FP32"), nvfp4: m("FP32"), mxfp4: m("FP32"), bfp4: n,
      fp6e3m2: m("FP32"), fp6e2m3: m("FP32"), mxfp6: m("FP32"),
      int8: m("INT32"), uint8: m("INT32"),
      fp8e4m3: m("FP32"), fp8e5m2: m("FP32"), mxfp8: m("FP32"), bfp8: n,
      fp16: m("FP32"), bf16: m("FP32"), tf32: m("FP32"),
      fp32: v, fp64: v,
    },
  },

  rdna4: {
    label: "RDNA 4",
    engine: "WMMA matrix cores",
    note:
      "The only architecture here that will accumulate a 16-bit float into a "
      + "16-bit float: FP16 and BF16 each have a narrow-accumulate form beside "
      + "the FP32 one, halving accumulator traffic at the cost of range. It "
      + "keeps a real 4-bit INTEGER matrix operand — in two shapes, one packing "
      + "twice the depth per lane — and adds both 8-bit float encodings, "
      + "including the mixed pairing of one against the other. No block-scaled "
      + "format and no 4-bit float.",
    source: [
      ['AMD — "RDNA 4" Instruction Set Architecture Reference Guide',
       "https://gpuopen.com/learn/rdna4-isa-guide/"],
      ["AMD — RDNA 4 architecture, Hot Chips 2025 (PDF)",
       "https://hc2025.hotchips.org/assets/program/conference/day1/8_amd_pomianowski_final.pdf"],
    ],
    dtypes: {
      int1: c, int2: c, int4: m("INT32"),
      fp4e2m1: c, nvfp4: n, mxfp4: n, bfp4: n,
      fp6e3m2: c, fp6e2m3: c, mxfp6: n,
      int8: m("INT32"), uint8: m("INT32"),
      fp8e4m3: m("FP32"), fp8e5m2: m("FP32"), mxfp8: n, bfp8: n,
      fp16: m("FP16 / FP32"), bf16: m("BF16 / FP32"), tf32: n,
      fp32: v, fp64: v,
    },
  },

  xe2: {
    label: "Xe2 (Battlemage)",
    engine: "XMX systolic array",
    note:
      "The integer specialist. It is the only architecture here with a 2-bit "
      + "matrix operand, and it carries an unusually wide set of unsigned and "
      + "mixed-sign integer pairings — signed against unsigned, 8-bit against "
      + "4-bit — as separate instructions rather than as a single signed form. "
      + "Against that, it is the only matrix engine here with no 8-bit float at "
      + "all: low precision on this part means integer.",
    source: [
      ["Khronos — cl_intel_subgroup_matrix_multiply_accumulate",
       "https://registry.khronos.org/OpenCL/extensions/intel/cl_intel_subgroup_matrix_multiply_accumulate.html"],
      ["Intel — oneAPI DPC++ joint_matrix extension, supported combinations",
       "https://github.com/intel/llvm/blob/sycl/sycl/doc/extensions/experimental/sycl_ext_matrix/sycl_ext_oneapi_matrix.asciidoc"],
    ],
    dtypes: {
      int1: c, int2: m("INT32"), int4: m("INT32"),
      fp4e2m1: c, nvfp4: n, mxfp4: n, bfp4: n,
      fp6e3m2: c, fp6e2m3: c, mxfp6: n,
      int8: m("INT32"), uint8: m("INT32"),
      fp8e4m3: c, fp8e5m2: c, mxfp8: n, bfp8: n,
      fp16: m("FP32"), bf16: m("FP32"), tf32: m("FP32"),
      fp32: v, fp64: n,
    },
  },

  tensix: {
    label: "Tensix",
    engine: "Tensix matrix unit (FPU)",
    note:
      "The odd one out in two ways. Its native narrow formats are BLOCK FLOAT "
      + "— a block of values sharing one exponent, each element carrying a sign "
      + "and mantissa — so an element's width is its share of a block rather "
      + "than a standalone number, and neither BFP8 nor BFP4 maps onto any "
      + "scalar column. And its accumulator is not fixed by the instruction: "
      + "results land in the DEST register file, which holds twice as many "
      + "entries in 16-bit mode as in 32-bit, making accumulator width a "
      + "per-kernel choice with a capacity cost rather than a property of the "
      + "operand.",
    source: [
      ["Tenstorrent — tt-isa-documentation, Blackhole",
       "https://github.com/tenstorrent/tt-isa-documentation/blob/main/BlackholeA0/README.md"],
      ["Tenstorrent — Blackhole & TT-Metalium, Hot Chips 2024 (PDF)",
       "https://hc2024.hotchips.org/assets/program/conference/day1/88_HC2024.Tenstorrent.Jasmina.Davor.v7.pdf"],
    ],
    dtypes: {
      int1: c, int2: c, int4: c,
      fp4e2m1: n, nvfp4: n, mxfp4: n, bfp4: m("FP16 / FP32"),
      fp6e3m2: n, fp6e2m3: n, mxfp6: n,
      int8: m("INT32"), uint8: m("INT32"),
      fp8e4m3: c, fp8e5m2: c, mxfp8: n, bfp8: m("FP16 / FP32"),
      fp16: m("FP16 / FP32"), bf16: m("FP16 / FP32"), tf32: m("FP16 / FP32"),
      fp32: v, fp64: n,
    },
  },
};

// Which architecture answers for each SKU. Two cards per architecture on both
// the NVIDIA and the Tenstorrent side, and they answer identically -- that is
// the point of keying this by architecture rather than by part.
export const SKU_ARCH = {
  "r9700": "rdna4",
  "b50": "xe2",
  "b70": "xe2",
  "rtx-pro-6000": "blackwell",
  "rtx-5090": "blackwell",
  "p150a": "tensix",
  "p300c": "tensix",
};

// Column order for the table: one column per architecture, not per SKU.
export const ARCH_ORDER = ["rdna4", "xe2", "blackwell", "tensix"];
