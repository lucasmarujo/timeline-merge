import { DecorKind, DecorLayer, Presence, SolidStyle } from '../../core/enums';
import type { Rng } from '../../core/rng';
import type { DecorDef, SolidDef } from '../../core/types';

interface DecorChoice {
  kind: DecorKind;
  weight: number;
  size: () => number;
  layer: DecorLayer;
  presence?: Presence;
}

const BACK_SET: readonly DecorKind[] = [DecorKind.Column, DecorKind.Statue, DecorKind.Tree, DecorKind.Arch, DecorKind.Banner, DecorKind.Crystals, DecorKind.Brazier, DecorKind.Shrine];

const CHAPTER_ACCENTS: Readonly<Record<number, readonly DecorKind[]>> = {
  1: [DecorKind.Column, DecorKind.Arch, DecorKind.Statue],
  2: [DecorKind.Tree, DecorKind.Tree, DecorKind.Flora],
  3: [DecorKind.Brazier, DecorKind.Brazier, DecorKind.Banner],
  4: [DecorKind.Crystals, DecorKind.Crystals, DecorKind.Column],
  5: [DecorKind.Column, DecorKind.Banner, DecorKind.Brazier],
  6: [DecorKind.Statue, DecorKind.Statue, DecorKind.Shrine],
  7: [DecorKind.Crystals, DecorKind.Arch, DecorKind.Statue],
  8: [DecorKind.Banner, DecorKind.Statue, DecorKind.Column],
  9: [DecorKind.Crystals, DecorKind.Arch, DecorKind.Tree],
  10: [DecorKind.Statue, DecorKind.Crystals, DecorKind.Arch],
};

const WATERFALL_CHAPTERS = new Set([1, 2, 4, 9]);

function sizeFor(kind: DecorKind, rng: Rng): number {
  switch (kind) {
    case DecorKind.Column:
      return rng.int(190, 260);
    case DecorKind.Arch:
      return rng.int(240, 300);
    case DecorKind.Statue:
      return rng.pick([1, 1, 1.2]);
    default:
      return 1;
  }
}

function isFree(x: number, busy: ReadonlyArray<{ x0: number; x1: number }>, placed: readonly number[], spacing: number): boolean {
  if (busy.some((range) => x > range.x0 - 50 && x < range.x1 + 50)) return false;
  return placed.every((other) => Math.abs(other - x) >= spacing);
}

export function dressLevel(solids: readonly SolidDef[], busy: ReadonlyArray<{ x0: number; x1: number }>, chapter: number, rng: Rng): DecorDef[] {
  const decor: DecorDef[] = [];
  const placed: number[] = [];
  const accents = CHAPTER_ACCENTS[chapter] ?? BACK_SET;
  const choices: DecorChoice[] = [...BACK_SET, ...accents, ...accents].map((kind) => ({ kind, weight: 1, size: () => sizeFor(kind, rng), layer: DecorLayer.Back }));
  const floors = solids.filter((solid) => solid.style === SolidStyle.Terrace && solid.presence === Presence.Both && !solid.condition && solid.w >= 180);
  for (const floor of floors) {
    const slots = Math.max(1, Math.floor(floor.w / 300));
    for (let slot = 0; slot < slots; slot++) {
      const x = floor.x + 40 + rng.range(0, floor.w - 80);
      if (!isFree(x, busy, placed, 150)) continue;
      const choice = rng.pick(choices);
      decor.push({ kind: choice.kind, x: Math.round(x), y: floor.y, presence: Presence.Both, layer: choice.layer, size: choice.size(), flip: rng.chance(0.5), seed: rng.int(1, 9999) });
      placed.push(x);
    }
    if (rng.chance(0.7)) {
      const x = floor.x + 30 + rng.range(0, floor.w - 60);
      if (isFree(x, busy, [], 0)) {
        decor.push({ kind: DecorKind.Flora, x: Math.round(x), y: floor.y, presence: Presence.Both, layer: DecorLayer.Front, size: rng.int(50, 80), seed: rng.int(1, 9999) });
      }
    }
    if (rng.chance(0.55)) {
      const edge = rng.chance(0.5) ? floor.x + 30 : floor.x + floor.w - 30;
      decor.push({ kind: DecorKind.Hanging, x: Math.round(edge), y: floor.y + 72, presence: Presence.Both, layer: DecorLayer.Back, size: rng.int(90, 150), seed: rng.int(1, 9999) });
    }
    if (WATERFALL_CHAPTERS.has(chapter) && rng.chance(0.18)) {
      const edge = floor.x + floor.w - 24;
      decor.push({ kind: DecorKind.Waterfall, x: Math.round(edge), y: floor.y + 72, presence: Presence.Both, layer: DecorLayer.Back, size: rng.int(420, 620), seed: rng.int(1, 9999) });
    }
    if (rng.chance(0.25)) {
      const x = floor.x + rng.range(40, floor.w - 40);
      decor.push({ kind: DecorKind.Lantern, x: Math.round(x), y: floor.y - rng.int(300, 420), presence: Presence.Eclipse, layer: DecorLayer.Back, size: 1, seed: rng.int(1, 9999) });
    }
  }
  return decor;
}
