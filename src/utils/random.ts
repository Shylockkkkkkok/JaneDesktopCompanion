/** Random float in [min, max). */
export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Random element from a non-empty array. */
export function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
