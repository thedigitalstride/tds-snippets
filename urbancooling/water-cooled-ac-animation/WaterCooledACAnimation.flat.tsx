import styles from "./WaterCooledACAnimation.module.css";
import { Arrow, FlowLine, Pill, Valve, type DrawingProps, type DrawingSpec } from "./WaterCooledACAnimation.kit";

/* Flat (elevation) drawing for WaterCooledACAnimation. */

/* ========================================================================== */
/*  Geometry (viewBox 0 0 760 516)                                             */
/*  Refrigerant cycle: wall-unit coil → gas line → compressor → heat           */
/*  exchanger → expansion valve → liquid line → coil. Paths run with the flow. */
/* ========================================================================== */

const VB_W = 760;
const VB_H = 516;

const PATHS = {
  /** Inside the wall unit: cool refrigerant in along the bottom… */
  coilIn: "M 284 146 H 124",
  /** …round the bend, picking up the room's heat, and out along the top. */
  coilOut: "M 124 146 A 10 10 0 0 1 124 126 H 284",
  /** Heat line: wall unit → through the wall → compressor. */
  suction: "M 284 126 H 404 V 272",
  /** Hot refrigerant: compressor → top of the heat exchanger. */
  discharge: "M 456 296 H 486 V 280 H 520",
  /** Out of the bottom of the heat exchanger → expansion valve. */
  warmLiquid: "M 532 372 V 406 H 478",
  /** Liquid line: expansion valve → through the wall → wall unit. */
  liquid: "M 462 406 H 358 V 146 H 284",
  /** Building water, counterflow: in at the bottom of the heat exchanger, out at the top. */
  waterIn: "M 752 350 H 604",
  waterOut: "M 604 280 H 752",
  /** Condensate: wall unit → through the wall above the refrigerant pair → pump → condenser unit. */
  condensate: "M 284 104 H 440 V 206",
  /** Badge leader: from the badge to the refrigerant pair where it crosses the wall. */
  leader: "M 256 258 L 298 156 V 116",
  /** Where water exists: the heat-exchanger side of the condenser unit, out to the edge. */
  zone: "M 500 186 H 758 V 428 H 500 Z",
} as const;

const CASING = { x: 380, y: 208, w: 236, h: 212, r: 16 } as const;

/** Two-turn scroll (Archimedean spiral): the compressor's working part, drawn as a line. */
const SCROLL_PATH = (() => {
  const cx = 426;
  const cy = 318;
  const turns = 2.25;
  const pts: string[] = [];
  for (let i = 0; i <= 72; i++) {
    const t = (i / 72) * turns * 2 * Math.PI;
    const r = 3 + (16 * t) / (turns * 2 * Math.PI);
    pts.push(`${(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * Math.sin(t)).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")}`;
})();

function FlatDrawing({ uid, step, current, labels, part, ring, on }: DrawingProps) {
  const ids = {
    boxClip: `${uid}-box-clip`,
    headHeat: `${uid}-head-heat`,
    headCool: `${uid}-head-cool`,
    headGrey: `${uid}-head-grey`,
  };
  const loud = current.focus === "badge";
  return (
    <>
      <defs>
        <clipPath id={ids.boxClip}>
          <rect x={CASING.x} y={CASING.y} width={CASING.w} height={CASING.h} rx={CASING.r} />
        </clipPath>
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

      {/* ---------------- Building section (grey line art) ---------------- */}
      <rect x="0" y="0" width={VB_W} height={VB_H} className={styles.svgBg} />
      <rect x="300" y="20" width="36" height="446" className={styles.wall} />
      <path d="M 300 20 V 466 M 336 20 V 466" className={styles.contextLine} />
      <path d={`M 0 20 H ${VB_W} M 0 466 H ${VB_W}`} className={styles.contextLine} />

      <text x="16" y="56" className={styles.areaLabel}>{labels.room}</text>
      <text x="348" y="58" className={styles.areaLabel}>{labels.cupboard}</text>

      {/* ---------------- Water zone, outside the casing ---------------- */}
      <path d={PATHS.zone} className={styles.zone} data-emphasis={on(step >= 3)} />

      {/* ---------------- Condensate: thin grey, secondary, never lit ---------------- */}
      <g className={styles.condensateGroup}>
        <path d={PATHS.condensate} className={styles.condensate} markerEnd={`url(#${ids.headGrey})`} />
        <g transform="translate(378 104)">
          <title>{labels.tooltips.condensatePump}</title>
          <circle r="13" className={styles.pump} />
          <text y="7" textAnchor="middle" className={styles.pumpGlyph}>P</text>
        </g>
        <text x="398" y="90" className={styles.noteLabel}>{labels.condensatePump}</text>
      </g>

      {/* ---------------- Condenser casing (no fan, no grille) + water zone inside it ---------------- */}
      <rect x={CASING.x} y={CASING.y} width={CASING.w} height={CASING.h} rx={CASING.r} className={styles.casing} />
      <path d={PATHS.zone} className={styles.zone} clipPath={`url(#${ids.boxClip})`} data-emphasis={on(step >= 3)} />

      {/* ---------------- Building water in and out (mid blue, thicker) ---------------- */}
      <g className={styles.part} {...part("water")}>
        <FlowLine d={PATHS.waterOut} flow="water" />
        <FlowLine d={PATHS.waterIn} flow="water" />
        <Arrow x={690} y={280} dir="right" flow="water" />
        <Arrow x={690} y={350} dir="left" flow="water" />
        <text x="744" y="262" textAnchor="end" className={styles.waterLabel}>{labels.waterOut}</text>
        <text x="744" y="386" textAnchor="end" className={styles.waterLabel}>{labels.waterIn}</text>
      </g>

      {/* ---------------- Refrigerant through the wall: heat line (red) out, cool line (light blue) back ---------------- */}
      <g className={styles.part} {...part("liquid")}>
        <FlowLine d={PATHS.liquid} flow="cool" />
        <Arrow x={358} y={300} dir="up" flow="cool" />
        <Arrow x={326} y={146} dir="left" flow="cool" />
      </g>
      <g className={styles.part} {...part("suction")}>
        <FlowLine d={PATHS.suction} flow="heat" />
        <Arrow x={318} y={126} dir="right" flow="heat" />
        <Arrow x={404} y={196} dir="down" flow="heat" />
      </g>

      <g className={styles.part} {...part("discharge")}>
        <FlowLine d={PATHS.discharge} flow="heat" />
        <Arrow x={486} y={290} dir="up" flow="heat" />
      </g>

      <g className={styles.part} {...part("warmLiquid")}>
        <FlowLine d={PATHS.warmLiquid} flow="cool" />
      </g>

      <g className={styles.part} {...part("valve")}>
        <Valve x={470} y={406} r={8} title={labels.tooltips.expansionValve} />
      </g>

      <g className={styles.part} {...part("compressor")}>
        <rect x="386" y="248" width="80" height="140" rx="38" className={styles.halo} data-on={ring("compressor")} />
        <g className={styles.compressorBody}>
          <rect x="396" y="258" width="60" height="120" rx="30" className={styles.equipment} />
          <path d={SCROLL_PATH} className={styles.detailLine} />
        </g>
      </g>

      <g className={styles.part} {...part("hx")}>
        <rect x="510" y="254" width="104" height="128" rx="14" className={styles.halo} data-on={ring("hx")} />
        <rect x="520" y="264" width="84" height="108" rx="8" className={styles.equipment} />
        <path d="M 538 276 V 360 M 556 276 V 360 M 574 276 V 360 M 592 276 V 360" className={styles.plates} />
        {/* Heat crossing from the refrigerant side to the water side */}
        <g className={styles.hxDetail}>
          {[300, 340].map((y) => (
            <path key={y} d={`M 538 ${y} q 7 -8 14 0 q 7 8 14 0 q 7 -8 14 0`} className={styles.heatMark} markerEnd={`url(#${ids.headHeat})`} />
          ))}
        </g>
      </g>

      {/* Wall-crossing highlight */}
      <rect x="290" y="113" width="56" height="46" rx="12" className={styles.halo} data-on={ring("wall")} />

      {/* Label row under the casing: the unit's name, or the step's component callout */}
      <text x="498" y="456" textAnchor="middle" className={styles.componentLabel} data-on={on(!current.callout)}>
        {labels.condenserUnit}
      </text>
      <g className={styles.callout} data-on={on(current.callout === "compressor")}>
        <Pill
          cx={440}
          cy={448}
          height={36}
          padX={14}
          maxWidth={230}
          bgClassName={styles.calloutBg}
          lines={[{ text: labels.callouts.compressor, className: styles.calloutText, dy: 9 }]}
        />
      </g>
      <g className={styles.callout} data-on={on(current.callout === "heatExchanger")}>
        <Pill
          cx={548}
          cy={448}
          height={36}
          padX={14}
          maxWidth={262}
          bgClassName={styles.calloutBg}
          lines={[{ text: labels.callouts.heatExchanger, className: styles.calloutText, dy: 9 }]}
        />
      </g>

      {/* Water-zone tag straddles the zone's top edge */}
      <Pill
        cx={591}
        cy={188}
        height={36}
        padX={14}
        maxWidth={178}
        bgClassName={styles.zoneTagBg}
        lines={[{ text: labels.waterZone, className: styles.zoneTagText, dy: 9 }]}
      />

      {/* ---------------- Room: air and wall unit ---------------- */}
      <g className={styles.part} {...part("air")}>
        {[192, 232, 272].map((x) => (
          <path key={x} d={`M ${x} 26 q 6 5 0 10 q -6 5 0 10 q 6 5 0 10`} className={styles.airHeat} markerEnd={`url(#${ids.headHeat})`} />
        ))}
        {[168, 210, 252].map((x) => (
          <path key={x} d={`M ${x} 180 Q ${x - 8} 204 ${x - 32} 224`} className={styles.airCool} markerEnd={`url(#${ids.headCool})`} />
        ))}
      </g>

      <g className={styles.part} {...part("unit")}>
        <rect x="90" y="60" width="204" height="120" rx="22" className={styles.halo} data-on={ring("unit")} />
        <rect x="100" y="70" width="184" height="100" rx="14" className={styles.equipment} />
        <path d="M 118 160 H 266" className={styles.detailLine} />
        <text x="192" y="106" textAnchor="middle" className={styles.unitLabel}>
          {labels.wallUnit}
        </text>
      </g>
      <g className={styles.part} {...part("coil")}>
        <FlowLine d={PATHS.coilIn} flow="cool" />
        <FlowLine d={PATHS.coilOut} flow="heat" />
      </g>

      {/* ---------------- Badge + leader to the pipes in the wall ---------------- */}
      <g className={styles.badge} data-loud={on(loud)}>
        <path d={PATHS.leader} className={styles.leader} />
        <path d="M 292 116 H 298 M 292 156 H 298" className={styles.leader} />
        <rect x="8" y="248" width="284" height="104" rx="26" className={styles.halo} data-on={ring("badge")} />
        <g className={styles.badgeQuiet}>
          <Pill
            cx={150}
            cy={300}
            height={84}
            padX={18}
            maxWidth={276}
            bgClassName={styles.badgeQuietBg}
            lines={[
              { text: labels.badge[0], className: styles.badgeTitleQuiet, dy: -5 },
              { text: labels.badge[1], className: styles.badgeTextQuiet, dy: 26 },
            ]}
          />
        </g>
        <g className={styles.badgeLoud}>
          <Pill
            cx={150}
            cy={300}
            height={84}
            padX={18}
            maxWidth={276}
            bgClassName={styles.badgeLoudBg}
            lines={[
              { text: labels.badge[0], className: styles.badgeTitleLoud, dy: -5 },
              { text: labels.badge[1], className: styles.badgeTextLoud, dy: 26 },
            ]}
          />
        </g>
      </g>

      {/* ---------------- Legend: the three flow lines ---------------- */}
      <g className={styles.legend}>
        <FlowLine d="M 18 498 H 58" flow="heat" still />
        <text x="68" y="507" className={styles.legendText}>{labels.legendHeat}</text>
        <FlowLine d="M 196 498 H 236" flow="cool" still />
        <text x="246" y="507" className={styles.legendText}>{labels.legendCool}</text>
        <FlowLine d="M 372 498 H 412" flow="water" still />
        <text x="422" y="507" className={styles.legendText}>{labels.legendWater}</text>
      </g>
    </>
  );
}

export const FLAT: DrawingSpec = { width: VB_W, height: VB_H, Drawing: FlatDrawing };
