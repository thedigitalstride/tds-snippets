"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
} from "react";
import styles from "./WaterCooledACAnimation.module.css";

/* ========================================================================== */
/*  COPY: every user-facing string lives in STEPS and LABELS below.            */
/*  SVG labels are drawn at 26 viewBox units (about 11px on a 340px-wide       */
/*  phone), so keep them short. Captions: 18 words or fewer.                   */
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
  | "water" //        building water loop, taps and isolation valves
  | "drain"; //       condensate drain

/** Things that can wear the pulsing highlight ring. */
export type Focus = "unit" | "wall" | "compressor" | "hx" | "valve" | "badge";

export interface Step {
  /** Bold lead-in before the caption; also used in the step button labels. */
  title: string;
  /** 18 words or fewer. */
  caption: string;
  /** Components that get the highlight ring. */
  focus: readonly Focus[];
  /** Parts that stay lit and animated; everything else is dimmed. */
  active: readonly Part[];
}

export interface Labels {
  room: string;
  cupboard: string;
  wallUnit: string;
  condenserUnit: string;
  waterZone: string;
  condensateDrain: readonly string[]; // one entry per line
  toRoof: readonly string[]; //         one entry per line
  loop: readonly string[]; //           one entry per line
  badge: readonly [string, string]; //  [bold line, second line]
  legendCold: string;
  legendHot: string;
  legendWater: string;
  /** Hover tooltips on parts that are not labelled on the drawing. */
  tooltips: {
    compressor: string;
    heatExchanger: string;
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

const ALL_PARTS: readonly Part[] = [
  "air",
  "unit",
  "coil",
  "suction",
  "compressor",
  "discharge",
  "hx",
  "warmLiquid",
  "valve",
  "liquid",
  "water",
  "drain",
];

export const STEPS: readonly Step[] = [
  {
    title: "Room heat is captured",
    caption:
      "The wall unit's cold refrigerant coil absorbs heat from your room air. Cool air flows back out.",
    focus: ["unit"],
    active: ["air", "unit", "coil", "drain"],
  },
  {
    title: "Refrigerant carries the heat",
    caption:
      "Refrigerant gas carries the heat through slim insulated pipes to the condenser unit. No water travels this way.",
    focus: ["wall"],
    active: ["suction", "liquid"],
  },
  {
    title: "Compressor turns up the heat",
    caption:
      "The compressor squeezes the gas, raising its temperature so it can pass its heat to the water.",
    focus: ["compressor"],
    active: ["suction", "compressor", "discharge"],
  },
  {
    title: "Water takes the heat away",
    caption:
      "In the heat exchanger, the building's water absorbs the heat. The refrigerant becomes liquid again and heads back.",
    focus: ["hx", "valve"],
    active: ["discharge", "hx", "warmLiquid", "valve", "liquid", "water"],
  },
  {
    title: "Water stays in the cupboard",
    caption:
      "Building water goes no further than the condenser unit. Only refrigerant travels to your wall unit.",
    focus: ["badge"],
    active: ALL_PARTS,
  },
];

export const LABELS: Labels = {
  room: "Your room",
  cupboard: "Cupboard",
  wallUnit: "Wall unit",
  condenserUnit: "Condenser unit",
  waterZone: "Water zone",
  condensateDrain: ["Condensate", "drain"],
  toRoof: ["To rooftop", "coolers"],
  loop: ["Building", "water loop"],
  badge: ["Refrigerant only", "no water piped in"],
  legendCold: "Cold refrigerant",
  legendHot: "Hot refrigerant",
  legendWater: "Building water",
  tooltips: {
    compressor: "Compressor",
    heatExchanger: "Heat exchanger",
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
/*  Geometry (viewBox 0 0 800 580)                                             */
/*  Refrigerant cycle: coil → gas pipe → compressor → heat exchanger →         */
/*  expansion valve → liquid pipe → coil. Paths are drawn in flow direction.   */
/* ========================================================================== */

const VIEWBOX = "0 0 800 580";

const PATHS = {
  /** Wall-unit coil: cold liquid enters along the bottom… */
  coilIn: "M 284 146 H 122",
  /** …turns, and leaves as cool, heat-carrying gas along the top. */
  coilOut: "M 122 146 A 10 10 0 0 1 122 126 H 284",
  /** Gas (suction) pipe, the larger one: wall unit → through wall → compressor. */
  suction: "M 284 126 H 426 V 270",
  /** Hot gas: compressor → top of the heat exchanger. */
  discharge: "M 456 304 H 486 V 252 H 520",
  /** Warm liquid: bottom of the heat exchanger → expansion valve. */
  warmLiquid: "M 540 402 V 416 H 470",
  /** Cold liquid pipe, the smaller one: expansion valve → through wall → wall unit. */
  liquid: "M 470 416 H 358 V 146 H 284",
  /** Building loop: flow comes down from the roof, return goes back up. */
  flowRiser: "M 752 -2 V 506",
  returnRiser: "M 708 506 V -2",
  /** Counterflow: water enters the heat exchanger at the bottom, leaves at the top. */
  flowTap: "M 752 380 H 604",
  returnTap: "M 604 260 H 708",
  /** Condensate drain: thin and grey, outside the water zone. */
  drain: "M 270 170 V 182 Q 270 192 280 192 H 284 Q 292 192 292 200 V 486",
  /** Where water exists. It ends inside the condenser unit, at x = 500. */
  zone: "M 500 196 H 682 V 6 H 798 V 504 H 682 V 448 H 500 Z",
} as const;

/** Numbered markers tie step n's button to a place on the drawing. */
const MARKERS = [
  { n: 1, x: 66, y: 120 }, //  wall unit
  { n: 2, x: 318, y: 252 }, // wall crossing
  { n: 3, x: 426, y: 362 }, // compressor
  { n: 4, x: 562, y: 236 }, // heat exchanger
] as const;

type Dir = "up" | "down" | "left" | "right";
const ANGLE: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };

/** Refrigerant state, drawn as a colour convention: blue = cold, red = hot. */
type RefState = "cold" | "cool" | "hot" | "warm";
type RefSize = "gas" | "liquid";

/* ========================================================================== */
/*  Hooks                                                                     */
/* ========================================================================== */

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/* ========================================================================== */
/*  SVG building blocks                                                       */
/* ========================================================================== */

const refFlowClass: Record<RefState, string> = {
  cold: styles.refCold,
  cool: styles.refCool,
  hot: styles.refHot,
  warm: styles.refWarm,
};
const refArrowClass: Record<RefState, string> = {
  cold: styles.refArrowCold,
  cool: styles.refArrowCool,
  hot: styles.refArrowHot,
  warm: styles.refArrowWarm,
};

/** Copper-rimmed refrigerant pipe with dashes flowing inside. Gas pipe is larger. */
function RefPipe({ d, state, size }: { d: string; state: RefState; size: RefSize }) {
  const big = size === "gas";
  return (
    <>
      <path className={big ? styles.refRimGas : styles.refRimLiquid} d={d} />
      <path className={big ? styles.refCoreGas : styles.refCoreLiquid} d={d} />
      <path className={`${styles.refFlow} ${big ? styles.refFlowGas : styles.refFlowLiquid} ${refFlowClass[state]}`} d={d} />
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
function WaterPipe({ d, ret }: { d: string; ret?: boolean }) {
  return (
    <>
      <path className={styles.waterRim} d={d} />
      <path className={styles.waterCore} d={d} />
      <path className={`${styles.waterFlow} ${ret ? styles.waterReturn : styles.waterSupply}`} d={d} />
    </>
  );
}

function WaterArrow({ x, y, dir, ret }: { x: number; y: number; dir: Dir; ret?: boolean }) {
  return (
    <path
      className={ret ? styles.waterArrowReturn : styles.waterArrow}
      d="M -6 -8 L 7 0 L -6 8 Z"
      transform={`translate(${x} ${y}) rotate(${ANGLE[dir]})`}
    />
  );
}

/** Bow-tie valve symbol on a horizontal pipe. */
function Valve({ x, y, r, className, title }: { x: number; y: number; r: number; className: string; title: string }) {
  return (
    <g className={className} transform={`translate(${x} ${y})`}>
      <title>{title}</title>
      <path d={`M ${-r} ${-r} L 0 0 L ${-r} ${r} Z M ${r} ${-r} L 0 0 L ${r} ${r} Z`} />
      <path d={`M 0 0 V ${-r - 5} M ${-r * 0.6} ${-r - 5} H ${r * 0.6}`} className={styles.valveStem} />
    </g>
  );
}

interface PillLine {
  text: string;
  className: string;
  /** Baseline offset from the pill centre. */
  dy: number;
}

/**
 * A rounded label whose background is sized to its measured text, so the copy
 * can change freely. If the text is wider than `maxWidth` it is scaled to fit.
 */
function Pill({
  cx,
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
  bgClassName: string;
  fallbackCharWidth?: number;
}) {
  const textRef = useRef<SVGGElement>(null);
  const longest = Math.max(...lines.map((l) => l.text.length));
  const [textWidth, setTextWidth] = useState(longest * fallbackCharWidth);
  const key = lines.map((l) => l.text).join("|");

  useIsoLayoutEffect(() => {
    let cancelled = false;
    const measure = () => {
      const el = textRef.current;
      if (cancelled || !el) return;
      try {
        const w = el.getBBox().width;
        if (w > 0) setTextWidth(w);
      } catch {
        /* not rendered yet */
      }
    };
    measure();
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [key]);

  const scale = Math.min(1, (maxWidth - padX * 2) / textWidth);
  const width = Math.min(maxWidth, textWidth * scale + padX * 2);
  return (
    <>
      <rect x={cx - width / 2} y={cy - height / 2} width={width} height={height} rx={Math.min(height / 2, 22)} className={bgClassName} />
      <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
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
  /** Extra class on the root element, e.g. to set a max-width. */
  className?: string;
  /** Start auto-advancing on mount. Ignored when the viewer prefers reduced motion. */
  autoPlay?: boolean;
  /** How long each step shows while playing, in milliseconds. */
  stepDuration?: number;
  /** Optional small heading inside the square, e.g. "How it works". */
  eyebrow?: string;
  /** Optional headline inside the square. Leave empty if the page already has one. */
  headline?: string;
}

export default function WaterCooledACAnimation({
  className,
  autoPlay = true,
  stepDuration = 4500,
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

  const rootRef = useRef<HTMLElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [tabHidden, setTabHidden] = useState(false);
  const [inView, setInView] = useState(true);
  const [keyboardInControls, setKeyboardInControls] = useState(false);
  /** Only user-initiated step changes are announced (not autoplay). */
  const [announcement, setAnnouncement] = useState("");
  const reducedMotion = usePrefersReducedMotion();

  // No autoplay for people who ask for reduced motion.
  useEffect(() => {
    if (reducedMotion) setPlaying(false);
  }, [reducedMotion]);

  // Pause when the tab is hidden.
  useEffect(() => {
    const update = () => setTabHidden(document.visibilityState === "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  // Pause while scrolled out of view.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /** Particles and pulses run while playing and visible. */
  const moving = playing && !tabHidden && inView;
  /** The step timer also holds while a keyboard user is in the controls. */
  const advancing = moving && !keyboardInControls;

  // Step timer. The time left is kept across pauses, so resuming continues the same step.
  const remainingRef = useRef(stepDuration);
  useEffect(() => {
    remainingRef.current = stepDuration;
  }, [step, stepDuration]);
  useEffect(() => {
    if (!advancing) return;
    const startedAt = performance.now();
    const timer = window.setTimeout(() => setStep((s) => (s + 1) % STEPS.length), remainingRef.current);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (performance.now() - startedAt));
    };
  }, [advancing, step]);

  /** User navigation: jump, restart that step's timer, and announce it. */
  const goTo = useCallback((i: number) => {
    const n = ((i % STEPS.length) + STEPS.length) % STEPS.length;
    const s = STEPS[n];
    setStep(n);
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

  const current = STEPS[step];
  const part = (p: Part) => ({ "data-active": current.active.includes(p) ? "true" : "false" });
  const ring = (f: Focus) => (current.focus.includes(f) ? "true" : "false");
  const loud = current.focus.includes("badge");

  return (
    <figure
      ref={rootRef}
      className={`${styles.root}${className ? ` ${className}` : ""}`}
      data-step={step + 1}
      data-moving={moving ? "true" : "false"}
      data-advancing={advancing ? "true" : "false"}
      aria-labelledby={ids.title}
      style={{ "--uc-step-duration": `${stepDuration}ms` } as CSSProperties}
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
          viewBox={VIEWBOX}
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
              <rect x="380" y="214" width="248" height="222" rx="18" />
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
          <rect x="0" y="0" width="800" height="580" className={styles.svgBg} />
          <rect x="0" y="20" width="300" height="470" className={styles.roomFill} />
          <rect x="336" y="20" width="464" height="470" className={styles.plantFill} />
          <rect x="300" y="20" width="36" height="470" fill={`url(#${ids.hatch})`} />
          <rect x="0" y="0" width="800" height="20" className={styles.slab} />
          <rect x="0" y="490" width="800" height="16" className={styles.slab} />

          <text x="16" y="54" className={styles.areaLabel}>{LABELS.room}</text>
          <text x="348" y="100" className={styles.areaLabel}>{LABELS.cupboard}</text>

          {/* Sofa */}
          <g className={styles.furniture} aria-hidden="true">
            <rect x="26" y="404" width="112" height="46" rx="14" />
            <rect x="16" y="438" width="132" height="32" rx="10" />
            <rect x="6" y="422" width="30" height="54" rx="12" />
            <rect x="128" y="422" width="30" height="54" rx="12" />
            <rect x="20" y="474" width="9" height="16" rx="3" />
            <rect x="135" y="474" width="9" height="16" rx="3" />
          </g>

          {/* ---------------- Water zone (always shown) ---------------- */}
          <path d={PATHS.zone} className={styles.zone} data-emphasis={step >= 3 ? "true" : "false"} />

          {/* ---------------- Condensate drain (grey, thin, not water-loop) ---------------- */}
          <g className={styles.part} {...part("drain")}>
            <path d={PATHS.drain} className={styles.drain} />
            <path d="M 284 478 L 292 490 L 300 478" className={styles.drainEnd} />
            {LABELS.condensateDrain.map((line, i) => (
              <text key={line} x="282" y={384 + i * 28} textAnchor="end" className={styles.drainLabel}>
                {line}
              </text>
            ))}
          </g>

          {/* ---------------- Building water loop ---------------- */}
          <g className={styles.part} {...part("water")}>
            <WaterPipe d={PATHS.returnRiser} ret />
            <WaterPipe d={PATHS.flowRiser} />
            <WaterPipe d={PATHS.returnTap} ret />
            <WaterPipe d={PATHS.flowTap} />
            <WaterArrow x={708} y={466} dir="up" ret />
            <WaterArrow x={708} y={110} dir="up" ret />
            <WaterArrow x={752} y={110} dir="down" />
            <WaterArrow x={752} y={466} dir="down" />
            <WaterArrow x={682} y={260} dir="right" ret />
            <WaterArrow x={682} y={380} dir="left" />
            <Valve x={648} y={260} r={11} className={styles.isoValve} title={LABELS.tooltips.isolationValve} />
            <Valve x={648} y={380} r={11} className={styles.isoValve} title={LABELS.tooltips.isolationValve} />
          </g>

          {/* "To rooftop coolers", above the return riser */}
          <g className={styles.roofNote}>
            {LABELS.toRoof.map((line, i) => (
              <text key={line} x="650" y={50 + i * 30} textAnchor="end" className={styles.noteLabel}>
                {line}
              </text>
            ))}
            <path d="M 666 74 V 34" className={styles.noteArrow} markerEnd={`url(#${ids.headWater})`} />
          </g>

          {/* ---------------- Refrigerant pipes outside the units ---------------- */}
          <g className={styles.part} {...part("liquid")}>
            <title>{LABELS.tooltips.liquidPipe}</title>
            <RefPipe d={PATHS.liquid} state="cold" size="liquid" />
            <RefArrow x={358} y={300} dir="up" state="cold" size="liquid" />
            <RefArrow x={420} y={416} dir="left" state="cold" size="liquid" />
          </g>
          <g className={styles.part} {...part("suction")}>
            <title>{LABELS.tooltips.gasPipe}</title>
            <path d={PATHS.suction} className={styles.glowCool} />
            <RefPipe d={PATHS.suction} state="cool" size="gas" />
            <RefArrow x={386} y={126} dir="right" state="cool" size="gas" />
            <RefArrow x={426} y={204} dir="down" state="cool" size="gas" />
          </g>

          {/* Wall-crossing highlight */}
          <rect x="290" y="104" width="56" height="64" rx="14" className={styles.halo} data-on={ring("wall")} />

          {/* ---------------- Condenser unit (no fan, no grille) ---------------- */}
          <rect x="380" y="214" width="248" height="222" rx="18" className={styles.box} filter={`url(#${ids.shadow})`} />
          {/* The water zone continues inside the casing and stops at x = 500 */}
          <path d={PATHS.zone} className={styles.zone} clipPath={`url(#${ids.boxClip})`} data-emphasis={step >= 3 ? "true" : "false"} />

          <g className={styles.part} {...part("discharge")}>
            <path d={PATHS.discharge} className={styles.glowHot} />
            <RefPipe d={PATHS.discharge} state="hot" size="gas" />
            <RefArrow x={486} y={282} dir="up" state="hot" size="gas" />
          </g>

          <g className={styles.part} {...part("warmLiquid")}>
            <RefPipe d={PATHS.warmLiquid} state="warm" size="liquid" />
          </g>

          <g className={styles.part} {...part("valve")}>
            <rect x="448" y="384" width="44" height="50" rx="12" className={styles.halo} data-on={ring("valve")} />
            <Valve x={470} y={416} r={10} className={styles.expValve} title={LABELS.tooltips.expansionValve} />
          </g>

          <g className={styles.part} {...part("compressor")}>
            <title>{LABELS.tooltips.compressor}</title>
            <rect x="386" y="258" width="80" height="144" rx="38" className={styles.halo} data-on={ring("compressor")} />
            <g className={styles.compressorBody}>
              <rect x="396" y="268" width="60" height="124" rx="30" className={styles.compressor} />
              <rect x="404" y="282" width="8" height="96" rx="4" className={styles.compressorShine} />
            </g>
            <g className={styles.rotor}>
              <circle cx="426" cy="312" r="21" className={styles.rotorDisc} />
              <path
                d="M 426 312 C 426 300 434 294 442 296 M 426 312 C 416 318 406 314 404 306 M 426 312 C 432 322 430 332 422 334"
                className={styles.rotorBlade}
              />
              <circle cx="426" cy="312" r="4" className={styles.rotorHub} />
            </g>
          </g>

          <g className={styles.part} {...part("hx")}>
            <title>{LABELS.tooltips.heatExchanger}</title>
            <rect x="510" y="226" width="104" height="188" rx="16" className={styles.halo} data-on={ring("hx")} />
            <rect x="520" y="236" width="84" height="168" rx="10" className={styles.hx} />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <rect
                key={i}
                x={528 + i * 12}
                y="246"
                width="8"
                height="148"
                rx="4"
                className={i % 2 === 0 ? styles.plateRef : styles.plateWater}
              />
            ))}
            {/* Counterflow inside the plates, and heat crossing from refrigerant to water */}
            <g className={styles.hxDetail}>
              <path d="M 532 268 V 384" className={styles.hxRefLine} markerEnd={`url(#${ids.headRef})`} />
              <path d="M 592 384 V 268" className={styles.hxWaterLine} markerEnd={`url(#${ids.headWater})`} />
              {[294, 326, 358].map((y) => (
                <path
                  key={y}
                  d={`M 544 ${y} q 6 -7 12 0 q 6 7 12 0`}
                  className={styles.heatLine}
                  markerEnd={`url(#${ids.headHeat})`}
                />
              ))}
            </g>
          </g>

          <text x="504" y="474" textAnchor="middle" className={styles.componentLabel}>
            {LABELS.condenserUnit}
          </text>

          {/* Water-zone tag straddles the zone's top edge */}
          <g className={styles.zoneTag}>
            <Pill
              cx={591}
              cy={196}
              height={38}
              padX={14}
              maxWidth={178}
              bgClassName={styles.zoneTagBg}
              lines={[{ text: LABELS.waterZone, className: styles.zoneTagText, dy: 9 }]}
            />
          </g>

          {/* ---------------- Room: air and wall unit ---------------- */}
          <g className={styles.part} {...part("air")}>
            {[192, 232, 272].map((x) => (
              <path
                key={x}
                d={`M ${x} 26 q 6 5 0 10 q -6 5 0 10 q 6 5 0 10`}
                className={styles.airWarm}
                markerEnd={`url(#${ids.headWarm})`}
              />
            ))}
            {[150, 196, 242].map((x) => (
              <path
                key={x}
                d={`M ${x} 178 Q ${x - 8} 206 ${x - 36} 230`}
                className={styles.airCool}
                markerEnd={`url(#${ids.headCool})`}
              />
            ))}
          </g>

          <g className={styles.part} {...part("unit")}>
            <rect x="90" y="60" width="204" height="120" rx="24" className={styles.halo} data-on={ring("unit")} />
            <rect x="100" y="70" width="184" height="100" rx="16" className={styles.unit} filter={`url(#${ids.shadow})`} />
            <line x1="114" y1="162" x2="270" y2="162" className={styles.louvre} />
            <text x="192" y="106" textAnchor="middle" className={styles.componentLabel}>
              {LABELS.wallUnit}
            </text>
          </g>
          <g className={styles.part} {...part("coil")}>
            <RefPipe d={PATHS.coilIn} state="cold" size="liquid" />
            <RefPipe d={PATHS.coilOut} state="cool" size="gas" />
          </g>

          {/* ---------------- Wall-unit badge: quiet in steps 1–4, loud in step 5 ---------------- */}
          <g className={styles.badge} data-loud={loud ? "true" : "false"}>
            <rect x="8" y="238" width="284" height="104" rx="26" className={styles.halo} data-on={ring("badge")} />
            <g className={styles.badgeQuiet}>
              <Pill
                cx={150}
                cy={290}
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
                cy={290}
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
            <g
              key={m.n}
              className={styles.marker}
              data-on={step === m.n - 1 ? "true" : "false"}
              transform={`translate(${m.x} ${m.y})`}
            >
              <circle r="19" className={styles.markerDisc} />
              <text y="9" textAnchor="middle" className={styles.markerText}>
                {m.n}
              </text>
            </g>
          ))}

          {/* ---------------- Legend ---------------- */}
          <g className={styles.legend}>
            <path d="M 18 529 H 62" className={styles.refRimGas} />
            <path d="M 18 529 H 62" className={styles.refCoreGas} />
            <path d="M 22 529 H 58" className={`${styles.legendDash} ${styles.refCool}`} />
            <path d="M 22 529 H 58" className={`${styles.legendDash} ${styles.legendDashAlt} ${styles.refCold}`} />
            <text x="72" y="538" className={styles.legendText}>{LABELS.legendCold}</text>

            <path d="M 322 529 H 366" className={styles.refRimGas} />
            <path d="M 322 529 H 366" className={styles.refCoreGas} />
            <path d="M 326 529 H 362" className={`${styles.legendDash} ${styles.refWarm}`} />
            <path d="M 326 529 H 362" className={`${styles.legendDash} ${styles.legendDashAlt} ${styles.refHot}`} />
            <text x="376" y="538" className={styles.legendText}>{LABELS.legendHot}</text>

            <path d="M 14 561 H 66" className={styles.waterRim} />
            <path d="M 14 561 H 66" className={styles.waterCore} />
            <path d="M 27 561 H 53" className={styles.legendDots} />
            <text x="76" y="570" className={styles.legendText}>{LABELS.legendWater}</text>

            {LABELS.loop.map((line, i) => (
              <text key={line} x="796" y={538 + i * 32} textAnchor="end" className={styles.legendText}>
                {line}
              </text>
            ))}
          </g>
        </svg>
      </div>

      {/* ---------------- Caption + controls ---------------- */}
      <div className={styles.band}>
        <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
        <div className={styles.captionStack} aria-hidden="true">
          {STEPS.map((s, i) => (
            <p key={s.title} className={styles.caption} data-on={i === step ? "true" : "false"}>
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
            className={`${styles.btn} ${styles.btnPlay}`}
            onClick={() => setPlaying((p) => !p)}
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

          <button type="button" className={styles.btn} onClick={() => goTo(step - 1)} aria-label={LABELS.previous}>
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
                  data-on={i === step ? "true" : "false"}
                  aria-current={i === step ? "step" : undefined}
                  aria-label={LABELS.goToStep(i + 1, s.title)}
                  onClick={() => goTo(i)}
                >
                  <span aria-hidden="true">{i + 1}</span>
                  {i === step && <span key={step} className={styles.progress} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ol>

          <button type="button" className={styles.btn} onClick={() => goTo(step + 1)} aria-label={LABELS.next}>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M 7.5 4 L 13.5 10 L 7.5 16" className={styles.iconStroke} />
            </svg>
          </button>
        </div>
      </div>
    </figure>
  );
}
