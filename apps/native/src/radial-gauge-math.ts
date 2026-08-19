export function angleFraction(cx: number, cy: number, x: number, y: number): number {
  const dx = x - cx;
  const dy = y - cy;
  let angle = Math.atan2(dx, -dy);
  if (angle < 0) angle += 2 * Math.PI;
  return angle / (2 * Math.PI);
}
export function applyAntiWrap(raw: number, prev: number | null): number {
  if (prev === null) return raw;
  if (Math.abs(raw - prev) > 0.5) return prev > 0.5 ? 1 : 0;
  return raw;
}
export function snapValue(fraction: number, scaleMax: number, snap: number): number {
  const snapped = Math.round((fraction * scaleMax) / snap) * snap;
  return Math.max(0, Math.min(scaleMax, snapped));
}
