import type { Character } from '../types/character';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceToken(text: string, from: string, to: string): string {
  const trimmed = from.trim();
  if (!trimmed || trimmed.toLowerCase() === to.trim().toLowerCase()) return text;
  const pattern = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, 'gi');
  return text.replace(pattern, to);
}

export function replaceNameInText(text: string, previousName: string, nextName: string): string {
  const prev = previousName.trim();
  const next = nextName.trim();
  if (!prev || !next || prev.toLowerCase() === next.toLowerCase()) return text;

  const previousFirstName = prev.split(/\s+/)[0] ?? '';
  const nextFirstName = next.split(/\s+/)[0] ?? next;

  let updated = replaceToken(text, prev, next);
  if (previousFirstName) {
    updated = replaceToken(updated, previousFirstName, nextFirstName);
  }
  return updated;
}

export function replaceNameInBackstory(
  backstory: Character['backstory'],
  previousName: string,
  nextName: string,
): Character['backstory'] {
  return {
    origin: replaceNameInText(backstory.origin, previousName, nextName),
    definingMoments: backstory.definingMoments.map((item) => replaceNameInText(item, previousName, nextName)),
    allies: backstory.allies.map((item) => replaceNameInText(item, previousName, nextName)),
    rival: replaceNameInText(backstory.rival, previousName, nextName),
    secret: replaceNameInText(backstory.secret, previousName, nextName),
    rumor: replaceNameInText(backstory.rumor, previousName, nextName),
    roleplayPrompts: backstory.roleplayPrompts.map((item) => replaceNameInText(item, previousName, nextName)),
    questHook: replaceNameInText(backstory.questHook, previousName, nextName),
  };
}
