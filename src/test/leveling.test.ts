import { describe, expect, it } from 'vitest';
import { generateCharacter } from '../engine/generator';
import { applyLevelUp } from '../engine/leveling';

describe('leveling with ASI/feat choices', () => {
  it('requires advancement choices when ASI levels are crossed', () => {
    const character = generateCharacter({
      mode: 'guided',
      level: 3,
      classId: 'fighter',
      raceId: 'human',
      gender: 'female',
      seed: 'lvl-requires-choice',
    });

    expect(() =>
      applyLevelUp(character, {
        targetLevel: 4,
        hpMethod: 'average',
      }),
    ).toThrow(/Expected 1 advancement choice/);
  });

  it('applies ASI and persists structured advancement history', () => {
    const character = generateCharacter({
      mode: 'guided',
      level: 3,
      classId: 'fighter',
      raceId: 'human',
      gender: 'female',
      seed: 'lvl-asi-choice',
    });

    const beforeStr = character.abilities.scores.str;
    const next = applyLevelUp(character, {
      targetLevel: 4,
      hpMethod: 'average',
      advancementChoices: [
        { type: 'asi', increases: [{ ability: 'str', amount: 2 }] },
      ],
    });

    expect(next.abilities.scores.str).toBe(beforeStr + 2);
    expect(next.advancement.choices.at(-1)).toEqual({
      type: 'asi',
      increases: [{ ability: 'str', amount: 2 }],
    });
    expect(next.advancement.history.at(-1)?.advancementChoice).toEqual({
      type: 'asi',
      increases: [{ ability: 'str', amount: 2 }],
    });
  });

  it('applies deterministic feat effects (tough hp per level)', () => {
    const character = generateCharacter({
      mode: 'guided',
      level: 3,
      classId: 'fighter',
      raceId: 'human',
      gender: 'female',
      seed: 'lvl-feat-tough',
    });

    const withAsi = applyLevelUp(character, {
      targetLevel: 4,
      hpMethod: 'average',
      advancementChoices: [
        { type: 'asi', increases: [{ ability: 'str', amount: 2 }] },
      ],
    });

    const withTough = applyLevelUp(character, {
      targetLevel: 4,
      hpMethod: 'average',
      advancementChoices: [
        { type: 'feat', featId: 'tough' },
      ],
    });

    expect(withTough.combat.hpMax).toBe(withAsi.combat.hpMax + 8);
    expect(withTough.advancement.choices.at(-1)).toEqual({ type: 'feat', featId: 'tough' });
  });

  it('supports resilient with one linked ability/save choice', () => {
    const character = generateCharacter({
      mode: 'guided',
      level: 3,
      classId: 'fighter',
      raceId: 'human',
      gender: 'female',
      seed: 'lvl-feat-resilient',
    });

    const beforeWis = character.abilities.scores.wis;
    const beforeSave = character.proficiencies.savingThrows.wis;

    const next = applyLevelUp(character, {
      targetLevel: 4,
      hpMethod: 'average',
      advancementChoices: [
        {
          type: 'feat',
          featId: 'resilient',
          selection: { abilityChoices: ['wis'] },
        },
      ],
    });

    expect(next.abilities.scores.wis).toBe(beforeWis + 1);
    expect(beforeSave).toBe(false);
    expect(next.proficiencies.savingThrows.wis).toBe(true);
  });
});
