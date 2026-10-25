import { describe, expect, it } from 'vitest';
import { Presence, SwitchRejection, Timeline } from '../src/core/enums';
import {
  existsIn,
  findSafePlacement,
  isConditionMet,
  nudgeOffsets,
  otherTimeline,
} from '../src/core/timeline';
import type { Rect } from '../src/core/types';

const BODY: Rect = { x: 100, y: 100, w: 14, h: 36 };

describe('presence rules', () => {
  it('resolves presence per timeline', () => {
    expect(existsIn(Presence.Both, Timeline.Dawn)).toBe(true);
    expect(existsIn(Presence.Both, Timeline.Eclipse)).toBe(true);
    expect(existsIn(Presence.Dawn, Timeline.Dawn)).toBe(true);
    expect(existsIn(Presence.Dawn, Timeline.Eclipse)).toBe(false);
    expect(existsIn(Presence.Eclipse, Timeline.Dawn)).toBe(false);
  });

  it('flips to the other timeline', () => {
    expect(otherTimeline(Timeline.Dawn)).toBe(Timeline.Eclipse);
    expect(otherTimeline(Timeline.Eclipse)).toBe(Timeline.Dawn);
  });

  it('evaluates requires and unless conditions', () => {
    const active = new Set(['lever']);
    const isActive = (id: string): boolean => active.has(id);
    expect(isConditionMet(undefined, isActive)).toBe(true);
    expect(isConditionMet({ requires: 'lever' }, isActive)).toBe(true);
    expect(isConditionMet({ requires: 'bell' }, isActive)).toBe(false);
    expect(isConditionMet({ unless: 'lever' }, isActive)).toBe(false);
    expect(isConditionMet({ unless: 'bell' }, isActive)).toBe(true);
  });
});

describe('nudgeOffsets', () => {
  it('starts at the original position and prefers moving up', () => {
    const offsets = nudgeOffsets(4);
    expect(offsets[0]).toEqual({ dx: 0, dy: 0 });
    expect(offsets[1]).toEqual({ dx: 0, dy: -1 });
  });

  it('is ordered by distance and bounded by the radius', () => {
    const offsets = nudgeOffsets(6);
    let previous = 0;
    for (const offset of offsets) {
      const distance = offset.dx * offset.dx + offset.dy * offset.dy;
      expect(distance).toBeGreaterThanOrEqual(previous);
      expect(distance).toBeLessThanOrEqual(36);
      previous = distance;
    }
  });
});

describe('findSafePlacement', () => {
  it('accepts a free destination without moving the body', () => {
    const result = findSafePlacement(BODY, [{ x: 0, y: 136, w: 300, h: 20 }], [], 10);
    expect(result).toEqual({ ok: true, dx: 0, dy: 0, nudged: false });
  });

  it('nudges the body out of a shallow overlap', () => {
    const floor: Rect = { x: 0, y: 131, w: 300, h: 20 };
    const result = findSafePlacement(BODY, [floor], [], 10);
    expect(result).toEqual({ ok: true, dx: 0, dy: -5, nudged: true });
  });

  it('rejects a destination buried inside solid geometry', () => {
    const wall: Rect = { x: 60, y: 40, w: 100, h: 200 };
    const result = findSafePlacement(BODY, [wall], [], 10);
    expect(result).toEqual({ ok: false, reason: SwitchRejection.Blocked });
  });

  it('rejects a destination that would overlap a hazard', () => {
    const thorns: Rect = { x: 90, y: 120, w: 60, h: 30 };
    const result = findSafePlacement(BODY, [], [thorns], 10);
    expect(result).toEqual({ ok: false, reason: SwitchRejection.Hazard });
  });

  it('only examines solids near the body', () => {
    const farAway: Rect[] = Array.from({ length: 5000 }, (_, index) => ({
      x: 10000 + index * 50,
      y: 0,
      w: 40,
      h: 40,
    }));
    const started = performance.now();
    for (let index = 0; index < 200; index++) {
      findSafePlacement(BODY, farAway, [], 10);
    }
    expect(performance.now() - started).toBeLessThan(500);
  });
});
