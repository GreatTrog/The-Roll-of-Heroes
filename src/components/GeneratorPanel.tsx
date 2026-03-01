import { useState } from 'react';
import { classes, races } from '../data/rules';
import { useAppStore } from '../store/useAppStore';

const presetTags = [
  'veteran',
  'cursed',
  'heroic',
  'dark',
  'gritty',
  'comic',
  'noble',
  'outcast',
  'arcane',
  'holy',
  'mercenary',
  'wanderer',
  'vengeful',
  'scholar',
];

export function GeneratorPanel() {
  const generate = useAppStore((s) => s.generate);
  const reroll = useAppStore((s) => s.reroll);
  const locks = useAppStore((s) => s.locks);
  const toggleLock = useAppStore((s) => s.toggleLock);
  const resetLocks = useAppStore((s) => s.resetLocks);

  const [mode, setMode] = useState<'one_click' | 'three_choices' | 'guided'>('one_click');
  const [level, setLevel] = useState(1);
  const [classId, setClassId] = useState(classes[0]?.id ?? 'fighter');
  const [raceId, setRaceId] = useState(races[0]?.id ?? 'human');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('other');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [combatRole, setCombatRole] = useState<'damage' | 'tank' | 'support' | 'control'>('damage');

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const onModeChange = (nextMode: typeof mode) => {
    setMode(nextMode);
    if (nextMode !== 'guided') {
      setSelectedTags([]);
      resetLocks();
    }
  };

  return (
    <section className="panel">
      <h2>Generator</h2>
      <div className="grid2">
        <label>
          Mode
          <select value={mode} onChange={(e) => onModeChange(e.target.value as typeof mode)}>
            <option value="one_click">One-Click</option>
            <option value="three_choices">Three Choices</option>
            <option value="guided">Guided</option>
          </select>
        </label>

        <label>
          Level
          <input type="number" min={1} max={20} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
        </label>
      </div>

      {mode === 'guided' && (
        <div className="tag-picker">
          <div className="tag-picker-head">
            <strong>Tags</strong>
            <button type="button" className="tag-clear" onClick={() => setSelectedTags([])} disabled={selectedTags.length === 0}>
              Clear
            </button>
          </div>
          <div className="tag-chips">
            {presetTags.map((tag) => {
              const selected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={selected ? 'tag-chip selected' : 'tag-chip'}
                  onClick={() => toggleTag(tag)}
                  aria-pressed={selected}
                >
                  {selected ? 'Selected' : 'Select'} {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mode !== 'one_click' && (
        <div className="grid3">
          <label>
            Class
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {mode === 'guided' && (
            <>
              <label>
                Race
                <select value={raceId} onChange={(e) => setRaceId(e.target.value)}>
                  {races.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Gender
                <select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </>
          )}

          {mode === 'three_choices' && (
            <label>
              Combat Role
              <select value={combatRole} onChange={(e) => setCombatRole(e.target.value as typeof combatRole)}>
                <option value="damage">Damage</option>
                <option value="tank">Tank</option>
                <option value="support">Support</option>
                <option value="control">Control</option>
              </select>
            </label>
          )}
        </div>
      )}

      <div className="controls generator-actions">
        <button
          onClick={() =>
            generate({
              mode,
              level,
              classId: mode === 'one_click' ? undefined : classId,
              raceId: mode === 'guided' ? raceId : undefined,
              gender: mode === 'guided' ? gender : undefined,
              tags: mode === 'guided' ? selectedTags : undefined,
              combatRole: mode === 'three_choices' ? combatRole : undefined,
            })
          }
        >
          Generate
        </button>
        {mode === 'guided' ? <button onClick={() => reroll()}>Reroll Unlocked</button> : null}
      </div>

      {mode === 'guided' && (
        <>
          <div className="locks-help">
            <strong>Lock Sections</strong>
            <p>
              Checked items are locked and will stay the same when you click <em>Generate</em> or <em>Reroll Unlocked</em>.
              Unchecked items can change.
            </p>
          </div>

          <div className="locks" aria-label="Lock Sections">
            {(Object.keys(locks) as (keyof typeof locks)[]).map((key) => (
              <button
                key={key}
                type="button"
                className={locks[key] ? 'lock-chip locked' : 'lock-chip'}
                onClick={() => toggleLock(key)}
                title={locks[key] ? `${key} locked` : `${key} unlocked`}
                aria-pressed={locks[key]}
              >
                {locks[key] ? 'Locked' : 'Unlocked'} {key}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
