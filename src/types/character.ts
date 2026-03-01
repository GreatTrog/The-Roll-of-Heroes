import { z } from 'zod';

export const abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type AbilityKey = (typeof abilityKeys)[number];

export const skillKeys = [
  'acrobatics',
  'animal_handling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleight_of_hand',
  'stealth',
  'survival',
] as const;
export type SkillKey = (typeof skillKeys)[number];

export const skillAbilityMap: Record<SkillKey, AbilityKey> = {
  acrobatics: 'dex',
  animal_handling: 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  sleight_of_hand: 'dex',
  stealth: 'dex',
  survival: 'wis',
};

export const spellSlotsSchema = z.object({
  level1: z.number().int().nonnegative(),
  level2: z.number().int().nonnegative(),
  level3: z.number().int().nonnegative(),
  level4: z.number().int().nonnegative(),
  level5: z.number().int().nonnegative(),
  level6: z.number().int().nonnegative(),
  level7: z.number().int().nonnegative(),
  level8: z.number().int().nonnegative(),
  level9: z.number().int().nonnegative(),
});

const abilityScoresSchema = z.object({
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
});

const abilityModifiersSchema = z.object({
  str: z.number().int(),
  dex: z.number().int(),
  con: z.number().int(),
  int: z.number().int(),
  wis: z.number().int(),
  cha: z.number().int(),
});

const proficiencyMapSchema = z.record(z.string(), z.boolean());

const attackSchema = z.object({
  id: z.string(),
  name: z.string(),
  toHit: z.number().int(),
  damage: z.string(),
  properties: z.array(z.string()),
});

const featureSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number().int().min(1).max(20),
  summary: z.string(),
});

const backstorySchema = z.object({
  origin: z.string(),
  definingMoments: z.array(z.string()).length(3),
  allies: z.array(z.string()).length(2),
  rival: z.string(),
  secret: z.string(),
  rumor: z.string(),
  roleplayPrompts: z.array(z.string()).min(2),
  questHook: z.string(),
});

const imageSchema = z.object({
  prompt: z.string(),
  negativePrompt: z.string(),
  seed: z.number().int(),
  stylePreset: z.string(),
  provider: z.string(),
  model: z.string(),
  url: z.string().optional(),
  thumbnail: z.string().optional(),
  createdAt: z.string(),
});

const abilityIncreaseSchema = z.object({
  ability: z.enum(abilityKeys),
  amount: z.number().int().min(1).max(2),
});

const featChoiceSelectionSchema = z.object({
  abilityChoices: z.array(z.enum(abilityKeys)).optional(),
  saveChoices: z.array(z.enum(abilityKeys)).optional(),
  skillChoices: z.array(z.string()).optional(),
  toolChoices: z.array(z.string()).optional(),
  weaponChoices: z.array(z.string()).optional(),
  languageChoices: z.array(z.string()).optional(),
});

const advancementChoiceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('asi'),
    increases: z.array(abilityIncreaseSchema).min(1).max(2),
  }),
  z.object({
    type: z.literal('feat'),
    featId: z.string(),
    selection: featChoiceSelectionSchema.optional(),
  }),
]);

const advancementEntrySchema = z.object({
  timestamp: z.string(),
  fromLevel: z.number().int().min(1).max(20),
  toLevel: z.number().int().min(1).max(20),
  hpMethod: z.enum(['average', 'roll', 'manual']),
  hpGain: z.number().int().nonnegative(),
  advancementChoice: advancementChoiceSchema.optional(),
  legacyAsiOrFeat: z.string().optional(),
  spellsChanged: z.array(z.string()),
  beforeSnapshot: z.string(),
  afterSnapshot: z.string(),
});

export const CharacterSchema = z.object({
  meta: z.object({
    id: z.string().uuid(),
    schemaVersion: z.number().int().positive(),
    createdAt: z.string(),
    updatedAt: z.string(),
    seed: z.string(),
    sectionSeeds: z.object({
      identitySeed: z.string(),
      abilitiesSeed: z.string(),
      equipmentSeed: z.string(),
      spellsSeed: z.string(),
      backstorySeed: z.string(),
      portraitSeed: z.string(),
    }),
  }),
  identity: z.object({
    name: z.string(),
    gender: z.enum(['male', 'female', 'other']).default('other'),
    classId: z.string(),
    subclassId: z.string().optional(),
    raceId: z.string(),
    subraceId: z.string().optional(),
    backgroundId: z.string(),
    level: z.number().int().min(1).max(20),
    alignment: z.string(),
    vibeTags: z.array(z.string()),
  }),
  build: z.object({
    mode: z.enum(['one_click', 'three_choices', 'guided']),
    combatRole: z.string().optional(),
    tone: z.string().optional(),
    flavorTags: z.array(z.string()),
  }),
  abilities: z.object({
    scores: abilityScoresSchema,
    modifiers: abilityModifiersSchema,
  }),
  combat: z.object({
    proficiencyBonus: z.number().int(),
    hpMax: z.number().int().positive(),
    currentHp: z.number().int().nonnegative(),
    hitDie: z.string(),
    ac: z.number().int().positive(),
    initiative: z.number().int(),
    speed: z.number().int().positive(),
    attacks: z.array(attackSchema),
  }),
  proficiencies: z.object({
    savingThrows: proficiencyMapSchema,
    skills: proficiencyMapSchema,
    armor: z.array(z.string()),
    weapons: z.array(z.string()),
    tools: z.array(z.string()),
    languages: z.array(z.string()),
  }),
  equipment: z.object({
    armorId: z.string().optional(),
    shield: z.boolean(),
    weaponIds: z.array(z.string()),
    items: z.array(z.string()),
  }),
  features: z.array(featureSchema),
  spellcasting: z.object({
    enabled: z.boolean(),
    castingAbility: z.string().optional(),
    saveDc: z.number().int().optional(),
    spellAttackBonus: z.number().int().optional(),
    slots: spellSlotsSchema,
    cantripsKnown: z.number().int().nonnegative(),
    knownType: z.enum(['none', 'known', 'prepared', 'spellbook']),
    spellsKnown: z.array(z.string()),
    spellsPrepared: z.array(z.string()),
  }),
  personality: z.object({
    traits: z.array(z.string()),
    ideals: z.array(z.string()),
    bonds: z.array(z.string()),
    flaws: z.array(z.string()),
  }),
  backstory: backstorySchema,
  image: imageSchema.optional(),
  advancement: z.object({
    hpMethodTracking: z.array(z.enum(['average', 'roll', 'manual'])),
    spellSelectionTracking: z.array(z.string()),
    asiFeatTracking: z.array(z.string()).optional(),
    choices: z.array(advancementChoiceSchema).default([]),
    history: z.array(advancementEntrySchema),
    multiclassPlan: z.array(z.string()),
  }),
});

export type Character = z.infer<typeof CharacterSchema>;
export type SpellSlots = z.infer<typeof spellSlotsSchema>;
export type AdvancementChoice = z.infer<typeof advancementChoiceSchema>;
export type FeatChoiceSelection = z.infer<typeof featChoiceSelectionSchema>;
