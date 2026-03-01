import { CharacterSchema, type Character } from '../types/character';

export function migrateCharacterJson(raw: unknown): Character {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Import payload must be an object.');
  }

  const maybeVersion = (raw as { meta?: { schemaVersion?: number } }).meta?.schemaVersion ?? 0;

  if (maybeVersion === 2) {
    return CharacterSchema.parse(raw);
  }

  if (maybeVersion === 1 || maybeVersion === 0) {
    const legacy = raw as Record<string, unknown>;
    const legacyAdvancement = (legacy.advancement as Record<string, unknown> | undefined) ?? {};
    const legacyTracking = Array.isArray(legacyAdvancement.asiFeatTracking)
      ? legacyAdvancement.asiFeatTracking as string[]
      : [];
    const legacyHistory = Array.isArray(legacyAdvancement.history)
      ? legacyAdvancement.history as Array<Record<string, unknown>>
      : [];

    const migratedHistory = legacyHistory.map((entry) => {
      const legacyAsiOrFeat =
        typeof entry.asiOrFeat === 'string'
          ? entry.asiOrFeat
          : typeof entry.legacyAsiOrFeat === 'string'
            ? entry.legacyAsiOrFeat
            : undefined;
      return {
        ...entry,
        legacyAsiOrFeat,
      };
    });

    const patched = {
      ...legacy,
      meta: {
        ...((legacy.meta as Record<string, unknown> | undefined) ?? {}),
        schemaVersion: 2,
      },
      advancement: {
        ...legacyAdvancement,
        hpMethodTracking: ['average'],
        spellSelectionTracking: [],
        asiFeatTracking: legacyTracking,
        choices: [],
        history: migratedHistory,
        multiclassPlan: [],
      },
    };

    return CharacterSchema.parse(patched);
  }

  throw new Error(`Unsupported schemaVersion ${String(maybeVersion)}.`);
}
