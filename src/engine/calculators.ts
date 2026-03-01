import type { AbilityKey, SpellSlots } from '../types/character';

export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonusForLevel(level: number): number {
  if (level <= 4) return 2;
  if (level <= 8) return 3;
  if (level <= 12) return 4;
  if (level <= 16) return 5;
  return 6;
}

const fullCasterSlots = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const halfCasterSlots = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
];

const pactSlotsByLevel = [
  [1, 1],
  [1, 2],
  [2, 2],
  [2, 2],
  [3, 2],
  [3, 2],
  [4, 2],
  [4, 2],
  [5, 2],
  [5, 2],
  [5, 3],
  [5, 3],
  [5, 3],
  [5, 3],
  [5, 3],
  [5, 3],
  [5, 4],
  [5, 4],
  [5, 4],
  [5, 4],
];

export function spellSlotsFor(type: 'none' | 'full' | 'half' | 'pact', level: number): SpellSlots {
  const empty: SpellSlots = { level1: 0, level2: 0, level3: 0, level4: 0, level5: 0, level6: 0, level7: 0, level8: 0, level9: 0 };
  if (type === 'none') return empty;

  if (type === 'full' || type === 'half') {
    const table = type === 'full' ? fullCasterSlots : halfCasterSlots;
    const row = table[level - 1] ?? table[0]!;
    return {
      level1: row[0]!,
      level2: row[1]!,
      level3: row[2]!,
      level4: row[3]!,
      level5: row[4]!,
      level6: row[5]!,
      level7: row[6]!,
      level8: row[7]!,
      level9: row[8]!,
    };
  }

  const [pactLevel, slotCount] = pactSlotsByLevel[level - 1] ?? [1, 1];
  const key = `level${pactLevel}` as keyof SpellSlots;
  return { ...empty, [key]: slotCount };
}

export function toHitFromAbility(abilityMod: number, proficiencyBonus: number, proficient: boolean): number {
  return abilityMod + (proficient ? proficiencyBonus : 0);
}

export function calculateSaveDc(castingAbilityMod: number, proficiencyBonus: number): number {
  return 8 + castingAbilityMod + proficiencyBonus;
}

export function defaultAbilityOrder(primary: AbilityKey[]): AbilityKey[] {
  const rest: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'].filter((x): x is AbilityKey => !primary.includes(x as AbilityKey)) as AbilityKey[];
  return [...primary, ...rest];
}
