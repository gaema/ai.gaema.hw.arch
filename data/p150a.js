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

  spec: {
    "Architecture": "Blackhole",
    "Die": "Blackhole ASIC × 1",
    "Process node": "6 nm",
    "Transistors": "—",
    "Die area": "—",
    "Execution unit": "Tensix tile",
    "Units enabled": "120 of 140",
    "Matrix engines": "120 (1 per Tensix tile)",
    "On-chip memory": "180 MB SRAM — 1.5 MB per tile, software-managed, no cache hierarchy",
    "Memory": "32 GB GDDR6",
    "Memory bus": "256-bit — 8 channels at 16 GT/s",
    "Memory bandwidth": "512 GB/s",
    "Board power": "300 W",
    "Cooling": "Active",
    "Host interface": "PCIe 5.0 ×16",
    "Scale-out link": "4 × QSFP-DD 800G",
  },

  extra: [
    ["ASICs on card", "1"],
    ["Baby RISC-V per tile", "5 (RV32IM, 1.35 GHz)"],
    ["Big RISC-V cores", "16 (SiFive X280)"],
    ["Ethernet tiles", "14 on the die, 12 available on this card"],
    ["Ethernet rate", "400 GbE per tile · 800 GbE per port"],
    ["Board Ethernet", "4 × QSFP-DD 800G — 8 of the 12 cabled, because the live PCIe ×16 tile consumes the SerDes of the other 4"],
    ["PCIe tiles", "2 on the die, each ×16-capable — one used, one idle"],
    ["BLOCKFP8", "664 TFLOPS"],
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
        note: "four passive QSFP-DD cages on the board's bracket, carrying 800 GbE each — the card's scale-out path. They extend the same Ethernet fabric the Ethernet tiles speak on-die out to other cards, so a multi-card system is one larger mesh rather than a set of peers coordinating over PCIe and host memory. That is how a model too large for 32 GB is run: its layers are spread across cards and activations cross these ports directly, never touching the host. Eight of the die's twelve usable Ethernet tiles are cabled to them",
      },
      {
        id: "slot", label: "PCIe 5.0 ×16 edge", kind: "io", span: 2,
        note: "the card's edge connector — a board part, not a tile on the die. It carries the one PCIe tile the die actually uses out to the host slot at about 63 GB/s each way, an eighth of the card's own 512 GB/s",
        specs: [["Lanes", "16"], ["Generation", "PCIe 5.0"], ["Bandwidth", "~63 GB/s per direction"]],
      },
    ],
  },

  sources: [
    ["Tenstorrent — Blackhole cards", "https://tenstorrent.com/hardware/blackhole"],
    ["Tenstorrent — Blackhole specifications and requirements", "https://docs.tenstorrent.com/aibs/blackhole/specifications.html"],
    ["The Register — Tenstorrent details its RISC-V packed Blackhole chips", "https://www.theregister.com/2024/08/27/tenstorrent_ai_blackhole/"],
    ["Tenstorrent — Blackhole & TT-Metalium, Hot Chips 2024 (PDF)", "https://hc2024.hotchips.org/assets/program/conference/day1/88_HC2024.Tenstorrent.Jasmina.Davor.v7.pdf"],
    ["VideoCardz — Blackhole p150 revised from 140 to 120 cores", "https://videocardz.com/newz/tenstorrent-downgrades-blackhole-p150-pcie-cards-specs-from-140-to-120-cores"],
    ["Tenstorrent — tt-isa-documentation, Blackhole A0 tile inventory", "https://github.com/tenstorrent/tt-isa-documentation/blob/main/BlackholeA0/README.md"],
  ],
};
