import { describe, expect, it } from 'vitest';
import { Discovery, ExitKind, FragmentKind, Presence, SimStatus } from '../src/core/enums';
import { GameSimulation } from '../src/core/simulation';
import { generateLevel } from '../src/levels/generator/compose';
import { SEGMENTS } from '../src/levels/generator/segments';
import { getLevel, HANDCRAFTED_LEVEL, levelName } from '../src/levels/registry';
import { abilitiesAt, DISCOVERIES, isChapterFinale, LEVEL_COUNT } from '../src/levels/progression';
import { runSolution } from './helpers/solutionRunner';

const GENERATED = Array.from({ length: LEVEL_COUNT }, (_, index) => index + 1).filter((level) => level !== HANDCRAFTED_LEVEL);
const KEYBOARD_WORDS = /\b(Tab|Esc|Enter|Space|A \/ D|W \/ S|Press)\b|\b[ADEMQRSWK]\b(?! [a-z])/;

describe('generated echoes', () => {
  it.each(GENERATED)('echo %i can be finished with the abilities unlocked by then, without dying', (level) => {
    const { def, solution } = generateLevel(level);
    const sim = new GameSimulation(def, abilitiesAt(level));
    runSolution(sim, solution);
    expect(sim.status).toBe(def.portal.kind === ExitKind.Gate ? SimStatus.Exited : SimStatus.Finale);
    expect(sim.stats.deaths).toBe(0);
    const optional = def.fragments.filter((fragment) => fragment.kind === FragmentKind.Shard);
    expect(optional.every((fragment) => sim.hasFragment(fragment.id))).toBe(true);
    if (isChapterFinale(level)) expect(sim.fragmentCount).toBe(3);
  });

  it('builds the same echo every time', () => {
    for (const level of [1, 27, 64, 99]) {
      const first = generateLevel(level);
      const second = generateLevel(level);
      expect(second.plan).toEqual(first.plan);
      expect(second.def).toEqual(first.def);
    }
  });

  it('never repeats an echo layout or a name', () => {
    const plans = GENERATED.map((level) => generateLevel(level).plan.join('>'));
    expect(new Set(plans).size).toBe(plans.length);
    const names = Array.from({ length: LEVEL_COUNT }, (_, index) => levelName(index + 1));
    expect(new Set(names).size).toBe(LEVEL_COUNT);
  });

  it('opens every discovery echo with a segment that teaches it', () => {
    for (const discovery of DISCOVERIES) {
      if (discovery.level === HANDCRAFTED_LEVEL) continue;
      const teachers = SEGMENTS.filter((template) => template.features.includes(discovery.id));
      if (teachers.length === 0) continue;
      const { plan, def } = generateLevel(discovery.level);
      expect(teachers.filter((template) => template.features[0] === discovery.id).map((template) => template.id), discovery.id).toContain(plan[0]);
      expect(def.hints.length, discovery.id).toBeGreaterThan(0);
    }
  });

  it('only unleashes the unraveling once it has been discovered, and never in a finale', () => {
    const awakened = DISCOVERIES.find((discovery) => discovery.id === Discovery.Unraveling)?.level ?? LEVEL_COUNT;
    for (const level of GENERATED) {
      const chased = generateLevel(level).def.chase !== undefined;
      expect(chased, `echo ${level}`).toBe(level >= awakened && !isChapterFinale(level));
    }
  });

  it('hides one shard in every echo and three memories in every finale', () => {
    for (const level of GENERATED) {
      const { def } = generateLevel(level);
      const shards = def.fragments.filter((fragment) => fragment.kind === FragmentKind.Shard);
      const memories = def.fragments.filter((fragment) => fragment.kind === FragmentKind.Memory);
      if (isChapterFinale(level)) {
        expect(memories, `echo ${level}`).toHaveLength(3);
        expect(def.portal.kind).toBe(ExitKind.Shattered);
      } else {
        expect(shards, `echo ${level}`).toHaveLength(1);
        expect(memories).toHaveLength(0);
        expect(def.portal.kind).toBe(ExitKind.Gate);
      }
    }
  });

  it('keeps spawn, checkpoints and exit inside the world, with checkpoints on shared ground', () => {
    for (const level of GENERATED) {
      const { def } = generateLevel(level);
      const inside = (x: number, y: number): boolean => x >= def.bounds.x && x <= def.bounds.x + def.bounds.w && y >= def.bounds.y && y <= def.bounds.y + def.bounds.h;
      expect(inside(def.spawn.x, def.spawn.y), `echo ${level} spawn`).toBe(true);
      expect(inside(def.portal.x, def.portal.y), `echo ${level} portal`).toBe(true);
      expect(def.killY).toBeGreaterThan(def.spawn.y);
      expect(def.checkpoints.length).toBeGreaterThan(0);
      for (const checkpoint of def.checkpoints) {
        expect(inside(checkpoint.x, checkpoint.y), `echo ${level} ${checkpoint.id}`).toBe(true);
        const ground = def.solids.find((solid) => solid.presence === Presence.Both && !solid.condition && !solid.motion && !solid.crumble && checkpoint.x >= solid.x && checkpoint.x <= solid.x + solid.w && Math.abs(solid.y - checkpoint.y) < 2);
        expect(ground, `echo ${level} ${checkpoint.id}`).toBeDefined();
      }
    }
  });

  it('gives every generated hint that names a key a touch alternative', () => {
    for (const level of GENERATED) {
      for (const hint of generateLevel(level).def.hints) {
        if (KEYBOARD_WORDS.test(hint.text)) expect(hint.touchText, `echo ${level} ${hint.id}`).toBeDefined();
        if (hint.touchText) expect(hint.touchText, `echo ${level} ${hint.id}`).not.toMatch(KEYBOARD_WORDS);
      }
    }
  });

  it('caches each generated echo so replays do not rebuild it', () => {
    expect(getLevel(42)).toBe(getLevel(42));
    expect(getLevel(HANDCRAFTED_LEVEL).id).not.toBe(getLevel(11).id);
  });
});
