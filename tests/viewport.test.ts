import { describe, expect, it } from 'vitest';
import { GAME_HEIGHT, GAME_WIDTH } from '../src/config';
import { computeGameWidth, MAX_GAME_WIDTH, MAX_HALF_WIDTH, uiOffset } from '../src/render/viewport';

describe('computeGameWidth', () => {
  it('keeps 16:9 and narrower screens exactly as they were', () => {
    expect(computeGameWidth(1920, 1080)).toBe(GAME_WIDTH);
    expect(computeGameWidth(1280, 720)).toBe(GAME_WIDTH);
    expect(computeGameWidth(1024, 768)).toBe(GAME_WIDTH);
    expect(computeGameWidth(1440, 900)).toBe(GAME_WIDTH);
    expect(computeGameWidth(390, 844)).toBe(GAME_WIDTH);
  });

  it('widens the world on ultrawide monitors', () => {
    expect(computeGameWidth(2560, 1080)).toBe(1706);
    expect(computeGameWidth(3440, 1440)).toBe(1720);
    expect(computeGameWidth(5120, 1440)).toBe(MAX_GAME_WIDTH);
    expect(computeGameWidth(3840, 1080)).toBe(MAX_GAME_WIDTH);
  });

  it('caps the width at 32:9 so each reality stays readable', () => {
    expect(computeGameWidth(7680, 1080)).toBe(MAX_GAME_WIDTH);
    expect(MAX_GAME_WIDTH / GAME_HEIGHT).toBeCloseTo(32 / 9, 5);
    expect(MAX_HALF_WIDTH).toBe(MAX_GAME_WIDTH / 2);
  });

  it('always returns an even width so the split stays on a whole pixel', () => {
    for (let width = 1200; width <= 6000; width += 37) {
      expect(computeGameWidth(width, 1080) % 2).toBe(0);
    }
  });

  it('falls back to the base width before the page has a size', () => {
    expect(computeGameWidth(0, 0)).toBe(GAME_WIDTH);
    expect(computeGameWidth(1920, 0)).toBe(GAME_WIDTH);
    expect(computeGameWidth(Number.NaN, 1080)).toBe(GAME_WIDTH);
  });
});

describe('uiOffset', () => {
  it('centres the interface band inside the wider canvas', () => {
    expect(uiOffset(GAME_WIDTH)).toBe(0);
    expect(uiOffset(MAX_GAME_WIDTH)).toBe((MAX_GAME_WIDTH - GAME_WIDTH) / 2);
    expect(uiOffset(1706)).toBe(213);
  });
});
