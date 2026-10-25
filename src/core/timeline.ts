import { Presence, SwitchRejection, Timeline } from './enums';
import { expand, overlaps, overlapsAny } from './geometry';
import type { Condition, Rect } from './types';

export type Placement =
  | { ok: true; dx: number; dy: number; nudged: boolean }
  | { ok: false; reason: SwitchRejection };

interface Offset {
  dx: number;
  dy: number;
}

const offsetCache = new Map<number, readonly Offset[]>();

export function existsIn(presence: Presence, timeline: Timeline): boolean {
  return presence === Presence.Both || (presence as string) === (timeline as string);
}

export function otherTimeline(timeline: Timeline): Timeline {
  return timeline === Timeline.Dawn ? Timeline.Eclipse : Timeline.Dawn;
}

export function isConditionMet(
  condition: Condition | undefined,
  isMechanismActive: (id: string) => boolean,
): boolean {
  if (!condition) return true;
  if (condition.requires !== undefined && !isMechanismActive(condition.requires)) return false;
  if (condition.unless !== undefined && isMechanismActive(condition.unless)) return false;
  return true;
}

function directionRank(offset: Offset): number {
  if (offset.dy < 0 && offset.dx === 0) return 0;
  if (offset.dy === 0) return 1;
  if (offset.dy < 0) return 2;
  return 3;
}

export function nudgeOffsets(maxNudge: number): readonly Offset[] {
  const cached = offsetCache.get(maxNudge);
  if (cached) return cached;
  const offsets: Offset[] = [];
  for (let dy = -maxNudge; dy <= maxNudge; dy++) {
    for (let dx = -maxNudge; dx <= maxNudge; dx++) {
      if (dx * dx + dy * dy <= maxNudge * maxNudge) {
        offsets.push({ dx, dy });
      }
    }
  }
  offsets.sort((a, b) => {
    const distance = a.dx * a.dx + a.dy * a.dy - (b.dx * b.dx + b.dy * b.dy);
    return distance !== 0 ? distance : directionRank(a) - directionRank(b);
  });
  offsetCache.set(maxNudge, offsets);
  return offsets;
}

export function findSafePlacement(
  body: Rect,
  solids: readonly Rect[],
  hazards: readonly Rect[],
  maxNudge: number,
): Placement {
  const searchArea = expand(body, maxNudge + 1);
  const nearbySolids = solids.filter((solid) => overlaps(searchArea, solid));
  const candidate: Rect = { x: body.x, y: body.y, w: body.w, h: body.h };

  for (const offset of nudgeOffsets(maxNudge)) {
    candidate.x = body.x + offset.dx;
    candidate.y = body.y + offset.dy;
    if (overlapsAny(candidate, nearbySolids)) continue;
    if (overlapsAny(candidate, hazards)) {
      return { ok: false, reason: SwitchRejection.Hazard };
    }
    return { ok: true, dx: offset.dx, dy: offset.dy, nudged: offset.dx !== 0 || offset.dy !== 0 };
  }

  return { ok: false, reason: SwitchRejection.Blocked };
}
