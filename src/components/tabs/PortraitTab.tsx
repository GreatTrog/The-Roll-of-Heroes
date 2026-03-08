import { useState } from 'react';
import type { Character } from '../../types/character';
import { useAppStore } from '../../store/useAppStore';

export function PortraitTab({ character }: { character: Character }) {
  const generatePortrait = useAppStore((s) => s.generatePortrait);
  const loadingPortrait = useAppStore((s) => s.loadingPortrait);
  const [stylePreset, setStylePreset] = useState<'fantasy_painting' | 'inked_comic' | 'grim_realism'>('fantasy_painting');
  const [negativePrompt, setNegativePrompt] = useState('text, watermark, blurry, deformed anatomy, duplicate face');

  return (
    <div>
      <h3>Portrait</h3>
      <div className="grid2">
        <label>
          Style
          <select value={stylePreset} onChange={(e) => setStylePreset(e.target.value as typeof stylePreset)}>
            <option value="fantasy_painting">Fantasy Painting</option>
            <option value="inked_comic">Inked Comic</option>
            <option value="grim_realism">Grim Realism</option>
          </select>
        </label>
        <label>
          Negative Prompt
          <input value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} />
        </label>
      </div>
      <div className="ai-action-row">
        <button className="portrait-actions" onClick={() => void generatePortrait({ stylePreset, negativePrompt })} disabled={loadingPortrait}>
          {loadingPortrait ? 'Generating...' : 'Generate Portrait'}
        </button>
        <span>(Password Required)</span>
      </div>

      {character.image ? (
        <div className="portrait-layout">
          <div className="portrait-hero-wrap">
            {character.image.url ? (
              <img
                src={character.image.url}
                alt="Character portrait"
                className="portrait-hero"
                loading="lazy"
                decoding="async"
                fetchPriority="low"
              />
            ) : (
              <p>No image URL returned by provider yet.</p>
            )}
          </div>
          <div className="portrait-meta">
            <p><strong>Seed:</strong> {character.image.seed}</p>
            <p><strong>Prompt:</strong> {character.image.prompt}</p>
            <p><strong>Negative Prompt:</strong> {character.image.negativePrompt}</p>
            <p><strong>Provider:</strong> {character.image.provider} / {character.image.model}</p>
          </div>
        </div>
      ) : (
        <p>No portrait generated yet.</p>
      )}
    </div>
  );
}
