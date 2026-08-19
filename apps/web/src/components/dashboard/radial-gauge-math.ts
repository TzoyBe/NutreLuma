/** Pointer → fraction [0,1); top = 0, clockwise. Screen coords (y grows down). */
export function angleFraction(cx: number, cy: number, x: number, y: number): number {
  const dx = x - cx;
  const dy = y - cy;
  // atan2(dx, -dy): top→0, right→+π/2, bottom→±π, left→-π/2
  let angle = Math.atan2(dx, -dy);
  if (angle < 0) angle += 2 * Math.PI;
  return angle / (2 * Math.PI);
}

/** Prevent the 0↔1 jump when the pointer crosses the top boundary. */
export function applyAntiWrap(raw: number, prev: number | null): number {
  if (prev === null) return raw;
  if (Math.abs(raw - prev) > 0.5) return prev > 0.5 ? 1 : 0;
  return raw;
}

/** fraction → snapped, clamped value. */
export function snapValue(fraction: number, scaleMax: number, snap: number): number {
  const raw = fraction * scaleMax;
  const snapped = Math.round(raw / snap) * snap;
  return Math.max(0, Math.min(scaleMax, snapped));
}
