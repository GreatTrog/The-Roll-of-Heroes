import type { Character } from '../../types/character';
import { useAppStore } from '../../store/useAppStore';
import { useState } from 'react';

export function BackstoryTab({ character }: { character: Character }) {
  const generateBackstory = useAppStore((s) => s.generateBackstory);
  const loadingBackstory = useAppStore((s) => s.loadingBackstory);
  const [showCaravanImage, setShowCaravanImage] = useState(true);

  return (
    <div className="backstory-layout">
      <div>
        <h3>Backstory Pack</h3>
        <div className="ai-action-row">
          <button onClick={() => void generateBackstory()} disabled={loadingBackstory}>
            {loadingBackstory ? 'Generating...' : 'Regenerate with AI'}
          </button>
          <span>(Password Required)</span>
        </div>
        <p>{character.backstory.origin}</p>
        <h4>Defining Moments</h4>
        <ul>
          {character.backstory.definingMoments.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <h4>Allies</h4>
        <ul>
          {character.backstory.allies.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p><strong>Rival:</strong> {character.backstory.rival}</p>
        <p><strong>Secret:</strong> {character.backstory.secret}</p>
        <p><strong>Rumor:</strong> {character.backstory.rumor}</p>
        <h4>Roleplay Prompts</h4>
        <ul>
          {character.backstory.roleplayPrompts.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p><strong>Quest Hook:</strong> {character.backstory.questHook}</p>
      </div>
      {showCaravanImage ? (
        <aside className="backstory-illustration-wrap" aria-hidden="true">
          <img
            className="backstory-illustration"
            src="/images/caravan.png"
            alt=""
            onError={() => setShowCaravanImage(false)}
          />
        </aside>
      ) : null}
    </div>
  );
}
