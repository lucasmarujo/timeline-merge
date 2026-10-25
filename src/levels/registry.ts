import type { LevelDef } from '../core/types';
import { generatedLevelName, generateLevel } from './generator/compose';
import { LEVEL_1 } from './level1';
import { clampLevel, LEVEL_COUNT } from './progression';

export const HANDCRAFTED_LEVEL = 10;

const cache = new Map<number, LevelDef>();

export function levelName(index: number): string {
  const level = clampLevel(index);
  if (level === HANDCRAFTED_LEVEL) return LEVEL_1.name;
  if (level === LEVEL_COUNT) return 'The Last Merge';
  return generatedLevelName(level);
}

export function getLevel(index: number): LevelDef {
  const level = clampLevel(index);
  if (level === HANDCRAFTED_LEVEL) return LEVEL_1;
  const cached = cache.get(level);
  if (cached) return cached;
  const def = generateLevel(level).def;
  cache.set(level, def);
  return def;
}
