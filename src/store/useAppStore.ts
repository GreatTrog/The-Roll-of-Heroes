import { create } from 'zustand';
import { generateCharacter, type GenerationInput } from '../engine/generator';
import type { Character } from '../types/character';
import { CharacterRepository, type StoredCharacter } from '../persistence/db';
import { migrateCharacterJson } from '../engine/migrations';
import { applyLevelUp, type LevelUpDecision } from '../engine/leveling';
import { getLocalPortraitUrl, MockAIProvider, resolveLocalPortraitUrl } from '../ai/mockProvider';
import { portraitPromptFromCharacter, type PortraitRequest } from '../ai/provider';
import { buildGeminiPortraitPrompt, GeminiProvider } from '../ai/geminiProvider';

export type TabKey = 'sheet' | 'spells' | 'backstory' | 'portrait';
type SavePromptChoice = 'save' | 'secondary' | 'cancel';
type SavePromptMode = 'beforeGenerate' | 'afterLevelUp';

type SavePromptState = {
  open: boolean;
  mode: SavePromptMode;
  title: string;
  message: string;
  saveLabel: string;
  secondaryLabel: string;
  cancelLabel?: string;
};

type AppState = {
  character?: Character;
  saved: StoredCharacter[];
  activeTab: TabKey;
  search: string;
  sort: 'updatedAt' | 'name' | 'level';
  aiUnlockedUntil?: number;
  locks: Record<'class' | 'race' | 'background' | 'name' | 'spells' | 'equipment' | 'backstory', boolean>;
  error?: string;
  aiStatus?: string;
  saveNotice?: string;
  openedCharacterId?: string;
  hasUnsavedChanges: boolean;
  savePrompt: SavePromptState;
  featsEnabled: boolean;
  loadingBackstory: boolean;
  loadingPortrait: boolean;
  aiPasswordModalOpen: boolean;
  aiPasswordValue: string;
  generate: (input: GenerationInput) => void;
  requestGenerate: (input: GenerationInput) => Promise<void>;
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
  setAiPasswordValue: (value: string) => void;
  submitAiPassword: () => void;
  cancelAiPassword: () => void;
  respondToSavePrompt: (choice: SavePromptChoice) => void;
};

function getAiProvider() {
  const useMock = String(import.meta.env.VITE_USE_MOCK_AI ?? '').toLowerCase() === 'true';
  if (useMock) return new MockAIProvider();
  return new GeminiProvider();
}

function allowAiFallback(): boolean {
  return String(import.meta.env.VITE_ALLOW_AI_FALLBACK ?? '').toLowerCase() === 'true';
}

const AI_UNLOCK_KEY = 'ai_unlock_until';
const DEFAULT_AI_UNLOCK_MS = 30 * 60 * 1000;
let aiPasswordResolver: ((value: string | null) => void) | null = null;
let savePromptResolver: ((choice: SavePromptChoice) => void) | null = null;

function resolveAiPassword(value: string | null) {
  const resolver = aiPasswordResolver;
  aiPasswordResolver = null;
  if (resolver) resolver(value);
}

function requestAiPasswordFromModal(): Promise<string | null> {
  return new Promise((resolve) => {
    aiPasswordResolver = resolve;
    useAppStore.setState({ aiPasswordModalOpen: true, aiPasswordValue: '' });
  });
}

function isOpenedCharacterDirty(state: Pick<AppState, 'character' | 'openedCharacterId' | 'hasUnsavedChanges'>): boolean {
  return Boolean(
    state.character &&
    state.openedCharacterId &&
    state.character.meta.id === state.openedCharacterId &&
    state.hasUnsavedChanges,
  );
}

function setUnsavedForOpenedCharacter(setter: (recipe: (state: AppState) => Partial<AppState>) => void) {
  setter((state) => {
    if (!state.character || !state.openedCharacterId || state.character.meta.id !== state.openedCharacterId) {
      return {};
    }
    return { hasUnsavedChanges: true };
  });
}

function requestSavePrompt(config: Omit<SavePromptState, 'open'>): Promise<SavePromptChoice> {
  return new Promise((resolve) => {
    savePromptResolver = resolve;
    useAppStore.setState({
      savePrompt: {
        open: true,
        ...config,
      },
    });
  });
}

function resolveSavePrompt(choice: SavePromptChoice) {
  const resolver = savePromptResolver;
  savePromptResolver = null;
  useAppStore.setState((state) => ({
    savePrompt: { ...state.savePrompt, open: false },
  }));
  if (resolver) resolver(choice);
}

function getInitialAiUnlockUntil(): number | undefined {
  if (typeof window === 'undefined') return undefined;
  const raw = window.sessionStorage.getItem(AI_UNLOCK_KEY);
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= Date.now()) {
    window.sessionStorage.removeItem(AI_UNLOCK_KEY);
    return undefined;
  }
  return value;
}

function persistAiUnlockUntil(until: number | undefined) {
  if (typeof window === 'undefined') return;
  if (!until || until <= Date.now()) {
    window.sessionStorage.removeItem(AI_UNLOCK_KEY);
    return;
  }
  window.sessionStorage.setItem(AI_UNLOCK_KEY, String(until));
}

async function requestAiUnlockUntil(): Promise<number | undefined> {
  const password = await requestAiPasswordFromModal();
  if (!password) return undefined;

  const response = await fetch('/api/ai-auth/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    let message = `AI unlock failed (${response.status}).`;
    try {
      const data = await response.json() as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Ignore parse errors and keep generic message.
    }
    throw new Error(message);
  }

  const data = await response.json() as { unlockForSeconds?: number };
  const ttlMs =
    typeof data.unlockForSeconds === 'number' && data.unlockForSeconds > 0
      ? data.unlockForSeconds * 1000
      : DEFAULT_AI_UNLOCK_MS;
  return Date.now() + ttlMs;
}

export const useAppStore = create<AppState>((set, get) => ({
  character: undefined,
  saved: [],
  activeTab: 'sheet',
  search: '',
  sort: 'updatedAt',
  aiUnlockedUntil: getInitialAiUnlockUntil(),
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
  aiPasswordModalOpen: false,
  aiPasswordValue: '',
  aiStatus: undefined,
  saveNotice: undefined,
  openedCharacterId: undefined,
  hasUnsavedChanges: false,
  savePrompt: {
    open: false,
    mode: 'beforeGenerate',
    title: '',
    message: '',
    saveLabel: 'Save',
    secondaryLabel: 'Continue',
    cancelLabel: 'Cancel',
  },
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
        const seedValue = Number(character.meta.sectionSeeds.portraitSeed.slice(-6)) || 424242;
        const defaultStyle: PortraitRequest['stylePreset'] = 'fantasy_painting';
        const defaultNegativePrompt = 'text, watermark, blurry, deformed anatomy, duplicate face';
        const placeholderUrl = getLocalPortraitUrl(character);
        const generated: Character = {
          ...character,
          image: {
            prompt: portraitPromptFromCharacter(character, defaultStyle),
            negativePrompt: defaultNegativePrompt,
            seed: seedValue,
            stylePreset: defaultStyle,
            provider: 'local-portrait',
            model: 'class-gender-png',
            url: placeholderUrl || undefined,
            thumbnail: placeholderUrl || undefined,
            createdAt: new Date().toISOString(),
          },
        };
        set({
          character: generated,
          error: undefined,
          aiStatus: attempt > 0 ? 'Auto-rerolled due equipment/proficiency mismatch.' : undefined,
          openedCharacterId: undefined,
          hasUnsavedChanges: false,
        });
        void resolveLocalPortraitUrl(character).then((resolvedUrl) => {
          set((state) => {
            const current = state.character;
            if (!current || current.meta.id !== generated.meta.id || !current.image || !current.image.provider.includes('local')) {
              return {};
            }
            if (current.image.url === resolvedUrl && current.image.thumbnail === resolvedUrl) return {};
            return {
              character: {
                ...current,
                image: {
                  ...current.image,
                  url: resolvedUrl ?? undefined,
                  thumbnail: resolvedUrl ?? undefined,
                },
              },
            };
          });
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
  requestGenerate: async (input) => {
    if (isOpenedCharacterDirty(get())) {
      const choice = await requestSavePrompt({
        mode: 'beforeGenerate',
        title: 'Save Changes Before Generating?',
        message: 'You have unsaved changes on this opened character. Save before generating a new one?',
        saveLabel: 'Save & Generate',
        secondaryLabel: 'Generate Without Saving',
        cancelLabel: 'Cancel',
      });

      if (choice === 'cancel') return;
      if (choice === 'save') {
        await get().saveCurrent();
      }
    }

    get().generate(input);
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
    set({
      character: stamped,
      saveNotice: 'Character saved successfully.',
      openedCharacterId: stamped.meta.id,
      hasUnsavedChanges: false,
    });
    await get().loadSaved();
  },
  openCharacter: async (id) => {
    const character = await CharacterRepository.get(id);
    if (!character) return;
    set({ character, error: undefined, openedCharacterId: id, hasUnsavedChanges: false });
  },
  duplicateCharacter: async (id) => {
    const duplicate = await CharacterRepository.duplicate(id);
    if (!duplicate) return;
    set({ character: duplicate, openedCharacterId: duplicate.meta.id, hasUnsavedChanges: false });
    await get().loadSaved();
  },
  deleteCharacter: async (id) => {
    await CharacterRepository.delete(id);
    if (get().character?.meta.id === id) {
      set({ character: undefined, openedCharacterId: undefined, hasUnsavedChanges: false });
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
      set({
        character,
        error: undefined,
        aiStatus: undefined,
        openedCharacterId: undefined,
        hasUnsavedChanges: false,
      });
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
      setUnsavedForOpenedCharacter(set);
      if (get().openedCharacterId && character.meta.id === get().openedCharacterId) {
        void requestSavePrompt({
          mode: 'afterLevelUp',
          title: 'Save Level-Up Changes?',
          message: 'Advancement was applied. Save this opened character now?',
          saveLabel: 'Save Now',
          secondaryLabel: 'Later',
        }).then(async (choice) => {
          if (choice === 'save') {
            await get().saveCurrent();
          }
        });
      }
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
    setUnsavedForOpenedCharacter(set);
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
          const nextLocalUrl = getLocalPortraitUrl(nextCharacter);
          nextCharacter.image = {
            ...nextCharacter.image,
            prompt: portraitPromptFromCharacter(nextCharacter, style),
            ...(nextCharacter.image.provider.includes('local')
              ? {
                  url: nextLocalUrl || undefined,
                  thumbnail: nextLocalUrl || undefined,
                }
              : {}),
          };
        }
      }
    }

    set({ character: nextCharacter });
    setUnsavedForOpenedCharacter(set);
    if (nextCharacter.image?.provider.includes('local')) {
      void resolveLocalPortraitUrl(nextCharacter).then((resolvedUrl) => {
        set((state) => {
          const current = state.character;
          if (!current || current.meta.id !== nextCharacter.meta.id || !current.image || !current.image.provider.includes('local')) {
            return {};
          }
          if (current.image.url === resolvedUrl && current.image.thumbnail === resolvedUrl) return {};
          return {
            character: {
              ...current,
              image: {
                ...current.image,
                url: resolvedUrl ?? undefined,
                thumbnail: resolvedUrl ?? undefined,
              },
            },
          };
        });
      });
    }
  },
  generateBackstory: async () => {
    const character = get().character;
    if (!character) return;
    const unlockedUntil = get().aiUnlockedUntil;
    if (!unlockedUntil || unlockedUntil <= Date.now()) {
      try {
        const nextUnlock = await requestAiUnlockUntil();
        if (!nextUnlock) {
          set({ aiStatus: 'AI generation cancelled.', error: undefined });
          return;
        }
        persistAiUnlockUntil(nextUnlock);
        set({ aiUnlockedUntil: nextUnlock, aiStatus: 'AI features unlocked for 30 minutes.' });
      } catch (error) {
        persistAiUnlockUntil(undefined);
        set({
          aiUnlockedUntil: undefined,
          error: error instanceof Error ? error.message : String(error),
          aiStatus: 'AI unlock failed.',
        });
        return;
      }
    }
    set({ loadingBackstory: true, error: undefined, aiStatus: 'Generating backstory...' });
    try {
      const ai = getAiProvider();
      const backstory = await ai.generateBackstory(character);
      set({ character: { ...character, backstory }, loadingBackstory: false, aiStatus: 'Backstory generated successfully.' });
      setUnsavedForOpenedCharacter(set);
    } catch (error) {
      if (allowAiFallback()) {
        const mock = new MockAIProvider();
        const backstory = await mock.generateBackstory(character);
        set({
          character: { ...character, backstory },
          loadingBackstory: false,
          error: undefined,
          aiStatus: 'Live AI unavailable; generated backstory using local fallback.',
        });
        setUnsavedForOpenedCharacter(set);
      } else {
        set({
          loadingBackstory: false,
          error: error instanceof Error ? error.message : String(error),
          aiStatus: 'Backstory generation failed.',
        });
      }
    }
  },
  generatePortrait: async (request) => {
    const character = get().character;
    if (!character) return;
    const unlockedUntil = get().aiUnlockedUntil;
    if (!unlockedUntil || unlockedUntil <= Date.now()) {
      try {
        const nextUnlock = await requestAiUnlockUntil();
        if (!nextUnlock) {
          const mock = new MockAIProvider();
          const image = await mock.generatePortrait(character, request);
        set({
          character: { ...character, image },
          aiStatus: 'AI generation cancelled. Local class portrait kept.',
          error: undefined,
        });
        setUnsavedForOpenedCharacter(set);
        return;
      }
        persistAiUnlockUntil(nextUnlock);
        set({ aiUnlockedUntil: nextUnlock, aiStatus: 'AI features unlocked for 30 minutes.' });
      } catch (error) {
        persistAiUnlockUntil(undefined);
        const mock = new MockAIProvider();
        const image = await mock.generatePortrait(character, request);
        set({
          character: { ...character, image },
          aiUnlockedUntil: undefined,
          error: undefined,
          aiStatus: `AI unlock failed. Applied local class portrait (${error instanceof Error ? error.message : String(error)}).`,
        });
        setUnsavedForOpenedCharacter(set);
        return;
      }
    }
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
        setUnsavedForOpenedCharacter(set);
        return;
      }
      set({ character: { ...character, image }, loadingPortrait: false, aiStatus: 'Portrait generated successfully.' });
      setUnsavedForOpenedCharacter(set);
    } catch (error) {
      const mock = new MockAIProvider();
      const image = await mock.generatePortrait(character, request);
      set({
        character: { ...character, image },
        loadingPortrait: false,
        error: undefined,
        aiStatus: `Live AI unavailable; using local class portrait (${error instanceof Error ? error.message : String(error)}).`,
      });
      setUnsavedForOpenedCharacter(set);
    }
  },
  clearAiStatus: () => set({ aiStatus: undefined }),
  clearStatus: () => set({ aiStatus: undefined, error: undefined }),
  clearSaveNotice: () => set({ saveNotice: undefined }),
  setAiPasswordValue: (value) => set({ aiPasswordValue: value }),
  submitAiPassword: () => {
    const value = get().aiPasswordValue.trim();
    set({ aiPasswordModalOpen: false, aiPasswordValue: '' });
    resolveAiPassword(value || null);
  },
  cancelAiPassword: () => {
    set({ aiPasswordModalOpen: false, aiPasswordValue: '' });
    resolveAiPassword(null);
  },
  respondToSavePrompt: (choice) => {
    resolveSavePrompt(choice);
  },
}));
