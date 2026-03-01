import classesRaw from './classes.json';
import subclassesRaw from './subclasses.json';
import racesRaw from './races.json';
import subracesRaw from './subraces.json';
import backgroundsRaw from './backgrounds.json';
import equipmentRaw from './equipment.json';
import spellsRaw from './spells.json';
import featuresRaw from './features.json';
import featsRaw from './feats.json';
import {
  backgroundSchema,
  classSchema,
  equipmentSchema,
  featSchema,
  featureSchema,
  raceSchema,
  spellSchema,
  subraceSchema,
  subclassSchema,
} from './schemas';

export const classes = classSchema.array().parse(classesRaw);
export const subclasses = subclassSchema.array().parse(subclassesRaw);
export const races = raceSchema.array().parse(racesRaw);
export const subraces = subraceSchema.array().parse(subracesRaw);
export const backgrounds = backgroundSchema.array().parse(backgroundsRaw);
export const equipment = equipmentSchema.array().parse(equipmentRaw);
export const spells = spellSchema.array().parse(spellsRaw);
export const features = featureSchema.array().parse(featuresRaw);
export const feats = featSchema.array().parse(featsRaw);

export const classById = new Map(classes.map((x) => [x.id, x]));
export const raceById = new Map(races.map((x) => [x.id, x]));
export const subraceById = new Map(subraces.map((x) => [x.id, x]));
export const backgroundById = new Map(backgrounds.map((x) => [x.id, x]));
export const equipmentById = new Map(equipment.map((x) => [x.id, x]));
export const featureById = new Map(features.map((x) => [x.id, x]));
export const featById = new Map(feats.map((x) => [x.id, x]));
export const subclassesByClassId = new Map<string, typeof subclasses>();

for (const subclass of subclasses) {
  const list = subclassesByClassId.get(subclass.classId) ?? [];
  list.push(subclass);
  subclassesByClassId.set(subclass.classId, list);
}

export const spellsByClassId = new Map<string, typeof spells>();
for (const spell of spells) {
  for (const classId of spell.classes) {
    const list = spellsByClassId.get(classId) ?? [];
    list.push(spell);
    spellsByClassId.set(classId, list);
  }
}

export function validateRulesReferences(): string[] {
  const issues: string[] = [];

  for (const subclass of subclasses) {
    if (!classById.has(subclass.classId)) {
      issues.push(`Subclass ${subclass.id} references missing class ${subclass.classId}`);
    }
  }

  for (const subrace of subraces) {
    if (!raceById.has(subrace.raceId)) {
      issues.push(`Subrace ${subrace.id} references missing race ${subrace.raceId}`);
    }
  }

  for (const background of backgrounds) {
    for (const itemId of background.equipment) {
      if (!equipmentById.has(itemId)) {
        issues.push(`Background ${background.id} references missing equipment ${itemId}`);
      }
    }
  }

  for (const classDef of classes) {
    for (const levelFeatures of Object.values(classDef.featuresByLevel)) {
      for (const featureId of levelFeatures) {
        if (!featureById.has(featureId) && !featureId.endsWith('_feature') && !featureId.includes('archetype') && !featureId.includes('path') && !featureId.includes('oath') && !featureId.includes('origin') && !featureId.includes('tradition') && !featureId.includes('domain') && !featureId.includes('circle') && !featureId.includes('patron')) {
          issues.push(`Class ${classDef.id} references missing feature ${featureId}`);
        }
      }
    }
  }

  return issues;
}
