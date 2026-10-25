import { describe, expect, it } from 'vitest';
import { Ability, Discovery } from '../src/core/enums';
import { buildAtlas, jumpChapter, NodeState, stepAtlas } from '../src/levels/atlas';
import {
  createProgress,
  completedTotal,
  continueLevel,
  isCompleted,
  isUnlocked,
  markSeen,
  parseProgress,
  PROGRESS_VERSION,
  recordCompletion,
  rememberLevel,
  shardTotal,
  type Progress,
} from '../src/levels/progress';
import {
  abilitiesAt,
  CHAPTER_COUNT,
  CHAPTERS,
  chapterOf,
  clampLevel,
  DISCOVERIES,
  DiscoveryKind,
  discoveryIntroducedAt,
  isChapterFinale,
  LEVEL_COUNT,
  LEVELS_PER_CHAPTER,
  nextDiscoveryAfter,
  positionInChapter,
} from '../src/levels/progression';

function completeUpTo(level: number): Progress {
  let progress = createProgress();
  for (let current = 1; current <= level; current++) {
    progress = recordCompletion(progress, { level: current, time: 60 + current, shard: current % 2 === 0 });
  }
  return progress;
}

describe('progression', () => {
  it('spans one hundred echoes in ten chapters', () => {
    expect(LEVEL_COUNT).toBe(100);
    expect(CHAPTER_COUNT).toBe(10);
    expect(CHAPTERS).toHaveLength(CHAPTER_COUNT);
    expect(CHAPTERS.map((chapter) => chapter.index)).toEqual(Array.from({ length: CHAPTER_COUNT }, (_, index) => index + 1));
    expect(new Set(CHAPTERS.map((chapter) => chapter.title)).size).toBe(CHAPTER_COUNT);
  });

  it('maps echoes to chapters, positions and finales', () => {
    expect(chapterOf(1).index).toBe(1);
    expect(chapterOf(10).index).toBe(1);
    expect(chapterOf(11).index).toBe(2);
    expect(chapterOf(100).index).toBe(10);
    expect(positionInChapter(37)).toBe(7);
    expect(isChapterFinale(30)).toBe(true);
    expect(isChapterFinale(31)).toBe(false);
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(250)).toBe(LEVEL_COUNT);
    expect(clampLevel(4.4)).toBe(4);
  });

  it('introduces discoveries in a strictly increasing, unique order', () => {
    const levels = DISCOVERIES.map((discovery) => discovery.level);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(new Set(levels).size).toBe(levels.length);
    expect(new Set(DISCOVERIES.map((discovery) => discovery.id)).size).toBe(Object.values(Discovery).length);
    expect(levels.every((level) => level >= 2 && level <= LEVEL_COUNT && !isChapterFinale(level))).toBe(true);
  });

  it('starts bare, then awakens something new early and in every chapter', () => {
    expect(abilitiesAt(1).size).toBe(0);
    expect(discoveryIntroducedAt(2)?.id).toBe(Discovery.Shift);
    expect(discoveryIntroducedAt(3)?.id).toBe(Discovery.Interact);
    for (let chapter = 1; chapter <= CHAPTER_COUNT; chapter++) {
      const first = (chapter - 1) * LEVELS_PER_CHAPTER + 1;
      const inChapter = DISCOVERIES.filter((discovery) => discovery.level >= first && discovery.level < first + LEVELS_PER_CHAPTER);
      expect(inChapter.length, `chapter ${chapter}`).toBeGreaterThan(0);
    }
  });

  it('only ever adds abilities as the journey goes on', () => {
    for (let level = 2; level <= LEVEL_COUNT; level++) {
      const before = abilitiesAt(level - 1);
      const now = abilitiesAt(level);
      for (const ability of before) expect(now.has(ability)).toBe(true);
    }
    expect(abilitiesAt(LEVEL_COUNT)).toEqual(new Set(Object.values(Ability)));
  });

  it('describes every ability with keyboard and touch controls', () => {
    for (const discovery of DISCOVERIES) {
      expect(discovery.title.length).toBeGreaterThan(0);
      expect(discovery.summary.length).toBeGreaterThan(0);
      if (discovery.kind === DiscoveryKind.Ability) {
        expect(discovery.ability, discovery.id).toBeDefined();
        expect(discovery.control?.keyboard, discovery.id).toBeTruthy();
        expect(discovery.control?.touch, discovery.id).toBeTruthy();
      } else {
        expect(discovery.ability, discovery.id).toBeUndefined();
      }
    }
  });

  it('teases the next discovery and stops after the last one', () => {
    expect(nextDiscoveryAfter(1)?.level).toBe(2);
    expect(nextDiscoveryAfter(51)?.level).toBeGreaterThan(51);
    const last = DISCOVERIES[DISCOVERIES.length - 1];
    expect(nextDiscoveryAfter(last?.level ?? LEVEL_COUNT)).toBeNull();
  });
});

describe('progress', () => {
  it('starts on the first echo with nothing recorded', () => {
    const progress = createProgress();
    expect(progress.unlocked).toBe(1);
    expect(continueLevel(progress)).toBe(1);
    expect(isUnlocked(progress, 1)).toBe(true);
    expect(isUnlocked(progress, 2)).toBe(false);
    expect(completedTotal(progress)).toBe(0);
  });

  it('unlocks the next echo and keeps the best record', () => {
    let progress = recordCompletion(createProgress(), { level: 1, time: 90, shard: false });
    expect(progress.unlocked).toBe(2);
    expect(continueLevel(progress)).toBe(2);
    expect(isCompleted(progress, 1)).toBe(true);
    progress = recordCompletion(progress, { level: 1, time: 120, shard: true });
    progress = recordCompletion(progress, { level: 1, time: 75, shard: false });
    expect(progress.records[1]).toEqual({ bestTime: 75, shard: true, completions: 3 });
    expect(progress.unlocked).toBe(2);
    expect(shardTotal(progress)).toBe(1);
  });

  it('never unlocks past the last echo', () => {
    const progress = recordCompletion({ ...createProgress(), unlocked: LEVEL_COUNT }, { level: LEVEL_COUNT, time: 10, shard: true });
    expect(progress.unlocked).toBe(LEVEL_COUNT);
    expect(progress.last).toBe(LEVEL_COUNT);
  });

  it('replaying an old echo does not lose the furthest unlock', () => {
    const progress = recordCompletion(completeUpTo(12), { level: 3, time: 40, shard: true });
    expect(progress.unlocked).toBe(13);
    expect(rememberLevel(progress, 7).last).toBe(7);
    expect(continueLevel(rememberLevel(progress, 7))).toBe(7);
  });

  it('marks discoveries as seen once', () => {
    const once = markSeen(createProgress(), Discovery.Dash);
    expect(markSeen(once, Discovery.Dash)).toBe(once);
    expect(once.seen).toEqual([Discovery.Dash]);
  });

  it('survives a round trip through storage', () => {
    const progress = markSeen(completeUpTo(14), Discovery.Chains);
    expect(parseProgress(JSON.parse(JSON.stringify(progress)))).toEqual(progress);
  });

  it('rejects corrupt or foreign saves', () => {
    expect(parseProgress(null)).toEqual(createProgress());
    expect(parseProgress('nope')).toEqual(createProgress());
    expect(parseProgress({ version: PROGRESS_VERSION + 1, unlocked: 50 })).toEqual(createProgress());
    const parsed = parseProgress({
      version: PROGRESS_VERSION,
      unlocked: 999,
      last: -4,
      records: { 1: { bestTime: 10, shard: true, completions: 2 }, 2: { bestTime: -1, shard: true, completions: 1 }, abc: { bestTime: 1, shard: false, completions: 1 }, 3: 'x' },
      seen: [Discovery.Glide, 'teleport', Discovery.Glide, 7],
    });
    expect(parsed.unlocked).toBe(LEVEL_COUNT);
    expect(parsed.last).toBe(1);
    expect(Object.keys(parsed.records)).toEqual(['1']);
    expect(parsed.seen).toEqual([Discovery.Glide]);
  });

  it('drops records for echoes that were never unlocked', () => {
    const parsed = parseProgress({ version: PROGRESS_VERSION, unlocked: 3, last: 3, records: { 2: { bestTime: 5, shard: false, completions: 1 }, 9: { bestTime: 5, shard: true, completions: 1 } }, seen: [] });
    expect(Object.keys(parsed.records)).toEqual(['2']);
    expect(shardTotal(parsed)).toBe(0);
  });
});

describe('atlas', () => {
  it('shows a whole chapter with locked, open and completed echoes', () => {
    const atlas = buildAtlas(completeUpTo(3), 2);
    expect(atlas.chapter.index).toBe(1);
    expect(atlas.nodes).toHaveLength(LEVELS_PER_CHAPTER);
    expect(atlas.nodes.map((node) => node.state).slice(0, 5)).toEqual([NodeState.Completed, NodeState.Completed, NodeState.Completed, NodeState.Open, NodeState.Locked]);
    expect(atlas.nodes[9]?.finale).toBe(true);
    expect(atlas.nodes[1]?.discovery?.id).toBe(Discovery.Shift);
    expect(atlas.nodes[1]?.shard).toBe(true);
    expect(atlas.selectedState).toBe(NodeState.Completed);
    expect(atlas.bestTime).toBe(62);
    expect(atlas.hasPrevious).toBe(false);
    expect(atlas.hasNext).toBe(true);
    expect(atlas.completed).toBe(3);
    expect(atlas.shards).toBe(1);
  });

  it('reports nothing recorded for an echo not yet played', () => {
    const atlas = buildAtlas(createProgress(), 57);
    expect(atlas.chapter.index).toBe(6);
    expect(atlas.selectedState).toBe(NodeState.Locked);
    expect(atlas.bestTime).toBeNull();
    expect(atlas.shardFound).toBe(false);
    expect(atlas.selectedName.length).toBeGreaterThan(0);
  });

  it('steps between echoes and chapters without leaving the journey', () => {
    expect(stepAtlas(1, -1)).toBe(1);
    expect(stepAtlas(10, 1)).toBe(11);
    expect(stepAtlas(LEVEL_COUNT, 1)).toBe(LEVEL_COUNT);
    expect(jumpChapter(13, 1)).toBe(23);
    expect(jumpChapter(13, -1)).toBe(3);
    expect(jumpChapter(3, -1)).toBe(3);
    expect(jumpChapter(97, 1)).toBe(97);
  });
});
