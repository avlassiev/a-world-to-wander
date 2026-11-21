/** Wall-clock cycle: every computer sees the same sky, independent of saved growth time. */
export const DAY_NIGHT_SECONDS = 240;

export function daylightAt(seconds: number) {
  const phase = ((seconds % DAY_NIGHT_SECONDS) + DAY_NIGHT_SECONDS) % DAY_NIGHT_SECONDS / DAY_NIGHT_SECONDS;
  const angle = phase * Math.PI * 2;
  const height = Math.cos(angle);
  const blend = Math.max(0, Math.min(1, (height + 0.18) / 0.5));
  const daylight = blend * blend * (3 - 2 * blend);
  return { phase, height, daylight, sunX: Math.sin(angle), sunY: height };
}