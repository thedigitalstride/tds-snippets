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
import { FLAT } from "./WaterCooledACAnimation.flat";
import { ISO } from "./WaterCooledACAnimation.iso";
import { cx, type DrawingSpec, type Focus, type Labels, type Part, type Step } from "./WaterCooledACAnimation.kit";

export type { Callout, Focus, Labels, Part, Step } from "./WaterCooledACAnimation.kit";

/** Drawing variants: same story, steps, copy and behaviour. */
export type Variant = "flat" | "isometric";
const DRAWINGS: Record<Variant, DrawingSpec> = { flat: FLAT, isometric: ISO };

/* ========================================================================== */
/*  COPY: every user-facing string lives in STEPS and LABELS below.            */
/*  On phones, SVG labels render at about 11px (26 viewBox units), so keep     */
/*  them short. Captions: 18 words or fewer (3 lines at 320px wide).           */
/* ========================================================================== */

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
  /** Drawing style: "flat" (elevation, default) or "isometric" (3D cut-away). */
  variant?: Variant | undefined;
}

export default function WaterCooledACAnimation({
  className,
  autoPlay = true,
  stepDuration = 7000,
  eyebrow,
  headline,
  variant = "flat",
}: WaterCooledACAnimationProps) {
  const rawId = useId();
  const uid = `ucwc${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ids = {
    title: `${uid}-title`,
    desc: `${uid}-desc`,
  };
  const drawing = DRAWINGS[variant] ?? FLAT;
  const Drawing = drawing.Drawing;

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

  const on = (b: boolean): "true" | "false" => (b ? "true" : "false");
  const part = (p: Part) => ({ "data-active": on(current.active.includes(p)) });
  const ring = (f: Focus) => on(current.focus === f);

  return (
    <figure
      ref={rootRef}
      className={cx(styles.root, className)}
      data-step={step + 1}
      data-moving={on(moving)}
      data-advancing={on(advancing)}
      data-variant={variant}
      aria-labelledby={ids.title}
      style={{ "--_uc-step-ms": `${stepMs}ms`, "--_uc-ratio": `${drawing.width} / ${drawing.height}` } as CSSProperties}
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
          viewBox={`0 0 ${drawing.width} ${drawing.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-labelledby={ids.title}
          aria-describedby={ids.desc}
          focusable="false"
        >
          <title id={ids.title}>{LABELS.svgTitle}</title>
          <desc id={ids.desc}>{LABELS.svgDesc}</desc>
          <Drawing uid={uid} step={step} current={current} labels={LABELS} part={part} ring={ring} on={on} />
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
