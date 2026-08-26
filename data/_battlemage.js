// Shared Xe2 "Battlemage" structure, used by both the B70 (BMG-G31, 32
// Xe-cores) and the B50 (BMG-G21, 16 Xe-cores).
//
// The two parts are the same design at two sizes: the Xe-core is identical, the
// render slice is identical, and the SKU differs in how many slices there are
// and what memory hangs off the edge. Keeping one definition here means a
// correction to the Xe-core lands on both pages at once — the previous copy of
// this text existed only inside b70.js.

import { band, field, memBand, MAP_NOTE } from "./_floorplan.js";

// `opts.xmxOnDie` and `opts.peakTops` are the only per-SKU values inside the
// Xe-core; everything else about it is the same silicon on both parts.
export function xeCore(opts) {
  return {
    id: "xe-core", label: "Xe-core", kind: "compute", count: `${opts.xeCores} on the die`,
    note: `Intel's equivalent of an SM or a compute unit, and the block a thread group is scheduled onto: eight vector engines, eight XMX matrix engines, a ray tracing unit, and 256 KB of L1 and shared local memory they all sit behind. ${opts.xeCores} of them make this die. Everything above is replication of this block; everything below is inside it`,
    specs: [
      ["Xe-cores on die", String(opts.xeCores)],
      ["Vector engines", "8 × 512-bit"],
      ["XMX engines", "8 × 2048-bit"],
      ["Shared L1 / SLM", "256 KB"],
    ],
    cols: 4,
    children: [
      {
        id: "ve", label: "Vector Engine ×8", kind: "compute", span: 2,
        note: "the general-purpose SIMD ALUs — where ordinary shader and kernel arithmetic runs, everything that is not a matrix multiply. 512 bits wide and SIMD16-native in Xe2 (Alchemist was SIMD8), executing both SIMD16 and SIMD32 operations. Eight per Xe-core, and the reason a kernel with elementwise work between its matrix ops is not stalled waiting on XMX",
        specs: [
          ["Per Xe-core", "8"],
          ["Width", "512-bit"],
          ["Native ALU", "SIMD16"],
          ["Issue modes", "SIMD16, SIMD32"],
        ],
      },
      {
        id: "xmx", label: "XMX Engine ×8", kind: "matrix", span: 2,
        note: `Xe Matrix eXtensions: a systolic array that takes a whole small matrix multiply-accumulate as one instruction rather than as a loop of vector FMAs. This is where a transformer's dense layers, attention projections and convolutions actually execute, and where the card's INT8 and FP16 headline throughput comes from — the vector engines beside it are an order of magnitude slower at the same work. Eight per Xe-core, ${opts.xmxOnDie} on the die`,
        specs: [
          ["Per Xe-core", "8"],
          ["On the die", String(opts.xmxOnDie)],
          ["Width", "2048-bit"],
          ["Card peak", opts.peakTops],
        ],
      },
      {
        id: "slm", label: "Shared L1 cache / SLM", kind: "cache", span: 2,
        specs: [["Capacity", "256 KB per Xe-core"]],
        note: "one 256 KB pool serving both the L1 and the shared-local-memory role — bigger than the 192 KB of Alchemist and of Lunar Lake's Xe2-LPG, which is the figure this is easily confused with",
      },
      { id: "ls", label: "Load / store", kind: "io",
        note: "the Xe-core's path to memory: it resolves addresses for the vector engines and moves data between them and the 256 KB L1/SLM block, coalescing lanes into as few transactions as it can. Scattered access patterns cost here before they ever reach L2" },
      { id: "thread", label: "Thread dispatch", kind: "sched",
        note: "hands threads to the eight vector engines and tracks the ones in flight. It is fed by the global command streamer at die level, so this is the local half of a two-level dispatch scheme" },
    ],
  };
}

export function renderSlice(opts) {
  const xc = xeCore(opts);
  return {
    id: "slice", label: "Render Slice", kind: "compute", count: `${opts.slices} on the die`,
    note: `the level Intel scales the product line by: four Xe-cores, four ray tracing units, and the geometry and rasterization front end that makes it a RENDER slice rather than just a group of cores. ${opts.slices} slices make the ${opts.sku}, and a bigger or smaller part in this family is a different number of the same slice, not a different design`,
    specs: [["Xe-cores", "4"], ["Ray tracing units", "4"]],
    cols: 4,
    children: [
      { ...xc, id: "xc0", label: "Xe-core 0", count: null },
      { ...xc, id: "xc1", label: "Xe-core 1", count: null },
      { ...xc, id: "xc2", label: "Xe-core 2", count: null },
      { ...xc, id: "xc3", label: "Xe-core 3", count: null },
      { id: "rtu", label: "Ray Tracing Unit ×4", kind: "fixed", span: 2,
        note: "hardware BVH traversal and intersection, one per Xe-core. Xe2 runs THREE traversal pipelines per unit against Alchemist's two — 6 box tests each, 18 box intersections per clock — plus two triangle tests per clock at the bottom of the tree",
        specs: [["Per render slice", "4"], ["Traversal pipelines", "3 per unit"], ["Box tests", "18 per clock"], ["Triangle tests", "2 per clock"]] },
      { id: "geo", label: "Geometry + rasterizer", kind: "fixed", span: 2,
        note: "the render slice's fixed-function graphics front end — geometry setup and rasterization. One per slice, which is what makes it a RENDER slice rather than just a group of Xe-cores" },
    ],
  };
}

export function sliceList(opts) {
  const s = renderSlice(opts);
  return Array.from({ length: opts.slices }, (_, i) => ({
    ...s, id: "slice" + i, label: "Render Slice " + i, count: null,
  }));
}

// The die map. `cols` is chosen so the Xe-core field comes out square-ish:
// perRow × 2 columns wide, four rows deep.
export function dieMap(opts) {
  // Four Xe-cores to a slice, `slicesPerRow` slices across, so the field is
  // always four rows deep and the slice count sets the width.
  const spr = opts.slicesPerRow;
  const fieldRows = opts.slices / spr;
  const perRow = spr * 4;
  const cols = perRow * 2;
  // Band rows after the compute field, so a die with more render slices simply
  // makes the map taller instead of overwriting its own memory edge.
  const fabricY = 4 + fieldRows;
  const memY2 = fabricY + 1;
  const geoY = memY2 + 1;
  const off = new Set(opts.disabledIndices || []);
  const memBlocks = opts.memBlocksPerBand;
  const fractionLabel = `1/${memBlocks * 2} of the bus`;
  const memDetail = `One ${memBlocks * 2 === 8 ? "eighth" : "quarter"} of the ${opts.bus} ${opts.dram} interface — ${opts.bw} from ${opts.busBits} bits × ${opts.memSpeed}. The blocks are a drawing convenience, NOT a controller count.`;
  const memSpecs = [
    ["This block", `1 of ${memBlocks * 2} drawn — not a controller count`],
    ["Its share of bandwidth", opts.shareOfBw],
    ["Whole memory subsystem", `${opts.bus}, ${opts.bw}`],
    ["DRAM on the board", `${opts.mem} ${opts.dram}`],
  ];
  const fabricSpecs = [["Reaches", `all ${opts.xeCores} Xe-cores`]];

  return {
    title: "Die map — Xe2 (Battlemage)",
    cols, rows: geoY + 1, cell: 58, cellH: 42,
    lede: `All ${opts.xeCores} Xe-cores, grouped four to a render slice. Each Xe-core carries 8 vector engines and 8 XMX engines, so the field below is where all ${opts.xmxOnDie} XMX engines live.`,
    hint: "Hover a block for detail. Every Xe-core opens at its own place in the hierarchy below.",
    dataflow: {
      label: "Trace a read",
      title: "One read: Xe-core → Xe fabric → L2 → " + opts.dram,
      kind: "stops",
      stops: [[Math.floor(cols / 2) - 2, 5], [Math.floor(cols / 2) - 2, 3],
              [Math.floor(cols / 2) - 2, 2], [Math.floor(cols / 2) - 2, 1]],
      note: `An Xe-core that misses in its own 256 KB of L1/SLM crosses the fabric to L2, and a miss there goes to a memory controller. Three stops, not a route — the hierarchy decides where a read lands, and the only lever a kernel has is whether the data was already in L2.`,
    },
    interconnect: "Drawn as the two Xe fabric bands the compute field sits between — a labelled band rather than a shape, since the claim is only that every Xe-core reaches L2 and memory through it.",
    tiles: [
      ...band(0, opts.frontEnd(cols)),
      ...memBand(1, memBlocks, cols, opts.dram, () => fractionLabel, memDetail, memSpecs),
      ...band(2, [{ w: cols, kind: "cache", label: "L2 cache", sub: `${opts.l2Sub} · banked with the memory controllers`, path: "l2",
        detail: opts.l2Detail,
        specs: opts.l2Specs }]),
      ...band(3, [{ w: cols, kind: "link", label: "Xe fabric", sub: "Xe-cores ⇄ L2 ⇄ memory controllers",
        detail: "The on-die interconnect between the render slices and the memory side. Every Xe-core reaches L2 and the memory controllers across it. Drawn as a band rather than a specific topology.",
        specs: fabricSpecs }]),
      ...field({
        y0: 4, perRow, rows: fieldRows, w: 2,
        make: (i, c, r) => {
          const slice = r * spr + Math.floor(c / 4);
          const within = c % 4;
          if (off.has(i)) {
            return {
              kind: "off", label: "Xe-core", sub: "disabled",
              detail: opts.disabledDetail,
              specs: [["State", "disabled on this SKU"], ["Position", "illustrative"]],
            };
          }
          return {
            kind: "compute", label: "Xe-core", sub: `slice ${slice} · ${within}`,
            path: `slice${slice}/xc${within}`,
            detail: `Xe-core ${within} of render slice ${slice}. 8 vector engines at 512-bit with SIMD16-native ALUs, 8 XMX engines at 2048-bit, and 256 KB of shared L1/SLM.`,
            specs: [["Vector engines", "8 × 512-bit"], ["XMX engines", "8 × 2048-bit"], ["Shared L1 / SLM", "256 KB"]],
          };
        },
      }),
      ...band(fabricY, [{ w: cols, kind: "link", label: "Xe fabric", sub: "the same fabric, reaching the other memory edge",
        detail: "The compute field is drawn between two runs of the same fabric because it reaches both memory edges — the two bands are one interconnect, not two.",
        specs: fabricSpecs }]),
      ...memBand(memY2, memBlocks, cols, opts.dram, () => fractionLabel, memDetail, memSpecs),
      ...band(geoY, [{ w: cols, kind: "fixed", label: `Geometry + rasterizers · ${opts.rtUnits} ray tracing units`, sub: "4 per render slice",
        detail: `The fixed-function front end of each render slice, plus its four ray tracing units — ${opts.rtUnits} across the die.` }]),
    ],
    note: opts.mapNote + " " + MAP_NOTE,
    source: "Intel's Xe2 architecture material and the card's product specifications",
  };
}
