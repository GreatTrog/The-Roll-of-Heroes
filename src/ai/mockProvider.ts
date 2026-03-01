import type { Character } from '../types/character';
import type { AIProvider, BackstoryResult, PortraitRequest, PortraitResult } from './provider';
import { portraitPromptFromCharacter } from './provider';

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function portraitGenderCandidates(character: Character): Array<'male' | 'female'> {
  if (character.identity.gender === 'male') return ['male'];
  if (character.identity.gender === 'female') return ['female'];
  const seed = character.meta.sectionSeeds.portraitSeed || character.meta.seed || character.meta.id;
  const pickMale = hashString(seed) % 2 === 0;
  return [pickMale ? 'male' : 'female'];
}

export function getLocalPortraitCandidates(character: Character): string[] {
  const classId = character.identity.classId.toLowerCase();
  const raceId = character.identity.raceId.toLowerCase();
  const genders = portraitGenderCandidates(character);
  return genders.flatMap((gender) => [
    `/portraits/${raceId}-${gender}.png`,
    `/portraits/${raceId}_${gender}.png`,
    `/portraits/${classId}-${gender}.png`,
    `/portraits/${classId}_${gender}.png`,
  ]);
}

function canLoadImage(url: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
  });
}

export async function resolveLocalPortraitUrl(character: Character): Promise<string | undefined> {
  const candidates = getLocalPortraitCandidates(character);
  for (const candidate of candidates) {
    if (await canLoadImage(candidate)) return candidate;
  }
  return undefined;
}

export function getLocalPortraitUrl(character: Character): string {
  return getLocalPortraitCandidates(character)[0] ?? '';
}

export class MockAIProvider implements AIProvider {
  async generateBackstory(character: Character): Promise<BackstoryResult> {
    return {
      origin: `${character.identity.name} came from a hard life and stepped into danger by choice.`,
      definingMoments: ['First duel survived', 'Saved a caravan', 'Broke from old mentor'],
      allies: ['Old friend from training grounds', 'Travelling priest who trusts them'],
      rival: 'A ruthless bounty captain',
      secret: 'Carries encoded notes from a forbidden archive',
      rumor: 'May have served the enemy years ago',
      roleplayPrompts: ['What line will they not cross?', 'Who do they still trust?', 'What cost are they hiding?'],
      questHook: 'A missing relic ties directly to their earliest failure.',
    };
  }

  async generatePortrait(character: Character, request: PortraitRequest): Promise<PortraitResult> {
    const seed = Number(character.meta.sectionSeeds.portraitSeed.slice(-6)) || 424242;
    const localUrl = await resolveLocalPortraitUrl(character);

    return {
      prompt: portraitPromptFromCharacter(character, request.stylePreset),
      negativePrompt: request.negativePrompt,
      seed,
      stylePreset: request.stylePreset,
      provider: 'local-portrait',
      model: 'class-gender-png',
      url: localUrl ?? undefined,
      thumbnail: localUrl ?? undefined,
      createdAt: new Date().toISOString(),
    };
  }
}
