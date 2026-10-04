import styles from "./WaterCooledACAnimation.module.css";
import { Arrow, FlowLine, Pill, Valve, type DrawingProps, type DrawingSpec, type Flow } from "./WaterCooledACAnimation.kit";

/* Isometric cut-away drawing for WaterCooledACAnimation.

   World axes (units ≈ viewBox units):
     x  along the back wall, left (room) → right (cupboard)   screen: down-right at 30°
     y  out from the back wall towards the viewer              screen: down-left at 30°
     z  up                                                     screen: straight up
   Everything is built from iso(x, y, z); only text is placed in screen space. */

const VB_W = 750;
const VB_H = 604;
const OX = 132;
const OY = 212;
const C = Math.cos(Math.PI / 6);
const S = 0.5;

type V3 = readonly [number, number, number];

const iso = ([x, y, z]: V3): [number, number] => [OX + (x - y) * C, OY + (x + y) * S - z];
const r1 = (n: number) => Math.round(n * 10) / 10;
const pt = (p: V3) => {
  const [a, b] = iso(p);
  return `${r1(a)} ${r1(b)}`;
};
/** Polyline through world points (a pipe run). */
const run = (...ps: V3[]) => `M ${ps.map(pt).join(" L ")}`;
/** Closed polygon through world points (a face). */
const face = (...ps: V3[]) => `${run(...ps)} Z`;

/** Screen angle of each world axis, for arrowheads. */
const AX = { "+x": 30, "-x": 210, "+y": 150, "-y": 330, "+z": 270, "-z": 90 } as const;
type Axis = keyof typeof AX;

function IsoArrow({ at, axis, flow }: { at: V3; axis: Axis; flow: Flow }) {
  const [x, y] = iso(at);
  return <Arrow x={r1(x)} y={r1(y)} dir={AX[axis]} flow={flow} />;
}

/** Screen-space bounding box of world points, padded, for highlight rings. */
function ringRect(pad: number, ...ps: V3[]) {
  const xs = ps.map((p) => iso(p)[0]);
  const ys = ps.map((p) => iso(p)[1]);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x: r1(x), y: r1(y), width: r1(Math.max(...xs) + pad - x), height: r1(Math.max(...ys) + pad - y) };
}

/* ------------------------------------------------------------------ Scene */

const H = 160; //            wall height
const D = 120; //            floor depth
const ROOM_X = 240; //       partition starts
const WALL_T = 30; //        partition thickness
const STUB_D = 56; //        partition is cut away beyond this depth
const END_X = 540; //        cupboard ends (cut)

/** Heights of the three lines running along the back wall (y = PIPE_Y). */
const PIPE_Y = 13;
const Z_HEAT = 138;
const Z_COOL = 123;
const Z_COND = 108;

const UNIT = { x0: 50, x1: 200, y1: 26, z0: 100, z1: 146 } as const;
const BOX = { x0: 310, x1: 505, y0: 34, y1: 112, z1: 96 } as const; // condenser casing (front and top cut away)
const COMP = { x: 360, y: 70, r: 20, z1: 80 } as const; //                  compressor cylinder
const HX = { x0: 425, x1: 450, y0: 50, y1: 92, z0: 10, z1: 90 } as const; // plate heat exchanger
const VALVE: V3 = [405, 104, 14];
const ZONE = { x0: 412, x1: 592, y0: 40, y1: 104, z1: 98 } as const;
const STUB_END = 588;
const Z_W_OUT = 74;
const Z_W_IN = 24;
const WATER_Y = 71;

const BUNDLE_X = 270; // where the bundle comes out of the partition into the cupboard
const PUMP: V3 = [287, PIPE_Y, Z_COND];
const COOL_UP_X = 332; // cool line rises behind the casing here
const COND_DOWN_X = 318; // condensate drops into the casing here

const P = {
  /* Room side (drawn before the partition, which hides the part inside the wall). */
  heatRoom: run([UNIT.x1, PIPE_Y, Z_HEAT], [BUNDLE_X, PIPE_Y, Z_HEAT]),
  coolRoom: run([BUNDLE_X, PIPE_Y, Z_COOL], [UNIT.x1, PIPE_Y, Z_COOL]),
  condRoom: run([UNIT.x1, PIPE_Y, Z_COND], [BUNDLE_X, PIPE_Y, Z_COND]),
  /* Wall-unit coil: cool in along the lower line, heat out along the upper line. */
  coilIn: run([UNIT.x1, PIPE_Y, Z_COOL], [UNIT.x0 + 14, PIPE_Y, Z_COOL]),
  coilOut: run([UNIT.x0 + 14, PIPE_Y, Z_COOL], [UNIT.x0 + 14, PIPE_Y, Z_HEAT], [UNIT.x1, PIPE_Y, Z_HEAT]),
  /* Cupboard side. */
  heatCupboard: run(
    [BUNDLE_X, PIPE_Y, Z_HEAT],
    [COMP.x, PIPE_Y, Z_HEAT],
    [COMP.x, COMP.y, Z_HEAT],
    [COMP.x, COMP.y, COMP.z1],
  ),
  coolBehind: run([COOL_UP_X, BOX.y0, 15], [COOL_UP_X, PIPE_Y, 15], [COOL_UP_X, PIPE_Y, Z_COOL], [BUNDLE_X, PIPE_Y, Z_COOL]),
  coolInside: run([VALVE[0] - 8, VALVE[1], VALVE[2]], [COOL_UP_X, VALVE[1], VALVE[2]], [COOL_UP_X, BOX.y0, VALVE[2]]),
  condCupboard: run([BUNDLE_X, PIPE_Y, Z_COND], [COND_DOWN_X, PIPE_Y, Z_COND], [COND_DOWN_X, PIPE_Y, 66], [COND_DOWN_X, BOX.y0 + 12, 66]),
  discharge: run([COMP.x + COMP.r, COMP.y, 52], [408, COMP.y, 52], [408, COMP.y, 76], [HX.x0, COMP.y, 76]),
  warmLiquid: run([HX.x0 + 12, HX.y1, 14], [HX.x0 + 12, VALVE[1], VALVE[2]], [VALVE[0] + 8, VALVE[1], VALVE[2]]),
  waterOut: run([HX.x1, WATER_Y, Z_W_OUT], [STUB_END, WATER_Y, Z_W_OUT]),
  waterIn: run([STUB_END, WATER_Y, Z_W_IN], [HX.x1, WATER_Y, Z_W_IN]),
} as const;

/* Two-turn scroll on the compressor's top face, drawn in the iso plane. */
const SCROLL = (() => {
  const pts: V3[] = [];
  const turns = 2.1;
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * turns * 2 * Math.PI;
    const r = 2 + ((COMP.r - 6) * t) / (turns * 2 * Math.PI);
    pts.push([COMP.x + r * Math.cos(t), COMP.y + r * Math.sin(t), COMP.z1]);
  }
  return run(...pts);
})();

/* Cylinder outline (side + front half of the base) and its top ellipse. */
const CYL = (() => {
  const [cxTop, cyTop] = iso([COMP.x, COMP.y, COMP.z1]);
  const [, cyBot] = iso([COMP.x, COMP.y, 0]);
  const rx = COMP.r * Math.SQRT2 * C;
  const ry = COMP.r * Math.SQRT2 * S;
  const body =
    `M ${r1(cxTop - rx)} ${r1(cyTop)} V ${r1(cyBot)} ` +
    `A ${r1(rx)} ${r1(ry)} 0 0 0 ${r1(cxTop + rx)} ${r1(cyBot)} V ${r1(cyTop)} Z`;
  return { body, cx: r1(cxTop), cy: r1(cyTop), rx: r1(rx), ry: r1(ry) };
})();

/** Plate edges on the heat exchanger's right face. */
const PLATES = [57, 64, 78, 85].map((y) => run([HX.x1, y, HX.z0 + 8], [HX.x1, y, HX.z1 - 8])).join(" ");

/** Screen positions used for upright labels and leaders. */
const at = (p: V3) => iso(p).map(r1) as [number, number];
const PAIR_TOP = at([BUNDLE_X + 3, PIPE_Y, Z_HEAT + 9]);
const PAIR_BOT = at([BUNDLE_X + 3, PIPE_Y, Z_COOL - 8]);
const PUMP_XY = at(PUMP);
const OUT_END = at([STUB_END, WATER_Y, Z_W_OUT]);
const IN_END = at([STUB_END, WATER_Y, Z_W_IN]);
const ZONE_CORNER = at([ZONE.x1, ZONE.y0, ZONE.z1]);
const ZONE_TAG: [number, number] = [ZONE_CORNER[0] + 8, ZONE_CORNER[1] - 82];

function IsoDrawing({ uid, step, current, labels, part, ring, on }: DrawingProps) {
  const ids = {
    headHeat: `${uid}-iso-head-heat`,
    headCool: `${uid}-iso-head-cool`,
    headGrey: `${uid}-iso-head-grey`,
  };
  const loud = current.focus === "badge";
  const unitRing = ringRect(10, [UNIT.x0, 0, UNIT.z1], [UNIT.x1, 0, UNIT.z1], [UNIT.x0, UNIT.y1, UNIT.z0], [UNIT.x1, UNIT.y1, UNIT.z0]);
  const wallRing = ringRect(12, [BUNDLE_X, PIPE_Y, Z_HEAT + 4], [BUNDLE_X, PIPE_Y, Z_COOL - 4], [BUNDLE_X + 16, PIPE_Y, Z_COOL - 4]);
  const compRing = ringRect(10, [COMP.x - COMP.r, COMP.y + COMP.r, 0], [COMP.x + COMP.r, COMP.y - COMP.r, COMP.z1], [COMP.x - COMP.r, COMP.y - COMP.r, COMP.z1], [COMP.x + COMP.r, COMP.y + COMP.r, 0]);
  const hxRing = ringRect(10, [HX.x0, HX.y0, HX.z1], [HX.x1, HX.y1, HX.z0], [HX.x0, HX.y1, HX.z0], [HX.x1, HX.y0, HX.z1]);
  const heatMarks = [
    at([HX.x0 + 4, HX.y1, 66]),
    at([HX.x0 + 4, HX.y1, 40]),
  ];

  return (
    <>
      <defs>
        {(
          [
            [ids.headHeat, styles.headHeat],
            [ids.headCool, styles.headCool],
            [ids.headGrey, styles.headGrey],
          ] as const
        ).map(([id, cls]) => (
          <marker key={id} id={id} viewBox="0 0 10 10" refX="4" refY="5" markerWidth="3.4" markerHeight="3.4" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 Z" className={cls} />
          </marker>
        ))}
      </defs>

      <rect x="0" y="0" width={VB_W} height={VB_H} className={styles.svgBg} />

      {/* ---------------- Building: floor (light grey) and back wall ---------------- */}
      <path d={face([0, 0, 0], [END_X, 0, 0], [END_X, D, 0], [0, D, 0])} className={styles.isoFloor} />
      <path d={face([0, 0, 0], [END_X, 0, 0], [END_X, 0, H], [0, 0, H])} className={styles.isoWall} />
      <path d={run([0, D, 0], [0, 0, 0], [0, 0, H], [END_X, 0, H], [END_X, 0, 0], [END_X, D, 0])} className={styles.contextLine} />

      <text x="16" y="44" className={styles.areaLabel}>{labels.room}</text>
      <text x="440" y="132" className={styles.areaLabel}>{labels.cupboard}</text>

      {/* ---------------- Room: wall unit, air ---------------- */}
      <g className={styles.part} {...part("air")}>
        {[85, 125, 165].map((x) => {
          const [ax, ay] = at([x, UNIT.y1 / 2, UNIT.z1 + 30]);
          return (
            <path key={x} d={`M ${ax} ${ay} q 6 5 0 10 q -6 5 0 10`} className={styles.airHeat} markerEnd={`url(#${ids.headHeat})`} />
          );
        })}
        {[80, 120, 160].map((x) => (
          <path
            key={x}
            d={run([x, UNIT.y1 + 6, UNIT.z0 - 4], [x, UNIT.y1 + 40, UNIT.z0 - 34])}
            className={styles.airCool}
            markerEnd={`url(#${ids.headCool})`}
          />
        ))}
      </g>

      <g className={styles.part} {...part("unit")}>
        <rect {...unitRing} rx="16" className={styles.halo} data-on={ring("unit")} />
        <path d={face([UNIT.x0, 0, UNIT.z1], [UNIT.x1, 0, UNIT.z1], [UNIT.x1, UNIT.y1, UNIT.z1], [UNIT.x0, UNIT.y1, UNIT.z1])} className={styles.equipment} />
        <path d={face([UNIT.x0, UNIT.y1, UNIT.z1], [UNIT.x1, UNIT.y1, UNIT.z1], [UNIT.x1, UNIT.y1, UNIT.z0], [UNIT.x0, UNIT.y1, UNIT.z0])} className={styles.equipment} />
        <path d={face([UNIT.x1, 0, UNIT.z1], [UNIT.x1, UNIT.y1, UNIT.z1], [UNIT.x1, UNIT.y1, UNIT.z0], [UNIT.x1, 0, UNIT.z0])} className={styles.equipment} />
        <path d={run([UNIT.x0 + 10, UNIT.y1, UNIT.z0 + 8], [UNIT.x1 - 10, UNIT.y1, UNIT.z0 + 8])} className={styles.detailLine} />
      </g>
      <text x="16" y="78" className={styles.unitLabel}>{labels.wallUnit}</text>

      {/* ---------------- Lines along the back wall, room side ---------------- */}
      <g className={styles.condensateGroup}>
        <path d={P.condRoom} className={styles.condensate} />
      </g>
      <g className={styles.part} {...part("coil")}>
        <FlowLine d={P.coilIn} flow="cool" />
        <FlowLine d={P.coilOut} flow="heat" />
      </g>
      <g className={styles.part} {...part("suction")}>
        <FlowLine d={P.heatRoom} flow="heat" />
      </g>
      <g className={styles.part} {...part("liquid")}>
        <FlowLine d={P.coolRoom} flow="cool" />
      </g>

      {/* ---------------- Partition wall (cut away in front), hides the run inside it ---------------- */}
      <path
        d={face([ROOM_X, 0, H], [ROOM_X + WALL_T, 0, H], [ROOM_X + WALL_T, STUB_D, H], [ROOM_X, STUB_D, H])}
        className={styles.isoWallCut}
      />
      <path
        d={face([ROOM_X, STUB_D, H], [ROOM_X + WALL_T, STUB_D, H], [ROOM_X + WALL_T, STUB_D, 0], [ROOM_X, STUB_D, 0])}
        className={styles.isoWallCut}
      />
      <path
        d={face([ROOM_X + WALL_T, 0, H], [ROOM_X + WALL_T, STUB_D, H], [ROOM_X + WALL_T, STUB_D, 0], [ROOM_X + WALL_T, 0, 0])}
        className={styles.isoWallSide}
      />
      <rect {...wallRing} rx="12" className={styles.halo} data-on={ring("wall")} />

      {/* ---------------- Cupboard: lines along the back wall, behind the casing ---------------- */}
      <g className={styles.condensateGroup}>
        <path d={P.condCupboard} className={styles.condensate} markerEnd={`url(#${ids.headGrey})`} />
        <g transform={`translate(${PUMP_XY[0]} ${PUMP_XY[1]})`}>
          <title>{labels.tooltips.condensatePump}</title>
          <circle r="12" className={styles.pump} />
          <text y="6.5" textAnchor="middle" className={styles.pumpGlyph}>P</text>
        </g>
        <path d={`M ${PUMP_XY[0] + 8} ${PUMP_XY[1] - 10} L ${PUMP_XY[0] + 40} ${PUMP_XY[1] - 62}`} className={styles.isoLeaderGrey} />
        <text x={PUMP_XY[0] + 44} y={PUMP_XY[1] - 66} className={styles.noteLabel}>{labels.condensatePump}</text>
      </g>
      <g className={styles.part} {...part("liquid")}>
        <FlowLine d={P.coolBehind} flow="cool" />
        <IsoArrow at={[COOL_UP_X, PIPE_Y, 80]} axis="+z" flow="cool" />
        <IsoArrow at={[BUNDLE_X + 18, PIPE_Y, Z_COOL]} axis="-x" flow="cool" />
      </g>

      {/* ---------------- Condenser casing: back and left walls; front and top cut away ---------------- */}
      <path d={face([BOX.x0, BOX.y0, 0], [BOX.x1, BOX.y0, 0], [BOX.x1, BOX.y1, 0], [BOX.x0, BOX.y1, 0])} className={styles.casing} />
      <path d={face([BOX.x0, BOX.y0, 0], [BOX.x1, BOX.y0, 0], [BOX.x1, BOX.y0, BOX.z1], [BOX.x0, BOX.y0, BOX.z1])} className={styles.casing} />
      <path d={face([BOX.x0, BOX.y0, 0], [BOX.x0, BOX.y1, 0], [BOX.x0, BOX.y1, BOX.z1], [BOX.x0, BOX.y0, BOX.z1])} className={styles.casing} />

      {/* ---------------- Water zone: dashed box round the heat-exchanger side, out to the water connections ---------------- */}
      <g className={styles.zoneIso} data-emphasis={on(step >= 3)}>
        <path d={face([ZONE.x0, ZONE.y0, 0], [ZONE.x1, ZONE.y0, 0], [ZONE.x1, ZONE.y1, 0], [ZONE.x0, ZONE.y1, 0])} className={styles.zoneFloor} />
        <path
          d={
            face([ZONE.x0, ZONE.y0, ZONE.z1], [ZONE.x1, ZONE.y0, ZONE.z1], [ZONE.x1, ZONE.y1, ZONE.z1], [ZONE.x0, ZONE.y1, ZONE.z1]) +
            " " +
            run([ZONE.x0, ZONE.y1, 0], [ZONE.x0, ZONE.y1, ZONE.z1]) +
            " " +
            run([ZONE.x1, ZONE.y1, 0], [ZONE.x1, ZONE.y1, ZONE.z1]) +
            " " +
            run([ZONE.x1, ZONE.y0, 0], [ZONE.x1, ZONE.y0, ZONE.z1]) +
            " " +
            run([ZONE.x0, ZONE.y0, 0], [ZONE.x0, ZONE.y0, ZONE.z1])
          }
          className={styles.zoneEdges}
        />
      </g>

      {/* ---------------- Inside the casing ---------------- */}
      <g className={styles.part} {...part("liquid")}>
        <FlowLine d={P.coolInside} flow="cool" />
      </g>
      <g className={styles.part} {...part("warmLiquid")}>
        <FlowLine d={P.warmLiquid} flow="cool" />
      </g>
      <g className={styles.part} {...part("valve")}>
        <Valve x={at(VALVE)[0]} y={at(VALVE)[1]} r={8} title={labels.tooltips.expansionValve} />
      </g>

      <g className={styles.part} {...part("compressor")}>
        <rect {...compRing} rx="16" className={styles.halo} data-on={ring("compressor")} />
        <g className={styles.compressorBody}>
          <path d={CYL.body} className={styles.equipment} />
          <ellipse cx={CYL.cx} cy={CYL.cy} rx={CYL.rx} ry={CYL.ry} className={styles.equipment} />
          <path d={SCROLL} className={styles.detailLine} />
        </g>
      </g>

      <g className={styles.part} {...part("suction")}>
        <FlowLine d={P.heatCupboard} flow="heat" />
        <IsoArrow at={[BUNDLE_X + 30, PIPE_Y, Z_HEAT]} axis="+x" flow="heat" />
        <IsoArrow at={[COMP.x, COMP.y, Z_HEAT - 30]} axis="-z" flow="heat" />
      </g>
      <g className={styles.part} {...part("discharge")}>
        <FlowLine d={P.discharge} flow="heat" />
        <IsoArrow at={[408, COMP.y, 66]} axis="+z" flow="heat" />
      </g>

      <g className={styles.part} {...part("hx")}>
        <rect {...hxRing} rx="12" className={styles.halo} data-on={ring("hx")} />
        <path d={face([HX.x0, HX.y0, HX.z1], [HX.x1, HX.y0, HX.z1], [HX.x1, HX.y1, HX.z1], [HX.x0, HX.y1, HX.z1])} className={styles.equipment} />
        <path d={face([HX.x0, HX.y1, HX.z1], [HX.x1, HX.y1, HX.z1], [HX.x1, HX.y1, HX.z0], [HX.x0, HX.y1, HX.z0])} className={styles.equipment} />
        <path d={face([HX.x1, HX.y0, HX.z1], [HX.x1, HX.y1, HX.z1], [HX.x1, HX.y1, HX.z0], [HX.x1, HX.y0, HX.z0])} className={styles.equipment} />
        <path d={PLATES} className={styles.plates} />
        <g className={styles.hxDetail}>
          {heatMarks.map(([x, y]) => (
            <path key={y} d={`M ${x - 2} ${y} q 6 -7 12 0 q 6 7 12 0`} className={styles.heatMark} markerEnd={`url(#${ids.headHeat})`} />
          ))}
        </g>
      </g>

      {/* ---------------- Water in / water out ---------------- */}
      <g className={styles.part} {...part("water")}>
        <FlowLine d={P.waterOut} flow="water" />
        <FlowLine d={P.waterIn} flow="water" />
        <IsoArrow at={[540, WATER_Y, Z_W_OUT]} axis="+x" flow="water" />
        <IsoArrow at={[530, WATER_Y, Z_W_IN]} axis="-x" flow="water" />
        <text x={OUT_END[0] + 12} y={OUT_END[1] + 9} className={styles.waterLabel}>{labels.waterOut}</text>
        <text x={IN_END[0] + 12} y={IN_END[1] + 9} className={styles.waterLabel}>{labels.waterIn}</text>
      </g>

      <path d={`M ${ZONE_CORNER[0]} ${ZONE_TAG[1]} V ${ZONE_CORNER[1]}`} className={styles.isoLeaderGrey} />
      <Pill
        cx={ZONE_TAG[0]}
        cy={ZONE_TAG[1]}
        height={38}
        padX={14}
        maxWidth={190}
        bgClassName={styles.zoneTagBg}
        lines={[{ text: labels.waterZone, className: styles.zoneTagText, dy: 10 }]}
      />

      {/* Label row under the casing: the unit's name, or the step's component callout */}
      <text x="352" y="555" textAnchor="middle" className={styles.componentLabel} data-on={on(!current.callout)}>
        {labels.condenserUnit}
      </text>
      <g className={styles.callout} data-on={on(current.callout === "compressor")}>
        <Pill
          cx={340}
          cy={545}
          height={36}
          padX={14}
          maxWidth={260}
          bgClassName={styles.calloutBg}
          lines={[{ text: labels.callouts.compressor, className: styles.calloutText, dy: 9.5 }]}
        />
      </g>
      <g className={styles.callout} data-on={on(current.callout === "heatExchanger")}>
        <Pill
          cx={352}
          cy={545}
          height={36}
          padX={14}
          maxWidth={290}
          bgClassName={styles.calloutBg}
          lines={[{ text: labels.callouts.heatExchanger, className: styles.calloutText, dy: 9.5 }]}
        />
      </g>

      {/* ---------------- Badge + leader to the refrigerant pair at the wall ---------------- */}
      <g className={styles.badge} data-loud={on(loud)}>
        <path d={`M 268 428 L ${PAIR_BOT[0] - 8} ${PAIR_BOT[1] + 4}`} className={styles.leader} />
        <path
          d={`M ${PAIR_TOP[0] - 6} ${PAIR_TOP[1]} H ${PAIR_TOP[0]} V ${PAIR_BOT[1]} H ${PAIR_BOT[0] - 6}`}
          className={styles.leader}
        />
        <rect x="4" y="414" width="310" height="112" rx="28" className={styles.halo} data-on={ring("badge")} />
        <g className={styles.badgeQuiet}>
          <Pill
            cx={159}
            cy={470}
            height={92}
            padX={18}
            maxWidth={310}
            bgClassName={styles.badgeQuietBg}
            lines={[
              { text: labels.badge[0], className: styles.badgeTitleQuiet, dy: -5 },
              { text: labels.badge[1], className: styles.badgeTextQuiet, dy: 29 },
            ]}
          />
        </g>
        <g className={styles.badgeLoud}>
          <Pill
            cx={159}
            cy={470}
            height={92}
            padX={18}
            maxWidth={310}
            bgClassName={styles.badgeLoudBg}
            lines={[
              { text: labels.badge[0], className: styles.badgeTitleLoud, dy: -5 },
              { text: labels.badge[1], className: styles.badgeTextLoud, dy: 29 },
            ]}
          />
        </g>
      </g>

      {/* ---------------- Legend ---------------- */}
      <g className={styles.legend}>
        <FlowLine d="M 18 587 H 58" flow="heat" still />
        <text x="68" y="597" className={styles.legendText}>{labels.legendHeat}</text>
        <FlowLine d="M 196 587 H 236" flow="cool" still />
        <text x="246" y="597" className={styles.legendText}>{labels.legendCool}</text>
        <FlowLine d="M 372 587 H 412" flow="water" still />
        <text x="422" y="597" className={styles.legendText}>{labels.legendWater}</text>
      </g>
    </>
  );
}

export const ISO: DrawingSpec = { width: VB_W, height: VB_H, Drawing: IsoDrawing };
