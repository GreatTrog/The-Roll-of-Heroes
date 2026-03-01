import { describe, expect, it } from 'vitest';
import { generateCharacter } from '../engine/generator';
import { validateCharacterInvariants } from '../engine/invariants';

describe('generator', () => {
  it('generates deterministic character from seed', () => {
    const one = generateCharacter({ mode: 'one_click', level: 3, seed: 'abc' });
    const two = generateCharacter({ mode: 'one_click', level: 3, seed: 'abc' });
    expect(one.identity.name).toBe(two.identity.name);
    expect(one.abilities.scores).toEqual(two.abilities.scores);
  });

  it('passes invariants', () => {
    const char = generateCharacter({ mode: 'guided', classId: 'fighter', raceId: 'human', level: 5, seed: 'fighter-5' });
    expect(validateCharacterInvariants(char)).toHaveLength(0);
  });
});
