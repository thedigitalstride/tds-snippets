"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent,
} from "react";
import styles from "./WaterCooledACAnimation.module.css";

/* ========================================================================== */
/*  COPY: every user-facing string lives in STEPS and LABELS below.            */
/*  On phones, SVG labels render at about 11px (26 viewBox units), so keep     */
/*  them short. Captions: 18 words or fewer (3 lines at 320px wide).           */
/* ========================================================================== */

/** Parts of the illustration that are lit (and animated) or dimmed per step. */
export type Part =
  | "air" //          room air in and out of the wall unit
  | "unit" //         wall unit outline
  | "coil" //         refrigerant loop inside the wall unit
  | "suction" //      heat line: refrigerant gas from the wall unit → compressor
  | "compressor"
  | "discharge" //    hot refrigerant: compressor → heat exchanger
  | "hx" //           plate heat exchanger
  | "warmLiquid" //   refrigerant: heat exchanger → expansion valve
  | "valve" //        expansion valve
  | "liquid" //       refrigerant liquid line: expansion valve → wall unit
  | "water"; //       building water in and out of the heat exchanger

/** Things that can wear the pulsing highlight ring (one per step). */
export type Focus = "unit" | "wall" | "compressor" | "hx" | "badge";

/** Optional on-diagram callout shown under the condenser unit for a step. */
export type Callout = "compressor" | "heatExchanger";

export interface Step {
  /** Bold lead-in before the caption; also used in the step button labels. */
  title: string;
  /** 18 words or fewer. */
  caption: string;
  /** Component that gets the highlight ring. */
  focus: Focus;
  /** Parts that stay lit and animated; everything else is dimmed and still. */
  active: readonly Part[];
  /** Name a component on the drawing during this step. */
  callout?: Callout;
  /** Multiplies stepDuration for this step (the summary is held longer). */
  hold?: number;
}

export interface Labels {
  room: string;
  cupboard: string;
  wallUnit: string;
  condenserUnit: string;
  waterZone: string;
  callouts: Record<Callout, string>;
  condensatePump: string;
  waterIn: string;
  waterOut: string;
  badge: readonly [string, string]; //  [bold line, second line]
  legendHeat: string;
  legendCool: string;
  legendWater: string;
  /** Hover tooltips on small parts that are not labelled on the drawing. */
  tooltips: {
    expansionValve: string;
    condensatePump: string;
  };
  /* Accessible copy */
  svgTitle: string;
  svgDesc: string;
  controlsGroup: string;
  play: string;
  pause: string;
  previous: string;
  next: string;
  goToStep: (n: number, title: string) => string;
  announce: (n: number, total: number, title: string, caption: string) => string;
}

export const STEPS: readonly Step[] = [
  {
    title: "Room heat is captured",
    caption:
      "The wall unit's cold refrigerant coil absorbs heat from your room air. Cool air flows back out.",
    focus: "unit",
    active: ["air", "unit", "coil"],
  },
  {
    title: "Refrigerant carries the heat",
    caption:
      "The room's heat travels through slim insulated pipes to the condenser unit in the cupboard.",
    focus: "wall",
    active: ["suction", "liquid"],
  },
  {
    title: "Compressor turns up the heat",
    caption:
      "The compressor squeezes the gas, raising its temperature so it can pass its heat to the water.",
    focus: "compressor",
    active: ["suction", "compressor", "discharge"],
    callout: "compressor",
  },
  {
    title: "Water takes the heat away",
    caption:
      "The building's water absorbs the heat in the heat exchanger. Refrigerant turns back to liquid and returns.",
    focus: "hx",
    active: ["discharge", "hx", "warmLiquid", "valve", "liquid", "water"],
    callout: "heatExchanger",
  },
  {
    title: "Water stays in the cupboard",
    caption:
      "Building water goes no further than the condenser unit. Only refrigerant travels to your wall unit.",
    focus: "badge",
    active: ["air", "unit", "coil", "suction", "compressor", "discharge", "hx", "warmLiquid", "valve", "liquid", "water"],
    hold: 2,
  },
];

export const LABELS: Labels = {
  room: "Your room",
  cupboard: "Cupboard",
  wallUnit: "Wall unit",
  condenserUnit: "Condenser unit",
  waterZone: "Water zone",
  callouts: { compressor: "Compressor", heatExchanger: "Heat exchanger" },
  condensatePump: "Condensate pump",
  waterIn: "Water in",
  waterOut: "Water out",
  badge: ["Refrigerant only", "no water piped in"],
  legendHeat: "Heat",
  legendCool: "Cool",
  legendWater: "Building water",
  tooltips: {
    expansionValve: "Expansion valve",
    condensatePump: "Condensate pump",
  },
  svgTitle: "How water-cooled air conditioning works",
  svgDesc:
    "A water-cooled air conditioning system in an apartment, shown in five steps. A wall unit absorbs heat from the room " +
    "into refrigerant, which carries it through slim insulated pipes to a condenser unit in a cupboard. There a compressor " +
    "and heat exchanger pass the heat to the building's water, which flows into the heat exchanger and out again, warmer. " +
    "Alongside the refrigerant pipes, a small condensate pump returns condensate from the wall unit to the condenser unit. " +
    "Building water stays in the condenser unit; only refrigerant travels to the wall unit. Red lines show heat, light " +
    "blue lines show cool refrigerant and air, and thicker mid-blue lines show the building's water.",
  controlsGroup: "Animation controls",
  play: "Play animation",
  pause: "Pause animation",
  previous: "Previous step",
  next: "Next step",
  goToStep: (n, title) => `Go to step ${n}: ${title}`,
  announce: (n, total, title, caption) => `Step ${n} of ${total}: ${title}. ${caption}`,
};

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

type Dir = "up" | "down" | "left" | "right";
const ANGLE: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };

/** The only three flow colours. */
type Flow = "heat" | "cool" | "water";
type ClassName = string | undefined;

const cx = (...c: (ClassName | false)[]) => c.filter(Boolean).join(" ");

/** Safe step lookup (works with noUncheckedIndexedAccess). */
const stepAt = (i: number): Step => STEPS[i] ?? (STEPS[0] as Step);

/* ========================================================================== */
/*  External stores (no setState-in-effect, SSR-safe server snapshots)         */
/* ========================================================================== */

const RM_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (cb: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(RM_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getReducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.(RM_QUERY).matches;

const subscribeVisibility = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};
const getTabHidden = () => document.visibilityState === "hidden";

const subscribeNothing = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

/* ========================================================================== */
/*  SVG building blocks                                                       */
/* ========================================================================== */

const lineClass: Record<Flow, ClassName> = { heat: styles.lineHeat, cool: styles.lineCool, water: styles.lineWater };
const beadClass: Record<Flow, ClassName> = { heat: styles.beadThin, cool: styles.beadThin, water: styles.beadThick };
const arrowClass: Record<Flow, ClassName> = { heat: styles.arrowHeat, cool: styles.arrowCool, water: styles.arrowWater };

/** One flow: a single stroked line with light beads travelling along it. */
function FlowLine({ d, flow, still }: { d: string; flow: Flow; still?: boolean }) {
  return (
    <>
      <path className={cx(styles.line, lineClass[flow])} d={d} />
      <path className={cx(styles.bead, beadClass[flow], still && styles.still)} d={d} />
    </>
  );
}

/** Direction arrowhead sitting on a flow line. */
function Arrow({ x, y, dir, flow }: { x: number; y: number; dir: Dir; flow: Flow }) {
  const s = flow === "water" ? 1.25 : 1;
  return (
    <path
      className={arrowClass[flow]}
      d="M -6 -7 L 7 0 L -6 7 Z"
      transform={`translate(${x} ${y}) rotate(${ANGLE[dir]}) scale(${s})`}
    />
  );
}

/** Bow-tie valve symbol (line art) on a horizontal line. */
function Valve({ x, y, r, title }: { x: number; y: number; r: number; title: string }) {
  return (
    <g className={styles.valve} transform={`translate(${x} ${y})`}>
      <title>{title}</title>
      <path d={`M ${-r} ${-r} L ${r} ${r} V ${-r} L ${-r} ${r} Z`} />
    </g>
  );
}

interface PillLine {
  text: string;
  className?: ClassName;
  /** Baseline offset from the pill centre. */
  dy: number;
}

/**
 * A rounded label whose background is sized to its measured text, so the copy
 * can change freely. If the text is wider than `maxWidth` it is scaled to fit.
 */
function Pill({
  cx: centreX,
  cy,
  height,
  padX,
  maxWidth,
  lines,
  bgClassName,
  fallbackCharWidth = 15,
}: {
  cx: number;
  cy: number;
  height: number;
  padX: number;
  maxWidth: number;
  lines: readonly PillLine[];
  bgClassName?: ClassName;
  fallbackCharWidth?: number;
}) {
  const textRef = useRef<SVGGElement>(null);
  const longest = Math.max(...lines.map((l) => l.text.length));
  const [measured, setMeasured] = useState<number | null>(null);
  const textWidth = measured ?? longest * fallbackCharWidth;

  // Re-measure whenever the text box changes size (copy, web fonts, container-query font sizes).
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const measure = () => {
      try {
        const w = el.getBBox().width;
        if (w > 0) setMeasured(w);
      } catch {
        /* not rendered */
      }
    };
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, []);

  const scale = Math.min(1, (maxWidth - padX * 2) / textWidth);
  const width = Math.min(maxWidth, textWidth * scale + padX * 2);
  return (
    <>
      <rect x={centreX - width / 2} y={cy - height / 2} width={width} height={height} rx={Math.min(height / 2, 20)} className={bgClassName} />
      <g transform={`translate(${centreX} ${cy}) scale(${scale})`}>
        <g ref={textRef}>
          {lines.map((l) => (
            <text key={l.text} x={0} y={l.dy} textAnchor="middle" className={l.className}>
              {l.text}
            </text>
          ))}
        </g>
      </g>
    </>
  );
}

/* ========================================================================== */
/*  Component                                                                 */
/* ========================================================================== */

export interface WaterCooledACAnimationProps {
  /** Extra class on the root element, e.g. to set brand tokens or margins. */
  className?: string | undefined;
  /** Start auto-advancing on mount. Ignored when the viewer prefers reduced motion. */
  autoPlay?: boolean | undefined;
  /** How long each step shows while playing, in ms (min 1500; the last step is held twice as long). */
  stepDuration?: number | undefined;
  /** Optional small heading inside the square, e.g. "How it works". */
  eyebrow?: string | undefined;
  /** Optional headline inside the square. Leave empty if the page already has one. */
  headline?: string | undefined;
}

export default function WaterCooledACAnimation({
  className,
  autoPlay = true,
  stepDuration = 7000,
  eyebrow,
  headline,
}: WaterCooledACAnimationProps) {
  const rawId = useId();
  const uid = `ucwc${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ids = {
    title: `${uid}-title`,
    desc: `${uid}-desc`,
    boxClip: `${uid}-box-clip`,
    headHeat: `${uid}-head-heat`,
    headCool: `${uid}-head-cool`,
    headGrey: `${uid}-head-grey`,
  };

  const duration = Number.isFinite(stepDuration) ? Math.max(1500, stepDuration) : 7000;

  const rootRef = useRef<HTMLElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  /** Increments on every manual navigation (restarts timers and re-announces). */
  const [nav, setNav] = useState(0);
  /** null = the viewer has not chosen; follow autoPlay and reduced motion. */
  const [userPlaying, setUserPlaying] = useState<boolean | null>(null);
  const [inView, setInView] = useState(true);
  const [keyboardInControls, setKeyboardInControls] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getFalse);
  const tabHidden = useSyncExternalStore(subscribeVisibility, getTabHidden, getFalse);
  const hydrated = useSyncExternalStore(subscribeNothing, getTrue, getFalse);

  const playing = userPlaying ?? (autoPlay && !reducedMotion);
  /** Flow motion and pulses run while playing and visible. */
  const moving = playing && !tabHidden && inView;
  /** The step timer also needs hydration, and holds while a keyboard user is in the controls. */
  const advancing = hydrated && moving && !keyboardInControls;

  const current = stepAt(step);
  const stepMs = Math.round(duration * (current.hold ?? 1));

  // Pause while scrolled out of view.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? true), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Step timer. The time left is kept across pauses, so resuming continues the same step.
  const remainingRef = useRef(stepMs);
  useEffect(() => {
    remainingRef.current = stepMs;
  }, [step, nav, stepMs]);
  useEffect(() => {
    if (!advancing) return;
    const startedAt = performance.now();
    const timer = window.setTimeout(() => setStep((s) => (s + 1) % STEPS.length), remainingRef.current);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (performance.now() - startedAt));
    };
  }, [advancing, step, nav]);

  /** Manual navigation: jump, pause autoplay (the viewer is in control), and announce. */
  const goTo = useCallback((i: number) => {
    const n = ((i % STEPS.length) + STEPS.length) % STEPS.length;
    const s = stepAt(n);
    setStep(n);
    setNav((k) => k + 1);
    setUserPlaying(false);
    setAnnouncement(LABELS.announce(n + 1, STEPS.length, s.title, s.caption));
  }, []);

  const onControlsFocus = (e: FocusEvent<HTMLDivElement>) => {
    let keyboard = false;
    try {
      keyboard = (e.target as HTMLElement).matches(":focus-visible");
    } catch {
      keyboard = false;
    }
    setKeyboardInControls(keyboard);
  };
  const onControlsBlur = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (!next || !controlsRef.current?.contains(next)) setKeyboardInControls(false);
  };

  const part = (p: Part) => ({ "data-active": current.active.includes(p) ? "true" : "false" });
  const ring = (f: Focus) => (current.focus === f ? "true" : "false");
  const on = (b: boolean) => (b ? "true" : "false");
  const loud = current.focus === "badge";

  return (
    <figure
      ref={rootRef}
      className={cx(styles.root, className)}
      data-step={step + 1}
      data-moving={on(moving)}
      data-advancing={on(advancing)}
      aria-labelledby={ids.title}
      style={{ "--_uc-step-ms": `${stepMs}ms` } as CSSProperties}
    >
      {(eyebrow || headline) && (
        <header className={styles.head}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          {headline && <p className={styles.headline}>{headline}</p>}
        </header>
      )}

      <div className={styles.stage}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-labelledby={ids.title}
          aria-describedby={ids.desc}
          focusable="false"
        >
          <title id={ids.title}>{LABELS.svgTitle}</title>
          <desc id={ids.desc}>{LABELS.svgDesc}</desc>

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

          <text x="16" y="56" className={styles.areaLabel}>{LABELS.room}</text>
          <text x="348" y="58" className={styles.areaLabel}>{LABELS.cupboard}</text>

          {/* ---------------- Water zone, outside the casing ---------------- */}
          <path d={PATHS.zone} className={styles.zone} data-emphasis={on(step >= 3)} />

          {/* ---------------- Condensate: thin grey, secondary, never lit ---------------- */}
          <g className={styles.condensateGroup}>
            <path d={PATHS.condensate} className={styles.condensate} markerEnd={`url(#${ids.headGrey})`} />
            <g transform="translate(378 104)">
              <title>{LABELS.tooltips.condensatePump}</title>
              <circle r="13" className={styles.pump} />
              <text y="7" textAnchor="middle" className={styles.pumpGlyph}>P</text>
            </g>
            <text x="398" y="90" className={styles.noteLabel}>{LABELS.condensatePump}</text>
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
            <text x="744" y="262" textAnchor="end" className={styles.waterLabel}>{LABELS.waterOut}</text>
            <text x="744" y="386" textAnchor="end" className={styles.waterLabel}>{LABELS.waterIn}</text>
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
            <Valve x={470} y={406} r={8} title={LABELS.tooltips.expansionValve} />
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
            {LABELS.condenserUnit}
          </text>
          <g className={styles.callout} data-on={on(current.callout === "compressor")}>
            <Pill
              cx={440}
              cy={448}
              height={36}
              padX={14}
              maxWidth={230}
              bgClassName={styles.calloutBg}
              lines={[{ text: LABELS.callouts.compressor, className: styles.calloutText, dy: 9 }]}
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
              lines={[{ text: LABELS.callouts.heatExchanger, className: styles.calloutText, dy: 9 }]}
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
            lines={[{ text: LABELS.waterZone, className: styles.zoneTagText, dy: 9 }]}
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
              {LABELS.wallUnit}
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
                  { text: LABELS.badge[0], className: styles.badgeTitleQuiet, dy: -5 },
                  { text: LABELS.badge[1], className: styles.badgeTextQuiet, dy: 26 },
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
                  { text: LABELS.badge[0], className: styles.badgeTitleLoud, dy: -5 },
                  { text: LABELS.badge[1], className: styles.badgeTextLoud, dy: 26 },
                ]}
              />
            </g>
          </g>

          {/* ---------------- Legend: the three flow lines ---------------- */}
          <g className={styles.legend}>
            <FlowLine d="M 18 498 H 58" flow="heat" still />
            <text x="68" y="507" className={styles.legendText}>{LABELS.legendHeat}</text>
            <FlowLine d="M 196 498 H 236" flow="cool" still />
            <text x="246" y="507" className={styles.legendText}>{LABELS.legendCool}</text>
            <FlowLine d="M 372 498 H 412" flow="water" still />
            <text x="422" y="507" className={styles.legendText}>{LABELS.legendWater}</text>
          </g>
        </svg>
      </div>

      {/* ---------------- Caption + controls ---------------- */}
      <div className={styles.band}>
        <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
          <span key={nav}>{announcement}</span>
        </p>
        <div className={styles.captionStack} aria-hidden="true">
          {STEPS.map((s, i) => (
            <p key={s.title} className={styles.caption} data-on={on(i === step)}>
              <strong className={styles.captionTitle}>{s.title}.</strong> {s.caption}
            </p>
          ))}
        </div>
        {/* Screen readers get the current caption here (the visual stack above is decorative). */}
        <p className={styles.srOnly}>{LABELS.announce(step + 1, STEPS.length, current.title, current.caption)}</p>

        <div
          ref={controlsRef}
          className={styles.controls}
          role="group"
          aria-label={LABELS.controlsGroup}
          onFocus={onControlsFocus}
          onBlur={onControlsBlur}
        >
          <button
            type="button"
            className={cx(styles.btn, styles.btnPlay)}
            onClick={() => setUserPlaying(!playing)}
            aria-label={playing ? LABELS.pause : LABELS.play}
          >
            {playing ? (
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <rect x="4.5" y="3.5" width="3.8" height="13" rx="1.2" />
                <rect x="11.7" y="3.5" width="3.8" height="13" rx="1.2" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path d="M 6 3.6 L 16.2 10 L 6 16.4 Z" />
              </svg>
            )}
          </button>

          <button type="button" className={cx(styles.btn, styles.btnStep)} onClick={() => goTo(step - 1)} aria-label={LABELS.previous}>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M 12.5 4 L 6.5 10 L 12.5 16" className={styles.iconStroke} />
            </svg>
          </button>

          <ol className={styles.pills}>
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  className={styles.pill}
                  data-on={on(i === step)}
                  aria-current={i === step ? "step" : undefined}
                  aria-label={LABELS.goToStep(i + 1, s.title)}
                  onClick={() => goTo(i)}
                >
                  <span aria-hidden="true">{i + 1}</span>
                  {i === step && <span key={`${step}-${nav}`} className={styles.progress} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ol>

          <button type="button" className={cx(styles.btn, styles.btnStep)} onClick={() => goTo(step + 1)} aria-label={LABELS.next}>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M 7.5 4 L 13.5 10 L 7.5 16" className={styles.iconStroke} />
            </svg>
          </button>
        </div>
      </div>
    </figure>
  );
}
