import { CharacterSchema, type Character } from '../types/character';

export function migrateCharacterJson(raw: unknown): Character {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Import payload must be an object.');
  }

  const maybeVersion = (raw as { meta?: { schemaVersion?: number } }).meta?.schemaVersion ?? 0;

  if (maybeVersion === 1) {
    return CharacterSchema.parse(raw);
  }

  if (maybeVersion === 0) {
    const legacy = raw as Record<string, unknown>;
    const patched = {
      ...legacy,
      meta: {
        ...((legacy.meta as Record<string, unknown> | undefined) ?? {}),
        schemaVersion: 1,
      },
      advancement: {
        hpMethodTracking: ['average'],
        spellSelectionTracking: [],
        asiFeatTracking: [],
        history: [],
        multiclassPlan: [],
        ...((legacy.advancement as Record<string, unknown> | undefined) ?? {}),
      },
    };

    return CharacterSchema.parse(patched);
  }

  throw new Error(`Unsupported schemaVersion ${String(maybeVersion)}.`);
}
