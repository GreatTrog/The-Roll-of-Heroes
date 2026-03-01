import { classById, equipmentById } from '../data/rules';
import type { Character } from '../types/character';
import { proficiencyBonusForLevel, spellSlotsFor } from './calculators';

export type InvariantIssue = { code: string; message: string };

export function validateCharacterInvariants(character: Character): InvariantIssue[] {
  const issues: InvariantIssue[] = [];
  const level = character.identity.level;

  const expectedPb = proficiencyBonusForLevel(level);
  if (character.combat.proficiencyBonus !== expectedPb) {
    issues.push({ code: 'PROFICIENCY_BONUS', message: `Expected proficiency ${expectedPb}, got ${character.combat.proficiencyBonus}` });
  }

  const classDef = classById.get(character.identity.classId);
  if (!classDef) {
    issues.push({ code: 'CLASS', message: `Unknown class ${character.identity.classId}` });
    return issues;
  }

  const expectedHd = `d${classDef.hitDie}`;
  if (character.combat.hitDie !== expectedHd) {
    issues.push({ code: 'HIT_DIE', message: `Expected hit die ${expectedHd}, got ${character.combat.hitDie}` });
  }

  const conMod = character.abilities.modifiers.con;
  const minHp = classDef.hitDie + conMod + (level - 1);
  if (character.combat.hpMax < minHp) {
    issues.push({ code: 'HP', message: `HP ${character.combat.hpMax} is below minimum ${minHp}` });
  }

  const uniqueSkills = new Set(Object.keys(character.proficiencies.skills).filter((k) => character.proficiencies.skills[k]));
  const skilledCount = Object.values(character.proficiencies.skills).filter(Boolean).length;
  if (uniqueSkills.size !== skilledCount) {
    issues.push({ code: 'SKILL_STACKING', message: 'Duplicate skill proficiency stacking detected.' });
  }

  const expectedSlots = spellSlotsFor(classDef.spellcasting.type, level);
  const slotMismatch = Object.entries(expectedSlots).some(([k, v]) => character.spellcasting.slots[k as keyof typeof expectedSlots] !== v);
  if (slotMismatch) {
    issues.push({ code: 'SPELL_SLOTS', message: 'Spell slot progression does not match class level.' });
  }

  for (const weaponId of character.equipment.weaponIds) {
    const weapon = equipmentById.get(weaponId);
    if (!weapon || weapon.type !== 'weapon') continue;
    const prof = weapon.proficiency;
    if (prof && !character.proficiencies.weapons.includes(prof) && !character.proficiencies.weapons.includes(weapon.id)) {
      issues.push({ code: 'WEAPON_PROFICIENCY', message: `Weapon ${weapon.name} is not compatible with proficiencies.` });
    }
  }

  if (character.equipment.armorId) {
    const armor = equipmentById.get(character.equipment.armorId);
    if (armor && armor.proficiency && !character.proficiencies.armor.includes(armor.proficiency) && !character.proficiencies.armor.includes('all_armor')) {
      issues.push({ code: 'ARMOR_PROFICIENCY', message: `Armor ${armor.name} is not compatible with proficiencies.` });
    }
  }

  return issues;
}
