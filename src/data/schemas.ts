import { z } from 'zod';

export const classSchema = z.object({
  id: z.string(),
  name: z.string(),
  hitDie: z.number().int().positive(),
  primaryAbilities: z.array(z.string()).min(1),
  savingThrows: z.array(z.string()).length(2),
  armorProficiencies: z.array(z.string()),
  weaponProficiencies: z.array(z.string()),
  skillsChoose: z.number().int().nonnegative(),
  skills: z.array(z.string()),
  spellcasting: z.object({
    type: z.enum(['none', 'full', 'half', 'pact']),
    ability: z.string().optional(),
    knownType: z.enum(['known', 'prepared', 'spellbook']).optional(),
    cantripsKnownByLevel: z.array(z.number().int()).optional(),
    spellsKnownByLevel: z.array(z.number().int()).optional(),
  }),
  featuresByLevel: z.record(z.string(), z.array(z.string())),
});

export const subclassSchema = z.object({
  id: z.string(),
  classId: z.string(),
  name: z.string(),
  features: z.array(z.string()),
});

export const raceSchema = z.object({
  id: z.string(),
  name: z.string(),
  speed: z.number().int().positive(),
  abilityBonuses: z.record(z.string(), z.number().int()),
  languages: z.array(z.string()),
  traits: z.array(z.string()),
});

export const subraceSchema = z.object({
  id: z.string(),
  raceId: z.string(),
  name: z.string(),
  abilityBonuses: z.record(z.string(), z.number().int()),
  traits: z.array(z.string()),
});

export const backgroundSchema = z.object({
  id: z.string(),
  name: z.string(),
  skills: z.array(z.string()),
  toolProficiencies: z.array(z.string()),
  languages: z.array(z.string()),
  equipment: z.array(z.string()),
});

export const equipmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  category: z.string().optional(),
  damage: z.string().optional(),
  properties: z.array(z.string()).optional(),
  proficiency: z.string().optional(),
  armorType: z.string().optional(),
  acBase: z.number().optional(),
  dexCap: z.number().nullable().optional(),
  acBonus: z.number().optional(),
  contains: z.array(z.string()).optional(),
});

export const spellSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number().int().min(0).max(9),
  school: z.string(),
  classes: z.array(z.string()),
  summary: z.string(),
});

export const featureSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
});

export type ClassData = z.infer<typeof classSchema>;
export type SubclassData = z.infer<typeof subclassSchema>;
export type RaceData = z.infer<typeof raceSchema>;
export type SubraceData = z.infer<typeof subraceSchema>;
export type BackgroundData = z.infer<typeof backgroundSchema>;
export type EquipmentData = z.infer<typeof equipmentSchema>;
export type SpellData = z.infer<typeof spellSchema>;
export type FeatureData = z.infer<typeof featureSchema>;
