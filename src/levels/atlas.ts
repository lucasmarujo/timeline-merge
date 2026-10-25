import { isCompleted, isUnlocked, shardTotal, completedTotal, type Progress } from './progress';
import { CHAPTER_COUNT, chapterOf, clampLevel, discoveryIntroducedAt, isChapterFinale, LEVELS_PER_CHAPTER, type ChapterDef, type DiscoveryDef } from './progression';
import { levelName } from './registry';

export enum NodeState {
  Locked = 'locked',
  Open = 'open',
  Completed = 'completed',
}

export interface AtlasNode {
  level: number;
  state: NodeState;
  shard: boolean;
  finale: boolean;
  discovery: DiscoveryDef | null;
}

export interface AtlasModel {
  chapter: ChapterDef;
  nodes: readonly AtlasNode[];
  selected: number;
  selectedName: string;
  selectedState: NodeState;
  bestTime: number | null;
  shardFound: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  completed: number;
  shards: number;
}

export function nodeState(progress: Progress, level: number): NodeState {
  if (isCompleted(progress, level)) return NodeState.Completed;
  return isUnlocked(progress, level) ? NodeState.Open : NodeState.Locked;
}

export function buildAtlas(progress: Progress, selectedLevel: number): AtlasModel {
  const selected = clampLevel(selectedLevel);
  const chapter = chapterOf(selected);
  const first = (chapter.index - 1) * LEVELS_PER_CHAPTER + 1;
  const nodes = Array.from({ length: LEVELS_PER_CHAPTER }, (_, offset) => {
    const level = first + offset;
    return {
      level,
      state: nodeState(progress, level),
      shard: progress.records[level]?.shard ?? false,
      finale: isChapterFinale(level),
      discovery: discoveryIntroducedAt(level),
    };
  });
  const record = progress.records[selected];
  return {
    chapter,
    nodes,
    selected,
    selectedName: levelName(selected),
    selectedState: nodeState(progress, selected),
    bestTime: record?.bestTime ?? null,
    shardFound: record?.shard ?? false,
    hasPrevious: chapter.index > 1,
    hasNext: chapter.index < CHAPTER_COUNT,
    completed: completedTotal(progress),
    shards: shardTotal(progress),
  };
}

export function stepAtlas(selected: number, delta: number): number {
  return clampLevel(selected + delta);
}

export function jumpChapter(selected: number, delta: number): number {
  const chapter = chapterOf(selected).index + delta;
  if (chapter < 1 || chapter > CHAPTER_COUNT) return selected;
  const offset = (clampLevel(selected) - 1) % LEVELS_PER_CHAPTER;
  return (chapter - 1) * LEVELS_PER_CHAPTER + 1 + offset;
}
