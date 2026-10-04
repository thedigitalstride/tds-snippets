# Water-cooled AC animation (Urban Cooling)

A square, auto-advancing explainer showing how a water-cooled air conditioning system works. Its key message: **building water never travels to the wall unit; only refrigerant does.**

There are five captioned steps. The water zone always stops inside the condenser unit, and the "Refrigerant only, no water piped in" badge stays on screen throughout.

- `WaterCooledACAnimation.tsx`: client component (`"use client"`, default export, no dependencies)
- `WaterCooledACAnimation.module.css`: styles and brand tokens

## Use it in a Next.js (App Router) page

Copy the folder into your app (for example `components/water-cooled-ac-animation/`), then:

```tsx
import WaterCooledACAnimation from "@/components/water-cooled-ac-animation/WaterCooledACAnimation";

export default function Page() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <WaterCooledACAnimation />
    </div>
  );
}
```

The component is `width: 100%` with `aspect-ratio: 1 / 1`, so the **parent sets the size**. The caption and controls sit inside the square. It is designed for widths between about 320px and 720px.

It works from a Server Component page because the file has `"use client"`. It renders on the server and hydrates without warnings.

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `className` | `string` | — | Added to the root `<figure>` (e.g. to set `max-width` or margins). |
| `autoPlay` | `boolean` | `true` | Auto-advance through the steps. Always off when the viewer prefers reduced motion. |
| `stepDuration` | `number` | `4500` | Milliseconds per step while playing. |
| `eyebrow` | `string` | — | Optional small heading inside the square, e.g. "How it works". |
| `headline` | `string` | — | Optional headline inside the square. It takes space from the diagram, so on small screens prefer a page heading outside the component. |

## Brand colours

Every colour is a CSS custom property in the **first block of `WaterCooledACAnimation.module.css`** (on `.root`). Swap the placeholders for the real Urban Cooling palette:

- Surfaces and text: `--uc-bg`, `--uc-surface`, `--uc-ink`, `--uc-muted`, `--uc-primary`, `--uc-accent`, `--uc-focus`, `--uc-font`
- Refrigerant states: `--refrigerant-cold`, `--refrigerant-cool`, `--refrigerant-hot`, `--refrigerant-warm`
- Water and heat: `--water-flow`, `--water-return`, `--heat`, `--air-cool`
- Illustration neutrals: pipe, wall, slab, furniture and drain greys

You can also override them from outside without editing the file:

```css
.myAnimation { --uc-primary: #003a70; --uc-accent: #00a37a; }
```

```tsx
<WaterCooledACAnimation className={styles.myAnimation} />
```

Keep `--uc-primary`, `--uc-ink` and `--uc-focus` dark enough for white text and focus rings (at least 4.5:1 on white).

## Editing the copy

All words (step titles, captions, diagram labels, badge, legend, tooltips and accessible text) live in the `STEPS` and `LABELS` constants at the top of the `.tsx` file. Each step also lists which parts of the drawing are lit (`active`) and which get the highlight ring (`focus`).

- Captions: 18 words or fewer, so they fit in three lines at 340px wide.
- Diagram labels: at most about three short words. They are drawn at 26 SVG units, which is about 11px on a phone. Multi-line labels are arrays with one entry per line.
- The badge and the water-zone tag size themselves to their text. If text gets too wide, it is scaled down to fit.

Suggested footnote for the page (outside the component): "Many systems can also run in reverse to provide heating in winter."

## Behaviour and accessibility

- **Controls**: play/pause comes first in the tab order, then previous, step buttons 1–5 and next.
  - Choosing a step jumps to it and restarts that step's timer.
  - Pause freezes all motion (WCAG 2.2.2).
- **Pausing**: autoplay pauses while the tab is hidden, while the component is off-screen, and while a keyboard user is in the controls.
- **Reduced motion**: with `prefers-reduced-motion: reduce` there is no autoplay and no particle or pulse motion. Static arrows on every pipe still show direction, and manual stepping works.
- **Structure**: a `<figure>` labelled by the SVG's `<title>`. The SVG has `role="img"` with `<title>` and `<desc>`.
- **Announcements**: the current step is in the page for screen readers. An `aria-live="polite"` region announces "Step N of 5: title. caption" only after user navigation, not on every autoplay tick. The active step button has `aria-current="step"`.
- **Not colour alone**: refrigerant is thin copper pipe with dashes, and the gas pipe is visibly larger than the liquid pipe. Water is wide double-outlined pipe with round bubbles. Every pipe carries direction arrowheads.

## Browser support

Current Chrome, Edge, Firefox and Safari (16+). It uses container query units (`cqi`, with fixed fallbacks), `color-mix()` and `aspect-ratio`. All motion is CSS (`stroke-dashoffset` keyframes). React only re-renders when the step changes.
