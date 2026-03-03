import { describe, expect, it } from 'vitest';
import { replaceNameInBackstory } from '../utils/backstoryName';

describe('replaceNameInBackstory', () => {
  it('replaces old full name references with the updated name', () => {
    const backstory = {
      origin: 'Aria Nightbreeze was born in a border city.',
      definingMoments: ['Aria Nightbreeze survived a siege', 'Saved a caravan', 'Broke from old mentor'],
      allies: ['A scout named Kael', 'A priest named Mira'],
      rival: "Captain Varric hunts Aria Nightbreeze across the realm.",
      secret: 'Carries a hidden sigil',
      rumor: 'Whispers follow Aria Nightbreeze in every town',
      roleplayPrompts: ['What line will Aria Nightbreeze never cross?', 'Who still trusts Aria Nightbreeze?'],
      questHook: 'A relic points Aria Nightbreeze toward a forgotten ruin.',
    };

    const updated = replaceNameInBackstory(backstory, 'Aria Nightbreeze', 'Bran Oakheart');

    expect(updated.origin).toContain('Bran Oakheart');
    expect(updated.rival).toContain('Bran Oakheart');
    expect(updated.questHook).toContain('Bran Oakheart');
    expect(updated.origin).not.toContain('Aria Nightbreeze');
  });

  it('falls back to replacing first-name references when full name is not present', () => {
    const backstory = {
      origin: 'Aria came from a hard life.',
      definingMoments: ['Aria won a duel', 'Aria crossed a cursed marsh', 'Aria spared an enemy'],
      allies: ['An old friend', 'A trusted guide'],
      rival: 'A bounty captain seeks Aria.',
      secret: 'Aria keeps a forbidden map.',
      rumor: 'Some say Aria served the enemy',
      roleplayPrompts: ['What does Aria hide?', 'Who would Aria betray to survive?'],
      questHook: 'A missing relic calls Aria back home.',
    };

    const updated = replaceNameInBackstory(backstory, 'Aria Nightbreeze', 'Bran Oakheart');

    expect(updated.origin).toContain('Bran');
    expect(updated.rival).toContain('Bran');
    expect(updated.questHook).toContain('Bran');
    expect(updated.origin).not.toContain('Aria');
  });
});
