import { describe, expect, it } from 'vitest';
import { generateCharacter } from '../engine/generator';
import { migrateCharacterJson } from '../engine/migrations';

describe('migrations', () => {
  it('migrates schemaVersion 1 payloads into schemaVersion 2 advancement shape', () => {
    const current = generateCharacter({
      mode: 'guided',
      level: 2,
      classId: 'fighter',
      raceId: 'human',
      gender: 'male',
      seed: 'migration-v1',
    });

    const legacy = {
      ...current,
      meta: { ...current.meta, schemaVersion: 1 },
      advancement: {
        ...current.advancement,
        asiFeatTracking: ['+2 STR'],
        history: [
          {
            timestamp: new Date().toISOString(),
            fromLevel: 1,
            toLevel: 2,
            hpMethod: 'average' as const,
            hpGain: 8,
            asiOrFeat: '+2 STR',
            spellsChanged: [],
            beforeSnapshot: '{}',
            afterSnapshot: '{}',
          },
        ],
      },
    };

    const migrated = migrateCharacterJson(legacy);
    expect(migrated.meta.schemaVersion).toBe(2);
    expect(migrated.advancement.choices).toEqual([]);
    expect(migrated.advancement.history[0]?.legacyAsiOrFeat).toBe('+2 STR');
  });
});
