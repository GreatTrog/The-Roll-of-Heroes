import { useState } from 'react';
import { equipmentById } from '../data/rules';
import { MAX_LOADOUT_WEAPONS } from '../engine/weapons';
import { useAppStore } from '../store/useAppStore';

function displayEquipmentName(id: string): string {
  return equipmentById.get(id)?.name ?? id.replaceAll('_', ' ');
}

export function WeaponLoadoutPanel() {
  const character = useAppStore((s) => s.character);
  const getAvailableWeaponOptions = useAppStore((s) => s.getAvailableWeaponOptions);
  const addWeaponToLoadout = useAppStore((s) => s.addWeaponToLoadout);
  const removeWeaponFromLoadout = useAppStore((s) => s.removeWeaponFromLoadout);
  const moveWeaponInLoadout = useAppStore((s) => s.moveWeaponInLoadout);
  const [newWeaponId, setNewWeaponId] = useState('');

  if (!character) return null;

  const availableWeaponOptions = getAvailableWeaponOptions();
  const addableWeaponOptions = availableWeaponOptions.filter(
    (option) => !character.equipment.weaponIds.includes(option.id),
  );
  const selectedNewWeaponId =
    addableWeaponOptions.length === 0
      ? ''
      : newWeaponId && addableWeaponOptions.some((option) => option.id === newWeaponId)
        ? newWeaponId
        : addableWeaponOptions[0]!.id;

  return (
    <>
      <p className="tiny">Manage up to {MAX_LOADOUT_WEAPONS} equipped weapons. Attacks update automatically.</p>
      <div className="controls">
        <label>
          Add Weapon
          <select value={selectedNewWeaponId} onChange={(e) => setNewWeaponId(e.target.value)} disabled={addableWeaponOptions.length === 0}>
            {addableWeaponOptions.length === 0 ? (
              <option value="">No additional proficient weapons</option>
            ) : (
              addableWeaponOptions.map((option) => (
                <option key={`add-weapon:${option.id}`} value={option.id}>{option.name}</option>
              ))
            )}
          </select>
        </label>
        <button
          type="button"
          onClick={() => selectedNewWeaponId && addWeaponToLoadout(selectedNewWeaponId)}
          disabled={!selectedNewWeaponId || addableWeaponOptions.length === 0}
        >
          Add Weapon
        </button>
      </div>
      <div className="saved-list">
        {character.equipment.weaponIds.length === 0 ? (
          <p>No weapons in loadout.</p>
        ) : (
          character.equipment.weaponIds.map((weaponId, index) => (
            <article key={`loadout:${weaponId}:${index}`} className="saved-item">
              <div>
                <strong>{displayEquipmentName(weaponId)}</strong>
                {character.combat.attacks[index] ? (
                  <p>+{character.combat.attacks[index].toHit} to hit - {character.combat.attacks[index].damage}</p>
                ) : null}
              </div>
              <div className="controls">
                <button type="button" onClick={() => moveWeaponInLoadout(index, index - 1)} disabled={index === 0}>Up</button>
                <button type="button" onClick={() => moveWeaponInLoadout(index, index + 1)} disabled={index === character.equipment.weaponIds.length - 1}>
                  Down
                </button>
                <button type="button" onClick={() => removeWeaponFromLoadout(weaponId)}>Remove</button>
              </div>
            </article>
          ))
        )}
      </div>
    </>
  );
}
