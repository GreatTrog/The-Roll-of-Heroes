import type { Character } from '../types/character';
import type { AIProvider, BackstoryResult, PortraitRequest, PortraitResult } from './provider';
import { portraitPromptFromCharacter } from './provider';
import { buildRng, randomInt } from '../utils/random';
import { classById, equipmentById, raceById } from '../data/rules';

const TEXT_MODEL_CANDIDATES = [
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.0-flash-001',
];

const IMAGE_MODEL_CANDIDATES = [
  'gemini-3-pro-image-preview',
  'gemini-2.0-flash-preview-image-generation',
];

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
  return `${prompt}
Visual context:
${visualContext}
Composition requirement: square 1:1 portrait framing.
Negative prompt: ${request.negativePrompt}
Seed: ${seed}`;
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

function extractFirstTextPart(response: unknown): string {
  const text = (response as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    ?.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === 'string')?.text;
  if (!text) throw new Error('Gemini response missing text content.');
  return text;
}

function extractJsonObject(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return JSON.');
  }
  return raw.slice(start, end + 1);
}

function extractInlineImageDataUrl(response: unknown): string | undefined {
  const parts =
    (response as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }> })
      ?.candidates?.[0]?.content?.parts ?? [];
  const withImage = parts.find((p) => p.inlineData?.data);
  if (!withImage?.inlineData?.data) return undefined;
  const mime = withImage.inlineData.mimeType || 'image/png';
  return `data:${mime};base64,${withImage.inlineData.data}`;
}

function parseApiError(bodyText: string): { code?: number; message: string } {
  try {
    const parsed = JSON.parse(bodyText) as { error?: { code?: number; message?: string } };
    return {
      code: parsed.error?.code,
      message: parsed.error?.message ?? bodyText,
    };
  } catch {
    return { message: bodyText };
  }
}

async function callGenerateContent(
  apiKey: string,
  models: string[],
  body: Record<string, unknown>,
): Promise<{ model: string; data: unknown }> {
  let lastError = 'Unknown Gemini error.';

  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (response.ok) {
      return { model, data: await response.json() };
    }

    const bodyText = await response.text();
    const parsed = parseApiError(bodyText);
    lastError = `Model ${model} failed (${response.status}): ${parsed.message}`;

    // Retry with next candidate only for model-availability style failures.
    const modelUnavailable = response.status === 404 || parsed.message.toLowerCase().includes('no longer available');
    if (!modelUnavailable) {
      break;
    }
  }

  throw new Error(lastError);
}

export class GeminiProvider implements AIProvider {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateBackstory(character: Character): Promise<BackstoryResult> {
    const classRaceContext = buildClassRaceContext(character);
    const prompt = [
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

    const { data } = await callGenerateContent(this.apiKey, TEXT_MODEL_CANDIDATES, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        responseMimeType: 'application/json',
      },
    });
    const text = extractFirstTextPart(data);
    const parsed = JSON.parse(extractJsonObject(text)) as Partial<BackstoryResult>;
    return normalizeBackstory(character, parsed);
  }

  async generatePortrait(character: Character, request: PortraitRequest): Promise<PortraitResult> {
    const seed = randomInt(buildRng(character.meta.sectionSeeds.portraitSeed), 1, 999_999);
    const fullPrompt = buildGeminiPortraitPrompt(character, request, seed);

    const { model, data } = await callGenerateContent(this.apiKey, IMAGE_MODEL_CANDIDATES, {
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });
    const imageUrl = extractInlineImageDataUrl(data);

    return {
      prompt: fullPrompt,
      negativePrompt: request.negativePrompt,
      seed,
      stylePreset: request.stylePreset,
      provider: 'gemini',
      model,
      url: imageUrl,
      thumbnail: imageUrl,
      createdAt: new Date().toISOString(),
    };
  }
}
