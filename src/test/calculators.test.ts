import { describe, expect, it } from 'vitest';
import { calculateModifier, proficiencyBonusForLevel, spellSlotsFor } from '../engine/calculators';

describe('calculators', () => {
  it('computes ability modifiers', () => {
    expect(calculateModifier(8)).toBe(-1);
    expect(calculateModifier(10)).toBe(0);
    expect(calculateModifier(18)).toBe(4);
  });

  it('computes proficiency progression', () => {
    expect(proficiencyBonusForLevel(1)).toBe(2);
    expect(proficiencyBonusForLevel(9)).toBe(4);
    expect(proficiencyBonusForLevel(17)).toBe(6);
  });

  it('computes full caster and pact slots', () => {
    expect(spellSlotsFor('full', 5).level1).toBe(4);
    expect(spellSlotsFor('full', 5).level3).toBe(2);
    expect(spellSlotsFor('pact', 11).level5).toBe(3);
  });
});
