import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import { useState } from 'react';
import type { Character } from '../types/character';
import { skillAbilityMap, skillKeys } from '../types/character';
import { equipmentById, spells } from '../data/rules';

Font.register({
  family: 'Oldenburg',
  src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/oldenburg/Oldenburg-Regular.ttf',
});

Font.register({
  family: 'EagleLake',
  src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/eaglelake/EagleLake-Regular.ttf',
});

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 28, paddingHorizontal: 28, fontSize: 10, fontFamily: 'Oldenburg', color: '#2b1d0e' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  headerText: { flex: 1 },
  title: { fontSize: 22, marginBottom: 4, color: '#5e2416', fontFamily: 'EagleLake' },
  subtitle: { fontSize: 10, color: '#6f5640', marginBottom: 0, fontFamily: 'Oldenburg' },
  titleThumbWrap: { width: 54, height: 54, borderRadius: 6, border: '1 solid #cab089', overflow: 'hidden' },
  titleThumb: { width: '100%', height: '100%', objectFit: 'cover' },
  titleThumbFallback: {
    width: 54,
    height: 54,
    borderRadius: 6,
    border: '1 solid #cab089',
    backgroundColor: '#f5e6ca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleThumbFallbackText: { fontSize: 8, color: '#6f5640', textAlign: 'center', fontFamily: 'Oldenburg' },
  quickStatsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  quickStat: {
    flex: 1,
    border: '1 solid #d6c2a2',
    borderRadius: 6,
    padding: 6,
    backgroundColor: '#fef1dd',
    alignItems: 'center',
  },
  quickLabel: { fontSize: 8, color: '#6f5640', fontFamily: 'Oldenburg', textAlign: 'center' },
  quickValue: { fontSize: 13, fontWeight: 'bold', marginTop: 1, fontFamily: 'Oldenburg', textAlign: 'center' },
  sheetOuter: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  leftArea: { flex: 3, gap: 8 },
  rightFeature: { flex: 1, minHeight: 520 },
  topBand: { flexDirection: 'row', gap: 8, minHeight: 320 },
  skillsTall: { flex: 1, minHeight: 320 },
  centerStack: { flex: 2, gap: 8 },
  topPair: { flexDirection: 'row', gap: 8, minHeight: 150 },
  pairCell: { flex: 1, minHeight: 150 },
  attacksWide: { minHeight: 160 },
  equipmentWide: { minHeight: 120 },
  packColumnsRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  packCol: { flex: 1 },
  compactBlock: { flexGrow: 1, border: '1 solid #d6c2a2', borderRadius: 6, padding: 8, backgroundColor: '#fef8ef' },
  tallBlock: { flexGrow: 1, border: '1 solid #d6c2a2', borderRadius: 6, padding: 8, backgroundColor: '#fef8ef' },
  block: { marginBottom: 10, border: '1 solid #d6c2a2', borderRadius: 4, padding: 8, backgroundColor: '#fef8ef' },
  sectionTitle: { fontSize: 12, marginBottom: 5, color: '#4d2e13', fontFamily: 'EagleLake' },
  smallHeading: { fontSize: 10, color: '#4d2e13', fontFamily: 'EagleLake' },
  smallHeadingBlock: { fontSize: 10, color: '#4d2e13', fontFamily: 'EagleLake', marginTop: 8, marginBottom: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  col: { flex: 1 },
  tiny: { fontSize: 9, lineHeight: 1.3, fontFamily: 'Oldenburg' },
  portrait: { width: 140, height: 140, borderRadius: 4, border: '1 solid #cab089' },
  portraitEmbedWrap: { width: 210, height: 210, borderRadius: 4, border: '1 solid #cab089', overflow: 'hidden', marginBottom: 8 },
  portraitEmbed: { width: '100%', height: '100%', objectFit: 'cover' },
  hr: { marginVertical: 5, borderBottom: '1 solid #ddccb0' },
  listItem: { marginBottom: 2 },
  lineBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginBottom: 2 },
  backstoryOrigin: { marginBottom: 8, lineHeight: 1.45 },
  backstoryListItem: { marginBottom: 3, lineHeight: 1.4 },
  backstoryInline: { marginTop: 6, lineHeight: 1.45 },
});

function displayEquipmentName(id: string): string {
  return equipmentById.get(id)?.name ?? id.replaceAll('_', ' ');
}

function CharacterPdfDocument({ character }: { character: Character }) {
  const spellSlotText = Object.entries(character.spellcasting.slots)
    .map(([k, v]) => `${k.replace('level', 'L')}:${v}`)
    .join(' ');
  const pb = character.combat.proficiencyBonus;
  const spellById = new Map(spells.map((s) => [s.id, s]));
  const packItems = character.equipment.items
    .map((id) => equipmentById.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item && item.contains && item.contains.length > 0));

  const knownCantripRows = character.spellcasting.spellsKnown
    .filter((id) => (spellById.get(id)?.level ?? 0) === 0)
    .map((id) => {
      const spell = spellById.get(id);
      return spell
        ? `${spell.name} (L${spell.level}) - ${spell.summary}`
        : `${id.replaceAll('_', ' ')} - No description available.`;
    });
  const knownLeveledRows = character.spellcasting.spellsKnown
    .filter((id) => (spellById.get(id)?.level ?? 99) > 0)
    .map((id) => {
      const spell = spellById.get(id);
      return spell
        ? `${spell.name} (L${spell.level}) - ${spell.summary}`
        : `${id.replaceAll('_', ' ')} - No description available.`;
    });

  const preparedSpellRows = character.spellcasting.spellsPrepared.map((id) => {
    const spell = spellById.get(id);
    return spell
      ? `${spell.name} (L${spell.level}) - ${spell.summary}`
      : `${id.replaceAll('_', ' ')} - No description available.`;
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {character.image?.url ? (
            <View style={styles.titleThumbWrap}>
              <Image src={character.image.url} style={styles.titleThumb} />
            </View>
          ) : (
            <View style={styles.titleThumbFallback}>
              <Text style={styles.titleThumbFallbackText}>No Portrait</Text>
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={styles.title}>{character.identity.name}</Text>
            <Text style={styles.subtitle}>{`${character.identity.raceId} ${character.identity.classId} (Level ${character.identity.level}) - ${character.identity.backgroundId} - ${character.identity.alignment}`}</Text>
          </View>
        </View>

        <View style={styles.quickStatsRow}>
          <View style={styles.quickStat}>
            <Text style={styles.quickLabel}>PB</Text>
            <Text style={styles.quickValue}>{`+${character.combat.proficiencyBonus}`}</Text>
          </View>
          <View style={styles.quickStat}>
            <Text style={styles.quickLabel}>AC</Text>
            <Text style={styles.quickValue}>{character.combat.ac}</Text>
          </View>
          <View style={styles.quickStat}>
            <Text style={styles.quickLabel}>HP</Text>
            <Text style={styles.quickValue}>{`${character.combat.currentHp}/${character.combat.hpMax}`}</Text>
          </View>
          <View style={styles.quickStat}>
            <Text style={styles.quickLabel}>Init</Text>
            <Text style={styles.quickValue}>{`${character.combat.initiative >= 0 ? '+' : ''}${character.combat.initiative}`}</Text>
          </View>
          <View style={styles.quickStat}>
            <Text style={styles.quickLabel}>Speed</Text>
            <Text style={styles.quickValue}>{character.combat.speed}</Text>
          </View>
          <View style={styles.quickStat}>
            <Text style={styles.quickLabel}>Hit Dice</Text>
            <Text style={styles.quickValue}>{`${character.identity.level}${character.combat.hitDie}`}</Text>
          </View>
        </View>

        <View style={styles.sheetOuter}>
          <View style={styles.leftArea}>
            <View style={styles.topBand}>
              <View style={[styles.skillsTall, styles.tallBlock]}>
                <Text style={styles.sectionTitle}>Skills</Text>
                {skillKeys.map((skill) => {
                  const proficient = character.proficiencies.skills[skill];
                  const base = character.abilities.modifiers[skillAbilityMap[skill]];
                  const score = base + (proficient ? pb : 0);
                  return (
                    <View key={skill} style={styles.lineBetween}>
                      <Text style={styles.tiny}>{skill.replaceAll('_', ' ')}</Text>
                      <Text style={styles.tiny}>{`${proficient ? 'Prof' : 'Norm'} ${score >= 0 ? '+' : ''}${score}`}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.centerStack}>
                <View style={styles.topPair}>
                  <View style={[styles.pairCell, styles.compactBlock]}>
                    <Text style={styles.sectionTitle}>Saving Throws</Text>
                    {Object.entries(character.proficiencies.savingThrows).map(([k, proficient]) => {
                      const ability = k as keyof typeof character.abilities.modifiers;
                      const value = character.abilities.modifiers[ability] + (proficient ? pb : 0);
                      return (
                        <View key={k} style={styles.lineBetween}>
                          <Text style={styles.tiny}>{k.toUpperCase()}</Text>
                          <Text style={styles.tiny}>{`${proficient ? 'Proficient' : 'Normal'} ${value >= 0 ? '+' : ''}${value}`}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={[styles.pairCell, styles.compactBlock]}>
                    <Text style={styles.sectionTitle}>Abilities</Text>
                    {Object.entries(character.abilities.scores).map(([key, score]) => (
                      <View key={key} style={styles.lineBetween}>
                        <Text style={styles.tiny}>{key.toUpperCase()}</Text>
                        <Text style={styles.tiny}>{`${score} (${character.abilities.modifiers[key as keyof typeof character.abilities.modifiers] >= 0 ? '+' : ''}${character.abilities.modifiers[key as keyof typeof character.abilities.modifiers]})`}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={[styles.attacksWide, styles.compactBlock]}>
                  <Text style={styles.sectionTitle}>Attacks</Text>
                  {character.combat.attacks.map((a) => (
                    <Text key={a.id} style={styles.tiny}>{`${a.name}: +${a.toHit} to hit - ${a.damage}`}</Text>
                  ))}
                </View>
              </View>
            </View>

            <View style={[styles.equipmentWide, styles.compactBlock]}>
              <Text style={styles.sectionTitle}>Equipment</Text>
              <Text style={styles.tiny}>
                <Text style={styles.smallHeading}>Armor: </Text>
                {`${character.equipment.armorId ? displayEquipmentName(character.equipment.armorId) : 'none'} ${
                  character.equipment.shield ? '+ shield' : ''
                }`}
              </Text>
              <Text style={styles.tiny}>
                <Text style={styles.smallHeading}>Weapons: </Text>
                {`${
                  character.equipment.weaponIds.length > 0
                    ? character.equipment.weaponIds.map(displayEquipmentName).join(', ')
                    : 'none'
                }`}
              </Text>
              <Text style={styles.tiny}>
                <Text style={styles.smallHeading}>Items: </Text>
                {`${
                  character.equipment.items.length > 0
                    ? character.equipment.items.map(displayEquipmentName).join(', ')
                    : 'none'
                }`}
              </Text>
              {packItems.length > 0 ? <Text style={styles.smallHeadingBlock}>Item Contents</Text> : null}
              {packItems.length > 1 ? (
                <View style={styles.packColumnsRow}>
                  {packItems.map((pack) => (
                    <View key={pack.id} style={styles.packCol}>
                      <Text style={styles.smallHeading}>{pack.name}</Text>
                      {pack.contains?.map((entry) => (
                        <Text key={`${pack.id}:${entry}`} style={[styles.tiny, styles.listItem]}>{`• ${entry}`}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              ) : (
                packItems.map((pack) => (
                  <View key={pack.id}>
                    <Text style={styles.smallHeading}>{pack.name}</Text>
                    {pack.contains?.map((entry) => (
                      <Text key={`${pack.id}:${entry}`} style={[styles.tiny, styles.listItem]}>{`• ${entry}`}</Text>
                    ))}
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={[styles.rightFeature, styles.tallBlock]}>
            <Text style={styles.sectionTitle}>Features</Text>
            {character.features.map((f) => (
              <Text key={`${f.level}:${f.id}`} style={styles.tiny}>{`L${f.level} ${f.name}: ${f.summary}`}</Text>
            ))}
          </View>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Spells and Portrait</Text>

        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Spellcasting</Text>
          <Text style={styles.tiny}>{`Enabled: ${character.spellcasting.enabled ? 'Yes' : 'No'} - Type: ${character.spellcasting.knownType}`}</Text>
          <Text style={styles.tiny}>{`Ability: ${character.spellcasting.castingAbility ?? 'n/a'} - Save DC: ${character.spellcasting.saveDc ?? 'n/a'} - Attack Bonus: ${character.spellcasting.spellAttackBonus ?? 'n/a'}`}</Text>
          <Text style={styles.tiny}>{`Slots: ${spellSlotText}`}</Text>
          <View style={styles.hr} />
          <Text style={styles.tiny}>{`Cantrips Known: ${character.spellcasting.cantripsKnown} - Levelled Spells Known: ${knownLeveledRows.length}`}</Text>
          <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Cantrips</Text>
          {knownCantripRows.length > 0 ? (
            knownCantripRows.map((line, idx) => (
              <Text key={`cantrip:${idx}`} style={[styles.tiny, styles.listItem]}>{`• ${line}`}</Text>
            ))
          ) : (
            <Text style={styles.tiny}>None</Text>
          )}
          <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Known Spells</Text>
          {knownLeveledRows.length > 0 ? (
            knownLeveledRows.map((line, idx) => (
              <Text key={`known:${idx}`} style={[styles.tiny, styles.listItem]}>{`• ${line}`}</Text>
            ))
          ) : (
            <Text style={styles.tiny}>None</Text>
          )}
          <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Prepared Spells</Text>
          {preparedSpellRows.length > 0 ? (
            preparedSpellRows.map((line, idx) => (
              <Text key={`prep:${idx}`} style={[styles.tiny, styles.listItem]}>{`• ${line}`}</Text>
            ))
          ) : (
            <Text style={styles.tiny}>None</Text>
          )}
        </View>

        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Portrait</Text>
          {character.image?.url ? (
            <View style={styles.portraitEmbedWrap}>
              <Image src={character.image.url} style={styles.portraitEmbed} />
            </View>
          ) : (
            <Text style={styles.tiny}>No portrait image available in character data.</Text>
          )}
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Backstory Pack</Text>
        <View style={styles.block}>
          <Text style={[styles.tiny, styles.backstoryOrigin]}>{character.backstory.origin}</Text>
          <Text style={styles.smallHeadingBlock}>Defining Moments</Text>
          {character.backstory.definingMoments.map((m, idx) => (
            <Text key={`moment:${idx}`} style={[styles.tiny, styles.backstoryListItem]}>{`${idx + 1}. ${m}`}</Text>
          ))}
          <Text style={styles.smallHeadingBlock}>Allies</Text>
          {character.backstory.allies.map((a, idx) => (
            <Text key={`ally:${idx}`} style={[styles.tiny, styles.backstoryListItem]}>{`${idx + 1}. ${a}`}</Text>
          ))}
          <Text style={[styles.tiny, styles.backstoryInline]}>
            <Text style={styles.smallHeading}>Rival: </Text>
            {character.backstory.rival}
          </Text>
          <Text style={[styles.tiny, styles.backstoryInline]}>
            <Text style={styles.smallHeading}>Secret: </Text>
            {character.backstory.secret}
          </Text>
          <Text style={[styles.tiny, styles.backstoryInline]}>
            <Text style={styles.smallHeading}>Rumour: </Text>
            {character.backstory.rumor}
          </Text>
          <Text style={styles.smallHeadingBlock}>Roleplay Prompts</Text>
          {character.backstory.roleplayPrompts.map((p, idx) => (
            <Text key={`prompt:${idx}`} style={[styles.tiny, styles.backstoryListItem]}>{`${idx + 1}. ${p}`}</Text>
          ))}
          <Text style={[styles.tiny, styles.backstoryInline]}>
            <Text style={styles.smallHeading}>Quest Hook: </Text>
            {character.backstory.questHook}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export function CharacterPdfDownload({ character }: { character: Character }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const onDownload = async () => {
    setIsGenerating(true);
    try {
      const blob = await pdf(<CharacterPdfDocument character={character} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${character.identity.name.replace(/\s+/g, '_')}-sheet.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button type="button" onClick={() => void onDownload()} disabled={isGenerating}>
      {isGenerating ? 'Preparing PDF...' : 'Export PDF'}
    </button>
  );
}
