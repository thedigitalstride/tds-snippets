# Water-cooled AC animation (Urban Cooling)

A square, step-by-step explainer showing how a water-cooled air conditioning system works. Its key message: **building water never travels to the wall unit; only refrigerant does.**

There are five captioned steps:
- The grey dashed water zone always stops inside the condenser unit.
- The "Refrigerant only, no water piped in" badge points at the two refrigerant lines where they cross the wall, in every step.
- Condensate from the wall unit is shown as a thin grey line, pumped back to the condenser unit alongside the refrigerant lines. It runs away from the room, so "no water piped in" stays accurate.
- Building water is shown simply as **Water in** (bottom of the heat exchanger) and **Water out** (top, warmer), so the heat exchanger works in counterflow.

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

## Visual language and brand colours

The illustration is simple line art. Equipment is drawn in black and the building context (room, wall, cupboard, condensate line and pump, water zone) in greys. Colour is used **only for the three flows**, each drawn as one line with arrowheads and travelling beads:

| Flow | Token | Default | Used for |
|---|---|---|---|
| Heat (red) | `--uc-heat` | `#e8412f` | refrigerant carrying the room's heat (from the wall-unit coil, through the wall, to the compressor and on to the heat exchanger), heat marks in the heat exchanger, warm room air |
| Cool (light blue) | `--uc-cool` | `#4fb3f0` | refrigerant after the heat exchanger (through the expansion valve and back to the wall unit) and cool air from the wall unit |
| Building water (mid blue, thicker) | `--uc-water` | `#1857ba` | water in and water out of the heat exchanger |

All tokens are public `--uc-*` custom properties, listed with their defaults at the top of `WaterCooledACAnimation.module.css`. Set any of them in any of these places:
- on the component, via `className`
- on any wrapper element
- globally, e.g. in `app/globals.css` on `:root`

```css
/* any stylesheet: global, a CSS Module, or inline on a wrapper */
.brand {
  --uc-heat: #d7262b;
  --uc-water: #0f4fa8;
}
```

```tsx
<WaterCooledACAnimation className={styles.brand} />
```

Internally the component reads private `--_uc-*` copies whose fallbacks are the defaults. Your values therefore win regardless of stylesheet order.

| Group | Tokens |
|---|---|
| Neutrals | `--uc-bg`, `--uc-ink` (near-black), `--uc-grey-1` (dark grey: body text, secondary labels), `--uc-grey-2` (mid grey: context lines, condensate line, water-zone outline), `--uc-grey-3` (light grey: plates, borders), `--uc-focus`, `--uc-font`, `--uc-max-width` |
| Flows | `--uc-heat`, `--uc-cool`, `--uc-water` |
| Other | `--uc-dim` (opacity of parts not in the current step) |

Choosing replacement flow colours:
- **Keep the three flows different in lightness, not just hue.** Water should be darkest, heat in the middle and cool lightest, so they stay distinct in greyscale and for red-green colour blindness.
  - The defaults have relative luminance of about 0.11, 0.21 and 0.40, roughly a 1.7:1 step between each pair.
  - A pure red and a mid blue of the same lightness, such as `#e0322b` and `#1f6fd1`, are almost identical in greyscale (1.1:1).
- **The light blue is below 3:1 on white** (`#4fb3f0` is 2.3:1). This keeps the client's light-blue look. The cool lines are never the only cue: they always have arrowheads, the legend, labels and captions. If stricter graphic contrast is needed, darken `--uc-cool` towards `#2f9ae0` (about 3:1), keeping it clearly lighter than `--uc-water`.
- Keep `--uc-ink` and `--uc-focus` at **4.5:1 or more** against `--uc-bg`. The active step, the callouts and the loud badge use white text on `--uc-ink`.

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
- Only the parts lit in the current step move. Everything else, line art and flows alike, is dimmed.

**Reduced motion:** with `prefers-reduced-motion: reduce` there is no autoplay and no motion. Static arrows on every pipe still show direction, and manual stepping works.

**Screen readers**
- A `<figure>` is labelled by the SVG's `<title>`. The SVG has `role="img"` with `<title>` and `<desc>`.
- The current step is always present as text.
- An `aria-live="polite"` region announces "Step N of 5: title. caption" after user navigation only.
- The active step button has `aria-current="step"`.

**Not colour alone**
- The three flows differ in lightness (see above), and water is also drawn thicker.
- Every flow line carries direction arrowheads, and the legend shows the three line samples.
- Red always means heat on the move: from the room air into the wall unit, along the refrigerant line to the condenser unit, and into the water in the heat exchanger.

**Forced colours:** the diagram keeps its palette, and the active step uses the system `Highlight` colour.

## Browser support

- Current Chrome, Edge and Firefox, and Safari **16.2+** (for `color-mix()`; plain-colour fallbacks are declared first).
- It uses container queries and units, `aspect-ratio` and `useSyncExternalStore`.
- All motion is CSS (`stroke-dashoffset` and `transform` keyframes). React never re-renders per frame, only on step, play-state, visibility and focus changes.
