import { DecorKind, DecorLayer, Discovery, ExitKind, FragmentKind, Presence, SolidStyle, Timeline } from '../../core/enums';
import { clamp } from '../../core/geometry';
import { hashString, Rng } from '../../core/rng';
import type { AreaDef, ChaseDef, LevelDef, PortalDef, SolidDef } from '../../core/types';
import { CHAPTER_MEMORIES, SHARD_TITLE, type MemoryText } from '../memories';
import { chapterOf, discoveriesUntil, discoveryIntroducedAt, isChapterFinale, LEVEL_COUNT, positionInChapter } from '../progression';
import type { SolutionStep } from '../solution';
import { airJump, airShift, LevelBuilder, other, presenceOf, retarget } from './builder';
import { dressLevel } from './dressing';
import { DESCENT, SEGMENTS, Slope, type SegmentTemplate } from './segments';

export interface GeneratedLevel {
  def: LevelDef;
  solution: SolutionStep[];
  plan: string[];
}

const START = { x: 200, y: 1000 } as const;
const HIGH_LIMIT = 700;
const LOW_LIMIT = 1260;
const CEILING = 620;

function levelName(index: number): string {
  const chapter = chapterOf(index);
  const position = positionInChapter(index);
  const adjective = chapter.words.adjectives[(position - 1) % chapter.words.adjectives.length] as string;
  const noun = chapter.words.nouns[(position * 3) % chapter.words.nouns.length] as string;
  return `The ${adjective} ${noun}`;
}

export function generatedLevelName(index: number): string {
  return levelName(index);
}

function weightOf(template: SegmentTemplate, introduced: Discovery | null, fresh: ReadonlySet<Discovery>, recent: readonly string[], index: number): number {
  let weight = template.features.length === 0 ? Math.max(0.2, 1 - index / 40) : 1;
  if (introduced && template.features.includes(introduced)) weight *= 4;
  if (template.features.some((feature) => fresh.has(feature))) weight *= 2.5;
  if (recent.includes(template.id)) weight *= 0.15;
  return weight;
}

function weightedPick<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng.range(0, total);
  for (let index = 0; index < items.length; index++) {
    roll -= weights[index] as number;
    if (roll <= 0) return items[index] as T;
  }
  return items[items.length - 1] as T;
}

function slopeAllowed(template: SegmentTemplate, y: number): boolean {
  if (template.slope === Slope.Up) return y > HIGH_LIMIT;
  if (template.slope === Slope.Down) return y < LOW_LIMIT;
  return true;
}

function buildAlcove(b: LevelBuilder, unlocked: ReadonlySet<Discovery>, kind: FragmentKind, text: MemoryText | null): void {
  const { x, y, timeline } = b.cursor;
  const slab = x + b.rng.int(150, 210);
  const high = unlocked.has(Discovery.RiftLeap) && b.rng.chance(0.5);
  const elsewhere = !high && unlocked.has(Discovery.Shift) && b.rng.chance(0.6);
  const presence = elsewhere ? presenceOf(other(timeline)) : Presence.Both;
  const rise = high ? 186 : 92;
  b.ground(x - 40, slab + 300, y);
  b.solid(presence, high ? SolidStyle.Shard : SolidStyle.Slab, slab, y - rise, 96, { h: 22 });
  b.fragment(kind, presence, slab + 48, y - rise - 22, text?.title ?? SHARD_TITLE, text?.memory);
  b.mark(slab - 30, slab + 130);
  b.walk(slab - 30);
  let current = timeline;
  if (elsewhere) {
    current = other(timeline);
    b.shift(current);
  }
  if (high) {
    current = other(current);
    b.leap(slab - 30, [airShift(current, { feetAbove: y - 80 }), airJump({ descending: true }), retarget(slab + 48, { feetAbove: y - rise - 6 })]);
  } else {
    b.leap(slab + 48);
  }
  b.walk(slab + 96 - 8);
  b.leap(slab + 180);
  b.walk(slab + 210);
  b.move(slab + 210, y, current);
}

function mergeFloors(solids: SolidDef[]): SolidDef[] {
  const mergeable = (solid: SolidDef): boolean => !solid.condition && !solid.motion && !solid.crumble && (solid.style === SolidStyle.Terrace || solid.style === SolidStyle.Bridge || solid.style === SolidStyle.BrokenBridge);
  const keyOf = (solid: SolidDef): string => `${solid.presence}|${solid.style}|${solid.y}|${solid.h}`;
  const groups = new Map<string, SolidDef[]>();
  const result: SolidDef[] = [];
  for (const solid of solids) {
    if (!mergeable(solid)) {
      result.push(solid);
      continue;
    }
    const key = keyOf(solid);
    groups.set(key, [...(groups.get(key) ?? []), solid]);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.x - b.x);
    let current: SolidDef | null = null;
    for (const solid of group) {
      if (current && solid.x <= current.x + current.w) {
        current.w = Math.max(current.x + current.w, solid.x + solid.w) - current.x;
      } else {
        current = { ...solid };
        result.push(current);
      }
    }
  }
  return result;
}

function finish(b: LevelBuilder, shattered: boolean): PortalDef {
  const { x, y } = b.cursor;
  if (!shattered) {
    const gateX = x + 280;
    b.ground(x - 40, x + 480, y);
    b.mark(gateX - 60, gateX + 60);
    b.walk(gateX);
    return { kind: ExitKind.Gate, x: gateX, y: y - 96, radius: 70, standX: gateX - 90, zone: { x: gateX - 34, y: y - 120, w: 68, h: 120 } };
  }
  const portalX = x + 560;
  b.ground(x - 40, x + 1000, y, SolidStyle.Viaduct);
  b.mark(portalX - 300, portalX + 300);
  b.decor.push({ kind: DecorKind.Pedestal, x: portalX, y, presence: Presence.Both, layer: DecorLayer.Back, size: 1, seed: 74 });
  b.decor.push({ kind: DecorKind.Statue, x: portalX - 200, y, presence: Presence.Both, layer: DecorLayer.Back, size: 1, seed: 73 });
  b.decor.push({ kind: DecorKind.Statue, x: portalX + 200, y, presence: Presence.Both, layer: DecorLayer.Back, size: 1, flip: true, seed: 75 });
  b.walk(portalX - 90);
  b.interact();
  return { kind: ExitKind.Shattered, x: portalX, y: y - 168, radius: 130, standX: portalX - 150, zone: { x: portalX - 120, y: y - 108, w: 240, h: 108 } };
}

export function generateLevel(index: number): GeneratedLevel {
  const chapter = chapterOf(index);
  const position = positionInChapter(index);
  const finale = isChapterFinale(index);
  const rng = new Rng(hashString(`timeline-merge:echo:${index}`));
  const unlocked = new Set(discoveriesUntil(index).map((discovery) => discovery.id));
  const introduced = discoveryIntroducedAt(index)?.id ?? null;
  const chapterStart = (chapter.index - 1) * 10 + 1;
  const fresh = new Set(discoveriesUntil(index).filter((discovery) => discovery.level >= chapterStart - 4).map((discovery) => discovery.id));
  const difficulty = clamp(0.1 + (0.55 * (position - 1)) / 9 + (chapter.index - 1) * 0.045, 0, 1);
  const count = finale ? 6 + Math.ceil(chapter.index / 2) : Math.min(7, 3 + Math.floor((index - 1) / 7));
  const chased = unlocked.has(Discovery.Unraveling) && !finale;

  const b = new LevelBuilder(rng, index, { x: START.x, y: START.y, timeline: Timeline.Dawn });
  b.ground(60, START.x + 160, START.y);
  b.solid(Presence.Both, SolidStyle.Wall, -200, START.y - 780, 260, { h: 1240 });
  b.mark(0, START.x + 60);
  if (index === 1) {
    b.hint(60, 900, START.y, 'A / D to move   ·   W or Space to jump', 'Slide on the left pad to move   ·   tap JUMP to leap');
  }

  const eligible = SEGMENTS.filter((template) => template.requires.every((requirement) => unlocked.has(requirement)) && (!chased || template.flow));
  const featured = introduced ? eligible.filter((template) => template.features[0] === introduced) : [];
  const memories = finale ? CHAPTER_MEMORIES[chapter.index] ?? null : null;
  const alcoveSlots = finale ? [1, Math.floor(count / 2), count - 1] : [Math.max(1, Math.floor(count / 2))];
  const plan: string[] = [];
  let memoryIndex = 0;

  for (let slot = 0; slot < count; slot++) {
    const y = b.cursor.y;
    let template: SegmentTemplate;
    let intro = false;
    if (y < CEILING) {
      template = DESCENT;
    } else if (slot === 0 && featured.length > 0) {
      template = featured.find((candidate) => slopeAllowed(candidate, y)) ?? (featured[0] as SegmentTemplate);
      intro = true;
    } else {
      const pool = eligible.filter((candidate) => slopeAllowed(candidate, y) && candidate.id !== plan[plan.length - 1]);
      const weights = pool.map((candidate) => weightOf(candidate, introduced, fresh, plan.slice(-3), index));
      template = weightedPick(rng, pool, weights);
    }
    b.checkpoint();
    template.build({ b, difficulty: clamp(difficulty + rng.range(-0.1, 0.1), 0, 1), intro });
    plan.push(template.id);
    if (alcoveSlots.includes(slot)) {
      const kind = memories ? FragmentKind.Memory : FragmentKind.Shard;
      const text = memories ? (memories[memoryIndex] as MemoryText) : null;
      memoryIndex += 1;
      b.checkpoint();
      buildAlcove(b, unlocked, kind, text);
      plan.push('alcove');
    }
  }

  b.checkpoint();
  const portal = finish(b, finale);
  const exitEnd = Math.max(...b.solids.map((solid) => solid.x + solid.w));
  b.solid(Presence.Both, SolidStyle.Wall, exitEnd, b.cursor.y - 850, 320, { h: 1350 });

  const solids = mergeFloors(b.solids);
  const floorTops = solids.filter((solid) => solid.h < 300).map((solid) => solid.y);
  const maxFloor = Math.max(...floorTops, START.y);
  const minTop = Math.min(...solids.map((solid) => solid.y), portal.y - 200);
  const right = exitEnd + 320;
  const top = Math.floor(minTop - 520);
  const killY = maxFloor + 380;
  const bounds = { x: 0, y: top, w: right, h: Math.max(800, killY + 80 - top) };
  const name = index === LEVEL_COUNT ? 'The Last Merge' : levelName(index);
  const areas: AreaDef[] = [
    { id: 'echo', zone: { x: -400, y: top - 2000, w: right + 800, h: bounds.h + 4000 }, title: name, subtitle: `Chapter ${chapter.numeral} · ${chapter.title}` },
  ];
  const chase: ChaseDef | undefined = chased ? { triggerX: START.x + 260, speed: 74 + position * 3, lead: 560 } : undefined;

  const def: LevelDef = {
    id: `echo-${index}`,
    name,
    bounds,
    killY,
    spawn: { x: START.x, y: START.y },
    solids,
    hazards: b.hazards,
    fragments: b.fragments,
    mechanisms: b.mechanisms,
    checkpoints: b.checkpoints,
    hints: b.hints,
    areas,
    decor: [...b.decor, ...dressLevel(solids, b.busy, chapter.index, rng)],
    zones: b.zones,
    chase,
    portal,
  };
  return { def, solution: b.steps, plan };
}
