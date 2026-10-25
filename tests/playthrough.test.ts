import { describe, expect, it } from 'vitest';
import { PLAYER_SIZE } from '../src/core/constants';
import { Presence, SimEventType, SimStatus, Timeline } from '../src/core/enums';
import { placeBody } from '../src/core/physics';
import { GameSimulation, type SimEvent } from '../src/core/simulation';
import { LEVEL_1 } from '../src/levels/level1';
import { descending, feetAbove, Pilot } from './helpers/pilot';

function eventTypes(events: SimEvent[]): SimEventType[] {
  return events.map((event) => event.type);
}

function pilotAt(feetX: number, feetY: number, timeline: Timeline, activate: string[] = []): Pilot {
  const sim = new GameSimulation(LEVEL_1);
  for (const id of activate) {
    const mechanism = LEVEL_1.mechanisms.find((candidate) => candidate.id === id);
    if (!mechanism) throw new Error(`Unknown mechanism ${id}`);
    placeBody(sim.body, mechanism.x, mechanism.y);
    sim.timeline = mechanism.presence === Presence.Eclipse ? Timeline.Eclipse : Timeline.Dawn;
    sim.step({ moveX: 0, jumpPressed: false, jumpHeld: false, shiftPressed: false, interactPressed: true });
  }
  placeBody(sim.body, feetX, feetY);
  sim.timeline = timeline;
  const pilot = new Pilot(sim, true);
  pilot.wait(0.1);
  return pilot;
}

describe('LEVEL_1 full playthrough', () => {
  it('can be completed from spawn to portal without dying', () => {
    const pilot = new Pilot(new GameSimulation(LEVEL_1));
    const { sim } = pilot;
    pilot.wait(0.1);

    pilot.walkTo(685);
    pilot.leapTo(870);
    expect(pilot.feet).toBe(1000);

    pilot.walkTo(1000);
    pilot.shift(Timeline.Eclipse);
    pilot.walkTo(1380);
    expect(sim.respawnPoint.id).toBe('cp-bridge');

    pilot.shift(Timeline.Dawn);
    pilot.walkTo(1835);
    pilot.shift(Timeline.Eclipse);
    pilot.walkTo(1930);
    pilot.shift(Timeline.Dawn);
    pilot.walkTo(2470);
    expect(sim.respawnPoint.id).toBe('cp-climb');

    pilot.walkTo(2700);
    pilot.leapTo(2810);
    expect(pilot.feet).toBe(904);
    pilot.leapTo(2958, [{ to: Timeline.Eclipse, when: feetAbove(874) }]);
    expect(pilot.feet).toBe(808);
    pilot.leapTo(2810, [{ to: Timeline.Dawn, when: feetAbove(778) }]);
    expect(pilot.feet).toBe(712);
    pilot.leapTo(2958, [{ to: Timeline.Eclipse, when: feetAbove(682) }]);
    expect(pilot.feet).toBe(616);
    pilot.leapTo(2810, [{ to: Timeline.Dawn, when: feetAbove(586) }]);
    expect(pilot.feet).toBe(520);
    pilot.walkTo(2810);
    expect(sim.hasFragment('fragment-builders')).toBe(true);
    pilot.leapTo(2958, [{ to: Timeline.Eclipse, when: feetAbove(500) }]);
    expect(pilot.feet).toBe(616);
    pilot.leapTo(3160);
    expect(pilot.feet).toBe(580);
    pilot.walkTo(3160);
    expect(sim.respawnPoint.id).toBe('cp-mesa');

    pilot.shift(Timeline.Dawn);
    pilot.walkTo(3440);
    pilot.leapTo(3550);
    expect(pilot.feet).toBe(484);
    pilot.leapTo(3740);
    expect(pilot.feet).toBe(388);
    pilot.walkTo(3750);
    expect(eventTypes(pilot.interact())).toContain(SimEventType.MechanismActivated);
    expect(sim.isMechanismActive('m-crank')).toBe(true);

    pilot.walkTo(3900);
    expect(pilot.feet).toBe(580);
    pilot.shift(Timeline.Eclipse);
    pilot.walkTo(4010);
    expect(sim.respawnPoint.id).toBe('cp-sanctum');

    pilot.shift(Timeline.Dawn);
    pilot.walkTo(4160);
    pilot.leapTo(4175, [
      { to: Timeline.Eclipse, when: feetAbove(570) },
      { to: Timeline.Dawn, when: (current) => descending(current) && sim.hasFragment('fragment-keeper') },
    ]);
    expect(pilot.feet).toBe(580);
    expect(sim.hasFragment('fragment-keeper')).toBe(true);

    pilot.walkTo(4680);
    pilot.leapTo(4855);
    expect(pilot.feet).toBe(676);
    pilot.walkTo(4905);
    pilot.leapTo(5075);
    expect(pilot.feet).toBe(772);
    pilot.walkTo(5125);
    pilot.leapTo(5300);
    expect(pilot.feet).toBe(868);
    pilot.walkTo(5320);
    expect(sim.respawnPoint.id).toBe('cp-portal');

    pilot.walkTo(5600);
    const locked = pilot.interact();
    expect(locked).toContainEqual({ type: SimEventType.PortalUnstable, missing: 1 });

    pilot.walkTo(6040);
    pilot.leapTo(6170);
    expect(pilot.feet).toBe(772);
    pilot.leapTo(6010, [{ to: Timeline.Eclipse, when: feetAbove(742) }]);
    expect(pilot.feet).toBe(676);
    pilot.leapTo(6170, [{ to: Timeline.Dawn, when: feetAbove(646) }]);
    expect(pilot.feet).toBe(580);
    pilot.walkTo(6300);
    pilot.shift(Timeline.Eclipse);
    expect(eventTypes(pilot.interact())).toContain(SimEventType.MechanismActivated);
    expect(sim.isMechanismActive('m-bell')).toBe(true);

    pilot.shift(Timeline.Dawn);
    pilot.walkTo(6250);
    pilot.leapTo(6132);
    expect(pilot.feet).toBe(484);
    pilot.walkTo(6095);
    pilot.leapTo(5984, [{ to: Timeline.Eclipse, when: feetAbove(454) }]);
    expect(pilot.feet).toBe(388);
    pilot.walkTo(5945);
    pilot.leapTo(5836, [{ to: Timeline.Dawn, when: feetAbove(358) }]);
    expect(pilot.feet).toBe(292);
    pilot.walkTo(5800);
    pilot.leapTo(5640);
    expect(pilot.feet).toBe(230);
    pilot.walkTo(5640);
    expect(sim.hasFragment('fragment-traveler')).toBe(true);

    pilot.walkTo(5560);
    expect(pilot.feet).toBe(868);
    expect(eventTypes(pilot.interact())).toContain(SimEventType.PortalActivated);
    expect(sim.status).toBe(SimStatus.Finale);
    pilot.wait(3);
    expect(Math.abs(pilot.cx - LEVEL_1.portal.standX)).toBeLessThanOrEqual(2);
    expect(sim.body.facing).toBe(1);

    expect(sim.fragmentCount).toBe(3);
    expect(sim.stats.deaths).toBe(0);
    expect(pilot.steps).toBeLessThan(120 * 600);
  });
});

describe('LEVEL_1 puzzle integrity', () => {
  it('cannot cross the broken Eclipse bridge without shifting', () => {
    const pilot = pilotAt(1380, 1000, Timeline.Eclipse);
    pilot.walkTo(1500);
    for (let index = 0; index < 240; index++) pilot.tick({ moveX: 1 });
    expect(pilot.events.some((event) => event.type === SimEventType.Died)).toBe(true);
  });

  it('keeps the sanctum gate shut in both realities until the winch turns', () => {
    for (const timeline of [Timeline.Dawn, Timeline.Eclipse]) {
      const pilot = pilotAt(3880, 580, timeline);
      for (let index = 0; index < 120; index++) pilot.tick({ moveX: 1 });
      expect(pilot.sim.body.x + PLAYER_SIZE.width).toBe(3920);
    }
    const opened = pilotAt(3880, 580, Timeline.Eclipse, ['m-crank']);
    for (let index = 0; index < 60; index++) opened.tick({ moveX: 1 });
    expect(opened.cx).toBeGreaterThan(3964);
  });

  it('cannot reach the winch balcony from the Eclipse', () => {
    const pilot = pilotAt(3560, 580, Timeline.Eclipse);
    pilot.leapTo(3700);
    expect(pilot.feet).toBe(580);
  });

  it('offers no light steps above the tower before the bell is struck', () => {
    const pilot = pilotAt(6250, 580, Timeline.Dawn);
    pilot.leapTo(6132);
    expect(pilot.feet).not.toBe(484);
  });

  it('cannot climb the Echo Steps while staying in a single timeline', () => {
    const pilot = pilotAt(2700, 1000, Timeline.Dawn);
    pilot.leapTo(2810);
    expect(pilot.feet).toBe(904);
    pilot.leapTo(2958);
    expect(pilot.feet).toBe(1000);
  });
});
