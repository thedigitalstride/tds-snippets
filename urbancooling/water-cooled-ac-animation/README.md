# Water-cooled AC animation (Urban Cooling)

A square, step-by-step explainer showing how a water-cooled air conditioning system works. Its key message: **building water never travels to the wall unit; only refrigerant does.**

There are five captioned steps:
- The water zone always stops inside the condenser unit.
- The "Refrigerant only, no water piped in" badge points at the pipe pair where it crosses the wall, in every step.

Files:
- `WaterCooledACAnimation.tsx`: client component (`"use client"`, default export, no dependencies)
- `WaterCooledACAnimation.module.css`: styles and brand tokens

## Use it in a Next.js (App Router) page

Copy the folder into your app (for example `components/water-cooled-ac-animation/`), then:

```tsx
import WaterCooledACAnimation from "@/components/water-cooled-ac-animation/WaterCooledACAnimation";

export default function Page() {
  return (
    <section>
      <h2>The water does its work in the cupboard, not your room.</h2>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <WaterCooledACAnimation />
      </div>
      <p>Many systems can also run in reverse to provide heating in winter.</p>
    </section>
  );
}
```

**Sizing**
- The component is `width: 100%` with `aspect-ratio: 1 / 1`, so the **parent sets the size**. The caption and controls sit inside the square.
- It is designed for **320–760px wide**, and is capped at 760px by default. Override the cap with `--uc-max-width`.
- On phones it fills the width, and diagram labels render at about 11px at 340px wide.

**Rendering**
- It works from a Server Component page and renders on the server.
- Hydration is clean in React 18 and 19, including StrictMode.
- It lints clean with `eslint-config-next` 16, which includes the react-hooks v7 rules.
- It type-checks with `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `className` | `string` | — | Added to the root `<figure>`, e.g. to set brand tokens or margins. |
| `autoPlay` | `boolean` | `true` | Auto-advance through the steps. Off when the viewer prefers reduced motion. |
| `stepDuration` | `number` | `7000` | Milliseconds per step (minimum 1500). The summary step is held for twice as long. |
| `eyebrow` | `string` | — | Optional small heading inside the square, e.g. "How it works". |
| `headline` | `string` | — | Optional headline inside the square. It takes space from the diagram, so prefer a page heading outside the component. |

## Brand colours

All tokens are public `--uc-*` custom properties, listed with their defaults at the top of `WaterCooledACAnimation.module.css`. Set any of them in any of these places:
- on the component, via `className`
- on any wrapper element
- globally, e.g. in `app/globals.css` on `:root`

```css
/* any stylesheet: global, a CSS Module, or inline on a wrapper */
.brand {
  --uc-primary: #003a70;
  --uc-accent: #00a37a;
}
```

```tsx
<WaterCooledACAnimation className={styles.brand} />
```

Internally the component reads private `--_uc-*` copies whose fallbacks are the defaults. Your values therefore win regardless of stylesheet order.

| Group | Tokens |
|---|---|
| Surfaces and text | `--uc-bg`, `--uc-surface`, `--uc-ink`, `--uc-muted`, `--uc-primary`, `--uc-accent`, `--uc-focus`, `--uc-font`, `--uc-max-width` |
| Refrigerant | `--uc-refrigerant-cold`, `--uc-refrigerant-cool`, `--uc-refrigerant-warm`, `--uc-refrigerant-hot` |
| Water, heat and air | `--uc-water-flow`, `--uc-water-return`, `--uc-heat`, `--uc-air-cool` |
| Illustration | `--uc-pipe-copper`, `--uc-pipe-core`, `--uc-pipe-water-edge`, `--uc-pipe-water-core`, `--uc-drain`, `--uc-drain-text`, `--uc-wall`, `--uc-wall-hatch`, `--uc-slab`, `--uc-room`, `--uc-plant`, `--uc-furniture`, `--uc-compressor`, `--uc-dim` |

Contrast rules:
- Keep `--uc-primary`, `--uc-ink` and `--uc-focus` at **4.5:1 or more** against white, because they carry white text and focus rings.
- Keep the refrigerant, air and heat colours at **3:1 or more** against `--uc-room` and `--uc-pipe-core`.

## Editing the copy

All words live in the `STEPS` and `LABELS` constants at the top of the `.tsx` file. That covers step titles, captions, diagram labels, callouts, the badge, the legend, tooltips and accessible text.

Each step also sets:
- which parts of the drawing are lit (`active`)
- which component gets the highlight ring (`focus`)
- an optional on-drawing `callout`
- an optional `hold` multiplier

Length limits:
- **Captions:** 18 words or fewer, so they fit three lines at 320px wide.
- **Diagram labels:** at most about three short words. Multi-line labels are arrays, one entry per line.
- **Pill labels** (badge, water-zone tag, callouts) size themselves to their text. If text gets too wide it is scaled down, so keep it short to stay legible.

## Behaviour and accessibility

**Controls**
- Order: play/pause first, then previous, step buttons 1–5, then next.
- Below 400px, Previous and Next are hidden and the remaining buttons are 40px.
- **Any manual navigation pauses autoplay** and announces the step. Play resumes.
- Pause freezes all motion (WCAG 2.2.2).
- The active step button fills to show the time left.

**Automatic pausing**
- Autoplay pauses while the tab is hidden, while the component is off-screen, and while a keyboard user is in the controls.
- Only the parts lit in the current step move.

**Reduced motion:** with `prefers-reduced-motion: reduce` there is no autoplay and no motion. Static arrows on every pipe still show direction, and manual stepping works.

**Screen readers**
- A `<figure>` is labelled by the SVG's `<title>`. The SVG has `role="img"` with `<title>` and `<desc>`.
- The current step is always present as text.
- An `aria-live="polite"` region announces "Step N of 5: title. caption" after user navigation only.
- The active step button has `aria-current="step"`.

**Not colour alone**
- Water is a wide pipe with a double outline and round bubbles.
- Refrigerant is a slim copper pipe, and the gas pipe is visibly larger than the liquid pipe.
- Each refrigerant temperature has its own dash rhythm, matched in the legend: cold is short ticks, heat-carrying gas is short dashes, warm is long dashes, and hot is near-solid.
- Every pipe carries direction arrowheads.

**Forced colours:** the diagram keeps its palette, and the active step uses the system `Highlight` colour.

## Browser support

- Current Chrome, Edge and Firefox, and Safari **16.2+** (for `color-mix()`; plain-colour fallbacks are declared first).
- It uses container queries and units, `aspect-ratio` and `useSyncExternalStore`.
- All motion is CSS (`stroke-dashoffset` and `transform` keyframes). React never re-renders per frame, only on step, play-state, visibility and focus changes.
