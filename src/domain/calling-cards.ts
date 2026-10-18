/**
 * The words around calling cards, kept here so the app and its tests agree.
 */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 new plants · 1 new photo", or null when nothing is new. */
export function whatsNew(newPlants: number, newPhotos: number): string | null {
  const parts = [
    newPlants > 0 ? plural(newPlants, "new plant", "new plants") : null,
    newPhotos > 0 ? plural(newPhotos, "new photo", "new photos") : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * How many cards a conservatory holds, said to its keeper ("yours") or to a
 * visitor ("theirs"). A number only: who left them is never shown.
 */
export function cardsLine(count: number, whose: "yours" | "theirs"): string {
  if (whose === "yours") {
    return count === 0
      ? "No calling cards yet. Send a plant friend your link and they can leave one."
      : `${plural(count, "keeper has", "keepers have")} left their card at your conservatory.`;
  }
  return count === 0 ? "" : `${plural(count, "keeper has", "keepers have")} left their card here.`;
}
