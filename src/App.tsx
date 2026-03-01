import { useEffect } from 'react';
import { CharacterWorkspace } from './components/CharacterWorkspace';
import { GeneratorPanel } from './components/GeneratorPanel';
import { SavedCharactersPanel } from './components/SavedCharactersPanel';
import { validateRulesReferences } from './data/rules';
import { useAppStore } from './store/useAppStore';
import d20Icon from './assets/ui/icons/d20.png';
import rollOfHeroesWordmark from './assets/ui/icons/roll-of-heroes.png';
import './index.css';

function App() {
  const error = useAppStore((s) => s.error);
  const aiStatus = useAppStore((s) => s.aiStatus);
  const saveNotice = useAppStore((s) => s.saveNotice);
  const clearAiStatus = useAppStore((s) => s.clearAiStatus);
  const clearSaveNotice = useAppStore((s) => s.clearSaveNotice);
  const dataIssues = [...new Set(validateRulesReferences())];

  useEffect(() => {
    if (!saveNotice) return;
    const timeoutId = window.setTimeout(() => clearSaveNotice(), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [saveNotice, clearSaveNotice]);

  useEffect(() => {
    if (!aiStatus || error) return;
    const timeoutId = window.setTimeout(() => clearAiStatus(), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [aiStatus, error, clearAiStatus]);

  return (
    <main className="app-shell">
      <header className="hero">
        <h1 className="hero-title">
          <img src={d20Icon} alt="" aria-hidden="true" className="hero-title-icon" />
          <span>THE ROLL OF HEROES</span>
          <img src={rollOfHeroesWordmark} alt="" aria-hidden="true" className="hero-title-wordmark" />
        </h1>
      </header>

      {dataIssues.length > 0 && (
        <section className="panel error">
          <h2>Rules Data Issues</h2>
          <ul>
            {dataIssues.map((issue, idx) => (
              <li key={`${idx}:${issue}`}>{issue}</li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <section className="panel error">
          <h2>Error</h2>
          <p>{error}</p>
        </section>
      )}

      {saveNotice ? (
        <div className="save-modal-backdrop" aria-live="polite" role="status">
          <div className="save-modal">{saveNotice}</div>
        </div>
      ) : null}

      {aiStatus && !error ? (
        <div className="ai-modal-backdrop" aria-live="polite" role="status">
          <div className="ai-modal">{aiStatus}</div>
        </div>
      ) : null}

      <GeneratorPanel />
      <div className="section-divider" aria-hidden="true" />
      <CharacterWorkspace />
      <div className="section-divider" aria-hidden="true" />
      <SavedCharactersPanel />

      <footer className="app-footer">
        <a href="/attributions.html">Attributions</a>
      </footer>
    </main>
  );
}

export default App;
