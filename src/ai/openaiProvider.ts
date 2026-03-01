import OpenAI from 'openai';
import type { Character } from '../types/character';
import { buildRng, randomInt } from '../utils/random';
import type { AIProvider, BackstoryResult, PortraitRequest, PortraitResult } from './provider';
import { portraitPromptFromCharacter } from './provider';

function toPlaceholderPortraitDataUrl(character: Character, stylePreset: string, seed: number): string {
  const label = `${character.identity.name} | ${character.identity.raceId} ${character.identity.classId} | ${stylePreset}`;
  const safeLabel = label.replace(/[<>&"]/g, '');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#2f1b12'/>
      <stop offset='100%' stop-color='#6f3e24'/>
    </linearGradient>
  </defs>
  <rect width='1024' height='1024' fill='url(#g)'/>
  <circle cx='512' cy='380' r='170' fill='#d7b693'/>
  <rect x='320' y='560' width='384' height='260' rx='120' fill='#4b2b1a'/>
  <text x='512' y='880' text-anchor='middle' fill='#f8ead7' font-size='34' font-family='Georgia, serif'>${safeLabel}</text>
  <text x='512' y='930' text-anchor='middle' fill='#f0dcc0' font-size='24' font-family='Georgia, serif'>seed ${seed}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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

function extractJsonObject(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return JSON.');
  }
  return raw.slice(start, end + 1);
}

export class OpenAIProvider implements AIProvider {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  }

  async generateBackstory(character: Character): Promise<BackstoryResult> {
    const system = 'You are a tabletop RPG writer. Return only valid JSON with keys origin, definingMoments, allies, rival, secret, rumor, roleplayPrompts, questHook.';
    const user = [
      'Create a coherent D&D 5e backstory pack aligned to class/race/background/ability profile.',
      'Use concise prose and avoid markdown.',
      JSON.stringify({
        identity: character.identity,
        abilities: character.abilities.scores,
        personality: character.personality,
      }),
    ].join('\n');

    const completion = await this.client.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      temperature: 0.8,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(extractJsonObject(content)) as Partial<BackstoryResult>;
    return normalizeBackstory(character, parsed);
  }

  async generatePortrait(character: Character, request: PortraitRequest): Promise<PortraitResult> {
    const prompt = portraitPromptFromCharacter(character, request.stylePreset);
    const seed = randomInt(buildRng(character.meta.sectionSeeds.portraitSeed), 1, 999_999);

    const image = await this.client.images.generate({
      model: 'gpt-image-1',
      prompt: `${prompt}\nNegative prompt: ${request.negativePrompt}\nSeed: ${seed}`,
      size: '1024x1024',
    });

    const first = image.data?.[0];
    const base64 = first?.b64_json;
    const directUrl = first?.url;
    const url = base64
      ? `data:image/png;base64,${base64}`
      : (typeof directUrl === 'string' && directUrl.length > 0 ? directUrl : undefined);

    return {
      prompt,
      negativePrompt: request.negativePrompt,
      seed,
      stylePreset: request.stylePreset,
      provider: 'openai',
      model: 'gpt-image-1',
      url,
      thumbnail: url,
      createdAt: new Date().toISOString(),
    };
  }
}

export class MockAIProvider implements AIProvider {
  async generateBackstory(character: Character): Promise<BackstoryResult> {
    return {
      origin: `${character.identity.name} came from a hard life and stepped into danger by choice.`,
      definingMoments: ['First duel survived', 'Saved a caravan', 'Broke from old mentor'],
      allies: ['Old friend from training grounds', 'Traveling priest who trusts them'],
      rival: 'A ruthless bounty captain',
      secret: 'Carries encoded notes from a forbidden archive',
      rumor: 'May have served the enemy years ago',
      roleplayPrompts: ['What line will they not cross?', 'Who do they still trust?', 'What cost are they hiding?'],
      questHook: 'A missing relic ties directly to their earliest failure.',
    };
  }

  async generatePortrait(character: Character, request: PortraitRequest): Promise<PortraitResult> {
    const seed = 424242;
    const placeholder = toPlaceholderPortraitDataUrl(character, request.stylePreset, seed);
    return {
      prompt: portraitPromptFromCharacter(character, request.stylePreset),
      negativePrompt: request.negativePrompt,
      seed,
      stylePreset: request.stylePreset,
      provider: 'mock',
      model: 'mock-image',
      url: placeholder,
      thumbnail: placeholder,
      createdAt: new Date().toISOString(),
    };
  }
}
