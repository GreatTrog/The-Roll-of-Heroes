import type { Character } from '../../types/character';
import { skillKeys } from '../../types/character';
import { skillModifier } from '../../engine/generator';
import { equipmentById } from '../../data/rules';

function displayEquipmentName(id: string): string {
  return equipmentById.get(id)?.name ?? id.replaceAll('_', ' ');
}

export function SheetTab({ character }: { character: Character }) {
  const proficiencyBonus = character.combat.proficiencyBonus;
  const packItems = character.equipment.items
    .map((id) => equipmentById.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item && item.contains && item.contains.length > 0));

  return (
    <div className="panel sheet-panel">
      <header className="sheet-header">
        <h3>Character Sheet</h3>
        <p>
          {character.identity.name} - Level {character.identity.level} {character.identity.raceId} {character.identity.classId}
        </p>
      </header>

      <div className="sheet-quickstats">
        <div className="quickstat"><span>PB</span><strong>+{character.combat.proficiencyBonus}</strong></div>
        <div className="quickstat"><span>AC</span><strong>{character.combat.ac}</strong></div>
        <div className="quickstat"><span>HP</span><strong>{character.combat.currentHp}/{character.combat.hpMax}</strong></div>
        <div className="quickstat"><span>Init</span><strong>{character.combat.initiative >= 0 ? '+' : ''}{character.combat.initiative}</strong></div>
        <div className="quickstat"><span>Speed</span><strong>{character.combat.speed}</strong></div>
        <div className="quickstat"><span>Hit Dice</span><strong>{character.identity.level}{character.combat.hitDie}</strong></div>
      </div>

      <div className="sheet-layout">
        <section className="sheet-section skills-panel">
          <h4>Skills</h4>
          <div className="skill-list">
            {skillKeys.map((skill) => (
              <p key={skill} className="row-line">
                <span>{skill.replaceAll('_', ' ')}</span>
                <span>
                  <span className={character.proficiencies.skills[skill] ? 'badge badge-on' : 'badge'}>
                    {character.proficiencies.skills[skill] ? 'Prof' : 'Norm'}
                  </span>{' '}
                  {skillModifier(character, skill) >= 0 ? '+' : ''}
                  {skillModifier(character, skill)}
                </span>
              </p>
            ))}
          </div>
        </section>

        <section className="sheet-section saves-panel">
          <h4>Saving Throws</h4>
          {Object.entries(character.proficiencies.savingThrows).map(([k, proficient]) => {
            const ability = k as keyof typeof character.abilities.modifiers;
            const base = character.abilities.modifiers[ability];
            const saveValue = base + (proficient ? proficiencyBonus : 0);
            return (
              <p key={k} className="row-line">
                <span>{k.toUpperCase()}</span>
                <span>
                  <span className={proficient ? 'badge badge-on' : 'badge'}>{proficient ? 'Proficient' : 'Normal'}</span>{' '}
                  {saveValue >= 0 ? '+' : ''}{saveValue}
                </span>
              </p>
            );
          })}
        </section>

        <section className="sheet-section abilities-panel">
          <h4>Abilities</h4>
          <div className="ability-grid">
            {Object.entries(character.abilities.scores).map(([k, v]) => (
              <div key={k} className="ability-card">
                <span className="ability-label">{k.toUpperCase()}</span>
                <strong>{v}</strong>
                <span>
                  {character.abilities.modifiers[k as keyof typeof character.abilities.modifiers] >= 0 ? '+' : ''}
                  {character.abilities.modifiers[k as keyof typeof character.abilities.modifiers]}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="sheet-section attacks-panel">
          <h4>Attacks</h4>
          {character.combat.attacks.map((a) => (
            <p key={a.id} className="row-line">
              <span>{a.name}</span>
              <span>+{a.toHit} to hit - {a.damage}</span>
            </p>
          ))}
        </section>

        <section className="sheet-section equipment-panel">
          <h4>Equipment</h4>
          <p>
            Armor: {character.equipment.armorId ? displayEquipmentName(character.equipment.armorId) : 'none'}{' '}
            {character.equipment.shield ? '+ shield' : ''}
          </p>
          <p>
            Weapons: {character.equipment.weaponIds.length > 0 ? character.equipment.weaponIds.map(displayEquipmentName).join(', ') : 'none'}
          </p>
          <p>
            Other: {character.equipment.items.length > 0 ? character.equipment.items.map(displayEquipmentName).join(', ') : 'none'}
          </p>
          {packItems.length > 0 ? (
            <div>
              <p><strong>Item Contents</strong></p>
              <div className={packItems.length > 1 ? 'pack-columns' : 'pack-single'}>
                {packItems.map((pack) => (
                  <div key={pack.id} className="pack-column">
                    <p><strong>{pack.name}</strong></p>
                    <ul>
                      {pack.contains?.map((entry) => (
                        <li key={`${pack.id}:${entry}`}>{entry}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="sheet-section features-panel">
          <h4>Features</h4>
          <ul>
            {character.features.map((f, i) => (
              <li key={`${f.id}:${i}`}>
                L{f.level} {f.name}: {f.summary}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
