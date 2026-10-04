import { useEffect, useRef, useState, type ReactElement } from "react";
import styles from "./WaterCooledACAnimation.module.css";

/* Internal module shared by the flat and isometric drawings of
   WaterCooledACAnimation. The public API is the default export of
   ./WaterCooledACAnimation.tsx. */

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

/** What every drawing receives from the shell. */
export interface DrawingProps {
  /** Unique, CSS-safe id prefix for this instance. */
  uid: string;
  /** Zero-based step index. */
  step: number;
  current: Step;
  labels: Labels;
  part: (p: Part) => { "data-active": "true" | "false" };
  ring: (f: Focus) => "true" | "false";
  on: (b: boolean) => "true" | "false";
}

/** A drawing variant: its viewBox size and its artwork. */
export interface DrawingSpec {
  width: number;
  height: number;
  Drawing: (props: DrawingProps) => ReactElement;
}

export type Dir = "up" | "down" | "left" | "right";
export const ANGLE: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };

/** The only three flow colours. */
export type Flow = "heat" | "cool" | "water";
export type ClassName = string | undefined;

export const cx = (...c: (ClassName | false)[]) => c.filter(Boolean).join(" ");

/* ========================================================================== */
/*  SVG building blocks                                                       */
/* ========================================================================== */

const lineClass: Record<Flow, ClassName> = { heat: styles.lineHeat, cool: styles.lineCool, water: styles.lineWater };
const beadClass: Record<Flow, ClassName> = { heat: styles.beadThin, cool: styles.beadThin, water: styles.beadThick };
const arrowClass: Record<Flow, ClassName> = { heat: styles.arrowHeat, cool: styles.arrowCool, water: styles.arrowWater };

/** One flow: a single stroked line with light beads travelling along it. */
export function FlowLine({ d, flow, still }: { d: string; flow: Flow; still?: boolean }) {
  return (
    <>
      <path className={cx(styles.line, lineClass[flow])} d={d} />
      <path className={cx(styles.bead, beadClass[flow], still && styles.still)} d={d} />
    </>
  );
}

/** Direction arrowhead sitting on a flow line. `dir` is a named direction or an angle in degrees. */
export function Arrow({ x, y, dir, flow }: { x: number; y: number; dir: Dir | number; flow: Flow }) {
  const s = flow === "water" ? 1.25 : 1;
  const angle = typeof dir === "number" ? dir : ANGLE[dir];
  return (
    <path
      className={arrowClass[flow]}
      d="M -6 -7 L 7 0 L -6 7 Z"
      transform={`translate(${x} ${y}) rotate(${angle}) scale(${s})`}
    />
  );
}

/** Bow-tie valve symbol (line art) on a horizontal line. */
export function Valve({ x, y, r, title }: { x: number; y: number; r: number; title: string }) {
  return (
    <g className={styles.valve} transform={`translate(${x} ${y})`}>
      <title>{title}</title>
      <path d={`M ${-r} ${-r} L ${r} ${r} V ${-r} L ${-r} ${r} Z`} />
    </g>
  );
}

export interface PillLine {
  text: string;
  className?: ClassName;
  /** Baseline offset from the pill centre. */
  dy: number;
}

/**
 * A rounded label whose background is sized to its measured text, so the copy
 * can change freely. If the text is wider than `maxWidth` it is scaled to fit.
 */
export function Pill({
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
