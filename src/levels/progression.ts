import { Ability, Discovery } from '../core/enums';
import type { ToneShift } from '../core/types';

export const LEVEL_COUNT = 100;
export const LEVELS_PER_CHAPTER = 10;
export const CHAPTER_COUNT = LEVEL_COUNT / LEVELS_PER_CHAPTER;

export enum DiscoveryKind {
  Ability = 'ability',
  Phenomenon = 'phenomenon',
}

export interface ControlHint {
  keyboard: string;
  touch: string;
}

export interface DiscoveryDef {
  id: Discovery;
  level: number;
  kind: DiscoveryKind;
  ability?: Ability;
  title: string;
  summary: string;
  control?: ControlHint;
}

export interface ChapterDef {
  index: number;
  numeral: string;
  title: string;
  subtitle: string;
  dawn: ToneShift;
  eclipse: ToneShift;
  words: { adjectives: readonly string[]; nouns: readonly string[] };
}

export const DISCOVERIES: readonly DiscoveryDef[] = [
  {
    id: Discovery.Shift,
    level: 2,
    kind: DiscoveryKind.Ability,
    ability: Ability.Shift,
    title: 'Reality Shift',
    summary: 'Step from the Dawn into the Eclipse and back. For now the rift only opens with solid ground beneath your feet.',
    control: { keyboard: 'Tab', touch: 'SHIFT' },
  },
  {
    id: Discovery.Interact,
    level: 3,
    kind: DiscoveryKind.Ability,
    ability: Ability.Interact,
    title: 'Echo Touch',
    summary: 'Turn winches and strike bells. What you move in one reality moves in the other.',
    control: { keyboard: 'E', touch: 'USE' },
  },
  {
    id: Discovery.Thorns,
    level: 4,
    kind: DiscoveryKind.Phenomenon,
    title: 'Thornfields',
    summary: 'Corrupted thorns grow in one reality only. The rift refuses to set you down inside them.',
  },
  {
    id: Discovery.AirShift,
    level: 5,
    kind: DiscoveryKind.Ability,
    ability: Ability.AirShift,
    title: 'Rift Step',
    summary: 'Shift in mid-air. Leap in one reality and land in the other.',
    control: { keyboard: 'Tab while airborne', touch: 'SHIFT while airborne' },
  },
  {
    id: Discovery.Bells,
    level: 7,
    kind: DiscoveryKind.Phenomenon,
    title: 'Tolling Bells',
    summary: 'A bell struck in one reality gathers light into steps in the other.',
  },
  {
    id: Discovery.RiftLeap,
    level: 11,
    kind: DiscoveryKind.Ability,
    ability: Ability.RiftLeap,
    title: 'Rift Leap',
    summary: 'Every shift in mid-air rekindles your jump. Leap, shift, and leap again.',
    control: { keyboard: 'Tab in the air, then W', touch: 'SHIFT in the air, then JUMP' },
  },
  {
    id: Discovery.Chains,
    level: 15,
    kind: DiscoveryKind.Phenomenon,
    title: 'Binding Chains',
    summary: 'Where violet chains hang, the rift is sealed. Choose your reality before you pass beneath them.',
  },
  {
    id: Discovery.Dash,
    level: 21,
    kind: DiscoveryKind.Ability,
    ability: Ability.Dash,
    title: 'Echo Dash',
    summary: 'Burst forward through the air, once per leap. It carries you where no jump can.',
    control: { keyboard: 'Q or K', touch: 'DASH' },
  },
  {
    id: Discovery.Drifters,
    level: 26,
    kind: DiscoveryKind.Phenomenon,
    title: 'Drifting Ruins',
    summary: 'Fragments of the old world drift on unseen tides. Wait for them, then ride.',
  },
  {
    id: Discovery.Glide,
    level: 31,
    kind: DiscoveryKind.Ability,
    ability: Ability.Glide,
    title: 'Cape Glide',
    summary: 'Hold jump while falling to glide on your cape. Rising winds lift a gliding traveler.',
    control: { keyboard: 'hold W while falling', touch: 'hold JUMP while falling' },
  },
  {
    id: Discovery.Wraiths,
    level: 41,
    kind: DiscoveryKind.Phenomenon,
    title: 'Wraiths',
    summary: 'Restless echoes patrol one reality. In the other they cannot touch you.',
  },
  {
    id: Discovery.WallGrip,
    level: 51,
    kind: DiscoveryKind.Ability,
    ability: Ability.WallGrip,
    title: 'Wall Grip',
    summary: 'Press against a wall to slide down it, and jump to kick away. Shafts become stairways.',
    control: { keyboard: 'hold toward a wall, then W', touch: 'hold toward a wall, then JUMP' },
  },
  {
    id: Discovery.Crumble,
    level: 61,
    kind: DiscoveryKind.Phenomenon,
    title: 'Crumbling Stone',
    summary: 'Old stone gives way a moment after you land on it, and reforms a little later. Keep moving.',
  },
  {
    id: Discovery.Pulse,
    level: 71,
    kind: DiscoveryKind.Phenomenon,
    title: 'Rift Pulse',
    summary: 'Inside the pulsing seams reality flips on its own rhythm, and your own shifts fall silent. Move with the beat.',
  },
  {
    id: Discovery.RiftChain,
    level: 81,
    kind: DiscoveryKind.Ability,
    ability: Ability.RiftChain,
    title: 'Rift Chain',
    summary: 'A shift in mid-air also restores your dash. Dash, shift, dash again.',
    control: { keyboard: 'Q, Tab, Q', touch: 'DASH, SHIFT, DASH' },
  },
  {
    id: Discovery.Unraveling,
    level: 91,
    kind: DiscoveryKind.Phenomenon,
    title: 'The Unraveling',
    summary: 'The world is coming apart behind you. Do not stop.',
  },
];

export const CHAPTERS: readonly ChapterDef[] = [
  {
    index: 1,
    numeral: 'I',
    title: 'The Sundered Span',
    subtitle: 'Where one world first became two',
    dawn: { hue: 0, saturation: 1, light: 0 },
    eclipse: { hue: 0, saturation: 1, light: 0 },
    words: { adjectives: ['Waking', 'Broken', 'Quiet', 'First', 'Gilded', 'Silent', 'Hollow', 'Leaning', 'Patient', 'Severed'], nouns: ['Terrace', 'Arches', 'Threshold', 'Causeway', 'Steps', 'Colonnade', 'Landing', 'Rampart', 'Courtyard', 'Span'] },
  },
  {
    index: 2,
    numeral: 'II',
    title: 'The Hanging Gardens',
    subtitle: 'Roots that remember both skies',
    dawn: { hue: 34, saturation: 1.1, light: 0.02 },
    eclipse: { hue: -34, saturation: 1.05, light: 0 },
    words: { adjectives: ['Verdant', 'Tangled', 'Dew-Lit', 'Trailing', 'Overgrown', 'Blooming', 'Mossbound', 'Whispering', 'Sunken', 'Rooted'], nouns: ['Trellis', 'Arbor', 'Canopy', 'Vines', 'Orchard', 'Grotto', 'Cascade', 'Pergola', 'Thicket', 'Garden'] },
  },
  {
    index: 3,
    numeral: 'III',
    title: 'The Ember Reach',
    subtitle: 'A sunset that never finished setting',
    dawn: { hue: -16, saturation: 1.25, light: -0.02 },
    eclipse: { hue: 42, saturation: 1.15, light: -0.02 },
    words: { adjectives: ['Smouldering', 'Ashen', 'Glowing', 'Scorched', 'Burnished', 'Kindled', 'Copper', 'Searing', 'Cinder', 'Molten'], nouns: ['Kiln', 'Forge', 'Hearth', 'Furnace', 'Brazier', 'Crucible', 'Bastion', 'Spire', 'Embers', 'Reach'] },
  },
  {
    index: 4,
    numeral: 'IV',
    title: 'The Glass Tide',
    subtitle: 'Shores of frozen light',
    dawn: { hue: 160, saturation: 0.75, light: 0.04 },
    eclipse: { hue: -60, saturation: 1.1, light: 0.02 },
    words: { adjectives: ['Glassy', 'Tidal', 'Frosted', 'Shimmering', 'Drowned', 'Pale', 'Brimming', 'Rippled', 'Crystal', 'Ebbing'], nouns: ['Shoals', 'Lagoon', 'Breakers', 'Jetty', 'Reef', 'Strand', 'Shallows', 'Tidepools', 'Harbor', 'Tide'] },
  },
  {
    index: 5,
    numeral: 'V',
    title: 'The Clockwork Deep',
    subtitle: 'Gears that turn in two directions',
    dawn: { hue: -8, saturation: 0.8, light: -0.05 },
    eclipse: { hue: 18, saturation: 0.85, light: -0.03 },
    words: { adjectives: ['Ticking', 'Geared', 'Rusted', 'Wound', 'Brass', 'Grinding', 'Measured', 'Swaying', 'Ratcheted', 'Deep'], nouns: ['Escapement', 'Gearworks', 'Mainspring', 'Foundry', 'Pendulum', 'Cog Hall', 'Orrery', 'Belfry', 'Engine', 'Clockwork'] },
  },
  {
    index: 6,
    numeral: 'VI',
    title: 'The Ashen Choir',
    subtitle: 'Hymns sung by the absent',
    dawn: { hue: 0, saturation: 0.45, light: 0.03 },
    eclipse: { hue: 95, saturation: 1.2, light: -0.03 },
    words: { adjectives: ['Hushed', 'Grey', 'Echoing', 'Faded', 'Solemn', 'Mourning', 'Chanting', 'Veiled', 'Pale', 'Last'], nouns: ['Nave', 'Choir', 'Cloister', 'Ossuary', 'Chancel', 'Vigil', 'Requiem', 'Apse', 'Reliquary', 'Hymn'] },
  },
  {
    index: 7,
    numeral: 'VII',
    title: 'The Starfall Steppe',
    subtitle: 'Where the sky fell and kept falling',
    dawn: { hue: -48, saturation: 1.05, light: 0.02 },
    eclipse: { hue: -95, saturation: 1.2, light: 0 },
    words: { adjectives: ['Starlit', 'Fallen', 'Windswept', 'Comet', 'Wandering', 'Distant', 'Meteor', 'Open', 'Rose', 'Endless'], nouns: ['Steppe', 'Craters', 'Plains', 'Barrows', 'Watch', 'Observatory', 'Meridian', 'Cairns', 'Expanse', 'Skyfall'] },
  },
  {
    index: 8,
    numeral: 'VIII',
    title: 'The Hollow Crown',
    subtitle: 'A throne for two kings',
    dawn: { hue: 12, saturation: 1.3, light: -0.04 },
    eclipse: { hue: 150, saturation: 1.1, light: -0.05 },
    words: { adjectives: ['Regal', 'Hollow', 'Exiled', 'Sovereign', 'Usurped', 'Gilded', 'Royal', 'Twin', 'Forsaken', 'High'], nouns: ['Throne', 'Court', 'Dais', 'Diadem', 'Galleries', 'Keep', 'Sanctum', 'Vault', 'Halls', 'Crown'] },
  },
  {
    index: 9,
    numeral: 'IX',
    title: 'The Mirrorwater',
    subtitle: 'Every surface a door',
    dawn: { hue: 185, saturation: 0.55, light: 0.06 },
    eclipse: { hue: -120, saturation: 1.15, light: 0.02 },
    words: { adjectives: ['Mirrored', 'Still', 'Silvered', 'Reflected', 'Inverted', 'Glimmering', 'Twofold', 'Deep', 'Lucent', 'Tranquil'], nouns: ['Mere', 'Basin', 'Pools', 'Fountains', 'Wellspring', 'Lake', 'Reflections', 'Locks', 'Canals', 'Mirror'] },
  },
  {
    index: 10,
    numeral: 'X',
    title: 'The Last Seam',
    subtitle: 'Where the timelines become one',
    dawn: { hue: 0, saturation: 1.15, light: 0.02 },
    eclipse: { hue: 0, saturation: 1.25, light: -0.02 },
    words: { adjectives: ['Final', 'Unraveling', 'Converging', 'Seamless', 'Bright', 'Kindred', 'Ultimate', 'Woven', 'Burning', 'Last'], nouns: ['Seam', 'Confluence', 'Loom', 'Weave', 'Crossing', 'Horizon', 'Meeting', 'Gate', 'Union', 'Nexus'] },
  },
];

export function clampLevel(level: number): number {
  return Math.min(LEVEL_COUNT, Math.max(1, Math.round(level)));
}

export function chapterOf(level: number): ChapterDef {
  return CHAPTERS[Math.floor((clampLevel(level) - 1) / LEVELS_PER_CHAPTER)] as ChapterDef;
}

export function positionInChapter(level: number): number {
  return ((clampLevel(level) - 1) % LEVELS_PER_CHAPTER) + 1;
}

export function isChapterFinale(level: number): boolean {
  return positionInChapter(level) === LEVELS_PER_CHAPTER;
}

export function discoveriesUntil(level: number): DiscoveryDef[] {
  return DISCOVERIES.filter((discovery) => discovery.level <= level);
}

export function hasDiscovery(level: number, id: Discovery): boolean {
  return DISCOVERIES.some((discovery) => discovery.id === id && discovery.level <= level);
}

export function discoveryIntroducedAt(level: number): DiscoveryDef | null {
  return DISCOVERIES.find((discovery) => discovery.level === level) ?? null;
}

export function nextDiscoveryAfter(level: number): DiscoveryDef | null {
  return DISCOVERIES.find((discovery) => discovery.level > level) ?? null;
}

export function abilitiesAt(level: number): ReadonlySet<Ability> {
  const abilities = new Set<Ability>();
  for (const discovery of discoveriesUntil(level)) {
    if (discovery.ability) abilities.add(discovery.ability);
  }
  return abilities;
}
