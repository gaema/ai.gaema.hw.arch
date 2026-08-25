// Tenstorrent Blackhole p150a -- one Blackhole ASIC, 120 Tensix tiles.
// Every figure here is from a published vendor or press source; see `sources`.

import { asic, dieMap } from "./_blackhole.js";

export default {
  id: "p150a",
  name: "Blackhole p150a",
  vendor: "Tenstorrent",
  vendorKey: "tt",
  arch: "Blackhole",
  die: "Blackhole ASIC",
  tagline:
    "A grid of 120 independent Tensix tiles, each with five RISC-V cores and 1.5 MB of software-managed SRAM — no warp scheduler, no cache hierarchy, and four QSFP-DD ports to bolt cards together.",

  headline: [
    ["Architecture", "Blackhole"],
    ["ASICs on card", "1"],
    ["Tensix tiles", "120 (of 140 on the die)"],
    ["Baby RISC-V per tile", "5 (RV32IM, 1 GHz)"],
    ["SRAM per tile", "1.5 MB"],
    ["Big RISC-V cores", "16 (SiFive X280)"],
    ["BLOCKFP8", "664 TFLOPS"],
    ["Memory", "32 GB GDDR6"],
    ["Memory channels", "8 (16 GT/s)"],
    ["Memory bandwidth", "512 GB/s"],
    ["Ethernet tiles", "14 on the die, 12 usable"],
    ["Board Ethernet", "4 × QSFP-DD 800G (8 channels wired)"],
    ["PCIe tiles", "2 on the die, 1 live — (11,0) harvested"],
    ["Board power", "300 W"],
    ["Cooling", "active"],
    ["Host interface", "PCIe 5.0 ×16"],
  ],

  compare: {
    "Execution unit": "Tensix tile",
    "Units on die": "120 Tensix enabled (140 on the die)",
    "SIMD width": "n/a — 5 scalar RISC-V cores issue to a compute complex",
    "Matrix engine": "Matrix engine (FPU), 1 per tile",
    "Matrix engines total": "120",
    "Last-level cache": "none — 1.5 MB software-managed SRAM per tile",
    "Memory": "32 GB GDDR6",
    "Bandwidth": "512 GB/s",
    "Board power": "300 W",
    "Host link": "PCIe 5.0 ×16",
  },

  dieMap: dieMap("asic"),

  root: {
    id: "card", label: "Blackhole p150a", kind: "compute",
    note: "one Blackhole ASIC, actively cooled, with four QSFP-DD 800G ports for card-to-card scale-out",
    cols: 4,
    children: [
      { ...asic(120), span: 4 },
      {
        id: "qsfp", label: "4 × QSFP-DD 800G", kind: "io", span: 2,
        note: "passive ports — link cards together to pool memory across chips",
      },
      { id: "slot", label: "PCIe 5.0 ×16 edge", kind: "io", span: 2 },
    ],
  },

  sources: [
    ["Tenstorrent — Blackhole cards", "https://tenstorrent.com/hardware/blackhole"],
    ["Tenstorrent — Blackhole specifications and requirements", "https://docs.tenstorrent.com/aibs/blackhole/specifications.html"],
    ["The Register — Tenstorrent details its RISC-V packed Blackhole chips", "https://www.theregister.com/2024/08/27/tenstorrent_ai_blackhole/"],
    ["Tenstorrent — Blackhole & TT-Metalium, Hot Chips 2024 (PDF)", "https://hc2024.hotchips.org/assets/program/conference/day1/88_HC2024.Tenstorrent.Jasmina.Davor.v7.pdf"],
    ["VideoCardz — Blackhole p150 revised from 140 to 120 cores", "https://videocardz.com/newz/tenstorrent-downgrades-blackhole-p150-pcie-cards-specs-from-140-to-120-cores"],
  ],
};
