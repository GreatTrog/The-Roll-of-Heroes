import { describe, expect, it } from 'vitest';
import { generateCharacter } from '../engine/generator';
import {
  getEligibleWeaponOptions,
  hasWeaponProficiency,
  recomputeAttacksForCharacter,
} from '../engine/weapons';

describe('weapons engine', () => {
  it('returns eligible weapon options based on proficiency', () => {
    const wizard = generateCharacter({
      mode: 'guided',
      classId: 'wizard',
      raceId: 'human',
      gender: 'other',
      level: 3,
      seed: 'wizard-weapons',
    });

    const options = getEligibleWeaponOptions(wizard).map((w) => w.id);
    expect(options).toContain('dagger');
    expect(options).toContain('light_crossbow');
    expect(options).not.toContain('greatsword');
  });

  it('recomputes attacks from modified loadout', () => {
    const fighter = generateCharacter({
      mode: 'guided',
      classId: 'fighter',
      raceId: 'human',
      gender: 'male',
      level: 5,
      seed: 'fighter-weapons',
    });

    fighter.equipment.weaponIds = ['longsword', 'longbow'];
    const attacks = recomputeAttacksForCharacter(fighter);
    expect(attacks).toHaveLength(2);
    expect(attacks[0]?.name.toLowerCase()).toContain('longsword');
    expect(attacks[1]?.name.toLowerCase()).toContain('longbow');
  });

  it('checks direct or category weapon proficiency', () => {
    const rogue = generateCharacter({
      mode: 'guided',
      classId: 'rogue',
      raceId: 'human',
      gender: 'female',
      level: 4,
      seed: 'rogue-proficiency',
    });
    expect(hasWeaponProficiency(rogue, 'rapier')).toBe(true);
    expect(hasWeaponProficiency(rogue, 'longbow')).toBe(false);
  });
});
