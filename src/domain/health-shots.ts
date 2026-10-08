/**
 * Which photos a health check sends, and how to say so. Pure, tested in
 * health-shots.test.ts.
 *
 * It used to send the plant's three newest photos whatever their age, and
 * said nothing about it: a keeper who took one picture was billed for three,
 * two of them weeks old. The comparison was worth having -- it is how a check
 * on 8 Oct 2026 saw that patches on a Thai Constellation had spread since
 * September -- so it stays, but on purpose:
 *
 *  - every photo from the newest photo's day, at full detail: the plant now;
 *  - plus, if there is room, the newest photo from an earlier day, sent
 *    smaller, for the before-and-after;
 *  - and the button says exactly that.
 */
export interface ShotPhoto {
  uri: string;
  takenAt: string;
}

export interface HealthShot extends ShotPhoto {
  /** "current" is read for health; "earlier" is only there to compare against. */
  role: "current" | "earlier";
}

function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function healthCheckShots(photos: ShotPhoto[], max = 3): HealthShot[] {
  const newest = [...photos].sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt));
  if (!newest.length) return [];
  const day = localDay(newest[0].takenAt);
  const current = newest.filter((p) => localDay(p.takenAt) === day).slice(0, max);
  const shots: HealthShot[] = current.map((p) => ({ ...p, role: "current" }));
  const earlier = newest.find((p) => localDay(p.takenAt) !== day);
  if (earlier && shots.length < max) shots.push({ ...earlier, role: "earlier" });
  return shots;
}

const short = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** "Sends today's photo, and one from Sep 19 to compare against." */
export function describeShots(shots: HealthShot[], now: Date = new Date()): string {
  const current = shots.filter((s) => s.role === "current");
  const earlier = shots.find((s) => s.role === "earlier");
  if (!current.length) return "";
  const today = localDay(current[0].takenAt) === localDay(now.toISOString());
  const when = today ? "today's" : `the ${short(current[0].takenAt)}`;
  const what = current.length === 1 ? `${when} photo` : `${current.length} of ${when} photos`;
  return earlier
    ? `Sends ${what}, and one from ${short(earlier.takenAt)} to compare against.`
    : `Sends ${what}.`;
}
