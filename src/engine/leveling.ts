import type { Character } from '../types/character';
import { generateCharacter } from './generator';

export type HpMethod = 'average' | 'roll' | 'manual';

export type LevelUpDecision = {
  targetLevel: number;
  hpMethod: HpMethod;
  hpManualGain?: number;
  featOrAsi?: string;
  spellAdds?: string[];
};

export function applyLevelUp(character: Character, decision: LevelUpDecision): Character {
  if (decision.targetLevel <= character.identity.level || decision.targetLevel > 20) {
    throw new Error('Target level must be greater than current level and <= 20.');
  }

  const before = JSON.stringify({
    level: character.identity.level,
    hpMax: character.combat.hpMax,
    features: character.features.map((f) => f.id),
    slots: character.spellcasting.slots,
  });

  const leveled = generateCharacter({
    mode: character.build.mode,
    level: decision.targetLevel,
    classId: character.identity.classId,
    raceId: character.identity.raceId,
    tags: character.build.flavorTags,
    seed: `${character.meta.seed}:lvl:${decision.targetLevel}`,
    lockedCharacter: character,
    locks: {
      class: true,
      race: true,
      background: true,
      name: true,
      equipment: true,
      backstory: true,
      spells: false,
    },
  });

  const hpGain = leveled.combat.hpMax - character.combat.hpMax;
  const after = JSON.stringify({
    level: leveled.identity.level,
    hpMax: leveled.combat.hpMax,
    features: leveled.features.map((f) => f.id),
    slots: leveled.spellcasting.slots,
  });

  leveled.advancement.hpMethodTracking = [...character.advancement.hpMethodTracking, decision.hpMethod];
  leveled.advancement.asiFeatTracking = decision.featOrAsi
    ? [...character.advancement.asiFeatTracking, decision.featOrAsi]
    : character.advancement.asiFeatTracking;
  leveled.advancement.spellSelectionTracking = [...character.advancement.spellSelectionTracking, ...(decision.spellAdds ?? [])];
  leveled.advancement.history = [
    ...character.advancement.history,
    {
      timestamp: new Date().toISOString(),
      fromLevel: character.identity.level,
      toLevel: decision.targetLevel,
      hpMethod: decision.hpMethod,
      hpGain: decision.hpManualGain ?? hpGain,
      asiOrFeat: decision.featOrAsi,
      spellsChanged: decision.spellAdds ?? [],
      beforeSnapshot: before,
      afterSnapshot: after,
    },
  ];

  if (decision.spellAdds?.length) {
    const merged = new Set([...leveled.spellcasting.spellsKnown, ...decision.spellAdds]);
    leveled.spellcasting.spellsKnown = [...merged];
  }

  return leveled;
}
