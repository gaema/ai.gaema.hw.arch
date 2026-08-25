// NVIDIA RTX PRO 6000 Blackwell -- GB202, 188 of 192 SMs enabled.
// Every figure here is from a published vendor or press source; see `sources`.

import { die, dieMap } from "./_blackwell.js";

export default {
  id: "rtx-pro-6000",
  name: "RTX PRO 6000 Blackwell",
  vendor: "NVIDIA",
  vendorKey: "nvidia",
  arch: "Blackwell",
  die: "GB202",
  tagline:
    "The largest shipping GB202: 188 of 192 SMs enabled, 24,064 CUDA cores, 752 fifth-generation Tensor Cores, and 96 GB of GDDR7. This page is the 600 W Workstation Edition — the Max-Q and Server cards are separate products in the same family and their figures are not mixed in here.",

  headline: [
    ["Architecture", "Blackwell"],
    ["Die", "GB202, TSMC 4NP"],
    ["Transistors", "92.2 B"],
    ["Die area", "~750 mm²"],
    ["SMs enabled", "188 of 192"],
    ["CUDA cores", "24,064"],
    ["Tensor Cores", "752 (5th gen)"],
    ["RT Cores", "188 (4th gen)"],
    ["FP32", "~125 TFLOPS"],
    ["Memory", "96 GB GDDR7 ECC"],
    ["Memory bus", "512-bit"],
    ["Memory bandwidth", "1,792 GB/s"],
    ["Memory controllers", "8 × 64-bit"],
    ["L2 cache", "128 MB (full GB202)"],
    ["Board power", "600 W"],
    ["Host interface", "PCIe 5.0 ×16"],
  ],

  compare: {
    "Execution unit": "Streaming Multiprocessor (SM)",
    "Units on die": "188 SM enabled (192 on the die)",
    "SIMD width": "4 × 32-wide processing blocks per SM",
    "Matrix engine": "Tensor Core (5th gen), 4 per SM",
    "Matrix engines total": "752",
    "Last-level cache": "128 MB L2 (full GB202)",
    "Memory": "96 GB GDDR7 ECC",
    "Bandwidth": "1,792 GB/s",
    "Board power": "600 W",
    "Host link": "PCIe 5.0 ×16",
  },

  dieMap: dieMap({
    activeSMs: 188, mem: "96 GB", bw: "1,792 GB/s",
    l2: "128 MB", l2Note: "the full GB202 complement — this card is the one that gets all of it.",
  }),

  root: {
    id: "card", label: "RTX PRO 6000 Blackwell", kind: "compute",
    note: "one GB202 die with 188 of its 192 SMs enabled, on a PCIe 5.0 ×16 card",
    cols: 4,
    children: die({
      activeSMs: 188,
      memLabel: "GDDR7 memory controllers",
      mem: "96 GB (ECC)",
      bus: "512-bit",
      bw: "1,792 GB/s",
      memNote: "512-bit bus, 96 GB of ECC GDDR7, 1,792 GB/s",
    }),
  },

  dieNote:
    "The GPC array below is drawn as the full 12-GPC GB202. This card enables 188 of the die's 192 SMs; NVIDIA does not publish which four are disabled, so no particular SM here is marked off.",

  sources: [
    ["NVIDIA — RTX PRO 6000 Blackwell Workstation Edition", "https://www.nvidia.com/en-us/products/workstations/professional-desktop-gpus/rtx-pro-6000/"],
    ["NVIDIA — RTX Blackwell PRO GPU architecture whitepaper (PDF)", "https://www.nvidia.com/content/dam/en-zz/Solutions/design-visualization/quadro-product-literature/NVIDIA-RTX-Blackwell-PRO-GPU-Architecture-v1.0.pdf"],
    ["Tom's Hardware — RTX PRO 6000 Blackwell: 24,064 CUDA cores, 96 GB, 600 W", "https://www.tomshardware.com/pc-components/gpus/nvidia-rtx-pro-6000-blackwell-gpu-spotted-with-24-064-cuda-cores-96gb-gddr7-and-600w-11-percent-more-cores-than-rtx-5090"],
    ["TechPowerUp — GB202 die shot: 24,576 CUDA cores at 128 per SM", "https://www.techpowerup.com/331657/nvidia-gb202-blackwell-die-exposed-shows-the-massive-24-576-cuda-core-configuration"],
  ],
};
