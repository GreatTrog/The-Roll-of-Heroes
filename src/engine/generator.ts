import { v4 as uuid } from 'uuid';
import { backgrounds, classById, classes, equipment, featureById, raceById, races, spellsByClassId, subclassesByClassId } from '../data/rules';
import type { ClassData } from '../data/schemas';
import { abilityKeys, CharacterSchema, skillAbilityMap, type AbilityKey, type Character, type SkillKey } from '../types/character';
import { generateName } from '../utils/names';
import { buildRng, pickMany, pickOne } from '../utils/random';
import { calculateModifier, calculateSaveDc, defaultAbilityOrder, proficiencyBonusForLevel, spellSlotsFor, toHitFromAbility } from './calculators';
import { validateCharacterInvariants } from './invariants';

export type GenerationMode = 'one_click' | 'three_choices' | 'guided';

export type GenerationInput = {
  mode: GenerationMode;
  level: number;
  classId?: string;
  raceId?: string;
  gender?: 'male' | 'female' | 'other';
  tags?: string[];
  combatRole?: 'damage' | 'tank' | 'support' | 'control';
  tone?: 'heroic' | 'dark' | 'comic' | 'gritty';
  seed?: string;
  lockedCharacter?: Character;
  locks?: Partial<Record<'class' | 'race' | 'background' | 'name' | 'spells' | 'equipment' | 'backstory', boolean>>;
};

const personalityPool = {
  traits: ['curious', 'stoic', 'bold', 'merciful', 'cynical', 'earnest'],
  ideals: ['justice', 'freedom', 'knowledge', 'power', 'honor', 'community'],
  bonds: ['family oath', 'lost mentor', 'sacred relic', 'old regiment', 'town guardian'],
  flaws: ['reckless', 'prideful', 'secretive', 'vengeful', 'naive'],
};

function assignAbilityScores(classDef: ClassData, seed: string, raceId: string): Record<AbilityKey, number> {
  const rng = buildRng(seed);
  const array = [15, 14, 13, 12, 10, 8];
  const order = defaultAbilityOrder(classDef.primaryAbilities as AbilityKey[]);
  const scores = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };

  for (let i = 0; i < order.length; i += 1) {
    const key = order[i]!;
    scores[key] = array[i]!;
  }

  const race = raceById.get(raceId);
  if (race) {
    for (const [ability, bonus] of Object.entries(race.abilityBonuses)) {
      if (ability === 'all') {
        for (const key of abilityKeys) scores[key] += bonus;
      } else if (ability === 'choice2') {
        const picks = pickMany(rng, [...abilityKeys], 2);
        picks.forEach((p) => {
          scores[p] += bonus;
        });
      } else if (ability in scores) {
        const key = ability as AbilityKey;
        scores[key] += bonus;
      }
    }
  }

  return scores;
}

function pickClass(input: GenerationInput, rngSeed: string): string {
  if (input.classId) return input.classId;
  const rng = buildRng(rngSeed);
  if (input.mode === 'three_choices' && input.combatRole) {
    const roleMap: Record<string, string[]> = {
      damage: ['fighter', 'rogue', 'sorcerer', 'wizard', 'warlock'],
      tank: ['barbarian', 'fighter', 'paladin'],
      support: ['bard', 'cleric', 'druid'],
      control: ['wizard', 'druid', 'bard', 'warlock'],
    };
    return pickOne(rng, roleMap[input.combatRole] ?? classes.map((x) => x.id));
  }
  return pickOne(rng, classes).id;
}

function pickRace(input: GenerationInput, rngSeed: string): string {
  if (input.raceId) return input.raceId;
  const rng = buildRng(rngSeed);
  return pickOne(rng, races).id;
}

function getHitPointGain(classDef: ClassData, conMod: number, level: number): number {
  if (level === 1) return classDef.hitDie + conMod;
  return Math.max(1, Math.floor(classDef.hitDie / 2) + 1 + conMod);
}

function buildBackstory(seed: string, identity: Character['identity']): Character['backstory'] {
  const rng = buildRng(seed);
  const locales = ['ruined keep', 'river village', 'border city', 'monastery archive', 'storm coast', 'desert caravan'];
  const events = ['survived a siege', 'solved a cursed relic mystery', 'broke a tyrant oath', 'saved a caravan', 'failed an important vow', 'won a duel'];
  const allyTypes = ['retired scout', 'wandering priest', 'guild artisan', 'arcane tutor', 'ex-mercenary', 'court messenger'];
  const secrets = ['is heir to a minor title', 'owes a favor to a hidden cult', 'carried forbidden notes for years', 'once served the rival unknowingly'];
  const rumors = ['struck a pact under a blood moon', 'cannot be harmed by steel', 'knows where a lost vault lies'];

  return {
    origin: `${identity.name} began in a ${pickOne(rng, locales)} and took up the path of a ${identity.classId} after a formative loss tied to their ${identity.backgroundId} years.`,
    definingMoments: pickMany(rng, events, 3),
    allies: [
      `${pickOne(rng, allyTypes)} named Kael`,
      `${pickOne(rng, allyTypes)} named Mira`,
    ],
    rival: `Captain Varric, who opposes ${identity.name}'s goals at every turn.`,
    secret: pickOne(rng, secrets),
    rumor: pickOne(rng, rumors),
    roleplayPrompts: [
      'What would make this character break a personal oath?',
      'Who from their past could appear at the worst possible time?',
      'When does duty conflict with compassion for this character?',
    ],
    questHook: `A lead points ${identity.name} toward a conspiracy linked to their ${identity.backgroundId} origins.`,
  };
}

function sanitizeSpells(classDef: ClassData, level: number, knownType: Character['spellcasting']['knownType'], seed: string): { known: string[]; prepared: string[]; cantripsKnown: number } {
  const classSpells = spellsByClassId.get(classDef.id) ?? [];
  const rng = buildRng(seed);
  const cantrips = classSpells.filter((s) => s.level === 0);
  const leveled = classSpells.filter((s) => s.level > 0 && s.level <= Math.ceil(level / 2));

  const cantripsKnownByLevel = classDef.spellcasting.cantripsKnownByLevel?.[level - 1];
  const cantripsKnown = Math.min(cantripsKnownByLevel ?? 0, cantrips.length);
  const cantripPick = pickMany(rng, cantrips.map((s) => s.id), cantripsKnown);
  const knownByLevel = classDef.spellcasting.spellsKnownByLevel?.[level - 1];
  const fallbackKnownCount = Math.max(2, level + 1);
  const knownCount = Math.min(knownByLevel ?? fallbackKnownCount, leveled.length);
  const known = pickMany(rng, leveled.map((s) => s.id), knownCount);

  if (knownType === 'prepared') {
    return { known: [...cantripPick, ...known], prepared: known.slice(0, Math.max(1, Math.floor(level / 2))), cantripsKnown: cantripsKnown };
  }

  return { known: [...cantripPick, ...known], prepared: [], cantripsKnown: cantripsKnown };
}

function pickEquipment(classDef: ClassData, input: GenerationInput, seed: string): Character['equipment'] {
  const rng = buildRng(seed);
  const defaultArmor = classDef.armorProficiencies.includes('all_armor') ? 'chain_mail' : classDef.armorProficiencies.includes('medium') ? 'chain_shirt' : classDef.armorProficiencies.includes('light') ? 'leather' : undefined;

  const classPackOptions: Record<string, string[]> = {
    barbarian: ['explorers_pack'],
    bard: ['diplomats_pack', 'entertainers_pack'],
    cleric: ['priests_pack', 'explorers_pack'],
    druid: ['explorers_pack'],
    fighter: ['dungeoneers_pack', 'explorers_pack'],
    monk: ['dungeoneers_pack', 'explorers_pack'],
    paladin: ['priests_pack', 'explorers_pack'],
    ranger: ['dungeoneers_pack', 'explorers_pack'],
    rogue: ['burglars_pack', 'dungeoneers_pack', 'explorers_pack'],
    sorcerer: ['dungeoneers_pack', 'explorers_pack'],
    warlock: ['scholars_pack', 'dungeoneers_pack'],
    wizard: ['scholars_pack', 'explorers_pack'],
  };

  const classFocusOptions: Record<string, string[]> = {
    bard: ['musical_instrument'],
    cleric: ['holy_symbol'],
    druid: ['druidic_focus'],
    paladin: ['holy_symbol'],
    sorcerer: ['arcane_focus', 'component_pouch'],
    warlock: ['arcane_focus', 'component_pouch'],
    wizard: ['arcane_focus', 'component_pouch'],
  };

  const weightedPick = (options: string[], weights: Record<string, number>): string => {
    if (options.length === 1) return options[0]!;
    const total = options.reduce((sum, option) => sum + Math.max(0.01, weights[option] ?? 1), 0);
    let roll = rng() * total;
    for (const option of options) {
      roll -= Math.max(0.01, weights[option] ?? 1);
      if (roll <= 0) return option;
    }
    return options[options.length - 1]!;
  };

  const buildPackWeights = (packPool: string[]): Record<string, number> => {
    const weights = Object.fromEntries(packPool.map((pack) => [pack, 1])) as Record<string, number>;
    const tags = (input.tags ?? []).map((tag) => tag.toLowerCase().trim());
    const tagText = tags.join(' ');
    const role = input.combatRole ?? '';

    const boost = (packId: string, amount: number) => {
      if (weights[packId] !== undefined) weights[packId] += amount;
    };

    if (/social|court|urban|noble|diplomat|merchant/.test(tagText)) {
      boost('diplomats_pack', 2);
      boost('scholars_pack', 1);
    }
    if (/stealth|criminal|heist|shadow|thief|rogue/.test(tagText)) {
      boost('burglars_pack', 2);
    }
    if (/faith|holy|divine|temple|church|saint/.test(tagText)) {
      boost('priests_pack', 2);
    }
    if (/arcane|scholar|library|wizard|study|tome/.test(tagText)) {
      boost('scholars_pack', 2);
    }
    if (/wild|nature|forest|ranger|hunter|survival|gritty|ruin|dungeon|cave/.test(tagText)) {
      boost('explorers_pack', 1.5);
      boost('dungeoneers_pack', 1.5);
    }
    if (/comic|perform|music|bard|show/.test(tagText)) {
      boost('entertainers_pack', 2);
    }

    if (role === 'tank' || role === 'damage') {
      boost('dungeoneers_pack', 1.2);
      boost('explorers_pack', 1.2);
    }
    if (role === 'support') {
      boost('priests_pack', 1.2);
      boost('diplomats_pack', 1.2);
    }
    if (role === 'control') {
      boost('scholars_pack', 1.2);
    }

    return weights;
  };

  const compatibleWeapons = equipment
    .filter((item) => item.type === 'weapon')
    .filter((weapon) => {
      const proficiency = weapon.proficiency;
      return Boolean(
        proficiency &&
        (classDef.weaponProficiencies.includes(proficiency) || classDef.weaponProficiencies.includes(weapon.id)),
      );
    })
    .map((weapon) => weapon.id);

  const classPreferredWeapons: Record<string, string[]> = {
    barbarian: ['greataxe', 'greatsword', 'maul', 'battleaxe', 'warhammer', 'javelin', 'spear', 'handaxe'],
    bard: ['rapier', 'shortsword', 'longsword', 'hand_crossbow', 'light_crossbow', 'dagger'],
    cleric: ['mace', 'warhammer', 'spear', 'light_crossbow'],
    druid: ['scimitar', 'quarterstaff', 'spear', 'sling', 'dagger'],
    fighter: ['longsword', 'greatsword', 'greataxe', 'maul', 'halberd', 'warhammer', 'longbow', 'heavy_crossbow'],
    monk: ['shortsword', 'quarterstaff', 'spear', 'dagger'],
    paladin: ['longsword', 'warhammer', 'battleaxe', 'greatsword', 'maul', 'javelin'],
    ranger: ['longbow', 'shortbow', 'longsword', 'shortsword', 'scimitar', 'spear', 'handaxe'],
    rogue: ['rapier', 'shortsword', 'dagger', 'shortbow', 'hand_crossbow'],
    sorcerer: ['light_crossbow', 'quarterstaff', 'dagger', 'sling', 'dart'],
    warlock: ['light_crossbow', 'quarterstaff', 'dagger', 'spear'],
    wizard: ['light_crossbow', 'quarterstaff', 'dagger', 'sling', 'dart'],
  };

  const preferredPool = (classPreferredWeapons[classDef.id] ?? []).filter((weaponId) => compatibleWeapons.includes(weaponId));
  const weaponPool = preferredPool.length > 0 ? preferredPool : compatibleWeapons;
  const packPool = classPackOptions[classDef.id] ?? ['explorers_pack'];
  const focusPool = classFocusOptions[classDef.id] ?? [];
  const pickedPack = weightedPick(packPool, buildPackWeights(packPool));
  const pickedFocus = focusPool.length > 0 ? pickOne(rng, focusPool) : undefined;
  const miscItems = [pickedPack, pickedFocus].filter((item): item is string => Boolean(item));

  return {
    armorId: defaultArmor,
    shield: classDef.armorProficiencies.includes('shield') && rng() > 0.5,
    weaponIds: weaponPool.length > 0 ? [pickOne(rng, weaponPool)] : ['dagger'],
    items: miscItems,
  };
}

function buildFeatures(classDef: ClassData, level: number): Character['features'] {
  const out: Character['features'] = [];
  for (let l = 1; l <= level; l += 1) {
    const ids = classDef.featuresByLevel[String(l)] ?? [];
    for (const id of ids) {
      const fromData = featureById.get(id);
      out.push({
        id,
        name: fromData?.name ?? id.replaceAll('_', ' '),
        summary: fromData?.summary ?? 'Class feature unlocked at this level.',
        level: l,
      });
    }
  }
  return out;
}

function computeSkills(classDef: ClassData, backgroundId: string, seed: string): Record<SkillKey, boolean> {
  const rng = buildRng(seed);
  const base: Record<SkillKey, boolean> = {
    acrobatics: false,
    animal_handling: false,
    arcana: false,
    athletics: false,
    deception: false,
    history: false,
    insight: false,
    intimidation: false,
    investigation: false,
    medicine: false,
    nature: false,
    perception: false,
    performance: false,
    persuasion: false,
    religion: false,
    sleight_of_hand: false,
    stealth: false,
    survival: false,
  };

  const selected = pickMany(rng, classDef.skills, classDef.skillsChoose);
  for (const skill of selected) {
    if (skill in base) base[skill as SkillKey] = true;
  }

  const bg = backgrounds.find((b) => b.id === backgroundId);
  for (const skill of bg?.skills ?? []) {
    if (skill in base) base[skill as SkillKey] = true;
  }

  return base;
}

function computeAttacks(character: Character): Character['combat']['attacks'] {
  const pb = character.combat.proficiencyBonus;
  return character.equipment.weaponIds.map((weaponId) => {
    const dexWeapon = weaponId.includes('bow') || weaponId === 'dagger' || weaponId === 'rapier';
    const abilityMod = dexWeapon ? character.abilities.modifiers.dex : character.abilities.modifiers.str;
    const proficient = true;
    return {
      id: weaponId,
      name: weaponId.replaceAll('_', ' '),
      toHit: toHitFromAbility(abilityMod, pb, proficient),
      damage: weaponId.includes('bow') ? `1d8 + ${abilityMod} piercing` : `1d8 + ${abilityMod} slashing`,
      properties: dexWeapon ? ['finesse/ranged'] : ['melee'],
    };
  });
}

function buildAlignment(seed: string): string {
  const rng = buildRng(seed);
  const alignments = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'];
  return pickOne(rng, alignments);
}

function makeSectionSeeds(seed: string): Character['meta']['sectionSeeds'] {
  return {
    identitySeed: `${seed}:identity`,
    abilitiesSeed: `${seed}:abilities`,
    equipmentSeed: `${seed}:equipment`,
    spellsSeed: `${seed}:spells`,
    backstorySeed: `${seed}:backstory`,
    portraitSeed: `${seed}:portrait`,
  };
}

function scoreToModifiers(scores: Record<AbilityKey, number>): Record<AbilityKey, number> {
  return {
    str: calculateModifier(scores.str),
    dex: calculateModifier(scores.dex),
    con: calculateModifier(scores.con),
    int: calculateModifier(scores.int),
    wis: calculateModifier(scores.wis),
    cha: calculateModifier(scores.cha),
  };
}

export function generateCharacter(input: GenerationInput): Character {
  const now = new Date().toISOString();
  const seed = input.seed ?? crypto.randomUUID();
  const locks = input.locks ?? {};
  const locked = input.lockedCharacter;

  const classId = locks.class && locked ? locked.identity.classId : pickClass(input, `${seed}:class`);
  const raceId = locks.race && locked ? locked.identity.raceId : pickRace(input, `${seed}:race`);
  const backgroundId = locks.background && locked ? locked.identity.backgroundId : pickOne(buildRng(`${seed}:background`), backgrounds).id;
  const classDef = classById.get(classId);

  if (!classDef) throw new Error(`Unknown class ${classId}`);

  const level = Math.min(20, Math.max(1, input.level));
  const sectionSeeds = makeSectionSeeds(seed);
  const abilitiesScores = assignAbilityScores(classDef, sectionSeeds.abilitiesSeed, raceId);
  const abilitiesModifiers = scoreToModifiers(abilitiesScores);

  const pb = proficiencyBonusForLevel(level);
  let hpMax = 0;
  for (let l = 1; l <= level; l += 1) {
    hpMax += getHitPointGain(classDef, abilitiesModifiers.con, l);
  }

  const nameRng = buildRng(sectionSeeds.identitySeed);
  const randomGender = pickOne(buildRng(`${sectionSeeds.identitySeed}:gender`), ['male', 'female', 'other'] as const);
  const lockedGender = locks.name && locked ? locked.identity.gender : undefined;
  const gender = input.gender ?? lockedGender ?? (input.mode === 'one_click' ? randomGender : 'other');
  const name = locks.name && locked ? locked.identity.name : generateName(nameRng, classId, raceId, gender);
  const subclass = (subclassesByClassId.get(classDef.id) ?? [])[0];
  const eq = locks.equipment && locked ? locked.equipment : pickEquipment(classDef, input, sectionSeeds.equipmentSeed);

  const savingThrows = Object.fromEntries(abilityKeys.map((k) => [k, classDef.savingThrows.includes(k)]));
  const skills = computeSkills(classDef, backgroundId, sectionSeeds.identitySeed);
  const race = raceById.get(raceId);

  const spellType = classDef.spellcasting.type;
  const knownType = classDef.spellcasting.knownType ?? 'none';
  const spellData = spellType === 'none' || (locks.spells && locked)
    ? {
        known: locked?.spellcasting.spellsKnown ?? [],
        prepared: locked?.spellcasting.spellsPrepared ?? [],
        cantripsKnown: locked?.spellcasting.cantripsKnown ?? 0,
      }
    : sanitizeSpells(classDef, level, knownType, sectionSeeds.spellsSeed);

  const castingAbility = classDef.spellcasting.ability as AbilityKey | undefined;
  const castingMod = castingAbility ? abilitiesModifiers[castingAbility] : undefined;
  const character: Character = {
    meta: {
      id: locked?.meta.id ?? uuid(),
      schemaVersion: 2,
      createdAt: locked?.meta.createdAt ?? now,
      updatedAt: now,
      seed,
      sectionSeeds,
    },
    identity: {
      name,
      gender,
      classId,
      subclassId: subclass?.id,
      raceId,
      backgroundId,
      level,
      alignment: buildAlignment(sectionSeeds.identitySeed),
      vibeTags: input.tags ?? [],
    },
    build: {
      mode: input.mode,
      combatRole: input.combatRole,
      tone: input.tone,
      flavorTags: input.tags ?? [],
    },
    abilities: {
      scores: abilitiesScores,
      modifiers: abilitiesModifiers,
    },
    combat: {
      proficiencyBonus: pb,
      hpMax,
      currentHp: hpMax,
      hitDie: `d${classDef.hitDie}`,
      ac: (eq.armorId ? (eq.armorId === 'chain_mail' ? 16 : eq.armorId === 'chain_shirt' ? 13 + Math.min(2, abilitiesModifiers.dex) : 11 + abilitiesModifiers.dex) : 10 + abilitiesModifiers.dex) + (eq.shield ? 2 : 0),
      initiative: abilitiesModifiers.dex,
      speed: race?.speed ?? 30,
      attacks: [],
    },
    proficiencies: {
      savingThrows,
      skills,
      armor: classDef.armorProficiencies,
      weapons: classDef.weaponProficiencies,
      tools: backgrounds.find((b) => b.id === backgroundId)?.toolProficiencies ?? [],
      languages: [...(race?.languages ?? []), ...(backgrounds.find((b) => b.id === backgroundId)?.languages ?? [])],
    },
    equipment: eq,
    features: buildFeatures(classDef, level),
    spellcasting: {
      enabled: spellType !== 'none',
      castingAbility,
      saveDc: castingMod === undefined ? undefined : calculateSaveDc(castingMod, pb),
      spellAttackBonus: castingMod === undefined ? undefined : castingMod + pb,
      slots: spellSlotsFor(spellType, level),
      cantripsKnown: spellData.cantripsKnown,
      knownType,
      spellsKnown: spellData.known,
      spellsPrepared: spellData.prepared,
    },
    personality: {
      traits: pickMany(buildRng(`${seed}:traits`), personalityPool.traits, 2),
      ideals: pickMany(buildRng(`${seed}:ideals`), personalityPool.ideals, 1),
      bonds: pickMany(buildRng(`${seed}:bonds`), personalityPool.bonds, 1),
      flaws: pickMany(buildRng(`${seed}:flaws`), personalityPool.flaws, 1),
    },
    backstory: locks.backstory && locked ? locked.backstory : buildBackstory(sectionSeeds.backstorySeed, {
      name,
      gender,
      classId,
      raceId,
      backgroundId,
      level,
      alignment: 'Neutral',
      vibeTags: input.tags ?? [],
    }),
    advancement: {
      hpMethodTracking: locked?.advancement.hpMethodTracking ?? ['average'],
      spellSelectionTracking: locked?.advancement.spellSelectionTracking ?? [],
      asiFeatTracking: locked?.advancement.asiFeatTracking ?? [],
      choices: locked?.advancement.choices ?? [],
      history: locked?.advancement.history ?? [],
      multiclassPlan: locked?.advancement.multiclassPlan ?? [],
    },
    image: locked?.image,
  };

  character.combat.attacks = computeAttacks(character);

  CharacterSchema.parse(character);
  const invariantIssues = validateCharacterInvariants(character);
  if (invariantIssues.length > 0) {
    throw new Error(`Invariant validation failed: ${invariantIssues.map((i) => i.message).join('; ')}`);
  }

  return character;
}

export function skillModifier(character: Character, skill: SkillKey): number {
  const ability = skillAbilityMap[skill];
  const base = character.abilities.modifiers[ability];
  const proficient = character.proficiencies.skills[skill];
  return base + (proficient ? character.combat.proficiencyBonus : 0);
}
