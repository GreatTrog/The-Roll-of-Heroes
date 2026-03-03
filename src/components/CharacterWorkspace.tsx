import { useEffect, useMemo, useRef, useState } from 'react';
import { CharacterPdfDownload } from '../pdf/CharacterPdf';
import { useAppStore, type TabKey } from '../store/useAppStore';
import { BackstoryTab } from './tabs/BackstoryTab';
import { PortraitTab } from './tabs/PortraitTab';
import { SheetTab } from './tabs/SheetTab';
import { SpellsTab } from './tabs/SpellsTab';
import { abilityKeys, skillKeys, type AbilityKey, type AdvancementChoice } from '../types/character';
import { applyAdvancementChoices, getFeatChoiceRequirements, validateAsiChoice, validateFeatChoice } from '../engine/feats';
import { backgrounds, equipment, equipmentById, feats, races } from '../data/rules';
import { MAX_LOADOUT_WEAPONS } from '../engine/weapons';

const tabs: TabKey[] = ['sheet', 'spells', 'backstory', 'portrait'];

type AdvancementDraft = {
  mode: 'asi' | 'feat';
  asiPrimary: AbilityKey;
  asiSecondary: AbilityKey;
  asiSplit: boolean;
  featId: string;
  selection: {
    abilityChoices: string[];
    saveChoices: string[];
    skillChoices: string[];
    toolChoices: string[];
    weaponChoices: string[];
    languageChoices: string[];
  };
};

const defaultDraft = (featsEnabled: boolean): AdvancementDraft => ({
  mode: featsEnabled ? 'feat' : 'asi',
  asiPrimary: 'str',
  asiSecondary: 'dex',
  asiSplit: false,
  featId: '',
  selection: {
    abilityChoices: [],
    saveChoices: [],
    skillChoices: [],
    toolChoices: [],
    weaponChoices: [],
    languageChoices: [],
  },
});

const emptySelection = (): AdvancementDraft['selection'] => ({
  abilityChoices: [],
  saveChoices: [],
  skillChoices: [],
  toolChoices: [],
  weaponChoices: [],
  languageChoices: [],
});

const getAbilityOptionsForFeat = (featId: string): AbilityKey[] => {
  const feat = feats.find((x) => x.id === featId);
  const options = new Set<AbilityKey>();
  for (const choice of feat?.effects?.abilityChoiceBonuses ?? []) {
    for (const ability of choice.from) options.add(ability);
  }
  return options.size > 0 ? [...options] : [...abilityKeys];
};

function reconcileAdvancementDrafts(
  drafts: AdvancementDraft[],
  opportunityCount: number,
  featsEnabled: boolean,
): AdvancementDraft[] {
  const next = [...drafts];
  while (next.length < opportunityCount) next.push(defaultDraft(featsEnabled));
  return next.slice(0, opportunityCount).map((draft) => ({
    ...draft,
    mode: featsEnabled ? draft.mode : 'asi',
  }));
}

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
  const getAvailableWeaponOptions = useAppStore((s) => s.getAvailableWeaponOptions);
  const addWeaponToLoadout = useAppStore((s) => s.addWeaponToLoadout);
  const removeWeaponFromLoadout = useAppStore((s) => s.removeWeaponFromLoadout);
  const moveWeaponInLoadout = useAppStore((s) => s.moveWeaponInLoadout);
  const getAsiOpportunitiesForTarget = useAppStore((s) => s.getAsiOpportunitiesForTarget);
  const getFeatEligibilityForCurrent = useAppStore((s) => s.getFeatEligibilityForCurrent);
  const lastCharacterOpenedAt = useAppStore((s) => s.lastCharacterOpenedAt);

  const [hpMethod, setHpMethod] = useState<'average' | 'roll' | 'manual'>('average');
  const [targetLevel, setTargetLevel] = useState<number>(2);
  const [manualHp, setManualHp] = useState<number>(1);
  const [featSearch, setFeatSearch] = useState<string>('');
  const [newWeaponId, setNewWeaponId] = useState<string>('');
  const [advancementDrafts, setAdvancementDrafts] = useState<AdvancementDraft[]>([]);
  const [isWeaponLoadoutCollapsed, setIsWeaponLoadoutCollapsed] = useState<boolean>(true);
  const [isLevelAdvancementCollapsed, setIsLevelAdvancementCollapsed] = useState<boolean>(true);
  const [importFileName, setImportFileName] = useState<string>('');
  const [isNameModalOpen, setIsNameModalOpen] = useState<boolean>(false);
  const [firstNameInput, setFirstNameInput] = useState<string>('');
  const [surnameInput, setSurnameInput] = useState<string>('');
  const [nameModalError, setNameModalError] = useState<string>('');
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const sheetTopRef = useRef<HTMLDivElement | null>(null);

  const diffSummary = useMemo(() => {
    if (!character) return '';
    return `Level ${character.identity.level} -> ${targetLevel} | HP method: ${hpMethod}`;
  }, [character, hpMethod, targetLevel]);

  const onImportFile = async (file: File | null) => {
    if (!file) return;
    setImportFileName(file.name);
    const raw = await file.text();
    await importJson(raw);
  };

  const asiOpportunities = getAsiOpportunitiesForTarget(targetLevel);
  const featEligibility = getFeatEligibilityForCurrent();
  const filteredFeatEligibility = featEligibility.filter((entry) => {
    const term = featSearch.trim().toLowerCase();
    if (!entry.eligible) return false;
    if (!term) return true;
    return entry.feat.name.toLowerCase().includes(term) || entry.feat.summary.toLowerCase().includes(term);
  });
  const effectiveAdvancementDrafts = useMemo(
    () => reconcileAdvancementDrafts(advancementDrafts, asiOpportunities.length, featsEnabled),
    [advancementDrafts, asiOpportunities.length, featsEnabled],
  );

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

  const weaponOptions = useMemo(
    () => equipment.filter((item) => item.type === 'weapon').map((item) => item.id),
    [],
  );
  const languageOptions = useMemo(() => {
    const all = new Set<string>();
    for (const race of races) {
      for (const language of race.languages) all.add(language);
    }
    for (const background of backgrounds) {
      for (const language of background.languages) all.add(language);
    }
    return [...all].sort((a, b) => a.localeCompare(b));
  }, []);
  const availableWeaponOptions = getAvailableWeaponOptions();
  const addableWeaponOptions = availableWeaponOptions.filter(
    (option) => !character?.equipment.weaponIds.includes(option.id),
  );
  const selectedNewWeaponId = useMemo(() => {
    if (addableWeaponOptions.length === 0) return '';
    if (newWeaponId && addableWeaponOptions.some((option) => option.id === newWeaponId)) return newWeaponId;
    return addableWeaponOptions[0]!.id;
  }, [addableWeaponOptions, newWeaponId]);

  const updateDraft = (index: number, next: Partial<AdvancementDraft>) => {
    setAdvancementDrafts((prev) =>
      reconcileAdvancementDrafts(prev, asiOpportunities.length, featsEnabled).map((draft, idx) =>
        idx === index ? { ...draft, ...next } : draft,
      ),
    );
  };

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

  const selectFeatForDraft = (index: number, featId: string) => {
    setAdvancementDrafts((prev) =>
      reconcileAdvancementDrafts(prev, asiOpportunities.length, featsEnabled).map((draft, idx) =>
        idx === index
          ? {
              ...draft,
              featId,
              selection: emptySelection(),
            }
          : draft,
      ),
    );
  };

  const clearDraftSelection = (index: number) => {
    setAdvancementDrafts((prev) =>
      reconcileAdvancementDrafts(prev, asiOpportunities.length, featsEnabled).map((draft, idx) =>
        idx === index
          ? {
              ...draft,
              featId: '',
              selection: emptySelection(),
            }
          : draft,
      ),
    );
  };

  const toggleSelectionValue = (
    index: number,
    key: keyof AdvancementDraft['selection'],
    value: string,
    maxChoices: number,
  ) => {
    setAdvancementDrafts((prev) =>
      reconcileAdvancementDrafts(prev, asiOpportunities.length, featsEnabled).map((draft, idx) => {
        if (idx !== index) return draft;
        const current = draft.selection[key];
        const exists = current.includes(value);
        if (exists) {
          return { ...draft, selection: { ...draft.selection, [key]: current.filter((item) => item !== value) } };
        }
        if (current.length >= maxChoices) return draft;
        return { ...draft, selection: { ...draft.selection, [key]: [...current, value] } };
      }),
    );
  };

  const buildChoiceFromDraft = (draft: AdvancementDraft): AdvancementChoice | undefined => {
    if (draft.mode === 'asi') {
      return draft.asiSplit
        ? { type: 'asi', increases: [{ ability: draft.asiPrimary, amount: 1 }, { ability: draft.asiSecondary, amount: 1 }] }
        : { type: 'asi', increases: [{ ability: draft.asiPrimary, amount: 2 }] };
    }
    if (!draft.featId) return undefined;
    return {
      type: 'feat',
      featId: draft.featId,
      selection: {
        abilityChoices: draft.selection.abilityChoices as AbilityKey[],
        saveChoices:
          draft.featId === 'resilient' && draft.selection.abilityChoices.length === 1
            ? (draft.selection.abilityChoices as AbilityKey[])
            : (draft.selection.saveChoices as AbilityKey[]),
        skillChoices: draft.selection.skillChoices,
        toolChoices: draft.selection.toolChoices,
        weaponChoices: draft.selection.weaponChoices,
        languageChoices: draft.selection.languageChoices,
      },
    };
  };

  const draftErrors = character
    ? effectiveAdvancementDrafts.map((draft, index) => {
      const choice = buildChoiceFromDraft(draft);
      if (!choice) return ['Select a feat.'];
      const priorChoices = effectiveAdvancementDrafts
        .slice(0, index)
        .map(buildChoiceFromDraft)
        .filter((x): x is AdvancementChoice => Boolean(x));
      const baseline = applyAdvancementChoices(character, priorChoices);
      if (choice.type === 'asi') return validateAsiChoice(baseline, choice);
      return validateFeatChoice(baseline, choice);
    })
    : [];

  const canSubmitLevelUp = character
    ? targetLevel > character.identity.level &&
      targetLevel <= 20 &&
      (hpMethod !== 'manual' || manualHp >= 1) &&
      draftErrors.every((errors) => errors.length === 0)
    : false;

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
            <button key={tab} className={activeTab === tab ? 'tab active' : 'tab'} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'sheet' && <SheetTab character={character} />}
        {activeTab === 'spells' && <SpellsTab character={character} />}
        {activeTab === 'backstory' && <BackstoryTab character={character} />}
        {activeTab === 'portrait' && <PortraitTab character={character} />}
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
          <CharacterPdfDownload character={character} />
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
              onClick={() => setIsWeaponLoadoutCollapsed((prev) => !prev)}
              aria-expanded={!isWeaponLoadoutCollapsed}
            >
              {isWeaponLoadoutCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
          {!isWeaponLoadoutCollapsed ? (
            <>
              <p className="tiny">Manage up to {MAX_LOADOUT_WEAPONS} equipped weapons. Attacks update automatically.</p>
              <div className="controls">
            <label>
              Add Weapon
              <select value={selectedNewWeaponId} onChange={(e) => setNewWeaponId(e.target.value)} disabled={addableWeaponOptions.length === 0}>
                {addableWeaponOptions.length === 0 ? (
                  <option value="">No additional proficient weapons</option>
                ) : (
                  addableWeaponOptions.map((option) => (
                    <option key={`add-weapon:${option.id}`} value={option.id}>{option.name}</option>
                  ))
                )}
              </select>
            </label>
              <button
              type="button"
              onClick={() => selectedNewWeaponId && addWeaponToLoadout(selectedNewWeaponId)}
              disabled={!selectedNewWeaponId || addableWeaponOptions.length === 0}
            >
              Add Weapon
            </button>
          </div>
          <div className="saved-list">
            {character.equipment.weaponIds.length === 0 ? (
              <p>No weapons in loadout.</p>
            ) : (
              character.equipment.weaponIds.map((weaponId, index) => (
                <article key={`loadout:${weaponId}:${index}`} className="saved-item">
                  <div>
                    <strong>{equipmentById.get(weaponId)?.name ?? weaponId.replaceAll('_', ' ')}</strong>
                    {character.combat.attacks[index] ? (
                      <p>+{character.combat.attacks[index].toHit} to hit - {character.combat.attacks[index].damage}</p>
                    ) : null}
                  </div>
                  <div className="controls">
                    <button type="button" onClick={() => moveWeaponInLoadout(index, index - 1)} disabled={index === 0}>Up</button>
                    <button type="button" onClick={() => moveWeaponInLoadout(index, index + 1)} disabled={index === character.equipment.weaponIds.length - 1}>Down</button>
                    <button type="button" onClick={() => removeWeaponFromLoadout(weaponId)}>Remove</button>
                  </div>
                </article>
              ))
            )}
          </div>
            </>
          ) : null}
        </div>

        <div className="panel subpanel advancement-panel">
          <div className="subpanel-header">
            <h3>Level Advancement</h3>
            <button
              type="button"
              className="subpanel-toggle"
              onClick={() => setIsLevelAdvancementCollapsed((prev) => !prev)}
              aria-expanded={!isLevelAdvancementCollapsed}
            >
              {isLevelAdvancementCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
          {!isLevelAdvancementCollapsed ? (
            <>
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
          {asiOpportunities.length > 0 ? (
            <div className="advancement-choice-wrap">
              <h4>ASI / Feat Choices</h4>
              <p>
                This level-up includes {asiOpportunities.length} {asiOpportunities.length > 1 ? 'ASI opportunities' : 'ASI opportunity'} at level
                {asiOpportunities.length > 1 ? 's ' : ' '}
                {asiOpportunities.join(', ')}.
              </p>
              {effectiveAdvancementDrafts.map((draft, idx) => {
                const feat = draft.featId ? feats.find((x) => x.id === draft.featId) : undefined;
                const reqs = feat ? getFeatChoiceRequirements(feat) : undefined;
                const isResilient = feat?.id === 'resilient';
                const featAbilityOptions = feat ? getAbilityOptionsForFeat(feat.id) : [...abilityKeys];
                return (
                  <div key={`adv-choice:${idx}`} className="advancement-choice">
                    <strong>Choice {idx + 1}</strong>
                    <div className="controls">
                      <label className="inline-toggle">
                        <input
                          type="radio"
                          checked={draft.mode === 'asi'}
                          onChange={() => updateDraft(idx, { mode: 'asi' })}
                        />
                        Take ASI
                      </label>
                      {featsEnabled ? (
                        <label className="inline-toggle">
                          <input
                            type="radio"
                            checked={draft.mode === 'feat'}
                            onChange={() => updateDraft(idx, { mode: 'feat' })}
                          />
                          Take Feat
                        </label>
                      ) : null}
                    </div>

                    {draft.mode === 'asi' ? (
                      <div className="grid3">
                        <label>
                          ASI Pattern
                          <select value={draft.asiSplit ? 'split' : 'single'} onChange={(e) => updateDraft(idx, { asiSplit: e.target.value === 'split' })}>
                            <option value="single">+2 to one ability</option>
                            <option value="split">+1 to two abilities</option>
                          </select>
                        </label>
                        <label>
                          Ability 1
                          <select value={draft.asiPrimary} onChange={(e) => updateDraft(idx, { asiPrimary: e.target.value as AbilityKey })}>
                            {abilityKeys.map((ability) => (
                              <option key={`asi1:${idx}:${ability}`} value={ability}>{ability.toUpperCase()}</option>
                            ))}
                          </select>
                        </label>
                        {draft.asiSplit ? (
                          <label>
                            Ability 2
                            <select value={draft.asiSecondary} onChange={(e) => updateDraft(idx, { asiSecondary: e.target.value as AbilityKey })}>
                              {abilityKeys.map((ability) => (
                                <option key={`asi2:${idx}:${ability}`} value={ability}>{ability.toUpperCase()}</option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                      </div>
                    ) : (
                      <div className="feat-picker">
                        <label>
                          Search Feats
                          <input
                            value={featSearch}
                            onChange={(e) => setFeatSearch(e.target.value)}
                            placeholder="Search feat name or summary"
                          />
                        </label>
                        <div className="feat-list">
                          {filteredFeatEligibility.length > 0 ? (
                            filteredFeatEligibility.map((entry) => (
                              <button
                                key={`feat-row:${idx}:${entry.feat.id}`}
                                type="button"
                                className={draft.featId === entry.feat.id ? 'feat-row selected' : 'feat-row'}
                                onClick={() => selectFeatForDraft(idx, entry.feat.id)}
                              >
                                <span><strong>{entry.feat.name}</strong> - {entry.feat.summary}</span>
                              </button>
                            ))
                          ) : (
                            <p className="tiny">No selectable feats match current prerequisites and search.</p>
                          )}
                        </div>
                        {feat && reqs ? (
                          <div className="feat-choice-controls">
                            <div className="controls">
                              <button type="button" onClick={() => clearDraftSelection(idx)}>Clear Feat Selection</button>
                            </div>
                            {reqs.abilityChoices > 0 ? (
                                <div>
                                  <strong>{isResilient ? 'Ability + Save choice' : 'Ability choice(s)'}</strong>
                                  <p className="tiny">Choose {reqs.abilityChoices}</p>
                                  <div className="choice-grid">
                                  {featAbilityOptions.map((ability) => {
                                    const checked = draft.selection.abilityChoices.includes(ability);
                                    return (
                                      <label key={`feat-ability:${idx}:${ability}`} className="inline-toggle">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleSelectionValue(idx, 'abilityChoices', ability, reqs.abilityChoices)}
                                        />
                                        {ability.toUpperCase()}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                            {reqs.saveChoices > 0 && !isResilient ? (
                              <div>
                                <strong>Save proficiency choice(s)</strong>
                                <p className="tiny">Choose {reqs.saveChoices}</p>
                                <div className="choice-grid">
                                  {abilityKeys.map((ability) => {
                                    const checked = draft.selection.saveChoices.includes(ability);
                                    return (
                                      <label key={`feat-save:${idx}:${ability}`} className="inline-toggle">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleSelectionValue(idx, 'saveChoices', ability, reqs.saveChoices)}
                                        />
                                        {ability.toUpperCase()}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                            {reqs.skillChoices > 0 ? (
                              <div>
                                <strong>Skill choice(s)</strong>
                                <p className="tiny">Choose {reqs.skillChoices}</p>
                                <div className="choice-grid">
                                  {skillKeys.map((skill) => {
                                    const checked = draft.selection.skillChoices.includes(skill);
                                    return (
                                      <label key={`feat-skill:${idx}:${skill}`} className="inline-toggle">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleSelectionValue(idx, 'skillChoices', skill, reqs.skillChoices)}
                                        />
                                        {skill.replaceAll('_', ' ')}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                            {reqs.weaponChoices > 0 ? (
                              <div>
                                <strong>Weapon proficiency choice(s)</strong>
                                <p className="tiny">Choose {reqs.weaponChoices}</p>
                                <div className="choice-grid">
                                  {weaponOptions.map((weapon) => {
                                    const checked = draft.selection.weaponChoices.includes(weapon);
                                    return (
                                      <label key={`feat-weapon:${idx}:${weapon}`} className="inline-toggle">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleSelectionValue(idx, 'weaponChoices', weapon, reqs.weaponChoices)}
                                        />
                                        {weapon.replaceAll('_', ' ')}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                            {reqs.languageChoices > 0 ? (
                              <div>
                                <strong>Language choice(s)</strong>
                                <p className="tiny">Choose {reqs.languageChoices}</p>
                                <div className="choice-grid">
                                  {languageOptions.map((language) => {
                                    const checked = draft.selection.languageChoices.includes(language);
                                    return (
                                      <label key={`feat-language:${idx}:${language}`} className="inline-toggle">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleSelectionValue(idx, 'languageChoices', language, reqs.languageChoices)}
                                        />
                                        {language}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                    {draftErrors[idx]?.length ? (
                      <div className="advancement-errors">
                        {draftErrors[idx].map((error, errorIdx) => <p key={`adv-error:${idx}:${errorIdx}`}>{error}</p>)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
          <p>Review Diff: {diffSummary}</p>
          <button
            disabled={!canSubmitLevelUp}
            onClick={() =>
              levelUp({
                targetLevel,
                hpMethod,
                hpManualGain: hpMethod === 'manual' ? manualHp : undefined,
                advancementChoices: effectiveAdvancementDrafts.map(buildChoiceFromDraft).filter((x): x is AdvancementChoice => Boolean(x)),
              })
            }
          >
            Confirm Advancement
          </button>
            </>
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
