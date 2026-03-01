import { equipment, equipmentById } from '../data/rules';
import type { Character } from '../types/character';
import { toHitFromAbility } from './calculators';

export const MAX_LOADOUT_WEAPONS = 4;

export type WeaponOption = {
  id: string;
  name: string;
};

function isDexWeapon(weaponId: string): boolean {
  const weapon = equipmentById.get(weaponId);
  if (!weapon || weapon.type !== 'weapon') return false;
  const category = weapon.category ?? '';
  const properties = weapon.properties ?? [];
  return category.includes('ranged') || properties.includes('finesse');
}

function attackDamageString(weaponId: string, abilityMod: number): string {
  const weapon = equipmentById.get(weaponId);
  if (!weapon || weapon.type !== 'weapon' || !weapon.damage) {
    return `1d8 + ${abilityMod} slashing`;
  }
  if (weapon.damage === 'special') return 'special';
  return `${weapon.damage} + ${abilityMod}`;
}

export function hasWeaponProficiency(character: Character, weaponId: string): boolean {
  const weapon = equipmentById.get(weaponId);
  if (!weapon || weapon.type !== 'weapon') return false;
  return Boolean(
    character.proficiencies.weapons.includes(weaponId) ||
    (weapon.proficiency && character.proficiencies.weapons.includes(weapon.proficiency)),
  );
}

export function getEligibleWeaponOptions(character: Character): WeaponOption[] {
  return equipment
    .filter((item) => item.type === 'weapon')
    .filter((item) => hasWeaponProficiency(character, item.id))
    .map((item) => ({ id: item.id, name: item.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function recomputeAttacksForCharacter(character: Character): Character['combat']['attacks'] {
  const pb = character.combat.proficiencyBonus;
  return character.equipment.weaponIds.map((weaponId) => {
    const dexWeapon = isDexWeapon(weaponId);
    const abilityMod = dexWeapon ? character.abilities.modifiers.dex : character.abilities.modifiers.str;
    const proficient = hasWeaponProficiency(character, weaponId);
    const weapon = equipmentById.get(weaponId);
    return {
      id: weaponId,
      name: weapon?.name ?? weaponId.replaceAll('_', ' '),
      toHit: toHitFromAbility(abilityMod, pb, proficient),
      damage: attackDamageString(weaponId, abilityMod),
      properties: weapon?.properties ?? (dexWeapon ? ['finesse/ranged'] : ['melee']),
    };
  });
}
