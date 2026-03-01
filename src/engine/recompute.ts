import { generateCharacter } from './generator';
import type { Character } from '../types/character';

export function recalculateCharacter(character: Character): Character {
  return generateCharacter({
    mode: character.build.mode,
    level: character.identity.level,
    classId: character.identity.classId,
    raceId: character.identity.raceId,
    tags: character.build.flavorTags,
    combatRole: character.build.combatRole as 'damage' | 'tank' | 'support' | 'control' | undefined,
    tone: character.build.tone as 'heroic' | 'dark' | 'comic' | 'gritty' | undefined,
    seed: character.meta.seed,
    lockedCharacter: character,
    locks: {
      class: true,
      race: true,
      background: true,
      name: true,
      spells: true,
      equipment: true,
      backstory: true,
    },
  });
}
