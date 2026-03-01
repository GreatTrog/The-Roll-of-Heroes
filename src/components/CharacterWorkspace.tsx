import { useMemo, useState } from 'react';
import { CharacterPdfDownload } from '../pdf/CharacterPdf';
import { useAppStore, type TabKey } from '../store/useAppStore';
import { BackstoryTab } from './tabs/BackstoryTab';
import { PortraitTab } from './tabs/PortraitTab';
import { SheetTab } from './tabs/SheetTab';
import { SpellsTab } from './tabs/SpellsTab';

const tabs: TabKey[] = ['sheet', 'spells', 'backstory', 'portrait'];

export function CharacterWorkspace() {
  const character = useAppStore((s) => s.character);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const saveCurrent = useAppStore((s) => s.saveCurrent);
  const exportCurrent = useAppStore((s) => s.exportCurrent);
  const importJson = useAppStore((s) => s.importJson);
  const levelUp = useAppStore((s) => s.levelUp);
  const featsEnabled = useAppStore((s) => s.featsEnabled);
  const setFeatsEnabled = useAppStore((s) => s.setFeatsEnabled);
  const updateCharacterName = useAppStore((s) => s.updateCharacterName);
  const updateCharacterGender = useAppStore((s) => s.updateCharacterGender);

  const [hpMethod, setHpMethod] = useState<'average' | 'roll' | 'manual'>('average');
  const [targetLevel, setTargetLevel] = useState<number>(2);
  const [manualHp, setManualHp] = useState<number>(1);
  const [asiOrFeat, setAsiOrFeat] = useState<string>('');
  const [importFileName, setImportFileName] = useState<string>('');

  const diffSummary = useMemo(() => {
    if (!character) return '';
    return `Level ${character.identity.level} -> ${targetLevel} | HP method: ${hpMethod}`;
  }, [character, hpMethod, targetLevel]);

  if (!character) {
    return (
      <section className="panel">
        <h2>Character</h2>
        <p>Generate or load a character to continue.</p>
      </section>
    );
  }

  const onImportFile = async (file: File | null) => {
    if (!file) return;
    setImportFileName(file.name);
    const raw = await file.text();
    await importJson(raw);
  };

  return (
    <section>
      <div className="tabs">
        {tabs.map((tab) => (
          <button key={tab} className={activeTab === tab ? 'tab active' : 'tab'} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'sheet' && <SheetTab character={character} />}
      {activeTab === 'spells' && <SpellsTab character={character} />}
      {activeTab === 'backstory' && <BackstoryTab character={character} />}
      {activeTab === 'portrait' && <PortraitTab character={character} />}

      <div className="panel controls-wrap">
        <h2>Character Controls</h2>
        <div className="controls">
          <button onClick={() => void saveCurrent()}>Save</button>
          <button onClick={exportCurrent}>Export JSON</button>
          <CharacterPdfDownload character={character} />
          <label className="inline-toggle">
            <input type="checkbox" checked={featsEnabled} onChange={(e) => setFeatsEnabled(e.target.checked)} />
            Feats Enabled
          </label>
        </div>

        <div className="name-gender-row">
          <label>
            Character Name
            <input
              value={character.identity.name}
              onChange={(e) => updateCharacterName(e.target.value)}
              placeholder="Enter character name"
            />
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

        <div className="grid2">
          <label>
            Import Character JSON File
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
            />
            {importFileName ? <small>Selected: {importFileName}</small> : null}
          </label>
          <div className="panel subpanel">
            <h3>Level Advancement</h3>
            <label>
              Target Level
              <input type="number" min={character.identity.level + 1} max={20} value={targetLevel} onChange={(e) => setTargetLevel(Number(e.target.value))} />
            </label>
            <label>
              HP Method
              <select value={hpMethod} onChange={(e) => setHpMethod(e.target.value as typeof hpMethod)}>
                <option value="average">Average</option>
                <option value="roll">Roll</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            {hpMethod === 'manual' && (
              <label>
                Manual HP Gain
                <input type="number" min={1} value={manualHp} onChange={(e) => setManualHp(Number(e.target.value))} />
              </label>
            )}
            {featsEnabled && (
              <label>
                ASI / Feat choice (optional)
                <input value={asiOrFeat} onChange={(e) => setAsiOrFeat(e.target.value)} placeholder="+2 STR / Great Weapon Master" />
              </label>
            )}
            <p>Review Diff: {diffSummary}</p>
            <button
              onClick={() =>
                levelUp({
                  targetLevel,
                  hpMethod,
                  hpManualGain: hpMethod === 'manual' ? manualHp : undefined,
                  featOrAsi: asiOrFeat || undefined,
                })
              }
            >
              Confirm Advancement
            </button>
          </div>
        </div>
      </div>

      <section className="panel">
        <h3>Advancement History</h3>
        {character.advancement.history.length === 0 ? (
          <p>No level-up history yet.</p>
        ) : (
          <ul>
            {character.advancement.history.map((entry, idx) => (
              <li key={`${entry.timestamp}:${idx}`}>
                {entry.timestamp}: L{entry.fromLevel} to L{entry.toLevel}, HP +{entry.hpGain}, method {entry.hpMethod}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
