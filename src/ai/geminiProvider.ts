import type { Character } from '../types/character';
import type { AIProvider, BackstoryResult, PortraitRequest, PortraitResult } from './provider';
import { portraitPromptFromCharacter } from './provider';
import { buildRng, randomInt } from '../utils/random';
import { classById, equipmentById, raceById } from '../data/rules';

function formatAbilityList(ids: string[]): string {
  return ids.map((x) => x.toUpperCase()).join(', ');
}

function formatRaceBonuses(abilityBonuses: Record<string, number>): string {
  return Object.entries(abilityBonuses)
    .map(([ability, value]) => {
      if (ability === 'all') return `all abilities +${value}`;
      if (ability === 'choice2') return `two abilities of choice +${value}`;
      return `${ability.toUpperCase()} +${value}`;
    })
    .join(', ');
}

function formatLoadout(character: Character): string {
  const weapons = character.equipment.weaponIds
    .map((id) => equipmentById.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((weapon) => {
      const parts = [
        weapon.name,
        weapon.damage ? `damage ${weapon.damage}` : undefined,
        weapon.properties?.length ? `properties: ${weapon.properties.join(', ')}` : undefined,
      ].filter(Boolean);
      return parts.join(' - ');
    });

  const armor = character.equipment.armorId ? equipmentById.get(character.equipment.armorId) : undefined;
  const armorText = armor ? armor.name : 'none';
  const weaponText = weapons.length > 0 ? weapons.join('; ') : 'none';
  return `Armor: ${armorText}${character.equipment.shield ? ' + shield' : ''}. Weapons: ${weaponText}.`;
}

function buildClassRaceContext(character: Character): string {
  const classDef = classById.get(character.identity.classId);
  const raceDef = raceById.get(character.identity.raceId);

  const classText = classDef
    ? [
        `${classDef.name} class profile:`,
        `Hit Die d${classDef.hitDie}.`,
        `Primary abilities: ${formatAbilityList(classDef.primaryAbilities)}.`,
        `Saving throw proficiencies: ${formatAbilityList(classDef.savingThrows)}.`,
        `Armor proficiencies: ${classDef.armorProficiencies.join(', ') || 'none'}.`,
        `Weapon proficiencies: ${classDef.weaponProficiencies.join(', ') || 'none'}.`,
        `Spellcasting type: ${classDef.spellcasting.type}.`,
      ].join(' ')
    : `Class profile unavailable for ${character.identity.classId}.`;

  const raceText = raceDef
    ? [
        `${raceDef.name} race profile:`,
        `Speed ${raceDef.speed} ft.`,
        `Ability bonuses: ${formatRaceBonuses(raceDef.abilityBonuses)}.`,
        `Languages: ${raceDef.languages.join(', ')}.`,
        `Traits: ${raceDef.traits.join(', ')}.`,
      ].join(' ')
    : `Race profile unavailable for ${character.identity.raceId}.`;

  return `${classText}\n${raceText}\nLoadout: ${formatLoadout(character)}`;
}

function buildPortraitVisualContext(character: Character): string {
  const classDef = classById.get(character.identity.classId);
  const raceDef = raceById.get(character.identity.raceId);
  const className = classDef?.name ?? character.identity.classId.replaceAll('_', ' ');
  const raceName = raceDef?.name ?? character.identity.raceId.replaceAll('_', ' ');

  const classVisuals: Record<string, string> = {
    barbarian: 'powerful physique, practical travel-worn gear, primal presence',
    bard: 'expressive performer style, decorative details, charismatic expression',
    cleric: 'faith-inspired attire, holy iconography, calm but resolute bearing',
    druid: 'nature-worn clothing, organic textures, wild and grounded feel',
    fighter: 'battle-ready stance, practical martial kit, disciplined posture',
    monk: 'simple training garb, balanced posture, focused expression',
    paladin: 'noble martial look, polished armour accents, oathbound presence',
    ranger: 'frontier gear, practical cloak and straps, alert tracker demeanor',
    rogue: 'light stealth-ready kit, layered leathers, sharp watchful eyes',
    sorcerer: 'innate arcane aura, dramatic magical highlights, confident stance',
    warlock: 'occult motifs, mysterious mood, pact-marked style elements',
    wizard: 'scholarly arcane style, refined robes or coat, precise composed look',
  };

  const raceVisuals: Record<string, string> = {
    human: 'realistic human proportions and features',
    elf: 'fine angular features, graceful posture, pointed ears',
    dwarf: 'stout build, strong features, craft-hardened presence',
    halfling: 'small stature, warm expressive features, agile proportions',
    dragonborn: 'draconic head features, scaled skin, imposing silhouette',
    gnome: 'small stature, curious expression, intricate practical details',
    half_elf: 'blended human-elven features, graceful but grounded look',
    half_orc: 'powerful build, tusked features, intense expression',
    tiefling: 'infernal heritage cues such as horns and uncommon complexion',
  };

  return [
    `Visual subject: ${character.identity.name}, a ${character.identity.gender} ${raceName} ${className}.`,
    `Race appearance cues: ${raceVisuals[character.identity.raceId] ?? `${raceName} visual traits true to fantasy art`}.`,
    `Class appearance cues: ${classVisuals[character.identity.classId] ?? `${className} archetype styling`}.`,
    `Equipment to depict clearly: ${formatLoadout(character)}`,
  ].join('\n');
}

export function buildGeminiPortraitPrompt(character: Character, request: PortraitRequest, seed: number): string {
  const prompt = portraitPromptFromCharacter(character, request.stylePreset);
  const visualContext = buildPortraitVisualContext(character);
  return `${prompt}\nVisual context:\n${visualContext}\nComposition requirement: square 1:1 portrait framing.\nNegative prompt: ${request.negativePrompt}\nSeed: ${seed}`;
}

export function buildGeminiBackstoryPrompt(character: Character): string {
  const classRaceContext = buildClassRaceContext(character);
  return [
    'Return only strict JSON with keys:',
    'origin, definingMoments (array length 3), allies (array length 2), rival, secret, rumor, roleplayPrompts (array length 3), questHook.',
    'No markdown, no explanation text.',
    'Writing constraints: suitable for UKS2 pupils (ages 9-11), clear and age-appropriate vocabulary, short sentences, adventurous but school-safe tone, British English spellings.',
    'Use the class/race profile and loadout details below to keep the backstory mechanically and thematically coherent.',
    classRaceContext,
    JSON.stringify({
      identity: character.identity,
      abilities: character.abilities.scores,
      personality: character.personality,
    }),
  ].join('\n');
}

function normalizeBackstory(character: Character, input: Partial<BackstoryResult>): BackstoryResult {
  const origin = input.origin?.trim() || `${character.identity.name} left home to pursue danger and purpose.`;
  const definingMoments = (input.definingMoments ?? []).slice(0, 3);
  while (definingMoments.length < 3) definingMoments.push(`A hard lesson at level ${character.identity.level}.`);
  const allies = (input.allies ?? []).slice(0, 2);
  while (allies.length < 2) allies.push('A trusted companion from earlier travels.');
  const roleplayPrompts = (input.roleplayPrompts ?? []).slice(0, 3);
  while (roleplayPrompts.length < 3) roleplayPrompts.push('What fear still controls this character?');

  return {
    origin,
    definingMoments,
    allies,
    rival: input.rival?.trim() || 'A determined rival with opposing ideals.',
    secret: input.secret?.trim() || 'They hide a past mistake that could ruin trust.',
    rumor: input.rumor?.trim() || 'Rumors follow them from an unresolved incident.',
    roleplayPrompts,
    questHook: input.questHook?.trim() || 'A new lead forces them to confront old enemies.',
  };
}

async function postJson<TResponse>(url: string, body: Record<string, unknown>): Promise<TResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string } & TResponse;
  if (!response.ok) {
    const message = data?.error || `Request failed (${response.status}).`;
    throw new Error(message);
  }

  return data;
}

export class GeminiProvider implements AIProvider {
  async generateBackstory(character: Character): Promise<BackstoryResult> {
    const prompt = buildGeminiBackstoryPrompt(character);
    const response = await postJson<{ backstory?: Partial<BackstoryResult> }>('/api/ai/backstory', { prompt });
    return normalizeBackstory(character, response.backstory ?? {});
  }

  async generatePortrait(character: Character, request: PortraitRequest): Promise<PortraitResult> {
    const seed = randomInt(buildRng(character.meta.sectionSeeds.portraitSeed), 1, 999_999);
    const fullPrompt = buildGeminiPortraitPrompt(character, request, seed);

    const response = await postJson<{ model?: string; url?: string; thumbnail?: string }>('/api/ai/portrait', {
      prompt: fullPrompt,
    });

    return {
      prompt: fullPrompt,
      negativePrompt: request.negativePrompt,
      seed,
      stylePreset: request.stylePreset,
      provider: 'gemini-server',
      model: response.model ?? 'gemini',
      url: response.url,
      thumbnail: response.thumbnail ?? response.url,
      createdAt: new Date().toISOString(),
    };
  }
}
