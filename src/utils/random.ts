import seedrandom from 'seedrandom';

export type Rng = () => number;

export function buildRng(seed: string): Rng {
  return seedrandom(seed);
}

export function pickOne<T>(rng: Rng, list: T[]): T {
  return list[Math.floor(rng() * list.length)]!;
}

export function pickMany<T>(rng: Rng, list: T[], count: number): T[] {
  const items = [...list];
  const selected: T[] = [];
  while (selected.length < count && items.length > 0) {
    const idx = Math.floor(rng() * items.length);
    selected.push(items.splice(idx, 1)[0]!);
  }
  return selected;
}

export function randomInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
