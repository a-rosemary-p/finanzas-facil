/**
 * components/ui/wave.tsx
 *
 * Shared wave components — Fiza Design System v2.
 *
 * Rules: stroke only (except hero fill — explicit exception) ·
 *        never fill elsewhere · stroke-linecap round · opacity 25–70% in UI.
 *
 * Three exports:
 *   WaveDivider   — hairline, absolutely positioned at section bottom
 *   WaveUnderline — light, inline under key headlines (max 420 px)
 *   WaveRule      — hairline, inline row separator (replaces border-bottom)
 */

/**
 * Section wave divider — absolutely positioned at the bottom of its parent.
 * Parent must have position: relative + overflow: hidden.
 *
 * Two modes:
 *  • fill (string) — filled wave that cuts the section into the next section's
 *    color. Recommended for color transitions (paper→dark, dark→paper, etc.).
 *    Height: 52 px. Pass the next section's background color as fill.
 *  • stroke only (no fill) — hairline decorative line. Height: 12 px.
 */
export function WaveDivider({
  color = 'var(--brand-light)',
  opacity = 0.6,
  fill,
}: {
  color?: string
  opacity?: number
  fill?: string
}) {
  if (fill) {
    return (
      <div
        aria-hidden="true"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, lineHeight: 0, pointerEvents: 'none' }}
      >
        <svg viewBox="0 0 1200 52" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '52px' }}>
          <path
            d="M0,32 C200,52 400,12 600,28 C800,44 1000,8 1200,28 L1200,52 L0,52 Z"
            fill={fill}
          />
        </svg>
      </div>
    )
  }
  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, lineHeight: 0, pointerEvents: 'none' }}
    >
      <svg viewBox="0 0 1200 12" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '12px' }}>
        <path
          d="M 0 6 C 50 0, 100 12, 150 6 S 250 0, 300 6 S 400 12, 450 6 S 550 0, 600 6 S 700 12, 750 6 S 850 0, 900 6 S 1000 12, 1050 6 S 1150 0, 1200 6"
          fill="none"
          stroke={color}
          strokeWidth="1"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          opacity={opacity}
        />
      </svg>
    </div>
  )
}

/**
 * Light stroke wave — headline underline.
 * Inline block; max 420 px per design spec.
 * Place directly after an h1 or key headline element.
 */
export function WaveUnderline({ color = 'var(--brand-light)' }: { color?: string }) {
  return (
    <svg
      viewBox="0 0 600 18"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: 'block', width: '100%', maxWidth: '420px', height: '10px' }}
    >
      <path
        d="M 0 9 C 25 3, 50 15, 75 9 S 125 3, 150 9 S 200 15, 225 9 S 275 3, 300 9 S 350 15, 375 9 S 425 3, 450 9 S 500 15, 525 9 S 575 3, 600 9"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/**
 * Inline row separator — replaces border-bottom between list/form rows.
 * Renders as a 6 px tall block element; no positioning required.
 * Default color matches --brand-border (same as a 1px solid divider line).
 */
export function WaveRule({
  color = 'var(--brand-border)',
  opacity = 0.9,
}: {
  color?: string
  opacity?: number
}) {
  return (
    <svg
      viewBox="0 0 1200 12"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '6px' }}
    >
      <path
        d="M 0 6 C 50 0, 100 12, 150 6 S 250 0, 300 6 S 400 12, 450 6 S 550 0, 600 6 S 700 12, 750 6 S 850 0, 900 6 S 1000 12, 1050 6 S 1150 0, 1200 6"
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity={opacity}
      />
    </svg>
  )
}
