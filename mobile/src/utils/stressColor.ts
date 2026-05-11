/**
 * Maps stress ratio (value / threshold) to a color from green → yellow → red.
 */
export function stressColor(ratio: number): string {
  const r = Math.min(Math.max(ratio, 0), 1.8) / 1.8;
  const green = { r: 74, g: 222, b: 128 }; // #4ade80
  const yellow = { r: 251, g: 191, b: 36 }; // #fbbf24
  const red = { r: 248, g: 113, b: 113 }; // #f87171

  let from = green;
  let to = yellow;
  let t = r * 2;
  if (t > 1) {
    from = yellow;
    to = red;
    t = t - 1;
  } else {
    t = t;
  }
  const lerp = (a: number, b: number, x: number) =>
    Math.round(a + (b - a) * x);
  return `rgb(${lerp(from.r, to.r, t)},${lerp(from.g, to.g, t)},${lerp(from.b, to.b, t)})`;
}

export function ringProgress(value: number, threshold: number): number {
  if (threshold <= 0) {
    return 0;
  }
  const cap = threshold * 1.35;
  return Math.min(1, Math.max(0, value / cap));
}
