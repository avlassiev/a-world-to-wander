import { DAY_NIGHT_SECONDS } from "./daylight";

/** Wall-clock years: a short year of a few game days, so New Year comes for everyone at the same moment. */
export const DAYS_PER_YEAR = 3;
export const YEAR_SECONDS = DAYS_PER_YEAR * DAY_NIGHT_SECONDS;
/** Ded Moroz stays for the whole first day of the new year. */
export const VISIT_SECONDS = DAY_NIGHT_SECONDS;
export const GIFTS = ["🧸", "🚗", "⚽", "🎨", "🍭", "🐶"] as const;

export function calendarAt(seconds: number) {
  const year = Math.floor(seconds / YEAR_SECONDS);
  const into = seconds - year * YEAR_SECONDS;
  const day = Math.floor(into / DAY_NIGHT_SECONDS);
  return { year, day, daysLeft: DAYS_PER_YEAR - day, secondsLeft: YEAR_SECONDS - into, visiting: into < VISIT_SECONDS };
}

/** A wish written during year Y is delivered on New Year at the start of Y+1; no wish, no visit. */
export function santaVisit(seconds: number, wishes: Record<number, string>) {
  const { year, visiting } = calendarAt(seconds);
  if (!visiting) return null;
  const gift = wishes[year - 1];
  return gift ? { gift } : { gift: null };
}
