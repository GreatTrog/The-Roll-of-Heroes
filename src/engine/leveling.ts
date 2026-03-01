import type { Character } from '../types/character';
import { generateCharacter } from './generator';
import { applyAdvancementChoices, getAsiOpportunities, validateAsiChoice, validateFeatChoice } from './feats';
import type { AdvancementChoice } from '../types/character';

export type HpMethod = 'average' | 'roll' | 'manual';

export type LevelUpDecision = {
  targetLevel: number;
  hpMethod: HpMethod;
  hpManualGain?: number;
  featsEnabled?: boolean;
  advancementChoices?: AdvancementChoice[];
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
  const asiOpportunities = getAsiOpportunities(character.identity.classId, character.identity.level, decision.targetLevel);
  const requiresChoices = asiOpportunities.length > 0;
  const providedChoices = decision.advancementChoices ?? [];
  if (requiresChoices && providedChoices.length !== asiOpportunities.length) {
    throw new Error(`Expected ${asiOpportunities.length} advancement choice(s) for this level-up.`);
  }
  if (!requiresChoices && providedChoices.length > 0) {
    throw new Error('Advancement choices were provided for a level-up with no ASI opportunity.');
  }
  if ((decision.featsEnabled ?? true) === false && providedChoices.some((choice) => choice.type === 'feat')) {
    throw new Error('Feats are disabled. Choose ASI for advancement choices.');
  }

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

  const existingChoices = character.advancement.choices ?? [];
  for (let idx = 0; idx < providedChoices.length; idx += 1) {
    const choice = providedChoices[idx]!;
    const priorChoices = [...existingChoices, ...providedChoices.slice(0, idx)];
    const validationBase = applyAdvancementChoices(leveled, priorChoices);
    const errors = choice.type === 'asi'
      ? validateAsiChoice(validationBase, choice)
      : validateFeatChoice(validationBase, choice);
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }
  }

  const mergedChoices = [...existingChoices, ...providedChoices];
  const withChoicesApplied = applyAdvancementChoices(leveled, mergedChoices);

  const hpGain = withChoicesApplied.combat.hpMax - character.combat.hpMax;
  const after = JSON.stringify({
    level: withChoicesApplied.identity.level,
    hpMax: withChoicesApplied.combat.hpMax,
    features: withChoicesApplied.features.map((f) => f.id),
    slots: withChoicesApplied.spellcasting.slots,
  });

  withChoicesApplied.advancement.hpMethodTracking = [...character.advancement.hpMethodTracking, decision.hpMethod];
  withChoicesApplied.advancement.choices = mergedChoices;
  withChoicesApplied.advancement.spellSelectionTracking = [...character.advancement.spellSelectionTracking, ...(decision.spellAdds ?? [])];
  withChoicesApplied.advancement.history = [
    ...character.advancement.history,
    {
      timestamp: new Date().toISOString(),
      fromLevel: character.identity.level,
      toLevel: decision.targetLevel,
      hpMethod: decision.hpMethod,
      hpGain: decision.hpManualGain ?? hpGain,
      advancementChoice: providedChoices[0],
      spellsChanged: decision.spellAdds ?? [],
      beforeSnapshot: before,
      afterSnapshot: after,
    },
  ];
  if (providedChoices.length > 1) {
    for (let idx = 1; idx < providedChoices.length; idx += 1) {
      withChoicesApplied.advancement.history.push({
        timestamp: new Date().toISOString(),
        fromLevel: character.identity.level,
        toLevel: decision.targetLevel,
        hpMethod: decision.hpMethod,
        hpGain: 0,
        advancementChoice: providedChoices[idx],
        spellsChanged: [],
        beforeSnapshot: before,
        afterSnapshot: after,
      });
    }
  }

  if (decision.spellAdds?.length) {
    const merged = new Set([...withChoicesApplied.spellcasting.spellsKnown, ...decision.spellAdds]);
    withChoicesApplied.spellcasting.spellsKnown = [...merged];
  }

  return withChoicesApplied;
}
