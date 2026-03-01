import type { Character } from '../types/character';

export type PortraitRequest = {
  stylePreset: 'fantasy_painting' | 'inked_comic' | 'grim_realism';
  negativePrompt: string;
};

export type PortraitResult = {
  prompt: string;
  negativePrompt: string;
  seed: number;
  stylePreset: string;
  provider: string;
  model: string;
  url?: string;
  thumbnail?: string;
  createdAt: string;
};

export type BackstoryResult = Character['backstory'];

export interface AIProvider {
  generateBackstory(character: Character): Promise<BackstoryResult>;
  generatePortrait(character: Character, request: PortraitRequest): Promise<PortraitResult>;
}

export const styleDescriptors: Record<PortraitRequest['stylePreset'], string> = {
  fantasy_painting: 'high-detail fantasy portrait painting, cinematic rim lighting, textured brush strokes',
  inked_comic: 'inked comic illustration, dramatic linework, expressive features, flat color blocks',
  grim_realism: 'gritty realistic fantasy portrait, weathered armor, muted palette, dramatic shadows',
};

export function portraitPromptFromCharacter(character: Character, stylePreset: PortraitRequest['stylePreset']): string {
  const traits = [
    `${character.identity.gender} ${character.identity.raceId} ${character.identity.classId}`,
    `level ${character.identity.level}`,
    `alignment ${character.identity.alignment}`,
    `background ${character.identity.backgroundId}`,
  ].join(', ');

  return `Portrait of ${character.identity.name}, ${traits}. ${styleDescriptors[stylePreset]}. Bust framing, centered composition, no text.`;
}
