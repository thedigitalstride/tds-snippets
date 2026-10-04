"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
} from "react";
import styles from "./WaterCooledACAnimation.module.css";

/* -------------------------------------------------------------------------- */
/*  Story                                                                     */
/* -------------------------------------------------------------------------- */

/** Parts of the illustration that can be lit (active) or dimmed per step. */
type Part =
  | "air"
  | "unit"
  | "coil"
  | "gas"
  | "liquid"
  | "compressor"
  | "discharge"
  | "hx"
  | "water";

/** Component that gets the pulsing highlight ring in a step. */
type Focus = "unit" | "wall" | "compressor" | "hx" | "badge";

interface Step {
  title: string;
  caption: string;
  focus: Focus;
  active: readonly Part[];
}

const ALL_PARTS: readonly Part[] = [
  "air",
  "unit",
  "coil",
  "gas",
  "liquid",
  "compressor",
  "discharge",
  "hx",
  "water",
];

const STEPS: readonly Step[] = [
  {
    title: "Cooling your room",
    caption:
      "The wall unit draws in warm air. Cold refrigerant in its coil soaks up the heat, and cool air flows back out.",
    focus: "unit",
    active: ["air", "unit", "coil"],
  },
  {
    title: "Through the wall",
    caption:
      "The warmed refrigerant travels as a gas through slim insulated pipes to the condenser. Only refrigerant crosses the wall.",
    focus: "wall",
    active: ["gas", "liquid"],
  },
  {
    title: "Compressor",
    caption:
      "The compressor squeezes the refrigerant gas, raising its temperature so the heat can be released.",
    focus: "compressor",
    active: ["compressor", "discharge"],
  },
  {
    title: "Heat exchanger",
    caption:
      "Water from the building loop absorbs the heat and carries it away. The refrigerant cools to a liquid and returns.",
    focus: "hx",
    active: ["hx", "water", "liquid"],
  },
  {
    title: "No water in your room",
    caption:
      "Water stays in the condenser and the building loop. Only refrigerant ever reaches your wall unit.",
    focus: "badge",
    active: ALL_PARTS,
  },
];

const LONG_DESCRIPTION =
  "Cut-away diagram of a flat. On the left, a room with an air conditioning wall unit high on the wall. " +
  "Two slim refrigerant pipes run from the wall unit through the wall to a condenser unit in a cupboard. " +
  "Inside the condenser, a compressor squeezes the refrigerant and a plate heat exchanger passes its heat " +
  "to water from the building's water loop, which runs up and down the building on the right. " +
  "A dashed water zone covers only the heat exchanger and the building loop: water never travels to the wall unit, " +
  "only refrigerant does.";

/* -------------------------------------------------------------------------- */
/*  Geometry (viewBox 0 0 800 560)                                            */
/* -------------------------------------------------------------------------- */

const PATHS = {
  /** Inside the wall unit: cold liquid runs left along the bottom of the coil… */
  coilCold: "M 284 146 H 122",
  /** …turns, and leaves as warm gas along the top. */
  coilHot: "M 122 146 A 10 10 0 0 1 122 126 H 284",
  /** Suction gas: wall unit → through wall → down into the compressor. */
  gas: "M 284 126 H 426 V 270",
  /** Hot discharge gas: compressor → heat exchanger. */
  discharge: "M 456 304 H 486 V 252 H 520",
  /** Liquid line: heat exchanger → back through the wall → wall unit. */
  liquid: "M 540 402 V 416 H 358 V 146 H 284",
  /** Building loop: flow rises, return falls. */
  flowRiser: "M 708 514 V -2",
  returnRiser: "M 752 -2 V 514",
  /** Taps into the condenser's heat exchanger. */
  flowTap: "M 708 380 H 604",
  returnTap: "M 604 260 H 752",
  /** Region where water exists. Ends inside the condenser at x = 500. */
  zone: "M 500 196 H 682 V 6 H 794 V 514 H 682 V 448 H 500 Z",
} as const;

type Dir = "up" | "down" | "left" | "right";
const ANGLE: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };

/* -------------------------------------------------------------------------- */
/*  Hooks                                                                     */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Small SVG pieces                                                          */
/* -------------------------------------------------------------------------- */

function RefArrow({ x, y, dir, hot }: { x: number; y: number; dir: Dir; hot: boolean }) {
  return (
    <path
      className={hot ? styles.refArrowHot : styles.refArrowCold}
      d="M -7 -9 L 7 0 L -7 9 Z"
      transform={`translate(${x} ${y}) rotate(${ANGLE[dir]})`}
    />
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

/** Copper-rimmed refrigerant pipe with dashed flow inside. */
function RefPipe({ d, hot }: { d: string; hot: boolean }) {
  return (
    <>
      <path className={styles.refOuter} d={d} />
      <path className={styles.refCore} d={d} />
      <path className={`${styles.flow} ${hot ? styles.refFlowHot : styles.refFlowCold}`} d={d} />
    </>
  );
}

/** Wide, double-outlined water pipe with round "bubble" particles. */
function WaterPipe({ d, ret }: { d: string; ret?: boolean }) {
  return (
    <>
      <path className={styles.waterOuter} d={d} />
      <path className={styles.waterCore} d={d} />
      <path className={`${styles.flow} ${ret ? styles.waterFlowReturn : styles.waterFlow}`} d={d} />
    </>
  );
}

function NoWaterIcon({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className={styles.noWaterIcon} aria-hidden="true">
      <path className={styles.noWaterDrop} d="M 0 -13 C 6 -5 10 0 10 5 A 10 10 0 0 1 -10 5 C -10 0 -6 -5 0 -13 Z" />
      <path className={styles.noWaterSlash} d="M -12 -12 L 12 14" />
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export interface WaterCooledACAnimationProps {
  /** Extra class for the root element (e.g. to set a max-width). */
  className?: string;
  /** Start auto-advancing on mount. Ignored when the viewer prefers reduced motion. */
  autoPlay?: boolean;
  /** Time each step is shown while playing, in milliseconds. */
  stepDuration?: number;
}

export default function WaterCooledACAnimation({
  className,
  autoPlay = true,
  stepDuration = 4500,
}: WaterCooledACAnimationProps) {
  const rawId = useId();
  const uid = `ucwc${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ids = {
    title: `${uid}-title`,
    desc: `${uid}-desc`,
    heading: `${uid}-heading`,
    hatch: `${uid}-hatch`,
    shadow: `${uid}-shadow`,
    headWarm: `${uid}-head-warm`,
    headCool: `${uid}-head-cool`,
    headHeat: `${uid}-head-heat`,
  };

  const rootRef = useRef<HTMLElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [tabHidden, setTabHidden] = useState(false);
  const [inView, setInView] = useState(true);
  const [keyboardInControls, setKeyboardInControls] = useState(false);
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

  // Pause when scrolled out of view (saves CPU, and the story restarts where it was).
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.15,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /** Motion (particles, pulses) runs while playing and visible. */
  const moving = playing && !tabHidden && inView;
  /** The step timer also holds while a keyboard user is in the controls. */
  const advancing = moving && !keyboardInControls;

  // Step timer. Time left is kept across pauses so a resume continues the same step.
  const remainingRef = useRef(stepDuration);
  useEffect(() => {
    remainingRef.current = stepDuration;
  }, [step, stepDuration]);
  useEffect(() => {
    if (!advancing) return;
    const startedAt = performance.now();
    const timer = window.setTimeout(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, remainingRef.current);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (performance.now() - startedAt));
    };
  }, [advancing, step]);

  const goTo = useCallback((i: number) => {
    setStep(((i % STEPS.length) + STEPS.length) % STEPS.length);
  }, []);

  const onControlsFocus = (e: FocusEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    let visible = false;
    try {
      visible = t.matches(":focus-visible");
    } catch {
      visible = false;
    }
    setKeyboardInControls(visible);
  };
  const onControlsBlur = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (!next || !controlsRef.current?.contains(next)) setKeyboardInControls(false);
  };

  const current = STEPS[step];
  const isActive = (p: Part) => current.active.includes(p);
  const part = (p: Part) => ({ "data-active": isActive(p) ? "true" : "false" });
  const focusOn = (f: Focus) => (current.focus === f ? "true" : "false");
  const marker = (n: number) => (step === n - 1 ? "true" : "false");

  return (
    <figure
      ref={rootRef}
      className={`${styles.root}${className ? ` ${className}` : ""}`}
      data-step={step + 1}
      data-moving={moving ? "true" : "false"}
      data-advancing={advancing ? "true" : "false"}
      aria-labelledby={ids.heading}
      style={{ "--uc-step-duration": `${stepDuration}ms` } as CSSProperties}
    >
      <figcaption id={ids.heading} className={styles.srOnly}>
        How a water-cooled air conditioning system works
      </figcaption>
      <p className={styles.srOnly}>{LONG_DESCRIPTION}</p>

      <div className={styles.stage}>
        <svg
          className={styles.svg}
          viewBox="0 0 800 560"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-labelledby={ids.title}
          aria-describedby={ids.desc}
          focusable="false"
        >
          <title id={ids.title}>Water-cooled air conditioning: water never reaches the wall unit</title>
          <desc id={ids.desc}>{LONG_DESCRIPTION}</desc>

          <defs>
            <pattern id={ids.hatch} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="14" height="14" className={styles.wallFill} />
              <line x1="0" y1="0" x2="0" y2="14" className={styles.wallHatch} />
            </pattern>
            <filter id={ids.shadow} x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0b2340" floodOpacity="0.14" />
            </filter>
            <marker id={ids.headWarm} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 Z" className={styles.headWarm} />
            </marker>
            <marker id={ids.headCool} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 Z" className={styles.headCool} />
            </marker>
            <marker id={ids.headHeat} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.6" markerHeight="3.6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 Z" className={styles.headWarm} />
            </marker>
          </defs>

          {/* ---------------- Building structure ---------------- */}
          <rect x="0" y="0" width="800" height="560" className={styles.svgBg} />
          <rect x="0" y="20" width="300" height="470" className={styles.roomFill} />
          <rect x="336" y="20" width="464" height="470" className={styles.plantFill} />
          <rect x="300" y="20" width="36" height="470" fill={`url(#${ids.hatch})`} />
          <rect x="0" y="0" width="800" height="20" className={styles.slab} />
          <rect x="0" y="490" width="800" height="22" className={styles.slab} />

          <text x="16" y="54" className={styles.areaLabel}>Your room</text>
          <text x="348" y="58" className={styles.areaLabel}>Cupboard</text>

          {/* Sofa silhouette */}
          <g className={styles.furniture} aria-hidden="true">
            <rect x="36" y="402" width="168" height="48" rx="14" />
            <rect x="26" y="438" width="188" height="32" rx="10" />
            <rect x="16" y="422" width="32" height="54" rx="12" />
            <rect x="192" y="422" width="32" height="54" rx="12" />
            <rect x="30" y="474" width="9" height="16" rx="3" />
            <rect x="201" y="474" width="9" height="16" rx="3" />
          </g>

          {/* ---------------- Water zone (persistent) ---------------- */}
          <g className={styles.zone} data-emphasis={step >= 3 ? "true" : "false"}>
            <path d={PATHS.zone} className={styles.zoneShape} />
          </g>

          {/* ---------------- Building water loop ---------------- */}
          <g className={styles.part} {...part("water")}>
            <WaterPipe d={PATHS.flowRiser} />
            <WaterPipe d={PATHS.returnRiser} ret />
            <WaterPipe d={PATHS.flowTap} />
            <WaterPipe d={PATHS.returnTap} ret />
            <WaterArrow x={708} y={466} dir="up" />
            <WaterArrow x={708} y={110} dir="up" />
            <WaterArrow x={752} y={110} dir="down" ret />
            <WaterArrow x={752} y={466} dir="down" ret />
            <WaterArrow x={652} y={380} dir="left" />
            <WaterArrow x={652} y={260} dir="right" ret />
          </g>

          {/* ---------------- Refrigerant circuit (outside the units) ---------------- */}
          <g className={styles.part} {...part("liquid")}>
            <RefPipe d={PATHS.liquid} hot={false} />
            <RefArrow x={358} y={300} dir="up" hot={false} />
            <RefArrow x={452} y={416} dir="left" hot={false} />
          </g>
          <g className={styles.part} {...part("gas")}>
            <path d="M 284 126 H 426 V 270" className={styles.glowGas} />
            <RefPipe d={PATHS.gas} hot />
            <RefArrow x={386} y={126} dir="right" hot />
            <RefArrow x={426} y={200} dir="down" hot />
          </g>

          {/* ---------------- Wall crossing highlight ---------------- */}
          <rect x="290" y="106" width="56" height="60" rx="14" className={styles.halo} data-on={focusOn("wall")} />

          {/* ---------------- Condenser unit ---------------- */}
          <g className={styles.condenser}>
            <rect x="380" y="214" width="248" height="222" rx="18" className={styles.box} filter={`url(#${ids.shadow})`} />
          </g>

          <g className={styles.part} {...part("discharge")}>
            <path d={PATHS.discharge} className={styles.glowHot} />
            <RefPipe d={PATHS.discharge} hot />
            <RefArrow x={486} y={282} dir="up" hot />
          </g>

          <g className={styles.part} {...part("compressor")}>
            <rect x="386" y="258" width="80" height="144" rx="38" className={styles.halo} data-on={focusOn("compressor")} />
            <g className={styles.compressorBody}>
              <rect x="396" y="268" width="60" height="124" rx="30" className={styles.compressor} />
              <rect x="404" y="282" width="8" height="96" rx="4" className={styles.compressorShine} />
            </g>
            <g className={styles.rotor}>
              <circle cx="426" cy="312" r="21" className={styles.rotorDisc} />
              <path d="M 426 312 C 426 300 434 294 442 296 M 426 312 C 416 318 406 314 404 306 M 426 312 C 432 322 430 332 422 334" className={styles.rotorBlade} />
              <circle cx="426" cy="312" r="4" className={styles.rotorHub} />
            </g>
          </g>

          <g className={styles.part} {...part("hx")}>
            <rect x="510" y="228" width="104" height="184" rx="16" className={styles.halo} data-on={focusOn("hx")} />
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
            <g className={styles.heatTransfer}>
              {[302, 334, 366].map((y) => (
                <path
                  key={y}
                  d={`M 530 ${y} q 6 -7 12 0 q 6 7 12 0 q 6 -7 12 0 q 6 7 12 0`}
                  className={styles.heatLine}
                  markerEnd={`url(#${ids.headHeat})`}
                />
              ))}
            </g>
          </g>

          <text x="504" y="474" textAnchor="middle" className={styles.componentLabel}>Condenser</text>

          {/* Water-zone tag straddles the zone's top edge. */}
          <g className={styles.zoneTag} data-emphasis={step >= 3 ? "true" : "false"}>
            <rect x="504" y="177" width="172" height="38" rx="19" className={styles.zoneTagBg} />
            <text x="590" y="205" textAnchor="middle" className={styles.zoneTagText}>Water zone</text>
          </g>

          {/* ---------------- Room: wall unit and air ---------------- */}
          <g className={styles.part} {...part("air")}>
            {[170, 214, 258].map((x) => (
              <path
                key={x}
                d={`M ${x} 26 q 6 5 0 10 q -6 5 0 10 q 6 5 0 10`}
                className={`${styles.flow} ${styles.airWarm}`}
                markerEnd={`url(#${ids.headWarm})`}
              />
            ))}
            {[150, 196, 242].map((x) => (
              <path
                key={x}
                d={`M ${x} 178 Q ${x - 8} 206 ${x - 36} 230`}
                className={`${styles.flow} ${styles.airCool}`}
                markerEnd={`url(#${ids.headCool})`}
              />
            ))}
          </g>

          <g className={styles.part} {...part("unit")}>
            <rect x="90" y="60" width="204" height="120" rx="24" className={styles.halo} data-on={focusOn("unit")} />
            <rect x="100" y="70" width="184" height="100" rx="16" className={styles.unit} filter={`url(#${ids.shadow})`} />
            <line x1="114" y1="162" x2="270" y2="162" className={styles.louvre} />
            <text x="192" y="106" textAnchor="middle" className={styles.componentLabel}>Wall unit</text>
          </g>
          <g className={styles.part} {...part("coil")}>
            <RefPipe d={PATHS.coilCold} hot={false} />
            <RefPipe d={PATHS.coilHot} hot />
          </g>

          {/* ---------------- "No water here" badge ---------------- */}
          <g className={styles.badge} data-emphasis={focusOn("badge")} transform="translate(150 290)">
            <rect x="-138" y="-46" width="276" height="92" rx="24" className={styles.halo} data-on={focusOn("badge")} />
            <g className={styles.badgeQuiet}>
              <rect x="-130" y="-22" width="260" height="44" rx="22" className={styles.badgeQuietBg} />
              <NoWaterIcon x={-104} y={0} s={0.95} />
              <text x="-84" y="9" className={styles.badgeQuietText}>No water here</text>
            </g>
            <g className={styles.badgeLoud}>
              <rect x="-134" y="-40" width="268" height="80" rx="20" className={styles.badgeLoudBg} />
              <NoWaterIcon x={-108} y={-12} s={0.95} />
              <text x="-86" y="-3" className={styles.badgeLoudTitle}>No water here</text>
              <text x="0" y="28" textAnchor="middle" className={styles.badgeLoudText}>Refrigerant only</text>
            </g>
          </g>

          {/* ---------------- Step markers ---------------- */}
          {[
            { n: 1, x: 66, y: 120 },
            { n: 2, x: 318, y: 190 },
            { n: 3, x: 426, y: 362 },
            { n: 4, x: 562, y: 236 },
          ].map((m) => (
            <g key={m.n} className={styles.marker} data-on={marker(m.n)} transform={`translate(${m.x} ${m.y})`}>
              <circle r="19" className={styles.markerDisc} />
              <text y="9" textAnchor="middle" className={styles.markerText}>{m.n}</text>
            </g>
          ))}

          {/* ---------------- Legend ---------------- */}
          <g className={styles.legend}>
            <g>
              <path d="M 18 537 H 40" className={styles.refOuter} />
              <path d="M 40 537 H 62" className={styles.refOuter} />
              <path d="M 18 537 H 62" className={styles.refCore} />
              <path d="M 22 537 H 38" className={styles.legendDashHot} />
              <path d="M 44 537 H 58" className={styles.legendDashCold} />
            </g>
            <text x="72" y="546" className={styles.legendText}>Refrigerant</text>
            <g>
              <path d="M 262 537 H 312" className={styles.waterOuter} />
              <path d="M 262 537 H 312" className={styles.waterCore} />
              <path d="M 274 537 H 300" className={styles.legendDots} />
            </g>
            <text x="324" y="546" className={styles.legendText}>Water</text>
            <text x="792" y="546" textAnchor="end" className={styles.legendText}>Building water loop</text>
          </g>
        </svg>
      </div>

      {/* ---------------- Caption + controls ---------------- */}
      <div className={styles.band}>
        <p className={styles.srOnly} aria-live={playing ? "off" : "polite"} aria-atomic="true">
          {`Step ${step + 1} of ${STEPS.length}: ${current.title}. ${current.caption}`}
        </p>
        <div className={styles.captionStack} aria-hidden="true">
          {STEPS.map((s, i) => (
            <p key={s.title} className={styles.caption} data-on={i === step ? "true" : "false"}>
              <strong className={styles.captionTitle}>{s.title}.</strong> {s.caption}
            </p>
          ))}
        </div>

        <div
          ref={controlsRef}
          className={styles.controls}
          role="group"
          aria-label="Animation controls"
          onFocus={onControlsFocus}
          onBlur={onControlsBlur}
        >
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPlay}`}
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause animation" : "Play animation"}
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

          <button
            type="button"
            className={styles.btn}
            onClick={() => goTo(step - 1)}
            aria-label="Previous step"
          >
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
                  aria-label={`Step ${i + 1} of ${STEPS.length}: ${s.title}`}
                  onClick={() => goTo(i)}
                >
                  <span aria-hidden="true">{i + 1}</span>
                  {i === step && <span key={step} className={styles.progress} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ol>

          <button
            type="button"
            className={styles.btn}
            onClick={() => goTo(step + 1)}
            aria-label="Next step"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M 7.5 4 L 13.5 10 L 7.5 16" className={styles.iconStroke} />
            </svg>
          </button>
        </div>
      </div>
    </figure>
  );
}
