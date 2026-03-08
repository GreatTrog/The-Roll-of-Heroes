import { lazy, Suspense, startTransition, useEffect, useRef, useState } from 'react';
import { useAppStore, type TabKey } from '../store/useAppStore';
import { SheetTab } from './tabs/SheetTab';

const tabs: TabKey[] = ['sheet', 'spells', 'backstory', 'portrait'];
const SpellsTab = lazy(async () => ({ default: (await import('./tabs/SpellsTab')).SpellsTab }));
const BackstoryTab = lazy(async () => ({ default: (await import('./tabs/BackstoryTab')).BackstoryTab }));
const PortraitTab = lazy(async () => ({ default: (await import('./tabs/PortraitTab')).PortraitTab }));
const WeaponLoadoutPanel = lazy(async () => ({ default: (await import('./WeaponLoadoutPanel')).WeaponLoadoutPanel }));
const LevelAdvancementPanel = lazy(async () => ({ default: (await import('./LevelAdvancementPanel')).LevelAdvancementPanel }));

export function CharacterWorkspace() {
  const character = useAppStore((s) => s.character);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const saveCurrent = useAppStore((s) => s.saveCurrent);
  const exportCurrent = useAppStore((s) => s.exportCurrent);
  const importJson = useAppStore((s) => s.importJson);
  const featsEnabled = useAppStore((s) => s.featsEnabled);
  const setFeatsEnabled = useAppStore((s) => s.setFeatsEnabled);
  const updateCharacterName = useAppStore((s) => s.updateCharacterName);
  const updateCharacterGender = useAppStore((s) => s.updateCharacterGender);
  const lastCharacterOpenedAt = useAppStore((s) => s.lastCharacterOpenedAt);

  const [isWeaponLoadoutCollapsed, setIsWeaponLoadoutCollapsed] = useState(true);
  const [isLevelAdvancementCollapsed, setIsLevelAdvancementCollapsed] = useState(true);
  const [weaponLoadoutReady, setWeaponLoadoutReady] = useState(false);
  const [levelAdvancementReady, setLevelAdvancementReady] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [firstNameInput, setFirstNameInput] = useState('');
  const [surnameInput, setSurnameInput] = useState('');
  const [nameModalError, setNameModalError] = useState('');
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const sheetTopRef = useRef<HTMLDivElement | null>(null);

  const onImportFile = async (file: File | null) => {
    if (!file) return;
    setImportFileName(file.name);
    const raw = await file.text();
    await importJson(raw);
  };

  const onExportPdf = async () => {
    if (!character || isPreparingPdf) return;
    setIsPreparingPdf(true);
    try {
      const { downloadCharacterPdf } = await import('../pdf/CharacterPdf');
      await downloadCharacterPdf(character);
    } finally {
      setIsPreparingPdf(false);
    }
  };

  useEffect(() => {
    if (!character || !lastCharacterOpenedAt) return;
    setActiveTab('sheet');
    const target = sheetTopRef.current;
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      target.focus({ preventScroll: true });
    }, 0);
  }, [character, lastCharacterOpenedAt, setActiveTab]);

  const openNameModal = () => {
    setFirstNameInput('');
    setSurnameInput('');
    setNameModalError('');
    setIsNameModalOpen(true);
  };

  const closeNameModal = () => {
    setIsNameModalOpen(false);
    setNameModalError('');
  };

  const saveNameFromModal = () => {
    const first = firstNameInput.trim();
    const surname = surnameInput.trim();
    const nextName = [first, surname].filter(Boolean).join(' ');
    if (!nextName) {
      setNameModalError('Name must contain at least one character.');
      return;
    }
    updateCharacterName(nextName);
    closeNameModal();
  };

  const toggleWeaponLoadout = () => {
    if (isWeaponLoadoutCollapsed) setWeaponLoadoutReady(true);
    setIsWeaponLoadoutCollapsed((prev) => !prev);
  };

  const toggleLevelAdvancement = () => {
    if (isLevelAdvancementCollapsed) setLevelAdvancementReady(true);
    setIsLevelAdvancementCollapsed((prev) => !prev);
  };

  if (!character) {
    return (
      <section className="panel">
        <h2>Character</h2>
        <p>Generate or load a character to continue.</p>
      </section>
    );
  }

  return (
    <section>
      <div ref={sheetTopRef} tabIndex={-1} className={activeTab === 'sheet' ? 'panel tab-host sheet-panel' : 'panel tab-host'}>
        <div className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? 'tab active' : 'tab'}
              onClick={() => startTransition(() => setActiveTab(tab))}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'sheet' && <SheetTab character={character} />}
        {activeTab !== 'sheet' ? (
          <Suspense fallback={<p>Loading {activeTab}...</p>}>
            {activeTab === 'spells' ? <SpellsTab character={character} /> : null}
            {activeTab === 'backstory' ? <BackstoryTab character={character} /> : null}
            {activeTab === 'portrait' ? <PortraitTab character={character} /> : null}
          </Suspense>
        ) : null}
      </div>

      <div className="section-divider" aria-hidden="true" />

      <div className="panel controls-wrap">
        <h2>Character Controls</h2>
        <div className="controls">
          <button onClick={() => void saveCurrent()}>Save</button>
          <button onClick={exportCurrent}>Export JSON</button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
          />
          <button type="button" onClick={() => importInputRef.current?.click()}>Import JSON</button>
          <button type="button" onClick={() => void onExportPdf()} disabled={isPreparingPdf}>
            {isPreparingPdf ? 'Preparing PDF...' : 'Export PDF'}
          </button>
          <label className="inline-toggle">
            <input type="checkbox" checked={featsEnabled} onChange={(e) => setFeatsEnabled(e.target.checked)} />
            Feats Enabled
          </label>
          {importFileName ? <small>Imported: {importFileName}</small> : null}
        </div>

        <div className="name-gender-row">
          <label>
            Character Name
            <div className="controls">
              <button type="button" onClick={openNameModal}>Change Name</button>
              <span>{character.identity.name}</span>
            </div>
          </label>
          <label>
            Gender
            <select value={character.identity.gender} onChange={(e) => updateCharacterGender(e.target.value as typeof character.identity.gender)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>

        <div className="panel subpanel">
          <div className="subpanel-header">
            <h3>Weapon Loadout</h3>
            <button
              type="button"
              className="subpanel-toggle"
              onClick={toggleWeaponLoadout}
              aria-expanded={!isWeaponLoadoutCollapsed}
            >
              {isWeaponLoadoutCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
          {weaponLoadoutReady ? (
            <Suspense fallback={!isWeaponLoadoutCollapsed ? <p>Loading weapon loadout...</p> : null}>
              <div hidden={isWeaponLoadoutCollapsed} aria-hidden={isWeaponLoadoutCollapsed}>
                <WeaponLoadoutPanel />
              </div>
            </Suspense>
          ) : null}
        </div>

        <div className="panel subpanel advancement-panel">
          <div className="subpanel-header">
            <h3>Level Advancement</h3>
            <button
              type="button"
              className="subpanel-toggle"
              onClick={toggleLevelAdvancement}
              aria-expanded={!isLevelAdvancementCollapsed}
            >
              {isLevelAdvancementCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
          {levelAdvancementReady ? (
            <Suspense fallback={!isLevelAdvancementCollapsed ? <p>Loading level advancement...</p> : null}>
              <div hidden={isLevelAdvancementCollapsed} aria-hidden={isLevelAdvancementCollapsed}>
                <LevelAdvancementPanel />
              </div>
            </Suspense>
          ) : null}
        </div>
      </div>

      {isNameModalOpen ? (
        <div className="save-prompt-backdrop" role="dialog" aria-modal="true" aria-labelledby="change-name-title">
          <form
            className="save-prompt-modal"
            onSubmit={(event) => {
              event.preventDefault();
              saveNameFromModal();
            }}
          >
            <h3 id="change-name-title">Change Name</h3>
            <label>
              First name
              <input
                value={firstNameInput}
                onChange={(event) => setFirstNameInput(event.target.value)}
                autoFocus
              />
            </label>
            <label>
              Surname
              <input
                value={surnameInput}
                onChange={(event) => setSurnameInput(event.target.value)}
              />
            </label>
            {nameModalError ? <p>{nameModalError}</p> : null}
            <div className="controls">
              <button type="submit">Save</button>
              <button type="button" onClick={closeNameModal}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="section-divider" aria-hidden="true" />

      <section className="panel">
        <h3>Advancement History</h3>
        {character.advancement.history.length === 0 ? (
          <p>No level-up history yet.</p>
        ) : (
          <ul>
            {character.advancement.history.map((entry, idx) => (
              <li key={`${entry.timestamp}:${idx}`}>
                {entry.timestamp}: L{entry.fromLevel} to L{entry.toLevel}, HP +{entry.hpGain}, method {entry.hpMethod}
                {entry.advancementChoice ? (
                  <> | {entry.advancementChoice.type === 'asi'
                    ? `ASI (${entry.advancementChoice.increases.map((inc) => `+${inc.amount} ${inc.ability.toUpperCase()}`).join(', ')})`
                    : `Feat (${entry.advancementChoice.featId.replaceAll('_', ' ')})`}</>
                ) : entry.legacyAsiOrFeat ? <> | {entry.legacyAsiOrFeat}</> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
