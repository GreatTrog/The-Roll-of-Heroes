import { calculateModifier, calculateSaveDc, proficiencyBonusForLevel, toHitFromAbility } from './calculators';
import { classById, equipmentById, featById, feats } from '../data/rules';
import type { FeatData } from '../data/schemas';
import type { AbilityKey, AdvancementChoice, Character } from '../types/character';

export type FeatEligibility = {
  feat: FeatData;
  eligible: boolean;
  reasons: string[];
};

export function getAsiOpportunities(classId: string, fromLevel: number, toLevel: number): number[] {
  const classDef = classById.get(classId);
  if (!classDef) return [];
  const out: number[] = [];
  for (let level = fromLevel + 1; level <= toLevel; level += 1) {
    const features = classDef.featuresByLevel[String(level)] ?? [];
    if (features.includes('asi')) out.push(level);
  }
  return out;
}

export function getTakenFeatIds(character: Character): Set<string> {
  const ids = new Set<string>();
  for (const choice of character.advancement.choices ?? []) {
    if (choice.type === 'feat') ids.add(choice.featId);
  }
  return ids;
}

export function getFeatChoiceRequirements(feat: FeatData) {
  const abilityChoices = (feat.effects?.abilityChoiceBonuses ?? []).reduce((sum, bonus) => sum + bonus.choose, 0);
  const saveChoices = feat.effects?.saveProficiencyChoice?.choose ?? 0;
  const skillChoices = (feat.effects?.addSkillProficiencies ?? []).filter((x) => x === 'choice').length;
  const toolChoices = (feat.effects?.addToolProficiencies ?? []).filter((x) => x === 'choice').length;
  const weaponChoices = (feat.effects?.addWeaponProficiencies ?? []).filter((x) => x === 'choice').length;
  const languageChoices = (feat.effects?.addLanguages ?? []).filter((x) => x === 'choice').length;
  return { abilityChoices, saveChoices, skillChoices, toolChoices, weaponChoices, languageChoices };
}

export function checkFeatPrerequisites(character: Character, feat: FeatData): string[] {
  const reasons: string[] = [];
  const prereqs = feat.prerequisites;
  if (!prereqs) return reasons;

  for (const req of prereqs.abilityMin ?? []) {
    if (character.abilities.scores[req.ability] < req.min) {
      reasons.push(`Requires ${req.ability.toUpperCase()} ${req.min}+.`);
    }
  }

  if (prereqs.abilityMinAny && prereqs.abilityMinAny.length > 0) {
    const satisfiesAny = prereqs.abilityMinAny.some((req) => character.abilities.scores[req.ability] >= req.min);
    if (!satisfiesAny) {
      const text = prereqs.abilityMinAny.map((req) => `${req.ability.toUpperCase()} ${req.min}+`).join(' or ');
      reasons.push(`Requires ${text}.`);
    }
  }

  if (prereqs.raceIds?.length && !prereqs.raceIds.includes(character.identity.raceId)) {
    reasons.push(`Requires race: ${prereqs.raceIds.join(', ')}.`);
  }

  const hasWeaponProf = (required: string) =>
    character.proficiencies.weapons.includes(required) ||
    (required === 'simple' && character.proficiencies.weapons.includes('martial'));
  const hasArmorProf = (required: string) =>
    character.proficiencies.armor.includes(required) ||
    (required === 'light' && (character.proficiencies.armor.includes('medium') || character.proficiencies.armor.includes('all_armor'))) ||
    (required === 'medium' && character.proficiencies.armor.includes('all_armor')) ||
    (required === 'heavy' && character.proficiencies.armor.includes('all_armor'));

  for (const prof of prereqs.weaponProficiencies ?? []) {
    if (!hasWeaponProf(prof)) reasons.push(`Requires weapon proficiency: ${prof}.`);
  }
  for (const prof of prereqs.armorProficiencies ?? []) {
    if (!hasArmorProf(prof)) reasons.push(`Requires armor proficiency: ${prof}.`);
  }
  for (const prof of prereqs.toolProficiencies ?? []) {
    if (!character.proficiencies.tools.includes(prof)) reasons.push(`Requires tool proficiency: ${prof}.`);
  }

  if (prereqs.spellcastingRequired && !character.spellcasting.enabled) {
    reasons.push('Requires spellcasting.');
  }

  return reasons;
}

export function getFeatEligibility(character: Character): FeatEligibility[] {
  const taken = getTakenFeatIds(character);
  return feats.map((feat) => {
    const reasons: string[] = [];
    if (feat.requiresManualResolution) reasons.push(feat.manualResolutionReason ?? 'Manual-only feat in current rules engine.');
    if (taken.has(feat.id)) reasons.push('Feat already taken.');
    reasons.push(...checkFeatPrerequisites(character, feat));
    return { feat, eligible: reasons.length === 0, reasons };
  });
}

export function validateAsiChoice(character: Character, choice: Extract<AdvancementChoice, { type: 'asi' }>): string[] {
  const errors: string[] = [];
  if (choice.increases.length === 0 || choice.increases.length > 2) {
    errors.push('ASI requires either one +2 increase or two +1 increases.');
    return errors;
  }

  const byAbility = new Map<AbilityKey, number>();
  for (const increase of choice.increases) {
    byAbility.set(increase.ability, (byAbility.get(increase.ability) ?? 0) + increase.amount);
  }

  const values = [...byAbility.values()];
  const isSinglePlusTwo = values.length === 1 && values[0] === 2;
  const isDoublePlusOne = values.length === 2 && values.every((x) => x === 1);
  if (!isSinglePlusTwo && !isDoublePlusOne) {
    errors.push('ASI must be +2 to one ability or +1 to two different abilities.');
  }

  for (const [ability, amount] of byAbility) {
    const next = character.abilities.scores[ability] + amount;
    if (next > 20) errors.push(`${ability.toUpperCase()} cannot exceed 20.`);
  }

  return errors;
}

export function validateFeatChoice(character: Character, choice: Extract<AdvancementChoice, { type: 'feat' }>): string[] {
  const feat = featById.get(choice.featId);
  if (!feat) return [`Unknown feat: ${choice.featId}.`];
  const errors: string[] = [];
  if (feat.requiresManualResolution) {
    errors.push(feat.manualResolutionReason ?? 'Selected feat is not supported in current rules engine.');
  }
  errors.push(...checkFeatPrerequisites(character, feat));

  const selection = choice.selection ?? {};
  const required = getFeatChoiceRequirements(feat);
  const abilityChoices = selection.abilityChoices ?? [];
  const saveChoices = selection.saveChoices ?? [];
  const effectiveSaveChoices =
    choice.featId === 'resilient' && saveChoices.length === 0 && abilityChoices.length === 1
      ? abilityChoices
      : saveChoices;
  const skillChoices = selection.skillChoices ?? [];
  const toolChoices = selection.toolChoices ?? [];
  const weaponChoices = selection.weaponChoices ?? [];
  const languageChoices = selection.languageChoices ?? [];

  if (abilityChoices.length !== required.abilityChoices) {
    errors.push(`Requires ${required.abilityChoices} ability choice(s).`);
  }
  if (effectiveSaveChoices.length !== required.saveChoices) {
    errors.push(`Requires ${required.saveChoices} save proficiency choice(s).`);
  }
  if (skillChoices.length !== required.skillChoices) {
    errors.push(`Requires ${required.skillChoices} skill choice(s).`);
  }
  if (toolChoices.length !== required.toolChoices) {
    errors.push(`Requires ${required.toolChoices} tool choice(s).`);
  }
  if (weaponChoices.length !== required.weaponChoices) {
    errors.push(`Requires ${required.weaponChoices} weapon choice(s).`);
  }
  if (languageChoices.length !== required.languageChoices) {
    errors.push(`Requires ${required.languageChoices} language choice(s).`);
  }

  if (choice.featId === 'resilient' && abilityChoices.length === 1 && effectiveSaveChoices.length === 1) {
    if (abilityChoices[0] !== effectiveSaveChoices[0]) {
      errors.push('Resilient save proficiency must match the ability increase.');
    }
  }

  const duplicateSkill = new Set(skillChoices).size !== skillChoices.length;
  const duplicateTool = new Set(toolChoices).size !== toolChoices.length;
  const duplicateWeapon = new Set(weaponChoices).size !== weaponChoices.length;
  const duplicateLanguage = new Set(languageChoices).size !== languageChoices.length;
  if (duplicateSkill || duplicateTool || duplicateWeapon || duplicateLanguage) {
    errors.push('Selection choices must be unique.');
  }

  // Validate ability choices against each feat-defined option group.
  if ((feat.effects?.abilityChoiceBonuses?.length ?? 0) > 0) {
    let cursor = 0;
    for (const abilityChoiceDef of feat.effects?.abilityChoiceBonuses ?? []) {
      for (let i = 0; i < abilityChoiceDef.choose; i += 1) {
        const picked = abilityChoices[cursor] as AbilityKey | undefined;
        if (!picked) {
          cursor += 1;
          continue;
        }
        if (!abilityChoiceDef.from.includes(picked)) {
          errors.push(`Invalid ability choice ${picked.toUpperCase()} for ${feat.name}.`);
        }
        cursor += 1;
      }
    }
  }

  return errors;
}

function applyAbilityIncrease(character: Character, ability: AbilityKey, amount: number) {
  character.abilities.scores[ability] = Math.min(20, character.abilities.scores[ability] + amount);
}

function resolveAbilityChoiceBonuses(feat: FeatData, selection: Extract<AdvancementChoice, { type: 'feat' }>['selection']): Array<{ ability: AbilityKey; amount: number }> {
  const out: Array<{ ability: AbilityKey; amount: number }> = [];
  const abilityChoices = selection?.abilityChoices ?? [];
  let cursor = 0;
  for (const choice of feat.effects?.abilityChoiceBonuses ?? []) {
    for (let i = 0; i < choice.choose; i += 1) {
      const picked = abilityChoices[cursor] as AbilityKey | undefined;
      if (picked && choice.from.includes(picked)) {
        out.push({ ability: picked, amount: choice.amount });
      }
      cursor += 1;
    }
  }
  return out;
}

function recomputeDerived(character: Character, conModBefore: number, initiativeBonus: number, speedBonus: number, hpPerLevelBonus: number) {
  const modifiers = {
    str: calculateModifier(character.abilities.scores.str),
    dex: calculateModifier(character.abilities.scores.dex),
    con: calculateModifier(character.abilities.scores.con),
    int: calculateModifier(character.abilities.scores.int),
    wis: calculateModifier(character.abilities.scores.wis),
    cha: calculateModifier(character.abilities.scores.cha),
  };
  character.abilities.modifiers = modifiers;
  const pb = proficiencyBonusForLevel(character.identity.level);
  character.combat.proficiencyBonus = pb;

  const conDelta = modifiers.con - conModBefore;
  if (conDelta !== 0) {
    character.combat.hpMax += conDelta * character.identity.level;
    character.combat.currentHp += conDelta * character.identity.level;
  }
  if (hpPerLevelBonus !== 0) {
    const hpGain = hpPerLevelBonus * character.identity.level;
    character.combat.hpMax += hpGain;
    character.combat.currentHp += hpGain;
  }
  if (character.combat.hpMax < 1) character.combat.hpMax = 1;
  if (character.combat.currentHp > character.combat.hpMax) character.combat.currentHp = character.combat.hpMax;

  const armor = character.equipment.armorId ? equipmentById.get(character.equipment.armorId) : undefined;
  let baseAc = 10 + modifiers.dex;
  if (armor?.acBase) {
    if (armor.dexCap === undefined || armor.dexCap === null) {
      baseAc = armor.acBase + modifiers.dex;
    } else {
      baseAc = armor.acBase + Math.min(armor.dexCap, modifiers.dex);
    }
  }
  character.combat.ac = baseAc + (character.equipment.shield ? 2 : 0);
  character.combat.initiative = modifiers.dex + initiativeBonus;
  character.combat.speed = Math.max(0, character.combat.speed + speedBonus);

  character.combat.attacks = character.equipment.weaponIds.map((weaponId) => {
    const dexWeapon = weaponId.includes('bow') || weaponId === 'dagger' || weaponId === 'rapier';
    const abilityMod = dexWeapon ? modifiers.dex : modifiers.str;
    const proficient = true;
    return {
      id: weaponId,
      name: weaponId.replaceAll('_', ' '),
      toHit: toHitFromAbility(abilityMod, pb, proficient),
      damage: weaponId.includes('bow') ? `1d8 + ${abilityMod} piercing` : `1d8 + ${abilityMod} slashing`,
      properties: dexWeapon ? ['finesse/ranged'] : ['melee'],
    };
  });

  const castingAbility = character.spellcasting.castingAbility as AbilityKey | undefined;
  if (castingAbility) {
    character.spellcasting.saveDc = calculateSaveDc(modifiers[castingAbility], pb);
    character.spellcasting.spellAttackBonus = modifiers[castingAbility] + pb;
  }
}

function applyFeatEffects(character: Character, choice: Extract<AdvancementChoice, { type: 'feat' }>, feat: FeatData) {
  for (const bonus of feat.effects?.fixedAbilityBonuses ?? []) {
    applyAbilityIncrease(character, bonus.ability, bonus.amount);
  }

  for (const bonus of resolveAbilityChoiceBonuses(feat, choice.selection)) {
    applyAbilityIncrease(character, bonus.ability, bonus.amount);
  }

  const addUnique = (target: string[], values: string[]) => {
    for (const value of values) {
      if (!target.includes(value)) target.push(value);
    }
  };

  for (const skill of choice.selection?.skillChoices ?? []) {
    if (skill !== 'choice') character.proficiencies.skills[skill] = true;
  }
  addUnique(character.proficiencies.tools, (choice.selection?.toolChoices ?? []).filter((x) => x !== 'choice'));
  addUnique(character.proficiencies.weapons, (feat.effects?.addWeaponProficiencies ?? []).filter((x) => x !== 'choice'));
  addUnique(character.proficiencies.weapons, (choice.selection?.weaponChoices ?? []).filter((x) => x !== 'choice'));
  addUnique(character.proficiencies.armor, (feat.effects?.addArmorProficiencies ?? []).filter((x) => x !== 'choice'));
  addUnique(character.proficiencies.languages, (feat.effects?.addLanguages ?? []).filter((x) => x !== 'choice'));
  addUnique(character.proficiencies.languages, (choice.selection?.languageChoices ?? []).filter((x) => x !== 'choice'));
}

export function applyAdvancementChoices(baseCharacter: Character, choices: AdvancementChoice[]): Character {
  const character: Character = structuredClone(baseCharacter);
  const conModBefore = character.abilities.modifiers.con;
  let initiativeBonus = 0;
  let speedBonus = 0;
  let hpPerLevelBonus = 0;

  for (const choice of choices) {
    if (choice.type === 'asi') {
      for (const increase of choice.increases) {
        applyAbilityIncrease(character, increase.ability, increase.amount);
      }
      continue;
    }

    const feat = featById.get(choice.featId);
    if (!feat) continue;
    applyFeatEffects(character, choice, feat);
    initiativeBonus += feat.effects?.initiativeBonus ?? 0;
    speedBonus += feat.effects?.speedBonus ?? 0;
    hpPerLevelBonus += feat.effects?.hpPerLevelBonus ?? 0;
  if (feat.effects?.saveProficiencyChoice) {
      const rawSaveChoices = choice.selection?.saveChoices ?? [];
      const effectiveSaveChoices =
        choice.featId === 'resilient' && rawSaveChoices.length === 0 && (choice.selection?.abilityChoices?.length ?? 0) === 1
          ? choice.selection?.abilityChoices ?? []
          : rawSaveChoices;
      for (const save of effectiveSaveChoices) {
        character.proficiencies.savingThrows[save] = true;
      }
    }
  }

  recomputeDerived(character, conModBefore, initiativeBonus, speedBonus, hpPerLevelBonus);
  return character;
}
