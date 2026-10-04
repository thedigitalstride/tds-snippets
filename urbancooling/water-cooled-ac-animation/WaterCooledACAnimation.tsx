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
  | "unit" //         wall unit body
  | "coil" //         refrigerant coil inside the wall unit
  | "suction" //      refrigerant gas pipe (larger): wall unit → compressor
  | "compressor"
  | "discharge" //    hot gas: compressor → heat exchanger
  | "hx" //           plate heat exchanger
  | "warmLiquid" //   warm liquid: heat exchanger → expansion valve
  | "valve" //        expansion valve
  | "liquid" //       cold liquid pipe (smaller): expansion valve → wall unit
  | "water"; //       building water loop, taps, isolation valves, roof note

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
  waterIn: string;
  waterOut: string;
  callouts: Record<Callout, string>;
  condensateDrain: readonly string[]; // one entry per line
  toRoof: readonly string[]; //         one entry per line
  badge: readonly [string, string]; //  [bold line, second line]
  legendCold: string;
  legendCool: string;
  legendHot: string;
  legendWater: string;
  /** Hover tooltips on parts that are not labelled on the drawing. */
  tooltips: {
    expansionValve: string;
    isolationValve: string;
    gasPipe: string;
    liquidPipe: string;
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
      "Refrigerant gas carries the heat through slim insulated pipes to the condenser unit. No water travels this way.",
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
  waterIn: "Cooler in",
  waterOut: "Warmer out",
  callouts: { compressor: "Compressor", heatExchanger: "Heat exchanger" },
  condensateDrain: ["Condensate", "drain"],
  toRoof: ["To rooftop", "coolers"],
  badge: ["Refrigerant only", "no water piped in"],
  legendCold: "Cold refrigerant",
  legendCool: "Heat-carrying gas",
  legendHot: "Hot refrigerant",
  legendWater: "Building water loop",
  tooltips: {
    expansionValve: "Expansion valve",
    isolationValve: "Isolation valve",
    gasPipe: "Refrigerant gas (larger pipe)",
    liquidPipe: "Refrigerant liquid (smaller pipe)",
  },
  svgTitle: "How water-cooled air conditioning works",
  svgDesc:
    "A water-cooled air conditioning system in an apartment, shown in five steps. A wall unit absorbs heat from the room " +
    "into refrigerant, which travels through slim insulated pipes to a condenser unit in a cupboard, where a compressor " +
    "and heat exchanger pass the heat to water from the building's shared water loop. Water stays in the condenser unit " +
    "and the building loop; only refrigerant travels to the wall unit.",
  controlsGroup: "Animation controls",
  play: "Play animation",
  pause: "Pause animation",
  previous: "Previous step",
  next: "Next step",
  goToStep: (n, title) => `Go to step ${n}: ${title}`,
  announce: (n, total, title, caption) => `Step ${n} of ${total}: ${title}. ${caption}`,
};

/* ========================================================================== */
/*  Geometry (viewBox 0 0 800 548)                                             */
/*  Refrigerant cycle: coil → gas pipe → compressor → heat exchanger →         */
/*  expansion valve → liquid pipe → coil. Paths are drawn in flow direction.   */
/* ========================================================================== */

const VB_W = 800;
const VB_H = 548;

const PATHS = {
  /** Wall-unit coil: cold liquid enters along the bottom… */
  coilIn: "M 284 146 H 122",
  /** …turns, and leaves as cool, heat-carrying gas along the top. */
  coilOut: "M 122 146 A 10 10 0 0 1 122 126 H 284",
  /** Gas (suction) pipe, the larger one: wall unit → through wall → compressor. */
  suction: "M 284 126 H 404 V 272",
  /** Hot gas: compressor → top of the heat exchanger. */
  discharge: "M 456 296 H 486 V 276 H 520",
  /** Warm liquid: bottom of the heat exchanger → expansion valve. */
  warmLiquid: "M 532 372 V 406 H 470",
  /** Cold liquid pipe, the smaller one: expansion valve → through wall → wall unit. */
  liquid: "M 470 406 H 358 V 146 H 284",
  /** Building loop: flow comes down from the roof, return goes back up. */
  flowRiser: "M 752 -2 V 482",
  returnRiser: "M 708 482 V -2",
  /** Counterflow: water enters the heat exchanger at the bottom, leaves at the top. */
  flowTap: "M 752 350 H 604",
  returnTap: "M 604 276 H 708",
  /** Condensate drain: thin and grey, outside the water zone, runs to waste. */
  drain: "M 112 170 V 466",
  /** Badge leader: from the badge to the pipe pair where it crosses the wall. */
  leader: "M 256 258 L 298 164 V 108",
  /** Where water exists. It ends inside the condenser unit, at x = 500. */
  zone: "M 500 188 H 682 V 6 H 798 V 480 H 682 V 428 H 500 Z",
} as const;

const CASING = { x: 380, y: 208, w: 248, h: 212, r: 18 } as const;

/** Two-turn scroll (Archimedean spiral): the compressor's working part. */
const SCROLL_PATH = (() => {
  const cx = 426;
  const cy = 300;
  const turns = 2.25;
  const pts: string[] = [];
  for (let i = 0; i <= 72; i++) {
    const t = (i / 72) * turns * 2 * Math.PI;
    const r = 3 + (17 * t) / (turns * 2 * Math.PI);
    pts.push(`${(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * Math.sin(t)).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")}`;
})();

/** Numbered markers tie step n's button to a place on the drawing. */
const MARKERS = [
  { n: 1, x: 66, y: 120 }, //  wall unit
  { n: 2, x: 318, y: 192 }, // wall crossing
  { n: 3, x: 426, y: 348 }, // compressor
  { n: 4, x: 562, y: 318 }, // heat exchanger (between the heat squiggles)
] as const;

type Dir = "up" | "down" | "left" | "right";
const ANGLE: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };

/** Refrigerant state, drawn as a colour convention (blue = cold, red = hot) plus its own dash rhythm. */
type RefState = "cold" | "cool" | "hot" | "warm";
type RefSize = "gas" | "liquid";
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

const refStateClass: Record<RefState, ClassName> = {
  cold: styles.refCold,
  cool: styles.refCool,
  hot: styles.refHot,
  warm: styles.refWarm,
};
const refArrowClass: Record<RefState, ClassName> = {
  cold: styles.refArrowCold,
  cool: styles.refArrowCool,
  hot: styles.refArrowHot,
  warm: styles.refArrowWarm,
};

/** Copper-rimmed refrigerant pipe with dashes flowing inside. The gas pipe is larger. */
function RefPipe({ d, state, size, still }: { d: string; state: RefState; size: RefSize; still?: boolean }) {
  const big = size === "gas";
  return (
    <>
      <path className={big ? styles.refRimGas : styles.refRimLiquid} d={d} />
      <path className={big ? styles.refCoreGas : styles.refCoreLiquid} d={d} />
      <path
        className={cx(styles.refFlow, big ? styles.refFlowGas : styles.refFlowLiquid, refStateClass[state], still && styles.still)}
        d={d}
      />
    </>
  );
}

function RefArrow({ x, y, dir, state, size }: { x: number; y: number; dir: Dir; state: RefState; size: RefSize }) {
  const s = size === "gas" ? 1 : 0.8;
  return (
    <path
      className={refArrowClass[state]}
      d="M -7 -9 L 7 0 L -7 9 Z"
      transform={`translate(${x} ${y}) rotate(${ANGLE[dir]}) scale(${s})`}
    />
  );
}

/** Wide, double-outlined water pipe with round bubbles flowing inside. */
function WaterPipe({ d, ret, still }: { d: string; ret?: boolean; still?: boolean }) {
  return (
    <>
      <path className={styles.waterRim} d={d} />
      <path className={styles.waterCore} d={d} />
      <path className={cx(styles.waterFlow, ret ? styles.waterReturn : styles.waterSupply, still && styles.still)} d={d} />
    </>
  );
}

function WaterArrow({ x, y, dir, ret, s = 1 }: { x: number; y: number; dir: Dir; ret?: boolean; s?: number }) {
  return (
    <path
      className={ret ? styles.waterArrowReturn : styles.waterArrow}
      d="M -6 -8 L 7 0 L -6 8 Z"
      transform={`translate(${x} ${y}) rotate(${ANGLE[dir]}) scale(${s})`}
    />
  );
}

/** Bow-tie valve symbol on a horizontal pipe. */
function Valve({
  x,
  y,
  r,
  className,
  title,
  stemDown,
}: {
  x: number;
  y: number;
  r: number;
  className?: ClassName;
  title: string;
  stemDown?: boolean;
}) {
  const s = stemDown ? 1 : -1;
  return (
    <g className={className} transform={`translate(${x} ${y})`}>
      <title>{title}</title>
      <path d={`M ${-r} ${-r} L 0 0 L ${-r} ${r} Z M ${r} ${-r} L 0 0 L ${r} ${r} Z`} />
      <path d={`M 0 0 V ${s * (r + 5)} M ${-r * 0.6} ${s * (r + 5)} H ${r * 0.6}`} className={styles.valveStem} />
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
      <rect x={centreX - width / 2} y={cy - height / 2} width={width} height={height} rx={Math.min(height / 2, 22)} className={bgClassName} />
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

/** Legend swatch for a refrigerant pipe: identical to the pipe it describes, but still. */
function RefSwatch({ x, y, state, size }: { x: number; y: number; state: RefState; size: RefSize }) {
  return <RefPipe d={`M ${x} ${y} H ${x + 46}`} state={state} size={size} still />;
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
    hatch: `${uid}-hatch`,
    shadow: `${uid}-shadow`,
    headWarm: `${uid}-head-warm`,
    headCool: `${uid}-head-cool`,
    headHeat: `${uid}-head-heat`,
    headRef: `${uid}-head-ref`,
    headWater: `${uid}-head-water`,
    boxClip: `${uid}-box-clip`,
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
  /** Particles and pulses run while playing and visible. */
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
            <pattern id={ids.hatch} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="14" height="14" className={styles.wallFill} />
              <line x1="0" y1="0" x2="0" y2="14" className={styles.wallHatch} />
            </pattern>
            <clipPath id={ids.boxClip}>
              <rect x={CASING.x} y={CASING.y} width={CASING.w} height={CASING.h} rx={CASING.r} />
            </clipPath>
            <filter id={ids.shadow} x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0b2340" floodOpacity="0.14" />
            </filter>
            {(
              [
                [ids.headWarm, styles.headWarm, 4],
                [ids.headCool, styles.headCool, 4],
                [ids.headHeat, styles.headWarm, 3.4],
                [ids.headRef, styles.headRef, 3.6],
                [ids.headWater, styles.headWater, 3.6],
              ] as const
            ).map(([id, cls, size]) => (
              <marker key={id} id={id} viewBox="0 0 10 10" refX="5" refY="5" markerWidth={size} markerHeight={size} orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 Z" className={cls} />
              </marker>
            ))}
          </defs>

          {/* ---------------- Building section ---------------- */}
          <rect x="0" y="0" width={VB_W} height={VB_H} className={styles.svgBg} />
          <rect x="0" y="20" width="300" height="446" className={styles.roomFill} />
          <rect x="336" y="20" width="464" height="446" className={styles.plantFill} />
          <rect x="300" y="20" width="36" height="446" fill={`url(#${ids.hatch})`} />
          <rect x="0" y="0" width={VB_W} height="20" className={styles.slab} />
          <rect x="0" y="466" width={VB_W} height="14" className={styles.slab} />

          <text x="16" y="54" className={styles.areaLabel}>{LABELS.room}</text>
          <text x="348" y="58" className={styles.areaLabel}>{LABELS.cupboard}</text>

          {/* ---------------- Water zone, outside the casing ---------------- */}
          <path d={PATHS.zone} className={styles.zone} data-emphasis={on(step >= 3)} />

          {/* ---------------- Condensate drain: secondary, never lit ---------------- */}
          <g className={styles.drainGroup}>
            <path d={PATHS.drain} className={styles.drain} />
            <path d="M 104 454 L 112 466 L 120 454" className={styles.drain} />
            {LABELS.condensateDrain.map((line, i) => (
              <text key={line} x="124" y={374 + i * 26} className={styles.drainLabel}>
                {line}
              </text>
            ))}
          </g>

          {/* Sofa (drawn over the drain) */}
          <g className={styles.furniture} aria-hidden="true">
            <rect x="170" y="402" width="104" height="38" rx="12" />
            <rect x="160" y="428" width="124" height="28" rx="9" />
            <rect x="150" y="414" width="28" height="44" rx="11" />
            <rect x="266" y="414" width="28" height="44" rx="11" />
            <rect x="160" y="456" width="8" height="10" rx="3" />
            <rect x="276" y="456" width="8" height="10" rx="3" />
          </g>

          {/* ---------------- Condenser casing (no fan, no grille) + water zone inside it ---------------- */}
          <rect x={CASING.x} y={CASING.y} width={CASING.w} height={CASING.h} rx={CASING.r} className={styles.box} filter={`url(#${ids.shadow})`} />
          <path d={PATHS.zone} className={styles.zone} clipPath={`url(#${ids.boxClip})`} data-emphasis={on(step >= 3)} />

          {/* ---------------- Building water loop ---------------- */}
          <g className={styles.part} {...part("water")}>
            <WaterPipe d={PATHS.returnRiser} ret />
            <WaterPipe d={PATHS.flowRiser} />
            <WaterPipe d={PATHS.returnTap} ret />
            <WaterPipe d={PATHS.flowTap} />
            <WaterArrow x={708} y={150} dir="up" ret />
            <WaterArrow x={708} y={440} dir="up" ret />
            <WaterArrow x={752} y={150} dir="down" />
            <WaterArrow x={752} y={440} dir="down" />
            <WaterArrow x={682} y={276} dir="right" ret />
            <WaterArrow x={682} y={350} dir="left" />
            <Valve x={648} y={276} r={11} className={styles.isoValve} title={LABELS.tooltips.isolationValve} stemDown />
            <Valve x={648} y={350} r={11} className={styles.isoValve} title={LABELS.tooltips.isolationValve} />
            <text x="676" y="252" textAnchor="end" className={styles.tapLabel}>{LABELS.waterOut}</text>
            <text x="676" y="398" textAnchor="end" className={styles.tapLabel}>{LABELS.waterIn}</text>
            {/* To the rooftop coolers, from the top of the return riser */}
            <WaterArrow x={708} y={34} dir="up" ret s={1.6} />
            {LABELS.toRoof.map((line, i) => (
              <text key={line} x="672" y={48 + i * 28} textAnchor="end" className={styles.noteLabel}>
                {line}
              </text>
            ))}
          </g>

          {/* ---------------- Refrigerant pipes (drawn over the casing so the loop is continuous) ---------------- */}
          <g className={styles.part} {...part("liquid")}>
            <title>{LABELS.tooltips.liquidPipe}</title>
            <RefPipe d={PATHS.liquid} state="cold" size="liquid" />
            <RefArrow x={358} y={300} dir="up" state="cold" size="liquid" />
            <RefArrow x={430} y={406} dir="left" state="cold" size="liquid" />
          </g>
          <g className={styles.part} {...part("suction")}>
            <title>{LABELS.tooltips.gasPipe}</title>
            <path d={PATHS.suction} className={styles.glowCool} />
            <RefPipe d={PATHS.suction} state="cool" size="gas" />
            <RefArrow x={380} y={126} dir="right" state="cool" size="gas" />
            <RefArrow x={404} y={186} dir="down" state="cool" size="gas" />
          </g>

          <g className={styles.part} {...part("discharge")}>
            <path d={PATHS.discharge} className={styles.glowHot} />
            <RefPipe d={PATHS.discharge} state="hot" size="gas" />
            <RefArrow x={486} y={290} dir="up" state="hot" size="gas" />
          </g>

          <g className={styles.part} {...part("warmLiquid")}>
            <RefPipe d={PATHS.warmLiquid} state="warm" size="liquid" />
          </g>

          <g className={styles.part} {...part("valve")}>
            <Valve x={470} y={406} r={10} className={styles.expValve} title={LABELS.tooltips.expansionValve} />
          </g>

          <g className={styles.part} {...part("compressor")}>
            <rect x="386" y="248" width="80" height="140" rx="38" className={styles.halo} data-on={ring("compressor")} />
            <g className={styles.compressorBody}>
              <rect x="396" y="258" width="60" height="120" rx="30" className={styles.compressor} />
              <rect x="404" y="272" width="7" height="92" rx="3.5" className={styles.compressorShine} />
              <path d={SCROLL_PATH} className={styles.scroll} />
            </g>
          </g>

          <g className={styles.part} {...part("hx")}>
            <rect x="513" y="257" width="98" height="122" rx="14" className={styles.halo} data-on={ring("hx")} />
            <rect x="520" y="264" width="84" height="108" rx="10" className={styles.hx} />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <rect
                key={i}
                x={528 + i * 12}
                y="272"
                width="8"
                height="92"
                rx="4"
                className={i % 2 === 0 ? styles.plateRef : styles.plateWater}
              />
            ))}
            {/* Counterflow inside the plates, and heat crossing from refrigerant to water */}
            <g className={styles.hxDetail}>
              <path d="M 532 280 V 356" className={styles.hxRefLine} markerEnd={`url(#${ids.headRef})`} />
              <path d="M 592 356 V 280" className={styles.hxWaterLine} markerEnd={`url(#${ids.headWater})`} />
              {[288, 350].map((y) => (
                <path key={y} d={`M 544 ${y} q 6 -7 12 0 q 6 7 12 0`} className={styles.heatLine} markerEnd={`url(#${ids.headHeat})`} />
              ))}
            </g>
          </g>

          {/* Wall-crossing highlight */}
          <rect x="290" y="104" width="56" height="64" rx="14" className={styles.halo} data-on={ring("wall")} />

          {/* Label row under the casing: the unit's name, or the step's component callout */}
          <text x="504" y="456" textAnchor="middle" className={styles.componentLabel} data-on={on(!current.callout)}>
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
              <path key={x} d={`M ${x} 26 q 6 5 0 10 q -6 5 0 10 q 6 5 0 10`} className={styles.airWarm} markerEnd={`url(#${ids.headWarm})`} />
            ))}
            {[168, 210, 252].map((x) => (
              <path key={x} d={`M ${x} 178 Q ${x - 8} 204 ${x - 34} 226`} className={styles.airCool} markerEnd={`url(#${ids.headCool})`} />
            ))}
          </g>

          <g className={styles.part} {...part("unit")}>
            <rect x="90" y="60" width="204" height="120" rx="24" className={styles.halo} data-on={ring("unit")} />
            <rect x="100" y="70" width="184" height="100" rx="16" className={styles.unit} filter={`url(#${ids.shadow})`} />
            <line x1="114" y1="162" x2="270" y2="162" className={styles.louvre} />
            <text x="192" y="106" textAnchor="middle" className={styles.unitLabel}>
              {LABELS.wallUnit}
            </text>
          </g>
          <g className={styles.part} {...part("coil")}>
            <RefPipe d={PATHS.coilIn} state="cold" size="liquid" />
            <RefPipe d={PATHS.coilOut} state="cool" size="gas" />
          </g>

          {/* ---------------- Badge + leader to the pipes in the wall ---------------- */}
          <g className={styles.badge} data-loud={on(loud)}>
            <path d={PATHS.leader} className={styles.leader} />
            <path d="M 292 108 H 298 M 292 164 H 298" className={styles.leader} />
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

          {/* ---------------- Step markers ---------------- */}
          {MARKERS.map((m) => (
            <g key={m.n} className={styles.marker} data-on={on(step === m.n - 1)} transform={`translate(${m.x} ${m.y})`}>
              <circle r="19" className={styles.markerDisc} />
              <text y="9" textAnchor="middle" className={styles.markerText}>
                {m.n}
              </text>
            </g>
          ))}

          {/* ---------------- Legend (2 × 2); each swatch is the pipe it names ---------------- */}
          <g className={styles.legend}>
            <RefSwatch x={16} y={500} state="cold" size="liquid" />
            <text x="72" y="509" className={styles.legendText}>{LABELS.legendCold}</text>
            <RefSwatch x={414} y={500} state="cool" size="gas" />
            <text x="470" y="509" className={styles.legendText}>{LABELS.legendCool}</text>
            <RefSwatch x={16} y={531} state="hot" size="gas" />
            <text x="72" y="540" className={styles.legendText}>{LABELS.legendHot}</text>
            <WaterPipe d="M 414 531 H 460" still />
            <text x="470" y="540" className={styles.legendText}>{LABELS.legendWater}</text>
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
