import { describe, expect, it } from 'vitest';
import { generateCharacter } from '../engine/generator';
import { getAsiOpportunities, getFeatEligibility } from '../engine/feats';

describe('feats engine', () => {
  it('detects ASI opportunities across multi-level jump', () => {
    expect(getAsiOpportunities('fighter', 3, 8)).toEqual([4, 6, 8]);
  });

  it('returns eligible and ineligible feats with reasons', () => {
    const character = generateCharacter({
      mode: 'guided',
      level: 4,
      classId: 'fighter',
      raceId: 'human',
      gender: 'male',
      seed: 'fighter-feat-eligibility',
    });

    const eligibility = getFeatEligibility(character);
    const tough = eligibility.find((x) => x.feat.id === 'tough');
    const lucky = eligibility.find((x) => x.feat.id === 'lucky');

    expect(tough?.eligible).toBe(true);
    expect(lucky?.eligible).toBe(false);
    expect(lucky?.reasons.join(' ')).toContain('not modeled');
  });
});
