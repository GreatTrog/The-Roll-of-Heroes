import Dexie, { type EntityTable } from 'dexie';
import type { Character } from '../types/character';

export type StoredCharacter = {
  id: string;
  name: string;
  classId: string;
  raceId: string;
  level: number;
  updatedAt: string;
  portraitThumbnail?: string;
  character: Character;
};

export class CharacterDb extends Dexie {
  characters!: EntityTable<StoredCharacter, 'id'>;

  constructor() {
    super('dnd-character-builder-db');
    this.version(1).stores({
      characters: 'id, name, classId, raceId, level, updatedAt',
    });
  }
}

export const db = new CharacterDb();

export const CharacterRepository = {
  async upsert(character: Character): Promise<void> {
    await db.characters.put({
      id: character.meta.id,
      name: character.identity.name,
      classId: character.identity.classId,
      raceId: character.identity.raceId,
      level: character.identity.level,
      updatedAt: character.meta.updatedAt,
      portraitThumbnail: character.image?.thumbnail,
      character,
    });
  },

  async get(id: string): Promise<Character | undefined> {
    return (await db.characters.get(id))?.character;
  },

  async list(search: string, sort: 'updatedAt' | 'name' | 'level'): Promise<StoredCharacter[]> {
    const all = await db.characters.toArray();
    const filtered = all.filter((item) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return [item.name, item.classId, item.raceId].some((x) => x.toLowerCase().includes(term));
    });

    return filtered.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'level') return b.level - a.level;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  },

  async delete(id: string): Promise<void> {
    await db.characters.delete(id);
  },

  async duplicate(id: string): Promise<Character | undefined> {
    const original = await this.get(id);
    if (!original) return undefined;

    const duplicate: Character = {
      ...original,
      meta: {
        ...original.meta,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      identity: {
        ...original.identity,
        name: `${original.identity.name} Copy`,
      },
    };

    await this.upsert(duplicate);
    return duplicate;
  },
};
