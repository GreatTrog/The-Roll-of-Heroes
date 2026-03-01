import { create } from 'zustand';
import { generateCharacter, type GenerationInput } from '../engine/generator';
import type { Character } from '../types/character';
import { CharacterRepository, type StoredCharacter } from '../persistence/db';
import { migrateCharacterJson } from '../engine/migrations';
import { applyLevelUp, type LevelUpDecision } from '../engine/leveling';
import { MockAIProvider } from '../ai/openaiProvider';
import { portraitPromptFromCharacter, type PortraitRequest } from '../ai/provider';
import { buildGeminiPortraitPrompt, GeminiProvider } from '../ai/geminiProvider';

export type TabKey = 'sheet' | 'spells' | 'backstory' | 'portrait';

type AppState = {
  character?: Character;
  saved: StoredCharacter[];
  activeTab: TabKey;
  search: string;
  sort: 'updatedAt' | 'name' | 'level';
  locks: Record<'class' | 'race' | 'background' | 'name' | 'spells' | 'equipment' | 'backstory', boolean>;
  error?: string;
  aiStatus?: string;
  saveNotice?: string;
  featsEnabled: boolean;
  loadingBackstory: boolean;
  loadingPortrait: boolean;
  generate: (input: GenerationInput) => void;
  reroll: () => void;
  toggleLock: (section: keyof AppState['locks']) => void;
  resetLocks: () => void;
  setActiveTab: (tab: TabKey) => void;
  setSearch: (value: string) => Promise<void>;
  setSort: (value: AppState['sort']) => Promise<void>;
  loadSaved: () => Promise<void>;
  saveCurrent: () => Promise<void>;
  openCharacter: (id: string) => Promise<void>;
  duplicateCharacter: (id: string) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;
  exportCurrent: () => void;
  exportCharacterById: (id: string) => Promise<void>;
  exportAllCharacters: () => Promise<void>;
  importJson: (raw: string) => Promise<void>;
  levelUp: (decision: LevelUpDecision) => void;
  setFeatsEnabled: (value: boolean) => void;
  updateCharacterName: (name: string) => void;
  updateCharacterGender: (gender: Character['identity']['gender']) => void;
  generateBackstory: () => Promise<void>;
  generatePortrait: (request: PortraitRequest) => Promise<void>;
  clearAiStatus: () => void;
  clearStatus: () => void;
  clearSaveNotice: () => void;
};

function getAiProvider() {
  const key = (import.meta.env.VITE_GEMINI_API_KEY ?? import.meta.env.GEMINI_API_KEY ?? '').trim();
  const useMock = String(import.meta.env.VITE_USE_MOCK_AI ?? '').toLowerCase() === 'true';
  if (useMock) return new MockAIProvider();
  if (!key) {
    throw new Error('Missing Gemini API key. Set VITE_GEMINI_API_KEY or GEMINI_API_KEY in .env and restart dev server.');
  }
  return new GeminiProvider(key);
}

function isQuotaOrBillingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('429') || message.toLowerCase().includes('quota') || message.toLowerCase().includes('billing');
}

function allowAiFallback(): boolean {
  return String(import.meta.env.VITE_ALLOW_AI_FALLBACK ?? '').toLowerCase() === 'true';
}

export const useAppStore = create<AppState>((set, get) => ({
  character: undefined,
  saved: [],
  activeTab: 'sheet',
  search: '',
  sort: 'updatedAt',
  locks: {
    class: false,
    race: false,
    background: false,
    name: false,
    spells: false,
    equipment: false,
    backstory: false,
  },
  featsEnabled: true,
  loadingBackstory: false,
  loadingPortrait: false,
  aiStatus: undefined,
  saveNotice: undefined,
  generate: (input) => {
    const current = get().character;
    const locks = get().locks;
    const maxAttempts = 8;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const candidateSeed = attempt === 0 ? input.seed : crypto.randomUUID();
        const character = generateCharacter({
          ...input,
          seed: candidateSeed,
          lockedCharacter: current,
          locks,
        });
        const generated = { ...character, image: undefined };
        set({
          character: generated,
          error: undefined,
          aiStatus: attempt > 0 ? 'Auto-rerolled due equipment/proficiency mismatch.' : undefined,
        });
        return;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const isWeaponCompatibilityIssue =
          message.includes('Invariant validation failed') &&
          message.toLowerCase().includes('weapon') &&
          message.toLowerCase().includes('not compatible with proficiencies');

        if (!isWeaponCompatibilityIssue) {
          set({ error: message });
          return;
        }
      }
    }

    set({
      error:
        lastError instanceof Error
          ? lastError.message
          : 'Generation failed after automatic rerolls.',
    });
  },
  reroll: () => {
    const current = get().character;
    if (!current) return;
    get().generate({
      mode: current.build.mode,
      level: current.identity.level,
      classId: current.identity.classId,
      raceId: current.identity.raceId,
      gender: current.identity.gender,
      tags: current.build.flavorTags,
      combatRole: current.build.combatRole as GenerationInput['combatRole'],
      tone: current.build.tone as GenerationInput['tone'],
      seed: crypto.randomUUID(),
    });
  },
  toggleLock: (section) => {
    set((state) => ({ locks: { ...state.locks, [section]: !state.locks[section] } }));
  },
  resetLocks: () =>
    set({
      locks: {
        class: false,
        race: false,
        background: false,
        name: false,
        spells: false,
        equipment: false,
        backstory: false,
      },
    }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearch: async (value) => {
    set({ search: value });
    const list = await CharacterRepository.list(value, get().sort);
    set({ saved: list });
  },
  setSort: async (value) => {
    set({ sort: value });
    const list = await CharacterRepository.list(get().search, value);
    set({ saved: list });
  },
  loadSaved: async () => {
    const list = await CharacterRepository.list(get().search, get().sort);
    set({ saved: list });
  },
  saveCurrent: async () => {
    const character = get().character;
    if (!character) return;
    const stamped: Character = {
      ...character,
      meta: {
        ...character.meta,
        updatedAt: new Date().toISOString(),
      },
    };
    await CharacterRepository.upsert(stamped);
    set({ character: stamped, saveNotice: 'Character saved successfully.' });
    await get().loadSaved();
  },
  openCharacter: async (id) => {
    const character = await CharacterRepository.get(id);
    if (!character) return;
    set({ character, error: undefined });
  },
  duplicateCharacter: async (id) => {
    const duplicate = await CharacterRepository.duplicate(id);
    if (!duplicate) return;
    set({ character: duplicate });
    await get().loadSaved();
  },
  deleteCharacter: async (id) => {
    await CharacterRepository.delete(id);
    if (get().character?.meta.id === id) {
      set({ character: undefined });
    }
    await get().loadSaved();
  },
  exportCurrent: () => {
    const character = get().character;
    if (!character) return;
    const blob = new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.identity.name.replace(/\s+/g, '_').toLowerCase()}-character.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  exportCharacterById: async (id) => {
    const character = await CharacterRepository.get(id);
    if (!character) return;
    const blob = new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = character.identity.name.replace(/[^a-z0-9_\- ]/gi, '').replace(/\s+/g, '_').toLowerCase();
    a.href = url;
    a.download = `${safeName || character.meta.id}-character.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  exportAllCharacters: async () => {
    const all = await CharacterRepository.list('', 'updatedAt');
    for (const item of all) {
      const character = item.character;
      const blob = new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = character.identity.name.replace(/[^a-z0-9_\- ]/gi, '').replace(/\s+/g, '_').toLowerCase();
      a.href = url;
      a.download = `${safeName || character.meta.id}-character.json`;
      a.click();
      URL.revokeObjectURL(url);
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  },
  importJson: async (raw) => {
    try {
      const parsed = JSON.parse(raw);
      const character = migrateCharacterJson(parsed);
      set({ character, error: undefined, aiStatus: undefined });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },
  levelUp: (decision) => {
    const character = get().character;
    if (!character) return;
    try {
      const leveled = applyLevelUp(character, decision);
      set({ character: leveled, error: undefined });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },
  setFeatsEnabled: (value) => set({ featsEnabled: value }),
  updateCharacterName: (name) => {
    const character = get().character;
    if (!character) return;
    const cleaned = name.trim();
    if (!cleaned) return;
    set({
      character: {
        ...character,
        identity: { ...character.identity, name: cleaned },
        meta: { ...character.meta, updatedAt: new Date().toISOString() },
      },
    });
  },
  updateCharacterGender: (gender) => {
    const character = get().character;
    if (!character) return;
    if (character.identity.gender === gender) return;
    const nextCharacter: Character = {
      ...character,
      identity: { ...character.identity, gender },
      meta: { ...character.meta, updatedAt: new Date().toISOString() },
    };

    if (nextCharacter.image) {
      const style = nextCharacter.image.stylePreset as PortraitRequest['stylePreset'];
      const validStyles: PortraitRequest['stylePreset'][] = ['fantasy_painting', 'inked_comic', 'grim_realism'];
      if (validStyles.includes(style)) {
        if (nextCharacter.image.provider.includes('gemini')) {
          nextCharacter.image = {
            ...nextCharacter.image,
            prompt: buildGeminiPortraitPrompt(
              nextCharacter,
              { stylePreset: style, negativePrompt: nextCharacter.image.negativePrompt },
              nextCharacter.image.seed,
            ),
          };
        } else {
          nextCharacter.image = {
            ...nextCharacter.image,
            prompt: portraitPromptFromCharacter(nextCharacter, style),
          };
        }
      }
    }

    set({ character: nextCharacter });
  },
  generateBackstory: async () => {
    const character = get().character;
    if (!character) return;
    set({ loadingBackstory: true, error: undefined, aiStatus: 'Generating backstory...' });
    try {
      const ai = getAiProvider();
      const backstory = await ai.generateBackstory(character);
      set({ character: { ...character, backstory }, loadingBackstory: false, aiStatus: 'Backstory generated successfully.' });
    } catch (error) {
      if (isQuotaOrBillingError(error) && allowAiFallback()) {
        const mock = new MockAIProvider();
        const backstory = await mock.generateBackstory(character);
        set({
          character: { ...character, backstory },
          loadingBackstory: false,
          error: undefined,
          aiStatus: 'Live Gemini call failed due quota/billing; generated backstory using local fallback.',
        });
      } else {
        set({
          loadingBackstory: false,
          error: error instanceof Error ? error.message : String(error),
          aiStatus: isQuotaOrBillingError(error)
            ? 'Live AI unavailable (quota/billing). No fallback used.'
            : 'Backstory generation failed.',
        });
      }
    }
  },
  generatePortrait: async (request) => {
    const character = get().character;
    if (!character) return;
    set({ loadingPortrait: true, error: undefined, aiStatus: 'Generating portrait...' });
    try {
      const ai = getAiProvider();
      let image = await ai.generatePortrait(character, request);
      if (!image.url) {
        const mock = new MockAIProvider();
        const fallback = await mock.generatePortrait(character, request);
        image = {
          ...image,
          url: fallback.url,
          thumbnail: fallback.thumbnail,
          provider: `${image.provider}+fallback`,
        };
        set({
          character: { ...character, image },
          loadingPortrait: false,
          aiStatus: 'Portrait metadata generated; image payload missing from provider, using local fallback image.',
        });
        return;
      }
      set({ character: { ...character, image }, loadingPortrait: false, aiStatus: 'Portrait generated successfully.' });
    } catch (error) {
      if (isQuotaOrBillingError(error) && allowAiFallback()) {
        const mock = new MockAIProvider();
        const image = await mock.generatePortrait(character, request);
        set({
          character: { ...character, image },
          loadingPortrait: false,
          error: undefined,
          aiStatus: 'Live Gemini call failed due quota/billing; generated portrait metadata using local fallback.',
        });
      } else {
        set({
          loadingPortrait: false,
          error: error instanceof Error ? error.message : String(error),
          aiStatus: isQuotaOrBillingError(error)
            ? 'Live AI unavailable (quota/billing). No fallback used.'
            : 'Portrait generation failed.',
        });
      }
    }
  },
  clearAiStatus: () => set({ aiStatus: undefined }),
  clearStatus: () => set({ aiStatus: undefined, error: undefined }),
  clearSaveNotice: () => set({ saveNotice: undefined }),
}));
