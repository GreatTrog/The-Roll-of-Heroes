import { useDeferredValue, useMemo, useState } from 'react';
import { applyAdvancementChoices, getFeatChoiceRequirements, validateAsiChoice, validateFeatChoice } from '../engine/feats';
import { backgrounds, equipment, feats, races } from '../data/rules';
import { useAppStore } from '../store/useAppStore';
import { abilityKeys, skillKeys, type AbilityKey, type AdvancementChoice } from '../types/character';

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

export function LevelAdvancementPanel() {
  const character = useAppStore((s) => s.character);
  const levelUp = useAppStore((s) => s.levelUp);
  const featsEnabled = useAppStore((s) => s.featsEnabled);
  const getAsiOpportunitiesForTarget = useAppStore((s) => s.getAsiOpportunitiesForTarget);
  const getFeatEligibilityForCurrent = useAppStore((s) => s.getFeatEligibilityForCurrent);

  const [hpMethod, setHpMethod] = useState<'average' | 'roll' | 'manual'>('average');
  const [targetLevel, setTargetLevel] = useState<number>(2);
  const [manualHp, setManualHp] = useState<number>(1);
  const [featSearch, setFeatSearch] = useState('');
  const [advancementDrafts, setAdvancementDrafts] = useState<AdvancementDraft[]>([]);

  const deferredFeatSearch = useDeferredValue(featSearch);

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

  if (!character) return null;

  const diffSummary = `Level ${character.identity.level} -> ${targetLevel} | HP method: ${hpMethod}`;
  const asiOpportunities = getAsiOpportunitiesForTarget(targetLevel);
  const featEligibility = getFeatEligibilityForCurrent();
  const filteredFeatEligibility = featEligibility.filter((entry) => {
    const term = deferredFeatSearch.trim().toLowerCase();
    if (!entry.eligible) return false;
    if (!term) return true;
    return entry.feat.name.toLowerCase().includes(term) || entry.feat.summary.toLowerCase().includes(term);
  });
  const effectiveAdvancementDrafts = useMemo(
    () => reconcileAdvancementDrafts(advancementDrafts, asiOpportunities.length, featsEnabled),
    [advancementDrafts, asiOpportunities.length, featsEnabled],
  );

  const updateDraft = (index: number, next: Partial<AdvancementDraft>) => {
    setAdvancementDrafts((prev) =>
      reconcileAdvancementDrafts(prev, asiOpportunities.length, featsEnabled).map((draft, idx) =>
        idx === index ? { ...draft, ...next } : draft,
      ),
    );
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

  const draftErrors = effectiveAdvancementDrafts.map((draft, index) => {
    const choice = buildChoiceFromDraft(draft);
    if (!choice) return ['Select a feat.'];
    const priorChoices = effectiveAdvancementDrafts
      .slice(0, index)
      .map(buildChoiceFromDraft)
      .filter((x): x is AdvancementChoice => Boolean(x));
    const baseline = applyAdvancementChoices(character, priorChoices);
    if (choice.type === 'asi') return validateAsiChoice(baseline, choice);
    return validateFeatChoice(baseline, choice);
  });

  const canSubmitLevelUp =
    targetLevel > character.identity.level &&
    targetLevel <= 20 &&
    (hpMethod !== 'manual' || manualHp >= 1) &&
    draftErrors.every((errors) => errors.length === 0);

  return (
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
      {hpMethod === 'manual' ? (
        <label>
          Manual HP Gain
          <input type="number" min={1} value={manualHp} onChange={(e) => setManualHp(Number(e.target.value))} />
        </label>
      ) : null}
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
  );
}
