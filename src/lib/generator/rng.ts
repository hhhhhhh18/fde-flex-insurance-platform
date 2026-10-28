/**
 * Seeded, platform-independent PRNG (mulberry32). Same seed => same stream on any
 * machine, which is what makes byte-identical exports possible.
 */
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed) || seed < 0) throw new Error("Seed must be a non-negative integer");
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    if (max < min) throw new Error(`Invalid range ${min}..${max}`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Cannot pick from an empty list");
    return items[this.int(0, items.length - 1)]!;
  }

  /** Picks by relative weight. Weights must be positive. */
  weighted<T>(entries: readonly { value: T; weight: number }[]): T {
    const total = entries.reduce((sum, e) => sum + e.weight, 0);
    let roll = this.next() * total;
    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) return entry.value;
    }
    return entries[entries.length - 1]!.value;
  }

  bool(probability: number): boolean {
    return this.next() < probability;
  }

  /** Deterministic shuffle (Fisher-Yates) returning a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  }

  /** Integer drawn from a triangular distribution - used for plausible skews. */
  triangular(min: number, max: number, mode: number): number {
    const u = this.next();
    const c = (mode - min) / (max - min);
    const value =
      u < c
        ? min + Math.sqrt(u * (max - min) * (mode - min))
        : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
    return Math.round(value);
  }
}

/** Deterministic 32-bit seed from a string (for named scenarios). */
export function seedFromString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
