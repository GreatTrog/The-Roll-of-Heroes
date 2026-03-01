import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export function SavedCharactersPanel() {
  const saved = useAppStore((s) => s.saved);
  const loadSaved = useAppStore((s) => s.loadSaved);
  const search = useAppStore((s) => s.search);
  const setSearch = useAppStore((s) => s.setSearch);
  const sort = useAppStore((s) => s.sort);
  const setSort = useAppStore((s) => s.setSort);
  const openCharacter = useAppStore((s) => s.openCharacter);
  const duplicateCharacter = useAppStore((s) => s.duplicateCharacter);
  const deleteCharacter = useAppStore((s) => s.deleteCharacter);
  const exportCharacterById = useAppStore((s) => s.exportCharacterById);
  const exportAllCharacters = useAppStore((s) => s.exportAllCharacters);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  return (
    <section className="panel">
      <h2>Saved Characters</h2>
      <div className="grid3">
        <label>
          Search
          <input value={search} onChange={(e) => void setSearch(e.target.value)} placeholder="name/class/race" />
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => void setSort(e.target.value as typeof sort)}>
            <option value="updatedAt">Last Updated</option>
            <option value="name">Name</option>
            <option value="level">Level</option>
          </select>
        </label>
      </div>

      <div className="controls" style={{ marginTop: '0.5rem' }}>
        <button onClick={() => void exportAllCharacters()} disabled={saved.length === 0}>
          Export All
        </button>
      </div>

      <div className="saved-list">
        {saved.length === 0 ? (
          <p>No saved characters yet.</p>
        ) : (
          saved.map((item) => (
            <article key={item.id} className="saved-item">
              <div>
                <strong>{item.name}</strong>
                <p>
                  L{item.level} {item.raceId} {item.classId}
                </p>
                <p>{new Date(item.updatedAt).toLocaleString()}</p>
              </div>
              {item.portraitThumbnail ? <img src={item.portraitThumbnail} alt={`${item.name} thumbnail`} className="thumb" /> : null}
              <div className="controls">
                <button onClick={() => void openCharacter(item.id)}>Open</button>
                <button onClick={() => void exportCharacterById(item.id)}>Export</button>
                <button onClick={() => void duplicateCharacter(item.id)}>Duplicate</button>
                <button onClick={() => void deleteCharacter(item.id)}>Delete</button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
