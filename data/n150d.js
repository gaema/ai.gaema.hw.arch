// Tenstorrent Wormhole n150d -- one Wormhole ASIC, 72 Tensix tiles.
// Every figure here is from a published vendor or press source; see `sources`.

import { asic, dieMap } from "./_wormhole.js";

export default {
  id: "n150d",
  name: "Wormhole n150d",
  vendor: "Tenstorrent",
  vendorKey: "tt",
  arch: "Wormhole",
  die: "Wormhole ASIC",
  tagline:
    "A grid of 72 independent Tensix tiles, each with five RISC-V cores and 1.5 MB of software-managed SRAM — no warp scheduler, no cache hierarchy, and two QSFP-DD ports plus two Warp 100 bridges to bolt cards together.",

  spec: {
    "Architecture": "Wormhole B0",
    "Die": "Wormhole ASIC × 1",
    "Process node": "12 nm",
    "Transistors": "—",
    "Die area": "—",
    "Execution unit": "Tensix tile",
    "Units enabled": "72 of 80",
    "Matrix engines": "72 (1 per Tensix tile)",
    "On-chip memory": "108 MB SRAM — 1.5 MB per tile, software-managed, no cache hierarchy",
    "Memory": "12 GB GDDR6",
    "Memory bus": "192-bit — 6 channels at 12 GT/s",
    "Memory bandwidth": "288 GB/s",
    "Board power": "160 W TBP",
    "Cooling": "Active (axial fan)",
    "Host interface": "PCIe 4.0 ×16",
    "Scale-out link": "2 × Warp 100 + 2 × QSFP-DD 200G",
  },

  extra: [
    ["ASICs on card", "1"],
    ["AI clock", "1 GHz"],
    ["Baby RISC-V per tile", "5 (RV32IM, 1 GHz)"],
    ["Big RISC-V cores", "none"],
    ["Ethernet tiles", "16"],
    ["Ethernet rate", "100 GbE per tile · 200 GbE per port"],
    ["Board Ethernet", "2 × QSFP-DD 200G on channels 6,7 and 0,1 · Warp 100 port 1 on channels 14,15 · second Warp 100 connector on the card"],
    ["PCIe tiles", "1"],
    ["FP8", "262 TFLOPS"],
    ["BLOCKFP8", "148 TFLOPS"],
    ["FP16", "74 TFLOPS"],
  ],

  compare: {
    "Execution unit": "Tensix tile",
    "Units on die": "72 Tensix enabled (80 on the die)",
    "SIMD width": "n/a — 5 scalar RISC-V cores issue to a compute complex",
    "Matrix engine": "Matrix engine (FPU), 1 per tile",
    "Matrix engines total": "72",
    "Last-level cache": "none — 1.5 MB software-managed SRAM per tile",
    "Memory": "12 GB GDDR6",
    "Bandwidth": "288 GB/s",
    "Board power": "160 W TBP",
    "Host link": "PCIe 4.0 ×16",
  },

  dieMap: dieMap("asic"),

  root: {
    id: "card", label: "Wormhole n150d", kind: "compute",
    note: "one Wormhole ASIC, actively cooled, with two QSFP-DD 200G ports and two Warp 100 bridges for card-to-card scale-out",
    cols: 4,
    children: [
      { ...asic(72), span: 4 },
      {
        id: "qsfp", label: "2 × QSFP-DD 200G", kind: "io", span: 2,
        note: "two QSFP-DD cages on the board's bracket, carrying 200 GbE each — the card's long-reach scale-out path. They extend the same Ethernet fabric the Ethernet tiles speak on-die out to other cards, so a multi-card system is one larger mesh rather than a set of peers coordinating over PCIe and host memory. Each cage pairs two of the die's sixteen 100 GbE tiles",
      },
      {
        id: "warp", label: "2 × Warp 100", kind: "io",
        note: "the short-reach card-to-card connectors. Each Wormhole card takes two Warp 100 bridges. Port 1 is wired to Ethernet channels 14 and 15",
        specs: [["Port 1", "channels 14 and 15"], ["Port 2", "second connector on the card"]],
      },
      {
        id: "slot", label: "PCIe 4.0 ×16 edge", kind: "io",
        note: "the card's edge connector — a board part, not a tile on the die. It carries the die's one PCIe tile out to the host slot",
        specs: [["Lanes", "16"], ["Generation", "PCIe 4.0"]],
      },
    ],
  },

  sources: [
    ["Tenstorrent — Wormhole n150d / n300d specifications", "https://docs.tenstorrent.com/aibs/wormhole/specifications.html"],
    ["Tenstorrent — Wormhole cards", "https://tenstorrent.com/hardware/wormhole"],
    ["Tenstorrent — tt-isa-documentation, Wormhole B0 tile inventory", "https://github.com/tenstorrent/tt-isa-documentation/blob/main/WormholeB0/README.md"],
    ["Tenstorrent — tt-isa-documentation, Wormhole Tensix tile", "https://github.com/tenstorrent/tt-isa-documentation/blob/main/WormholeB0/TensixTile/README.md"],
    ["Tenstorrent — Warp 100 Bridge (two per card)", "https://docs.tenstorrent.com/aibs/wormhole/warp100.html"],
    ["Tenstorrent — tt-metal, N150 board definition (QSFP-DD + Warp 100)", "https://github.com/tenstorrent/tt-metal/blob/main/tools/scaleout/board/board.cpp"],
    ["Tenstorrent — tt-metal, Wormhole B0 SoC descriptor", "https://github.com/tenstorrent/tt-metal/blob/main/tt_metal/soc_descriptors/wormhole_b0_80_arch.yaml"],
    ["Tenstorrent — Community highlight, Wormhole physicalities (row harvest)", "https://tenstorrent.com/vision/community-highlight-tenstorrent-wormhole-series-part-1-physicalities"],
    ["EPCC — Tenstorrent at HPC Asia 2025 (12 nm, 80 Tensix, 16 × 100 GbE)", "https://riscv.epcc.ed.ac.uk/assets/files/hpcasia25/Tenstorrent.pdf"],
  ],
};
