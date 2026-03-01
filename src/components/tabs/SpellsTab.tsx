import type { Character } from '../../types/character';
import { spells } from '../../data/rules';

const spellById = new Map(spells.map((s) => [s.id, s]));

function renderSpellLine(id: string): string {
  const spell = spellById.get(id);
  if (!spell) return `${id.replaceAll('_', ' ')} - No description available.`;
  return `${spell.name} (L${spell.level}, ${spell.school}) - ${spell.summary}`;
}

export function SpellsTab({ character }: { character: Character }) {
  const knownCantrips = character.spellcasting.spellsKnown.filter((id) => (spellById.get(id)?.level ?? 0) === 0);
  const knownLeveledSpells = character.spellcasting.spellsKnown.filter((id) => (spellById.get(id)?.level ?? 99) > 0);

  return (
    <div className="spells-layout">
      <div>
        <h3>Spells</h3>
        {!character.spellcasting.enabled ? (
          <p>This class does not have spellcasting.</p>
        ) : (
          <>
            <p>Casting Ability: {character.spellcasting.castingAbility?.toUpperCase()}</p>
            <p>Save DC: {character.spellcasting.saveDc} | Spell Attack Bonus: +{character.spellcasting.spellAttackBonus}</p>
            <p>
              Slots:{' '}
              {Object.entries(character.spellcasting.slots)
                .map(([key, value]) => `${key.replace('level', 'L')}:${value}`)
                .join(' ')}
            </p>
            <p>Cantrips Known: {character.spellcasting.cantripsKnown} | Levelled Spells Known: {knownLeveledSpells.length}</p>
            <h4>Cantrips</h4>
            <ul>
              {knownCantrips.length
                ? knownCantrips.map((id) => (
                  <li key={id}>{renderSpellLine(id)}</li>
                ))
                : <li>n/a</li>}
            </ul>
            <h4>Known Spells</h4>
            <ul>
              {knownLeveledSpells.length
                ? knownLeveledSpells.map((id) => (
                <li key={id}>{renderSpellLine(id)}</li>
                ))
                : <li>n/a</li>}
            </ul>
            <h4>Prepared</h4>
            <ul>
              {character.spellcasting.spellsPrepared.length
                ? character.spellcasting.spellsPrepared.map((id) => <li key={id}>{renderSpellLine(id)}</li>)
                : <li>n/a</li>}
            </ul>
          </>
        )}
      </div>
      <aside className="spells-illustration-wrap" aria-hidden="true">
        <img className="spells-illustration" src="/images/spell-scroll.png" alt="" />
      </aside>
    </div>
  );
}
