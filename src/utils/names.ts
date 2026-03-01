import type { Rng } from './random';
export type NameGender = 'male' | 'female' | 'other';

const sharedFirstNames = [
  'Aelar', 'Ari', 'Bryn', 'Caelan', 'Darian', 'Elara', 'Faelan', 'Galen', 'Iris', 'Joran',
  'Kael', 'Liora', 'Mira', 'Nerys', 'Orin', 'Perrin', 'Quill', 'Rowan', 'Selene', 'Tamsin',
  'Ulric', 'Vera', 'Wren', 'Ysolde', 'Zorin', 'Aldric', 'Briala', 'Corin', 'Delphine', 'Eamon',
  'Fiora', 'Gideon', 'Helena', 'Isolde', 'Kestrel', 'Lucan', 'Maris', 'Nolan', 'Odette', 'Riven',
];

const sharedFirstNamesByGender: Record<NameGender, string[]> = {
  male: ['Aldric', 'Cedric', 'Darian', 'Eamon', 'Gideon', 'Joran', 'Kael', 'Lucan', 'Nolan', 'Orin', 'Perrin', 'Theo', 'Ulric', 'Zorin'],
  female: ['Amelia', 'Briala', 'Clara', 'Delphine', 'Elara', 'Fiora', 'Helena', 'Imogen', 'Isolde', 'Liora', 'Maris', 'Nora', 'Odette', 'Tamsin', 'Ysolde'],
  other: ['Ari', 'Bryn', 'Caelan', 'Faelan', 'Galen', 'Harper', 'Iris', 'Kestrel', 'Mira', 'Quill', 'Rowan', 'Riven', 'Selene', 'Vera', 'Wren'],
};

const raceFirstNamePools: Record<string, string[]> = {
  dwarf: ['Brom', 'Dagna', 'Torgrin', 'Hilda', 'Rurik', 'Vonda', 'Kilda', 'Orsik', 'Thrain', 'Brynja', 'Durgan', 'Morgran'],
  elf: ['Aelar', 'Luthien', 'Sylvar', 'Thalion', 'Nimriel', 'Caelynn', 'Ithil', 'Vaelis', 'Seris', 'Aeris', 'Elaria', 'Rylien'],
  halfling: ['Pip', 'Milo', 'Rosie', 'Tobin', 'Nessa', 'Poppy', 'Merric', 'Daisy', 'Rollo', 'Briony', 'Jasper', 'Tilly'],
  human: ['James', 'Amelia', 'Rowan', 'Marcus', 'Eliza', 'Cedric', 'Nora', 'Harper', 'Theo', 'Clara', 'Gareth', 'Imogen'],
  dragonborn: ['Arjhan', 'Balasar', 'Donaar', 'Ghesh', 'Nala', 'Akra', 'Sora', 'Rhogar', 'Torinn', 'Vyth', 'Kava', 'Zorren'],
  gnome: ['Boddynock', 'Nyx', 'Fizzwick', 'Tana', 'Nib', 'Wrenn', 'Jebeddo', 'Pella', 'Rimble', 'Tink', 'Quibli', 'Fen'],
  half_elf: ['Alaric', 'Elyra', 'Saren', 'Mirel', 'Kieran', 'Lyra', 'Talin', 'Vesper', 'Rolen', 'Selia', 'Aeron', 'Brisa'],
  half_orc: ['Grom', 'Shara', 'Thokk', 'Ugra', 'Mog', 'Brena', 'Ront', 'Korga', 'Hruk', 'Dorna', 'Varg', 'Sura'],
  tiefling: ['Azael', 'Nyx', 'Malis', 'Vespera', 'Raze', 'Lilith', 'Kairo', 'Zara', 'Vex', 'Sable', 'Icar', 'Seraph'],
};

const raceSurnamePools: Record<string, string[]> = {
  dwarf: ['Stoneforge', 'Ironforge', 'Goldhammer', 'Runebeard', 'Deepdelver', 'Flintshield', 'Coalbraid', 'Graniteson', 'Stormforge', 'Hammerfall', 'Anvilborn', 'Coppervein'],
  elf: ['Moonwhisper', 'Silverleaf', 'Starbloom', 'Dawnsong', 'Nightpetal', 'Windglade', 'Brightbrook', 'Farsylvan', 'Sunshadow', 'Rivershade', 'Larkwood', 'Starglen'],
  halfling: ['Goodbarrel', 'Brushgather', 'Tealeaf', 'Hilltopple', 'Applebrook', 'Quickstep', 'Puddlefoot', 'Amberfield', 'Merryhill', 'Greenbottle', 'Berrymeadow', 'Thimblewick'],
  human: ['Blackwood', 'Ravencrest', 'Ashford', 'Stormfield', 'Hawthorne', 'Whitlock', 'Stonebridge', 'Redfern', 'Wainwright', 'Fairchild', 'Lockwood', 'Briar'],
  dragonborn: ['Flamecrest', 'Ironscale', 'Stormclaw', 'Emberfang', 'Dreadwing', 'Skyrend', 'Ashmaw', 'Thunderbrand', 'Cragtalon', 'Dawnscale', 'Steelwing', 'Pyrestone'],
  gnome: ['Cogspinner', 'Sprocket', 'Bumblewhizz', 'Fizzlebang', 'Nimblegear', 'Copperwink', 'Twistbolt', 'Mirthspark', 'Geargleam', 'Whistlewick', 'Brasswhirl', 'Tinkertop'],
  half_elf: ['Brightthorn', 'Riverstone', 'Duskvale', 'Windmere', 'Starling', 'Silverbrook', 'Ashbloom', 'Nightwind', 'Dawnmere', 'Thornfield', 'Stormvale', 'Lightgrove'],
  half_orc: ['Ironhide', 'Stonefist', 'Grimscar', 'Bloodriver', 'Ashjaw', 'Skullbreaker', 'Stormtusk', 'Rageborn', 'Frostmaul', 'Bonecrusher', 'Darktooth', 'Warbrand'],
  tiefling: ['Nightbloom', 'Ashfall', 'Duskwrath', 'Embervein', 'Shadowbrand', 'Hellspark', 'Grimflare', 'Umberthorn', 'Blackcandle', 'Dreadmire', 'Cinderveil', 'Sablethorn'],
};

const raceFirstNamesByGender: Partial<Record<string, Record<NameGender, string[]>>> = {
  dwarf: {
    male: ['Brom', 'Torgrin', 'Rurik', 'Orsik', 'Thrain', 'Durgan', 'Morgran'],
    female: ['Dagna', 'Hilda', 'Vonda', 'Kilda', 'Brynja', 'Sigrid', 'Dora'],
    other: ['Kelda', 'Runa', 'Brin', 'Tora', 'Skadi'],
  },
  elf: {
    male: ['Aelar', 'Thalion', 'Vaelis', 'Faelar', 'Rylien'],
    female: ['Luthien', 'Nimriel', 'Caelynn', 'Elaria', 'Seris'],
    other: ['Aeris', 'Ithil', 'Sylvar', 'Nymeri', 'Aelith'],
  },
  halfling: {
    male: ['Pip', 'Milo', 'Tobin', 'Rollo', 'Jasper'],
    female: ['Rosie', 'Nessa', 'Poppy', 'Briony', 'Tilly'],
    other: ['Merric', 'Daisy', 'Quin', 'Willa', 'Bramble'],
  },
};

const classSuffixes: Record<string, string[]> = {
  barbarian: ['Rageborn', 'Skullsplitter', 'Stormhowl', 'Wildheart'],
  bard: ['Songsmith', 'Larktongue', 'Ballad', 'Silvervoice'],
  cleric: ['Lightward', 'Dawnprayer', 'Sanctum', 'Faithkeeper'],
  druid: ['Rootwalker', 'Mossbloom', 'Oakshield', 'Thorngrove'],
  fighter: ['Steelhand', 'Ironguard', 'Warbrand', 'Shieldbane'],
  monk: ['Stillwater', 'Calmwind', 'Stonepalm', 'Sunstep'],
  paladin: ['Oathguard', 'Dawnshield', 'Brightlance', 'Justicar'],
  ranger: ['Pathfinder', 'Greenarrow', 'Hawkeye', 'Trailwarden'],
  rogue: ['Quickblade', 'Nightstep', 'Shadowfoot', 'Lockpick'],
  sorcerer: ['Spellfire', 'Starflame', 'Arcaneborn', 'Wyrmspark'],
  warlock: ['Voidwhisper', 'Hexborne', 'Nightpact', 'Dreadsigil'],
  wizard: ['Runecaster', 'Spellweaver', 'Starquill', 'Wiseglyph'],
};

function pick(rng: Rng, pool: string[]): string {
  return pool[Math.floor(rng() * pool.length)]!;
}

export function generateName(rng: Rng, classId: string, raceId: string, gender: NameGender = 'other'): string {
  const raceByGender = raceFirstNamesByGender[raceId]?.[gender] ?? [];
  const sharedByGender = sharedFirstNamesByGender[gender] ?? [];
  const firstPool = [...raceByGender, ...(raceFirstNamePools[raceId] ?? []), ...sharedByGender, ...sharedFirstNames];
  const first = pick(rng, firstPool);

  const baseLastPool = raceSurnamePools[raceId] ?? raceSurnamePools.human;
  const classPool = classSuffixes[classId] ?? [];

  // Bias toward race-appropriate surnames, occasionally class-themed surnames.
  const useClassSurname = classPool.length > 0 && rng() < 0.32;
  const last = useClassSurname ? pick(rng, classPool) : pick(rng, baseLastPool);

  return `${first} ${last}`;
}
