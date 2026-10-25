import { Discovery } from '../core/enums';
import { clampLevel, LEVEL_COUNT } from './progression';

export const PROGRESS_VERSION = 1;

export interface LevelRecord {
  bestTime: number;
  shard: boolean;
  completions: number;
}

export interface Progress {
  version: number;
  unlocked: number;
  last: number;
  records: Readonly<Record<number, LevelRecord>>;
  seen: readonly Discovery[];
}

export interface Completion {
  level: number;
  time: number;
  shard: boolean;
}

export function createProgress(): Progress {
  return { version: PROGRESS_VERSION, unlocked: 1, last: 1, records: {}, seen: [] };
}

export function recordCompletion(progress: Progress, completion: Completion): Progress {
  const level = clampLevel(completion.level);
  const previous = progress.records[level];
  const record: LevelRecord = {
    bestTime: previous ? Math.min(previous.bestTime, completion.time) : completion.time,
    shard: (previous?.shard ?? false) || completion.shard,
    completions: (previous?.completions ?? 0) + 1,
  };
  return {
    ...progress,
    unlocked: Math.max(progress.unlocked, Math.min(LEVEL_COUNT, level + 1)),
    last: Math.min(LEVEL_COUNT, level + 1),
    records: { ...progress.records, [level]: record },
  };
}

export function markSeen(progress: Progress, discovery: Discovery): Progress {
  if (progress.seen.includes(discovery)) return progress;
  return { ...progress, seen: [...progress.seen, discovery] };
}

export function rememberLevel(progress: Progress, level: number): Progress {
  return { ...progress, last: clampLevel(level) };
}

export function isUnlocked(progress: Progress, level: number): boolean {
  return level >= 1 && level <= progress.unlocked;
}

export function isCompleted(progress: Progress, level: number): boolean {
  return progress.records[level] !== undefined;
}

export function shardTotal(progress: Progress): number {
  return Object.values(progress.records).filter((record) => record.shard).length;
}

export function completedTotal(progress: Progress): number {
  return Object.keys(progress.records).length;
}

export function continueLevel(progress: Progress): number {
  return Math.min(progress.unlocked, Math.max(1, progress.last));
}

function isRecord(value: unknown): value is LevelRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.bestTime === 'number' && Number.isFinite(record.bestTime) && record.bestTime >= 0 && typeof record.shard === 'boolean' && typeof record.completions === 'number';
}

export function parseProgress(raw: unknown): Progress {
  if (typeof raw !== 'object' || raw === null) return createProgress();
  const data = raw as Record<string, unknown>;
  if (data.version !== PROGRESS_VERSION) return createProgress();
  const unlocked = typeof data.unlocked === 'number' && Number.isFinite(data.unlocked) ? clampLevel(data.unlocked) : 1;
  const last = typeof data.last === 'number' && Number.isFinite(data.last) ? Math.min(unlocked, clampLevel(data.last)) : unlocked;
  const records: Record<number, LevelRecord> = {};
  if (typeof data.records === 'object' && data.records !== null) {
    for (const [key, value] of Object.entries(data.records as Record<string, unknown>)) {
      const level = Number(key);
      if (Number.isInteger(level) && level >= 1 && level <= LEVEL_COUNT && level <= unlocked && isRecord(value)) {
        records[level] = { bestTime: value.bestTime, shard: value.shard, completions: Math.max(1, Math.round(value.completions)) };
      }
    }
  }
  const known = new Set<string>(Object.values(Discovery));
  const seen = Array.isArray(data.seen) ? (data.seen.filter((entry) => typeof entry === 'string' && known.has(entry)) as Discovery[]) : [];
  return { version: PROGRESS_VERSION, unlocked, last, records, seen: [...new Set(seen)] };
}
