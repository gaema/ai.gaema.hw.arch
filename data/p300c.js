// Tenstorrent Blackhole p300c -- two Blackhole ASICs on one card.
// Every figure here is from a published vendor or press source; see `sources`.

import { asic, dualDieMap } from "./_blackhole.js";

export default {
  id: "p300c",
  name: "Blackhole p300c",
  vendor: "Tenstorrent",
  vendorKey: "tt",
  arch: "Blackhole",
  die: "2 × Blackhole ASIC",
  tagline:
    "Two Blackhole ASICs on one liquid-cooled board — 240 Tensix tiles and 64 GB of GDDR6 at 600 W — joined by two Ethernet channels, not by a shared NOC. Each die fuses off a different one of its two PCIe tiles, so the pair are mirror images rather than copies. The p300c is not sold on its own: it is the card inside TT-QuietBox 2, and the separately-sold dual-ASIC boards are the p300a and p300b.",

  spec: {
    "Architecture": "Blackhole",
    "Die": "Blackhole ASIC × 2",
    "Process node": "6 nm class — Tenstorrent has not named the foundry",
    "Transistors": "Not published",
    "Die area": "Not published",
    "Execution unit": "Tensix tile",
    "Units enabled": "240 of 280 — 120 of 140 per ASIC",
    "Matrix engines": "240 (1 per Tensix tile)",
    "On-chip memory": "360 MB SRAM — 1.5 MB per tile, software-managed, no cache hierarchy",
    "Memory": "64 GB GDDR6 — 32 GB per ASIC",
    "Memory bus": "256-bit per ASIC — 8 channels at 16 GT/s",
    "Memory bandwidth": "1,024 GB/s board · 512 GB/s per ASIC",
    "Board power": "600 W TBP",
    "Cooling": "Liquid",
    "Host interface": "PCIe 5.0 ×16",
    "Scale-out link": "Samtec ARP6 cable — card to card, no QSFP cages",
  },

  extra: [
    ["ASICs on card", "2"],
    ["Baby RISC-V per tile", "5 (RV32IM, 1.35 GHz)"],
    ["Big RISC-V cores", "32 (16 per ASIC)"],
    ["Die-to-die link", "2 Ethernet channels, on the PCB"],
    ["PCIe tiles", "2 per die, each ×16-capable — one used, one idle"],
    ["PCIe mirroring", "left die uses (2,0), right die uses (11,0)"],
    ["Availability", "not sold separately — ships in TT-QuietBox 2"],
  ],

  compare: {
    "Execution unit": "Tensix tile",
    "Units on die": "240 Tensix (120 per ASIC, 2 ASICs)",
    "SIMD width": "n/a — 5 scalar RISC-V cores issue to a compute complex",
    "Matrix engine": "Matrix engine (FPU), 1 per tile",
    "Matrix engines total": "240",
    "Last-level cache": "none — 1.5 MB software-managed SRAM per tile",
    "Memory": "64 GB GDDR6",
    "Bandwidth": "512 GB/s per ASIC",
    "Board power": "600 W TBP",
    "Host link": "PCIe 5.0 ×16",
  },

  dieMap: dualDieMap(),

  root: {
    id: "card", label: "Blackhole p300c", kind: "compute",
    note: "two Blackhole ASICs on one liquid-cooled board, behind a single PCIe 5.0 ×16 edge connector — but each die keeps its OWN live PCIe interface, so they do not share one. How the board fans two endpoints onto one connector is not in the published descriptors, so it is not drawn",
    cols: 2,
    children: [
      {
        ...asic(120), id: "asic0", label: "Blackhole ASIC 0", count: "the left chip",
        note: "PCIe core (11,0) is fused off here, so this die's live host interface is (2,0) — the mirror of ASIC 1",
      },
      {
        ...asic(120), id: "asic1", label: "Blackhole ASIC 1", count: "the right chip",
        note: "PCIe core (2,0) is fused off here, so this die's live host interface is (11,0) — the mirror of ASIC 0",
      },
      {
        id: "link", label: "On-board die-to-die link", kind: "link", span: 2,
        specs: [["Channels", "2"], ["Device topology", "1 × 2"], ["Fabric", "Ethernet, the same one used between cards"]],
        note: "the two ASICs are joined over two Ethernet channels — the same fabric that runs card to card, routed on the PCB instead of through a cage. The two dies do NOT share a NOC; each mesh is closed and this link is the only path between them",
      },
      {
        id: "slot", label: "PCIe 5.0 ×16 edge", kind: "io", span: 2,
        note: "the card's edge connector — a board part. Each ASIC has its own live PCIe tile, so the card carries two endpoints behind one connector; the board-level fan-out is not published and is not claimed here",
      },
    ],
  },

  sources: [
    ["Tenstorrent — Blackhole p300c card specifications", "https://docs.tenstorrent.com/aibs/blackhole/p300.html"],
    ["Tenstorrent — Blackhole cards", "https://tenstorrent.com/hardware/blackhole"],
    ["Tenstorrent — Blackhole & TT-Metalium, Hot Chips 2024 (PDF)", "https://hc2024.hotchips.org/assets/program/conference/day1/88_HC2024.Tenstorrent.Jasmina.Davor.v7.pdf"],
  ],
};
