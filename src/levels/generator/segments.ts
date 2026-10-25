import { DecorKind, DecorLayer, Discovery, HazardStyle, MechanismKind, MotionAxis, Presence, SolidStyle, Timeline, ZoneKind } from '../../core/enums';
import { hashString } from '../../core/rng';
import { airDash, airJump, airShift, lerp, other, presenceOf, retarget, type LevelBuilder } from './builder';

export interface SegmentContext {
  b: LevelBuilder;
  difficulty: number;
  intro: boolean;
}

export enum Slope {
  Flat = 'flat',
  Up = 'up',
  Down = 'down',
}

export interface SegmentTemplate {
  id: string;
  requires: readonly Discovery[];
  features: readonly Discovery[];
  slope: Slope;
  flow: boolean;
  build(context: SegmentContext): void;
}

const DAWN = Timeline.Dawn;
const ECLIPSE = Timeline.Eclipse;

function decorate(b: LevelBuilder, kind: DecorKind, x: number, y: number, presence: Presence, size = 1): void {
  b.decor.push({ kind, x: Math.round(x), y: Math.round(y), presence, layer: DecorLayer.Back, size, seed: hashString(`${b.level}:${x}:${kind}`) % 1000 });
}

function floorStyleFor(timeline: Timeline): SolidStyle {
  return timeline === DAWN ? SolidStyle.Bridge : SolidStyle.BrokenBridge;
}

const gap: SegmentTemplate = {
  id: 'gap',
  requires: [],
  features: [],
  slope: Slope.Flat,
  flow: true,
  build({ b, difficulty }) {
    const { x, y } = b.cursor;
    const edge = x + b.rng.int(140, 240);
    const dy = b.rng.pick([0, 0, 0, -1, 1]) * b.rng.int(30, 54);
    let width = Math.round(lerp(72, 112, difficulty)) + b.rng.int(-8, 8);
    if (dy < 0) width = Math.min(width, 88);
    if (dy > 0) width += 10;
    const far = edge + width;
    b.ground(x - 40, edge, y);
    b.ground(far, far + b.rng.int(220, 320), y + dy);
    b.mark(edge, far);
    b.walk(edge - 8);
    b.leap(far + 40);
    b.walk(far + 70);
    b.move(far + 70, y + dy);
  },
};

const ascent: SegmentTemplate = {
  id: 'ascent',
  requires: [],
  features: [],
  slope: Slope.Up,
  flow: true,
  build({ b, difficulty }) {
    const { x, y } = b.cursor;
    const first = x + b.rng.int(100, 170);
    b.ground(x - 40, first, y);
    const count = b.rng.int(2, difficulty > 0.5 ? 4 : 3);
    let edge = first;
    let top = y;
    b.walk(edge - 8);
    for (let index = 0; index < count; index++) {
      const rise = b.rng.int(58, 86);
      const width = b.rng.int(86, 120);
      const px = edge + b.rng.int(26, 50);
      top -= rise;
      b.solid(Presence.Both, b.rng.pick([SolidStyle.Slab, SolidStyle.Shard]), px, top, width, { h: 24 });
      b.leap(px + 40);
      edge = px + width;
      b.walk(edge - 8);
    }
    const land = edge + b.rng.int(26, 46);
    top -= b.rng.int(0, 50);
    b.ground(land, land + b.rng.int(240, 320), top);
    if (difficulty < 0.45) b.ground(first, land + 20, y);
    b.mark(first, land);
    b.leap(land + 40);
    b.walk(land + 70);
    b.move(land + 70, top);
  },
};

const descent: SegmentTemplate = {
  id: 'descent',
  requires: [],
  features: [],
  slope: Slope.Down,
  flow: true,
  build({ b }) {
    const { x, y } = b.cursor;
    const edge = x + b.rng.int(120, 200);
    const drop = b.rng.int(120, 250);
    const far = edge + b.rng.int(50, 120);
    b.ground(x - 40, edge, y);
    b.ground(far, far + b.rng.int(260, 340), y + drop);
    b.mark(edge, far);
    b.walk(edge - 8);
    b.leap(far + 50);
    b.walk(far + 80);
    b.move(far + 80, y + drop);
  },
};

const pillars: SegmentTemplate = {
  id: 'pillars',
  requires: [],
  features: [],
  slope: Slope.Flat,
  flow: true,
  build({ b, difficulty }) {
    const { x, y } = b.cursor;
    let edge = x + b.rng.int(110, 190);
    b.ground(x - 40, edge, y);
    const start = edge;
    let top = y;
    b.walk(edge - 8);
    const count = b.rng.int(2, difficulty > 0.4 ? 4 : 3);
    for (let index = 0; index < count; index++) {
      const width = b.rng.int(58, 84);
      const px = edge + Math.round(lerp(62, 98, difficulty)) + b.rng.int(-6, 6);
      top = Math.min(y + 70, Math.max(y - 70, top + b.rng.int(-36, 36)));
      b.solid(Presence.Both, SolidStyle.Tower, px, top, width, { h: 440 });
      b.leap(px + width / 2);
      edge = px + width;
      b.walk(edge - 8);
    }
    const land = edge + b.rng.int(60, 90);
    const landY = top + b.rng.int(-20, 30);
    b.ground(land, land + b.rng.int(240, 320), landY);
    b.mark(start, land);
    b.leap(land + 40);
    b.walk(land + 70);
    b.move(land + 70, landY);
  },
};

const sealedDoor: SegmentTemplate = {
  id: 'sealedDoor',
  requires: [Discovery.Shift],
  features: [Discovery.Shift],
  slope: Slope.Flat,
  flow: true,
  build({ b, intro }) {
    const { x, y } = b.cursor;
    const blocked = intro ? DAWN : b.rng.pick([DAWN, ECLIPSE]);
    const free = other(blocked);
    const door = x + b.rng.int(170, 260);
    b.ground(x - 40, door + 200, y);
    b.solid(presenceOf(blocked), blocked === DAWN ? SolidStyle.Door : SolidStyle.Portcullis, door, y - 230, 44, { h: 230 });
    b.mark(door - 60, door + 100);
    if (intro) {
      b.hint(x - 40, door + 60, y, 'The way is sealed in Dawn. Press Tab to shift into the Eclipse.', 'The way is sealed in Dawn. Tap SHIFT to cross into the Eclipse.');
    }
    b.walk(door - 30);
    b.ensure(free);
    b.walk(door + 100);
    b.move(door + 100, y, free);
  },
};

const splitFloor: SegmentTemplate = {
  id: 'splitFloor',
  requires: [Discovery.Shift],
  features: [Discovery.Shift],
  slope: Slope.Flat,
  flow: true,
  build({ b, intro }) {
    const { x, y } = b.cursor;
    const lead = x + b.rng.int(90, 150);
    b.ground(x - 40, lead, y);
    let timeline = intro ? DAWN : b.rng.pick([DAWN, ECLIPSE]);
    b.walk(lead - 40);
    b.ensure(timeline);
    let start = lead - 20;
    const pieces = b.rng.int(2, 3);
    for (let index = 0; index < pieces; index++) {
      const length = b.rng.int(220, 300);
      b.ground(start, start + length, y, floorStyleFor(timeline), presenceOf(timeline));
      if (index < pieces - 1) {
        b.walk(start + length - 40);
        timeline = other(timeline);
        b.shift(timeline);
        start = start + length - 80;
      } else {
        start += length;
      }
    }
    b.mark(lead, start);
    b.ground(start - 40, start + b.rng.int(220, 300), y);
    if (intro) {
      b.hint(lead, start, y, 'Where one reality crumbles, the other may hold. Shift on the overlap.', 'Where one reality crumbles, the other may hold. Tap SHIFT on the overlap.');
    }
    b.walk(start + 60);
    b.move(start + 60, y, timeline);
  },
};

const wardBridge: SegmentTemplate = {
  id: 'wardBridge',
  requires: [Discovery.Shift],
  features: [Discovery.Shift],
  slope: Slope.Flat,
  flow: true,
  build({ b }) {
    const { x, y } = b.cursor;
    const start = x + b.rng.int(90, 150);
    const length = b.rng.int(560, 720);
    const ward = start + Math.round(length * b.rng.range(0.4, 0.6));
    b.ground(x - 40, start, y);
    b.ground(start, start + length, y, SolidStyle.Bridge, Presence.Dawn);
    b.solid(Presence.Dawn, SolidStyle.Ward, ward, y - 280, 36, { h: 280 });
    b.ground(start, start + 60, y, SolidStyle.BrokenBridge, Presence.Eclipse);
    b.ground(ward - 100, ward + 140, y, SolidStyle.BrokenBridge, Presence.Eclipse);
    b.ground(start + length - 90, start + length, y, SolidStyle.BrokenBridge, Presence.Eclipse);
    b.ground(start + length, start + length + b.rng.int(220, 300), y);
    for (const offset of [-60, 170]) decorate(b, DecorKind.Suspension, ward + offset, y, Presence.Eclipse, 420);
    b.mark(start, start + length);
    b.walk(start - 40);
    b.ensure(DAWN);
    b.walk(ward - 40);
    b.shift(ECLIPSE);
    b.walk(ward + 90);
    b.shift(DAWN);
    b.walk(start + length + 60);
    b.move(start + length + 60, y, DAWN);
  },
};

const otherStair: SegmentTemplate = {
  id: 'otherStair',
  requires: [Discovery.Shift],
  features: [Discovery.Shift],
  slope: Slope.Up,
  flow: true,
  build({ b }) {
    const { x, y } = b.cursor;
    const stairTimeline = b.rng.pick([DAWN, ECLIPSE]);
    const stair = x + b.rng.int(150, 220);
    b.ground(x - 40, stair + 80, y);
    b.solid(presenceOf(stairTimeline), SolidStyle.Stair, stair, y - 80, 80, { h: 80 });
    const ledge = stair + 100;
    b.ground(ledge, ledge + b.rng.int(240, 320), y - 160);
    b.mark(stair - 20, ledge + 40);
    b.walk(stair - 40);
    b.ensure(stairTimeline);
    b.leap(stair + 40);
    b.walk(stair + 72);
    b.leap(ledge + 40);
    b.walk(ledge + 70);
    b.move(ledge + 70, y - 160, stairTimeline);
  },
};

const winchGate: SegmentTemplate = {
  id: 'winchGate',
  requires: [Discovery.Interact],
  features: [Discovery.Interact],
  slope: Slope.Flat,
  flow: true,
  build({ b, intro }) {
    const { x, y } = b.cursor;
    const crankX = x + b.rng.int(150, 210);
    const gate = crankX + b.rng.int(150, 220);
    b.ground(x - 40, gate + 230, y);
    const crank = b.mechanism(Presence.Dawn, MechanismKind.Crank, crankX, y);
    decorate(b, DecorKind.Winch, crankX, y, Presence.Eclipse);
    b.solid(Presence.Dawn, SolidStyle.Door, gate, y - 230, 44, { h: 230 });
    b.solid(Presence.Eclipse, SolidStyle.Portcullis, gate, y - 230, 44, { h: 230, condition: { unless: crank } });
    b.mark(gate - 40, gate + 90);
    if (intro) {
      b.hint(x - 40, gate, y, 'Press E to turn the winch. Its echo lifts the bars in the Eclipse.', 'Tap USE to turn the winch. Its echo lifts the bars in the Eclipse.');
    }
    b.walk(crankX - 40);
    b.ensure(DAWN);
    b.walk(crankX - 20);
    b.interact();
    b.shift(ECLIPSE);
    b.walk(gate + 110);
    b.move(gate + 110, y, ECLIPSE);
  },
};

const echoBridge: SegmentTemplate = {
  id: 'echoBridge',
  requires: [Discovery.Interact],
  features: [Discovery.Interact, Discovery.Bells],
  slope: Slope.Flat,
  flow: true,
  build({ b }) {
    const { x, y } = b.cursor;
    const useBell = b.level >= 7 && b.rng.chance(0.5);
    const mechanismTimeline = b.rng.pick([DAWN, ECLIPSE]);
    const bridgeTimeline = b.rng.pick([DAWN, ECLIPSE]);
    const edge = x + b.rng.int(180, 240);
    const pivot = edge - 70;
    const width = b.rng.int(260, 340);
    b.ground(x - 40, edge, y);
    const switcher = b.mechanism(presenceOf(mechanismTimeline), useBell ? MechanismKind.Bell : MechanismKind.Crank, pivot, y);
    if (useBell) decorate(b, DecorKind.BellFrame, pivot, y, presenceOf(other(mechanismTimeline)));
    else decorate(b, DecorKind.Winch, pivot, y, presenceOf(other(mechanismTimeline)));
    b.solid(presenceOf(bridgeTimeline), useBell ? SolidStyle.LightStep : SolidStyle.Bridge, edge - 10, y, width + 20, {
      h: useBell ? 18 : 28,
      condition: { requires: switcher },
    });
    b.ground(edge + width, edge + width + b.rng.int(220, 300), y);
    b.mark(edge, edge + width);
    b.walk(pivot - 40);
    b.ensure(mechanismTimeline);
    b.walk(pivot - 20);
    b.interact();
    b.ensure(bridgeTimeline);
    b.walk(edge + width + 60);
    b.move(edge + width + 60, y, bridgeTimeline);
  },
};

const thornField: SegmentTemplate = {
  id: 'thornField',
  requires: [Discovery.Thorns, Discovery.Shift],
  features: [Discovery.Thorns],
  slope: Slope.Flat,
  flow: true,
  build({ b, difficulty, intro }) {
    const { x, y } = b.cursor;
    const first = intro ? DAWN : b.rng.pick([DAWN, ECLIPSE]);
    const start = x + b.rng.int(120, 180);
    const length = Math.round(lerp(160, 300, difficulty));
    const twin = !intro && difficulty > 0.3 && b.rng.chance(0.6);
    const secondStart = start + length + 150;
    const secondLength = b.rng.int(140, 240);
    const end = twin ? secondStart + secondLength : start + length;
    b.ground(x - 40, end + 220, y);
    b.thorns(presenceOf(first), start, start + length, y);
    if (twin) b.thorns(presenceOf(other(first)), secondStart, secondStart + secondLength, y);
    if (intro) {
      b.hint(x - 40, start + length, y, 'Thorns grow in only one reality. Cross where they cannot reach you.');
    }
    b.walk(start - 40);
    b.ensure(other(first));
    b.walk(start + length + 30);
    if (twin) {
      b.walk(secondStart - 50);
      b.shift(first);
      b.walk(secondStart + secondLength + 40);
    }
    b.walk(end + 60);
    b.move(end + 60, y);
  },
};

const thornHop: SegmentTemplate = {
  id: 'thornHop',
  requires: [Discovery.Thorns],
  features: [Discovery.Thorns],
  slope: Slope.Flat,
  flow: true,
  build({ b, difficulty }) {
    const { x, y } = b.cursor;
    let edge = x + b.rng.int(110, 170);
    b.ground(x - 40, edge, y);
    const pitStart = edge;
    b.walk(edge - 8);
    const count = b.rng.int(2, 3);
    for (let index = 0; index < count; index++) {
      const width = b.rng.int(70, 96);
      const px = edge + Math.round(lerp(64, 96, difficulty)) + b.rng.int(-6, 6);
      b.solid(Presence.Both, SolidStyle.Slab, px, y, width, { h: 24 });
      b.leap(px + width / 2);
      edge = px + width;
      b.walk(edge - 8);
    }
    const land = edge + b.rng.int(64, 90);
    b.ground(pitStart, land, y + 70);
    b.thorns(Presence.Both, pitStart + 4, land - 4, y + 70);
    b.ground(land, land + b.rng.int(220, 300), y);
    b.leap(land + 40);
    b.walk(land + 70);
    b.move(land + 70, y);
  },
};

const echoClimb: SegmentTemplate = {
  id: 'echoClimb',
  requires: [Discovery.AirShift],
  features: [Discovery.AirShift],
  slope: Slope.Up,
  flow: true,
  build({ b, difficulty, intro }) {
    const { x, y } = b.cursor;
    const left = x + b.rng.int(220, 280);
    const right = left + 148;
    const count = intro ? 2 : difficulty > 0.55 ? 4 : b.rng.pick([2, 4]);
    b.ground(x - 40, right + 140, y);
    let top = y;
    b.walk(left - 90);
    b.ensure(DAWN);
    b.walk(left - 60);
    for (let index = 0; index < count; index++) {
      const previous = top;
      top -= 96;
      const onLeft = index % 2 === 0;
      const px = onLeft ? left : right;
      b.solid(onLeft ? Presence.Dawn : Presence.Eclipse, onLeft ? SolidStyle.Crystal : SolidStyle.Slab, px, top, 100, { h: 18 });
      if (!onLeft) decorate(b, DecorKind.Suspension, px + 50, top, Presence.Eclipse, 360);
      if (index === 0) b.leap(px + 50);
      else b.leap(px + 50, [airShift(onLeft ? DAWN : ECLIPSE, { feetAbove: previous - 30 })]);
    }
    const exit = right + 152;
    const exitY = top - b.rng.int(0, 36);
    b.ground(exit, exit + b.rng.int(260, 340), exitY);
    b.mark(left - 20, exit + 20);
    if (intro) {
      b.hint(left - 200, right + 100, y, 'You can shift in mid-air. Leap first, then shift.', 'You can shift in mid-air. Leap first, then tap SHIFT.');
    }
    b.leap(exit + 100);
    b.walk(exit + 120);
    b.move(exit + 120, exitY, ECLIPSE);
  },
};

const phaseGap: SegmentTemplate = {
  id: 'phaseGap',
  requires: [Discovery.AirShift],
  features: [Discovery.AirShift],
  slope: Slope.Flat,
  flow: true,
  build({ b, difficulty }) {
    const { x, y } = b.cursor;
    const takeoff = b.rng.pick([DAWN, ECLIPSE]);
    const landing = other(takeoff);
    const lead = x + b.rng.int(120, 180);
    const edge = lead + b.rng.int(130, 200);
    const width = Math.round(lerp(82, 112, difficulty));
    const far = edge + width;
    const landingEnd = far + b.rng.int(150, 200);
    b.ground(x - 40, lead, y);
    b.ground(lead, edge, y, floorStyleFor(takeoff), presenceOf(takeoff));
    b.ground(far, landingEnd, y, floorStyleFor(landing), presenceOf(landing));
    b.ground(landingEnd, landingEnd + b.rng.int(220, 300), y);
    b.mark(lead, landingEnd);
    b.walk(lead - 40);
    b.ensure(takeoff);
    b.walk(edge - 8);
    b.leap(far + 50, [airShift(landing, { xPast: edge + width * 0.3 })]);
    b.walk(landingEnd + 60);
    b.move(landingEnd + 60, y, landing);
  },
};

const bellStair: SegmentTemplate = {
  id: 'bellStair',
  requires: [Discovery.Bells, Discovery.Shift],
  features: [Discovery.Bells],
  slope: Slope.Up,
  flow: true,
  build({ b, intro }) {
    const { x, y } = b.cursor;
    const bellTimeline = intro ? ECLIPSE : b.rng.pick([DAWN, ECLIPSE]);
    const stepsTimeline = other(bellTimeline);
    const first = x + b.rng.int(200, 260);
    const bellX = first - 90;
    b.ground(x - 40, first + 120, y);
    const bell = b.mechanism(presenceOf(bellTimeline), MechanismKind.Bell, bellX, y);
    decorate(b, DecorKind.BellFrame, bellX, y, presenceOf(stepsTimeline));
    const count = b.rng.int(2, 3);
    let top = y;
    let sx = first;
    for (let index = 0; index < count; index++) {
      top -= 88;
      sx = first + index * 110;
      b.solid(presenceOf(stepsTimeline), SolidStyle.LightStep, sx, top, 96, { h: 18, condition: { requires: bell } });
    }
    const land = sx + 96 + 14;
    b.ground(land, land + b.rng.int(240, 320), top);
    b.mark(bellX - 40, land + 40);
    if (intro) {
      b.hint(x - 40, first + 120, y, 'Strike the bell. Its echo gathers light into steps in the other reality.', 'Tap USE to strike the bell. Its echo gathers light into steps in the other reality.');
    }
    b.walk(bellX - 40);
    b.ensure(bellTimeline);
    b.walk(bellX - 20);
    b.interact();
    b.ensure(stepsTimeline);
    b.walk(first - 30);
    for (let index = 0; index < count; index++) {
      const stepX = first + index * 110;
      if (index > 0) b.walk(stepX - 14 - 8);
      b.leap(stepX + 48);
    }
    b.walk(sx + 96 - 8);
    b.leap(land + 50);
    b.walk(land + 80);
    b.move(land + 80, top, stepsTimeline);
  },
};

const riftWall: SegmentTemplate = {
  id: 'riftWall',
  requires: [Discovery.RiftLeap],
  features: [Discovery.RiftLeap],
  slope: Slope.Up,
  flow: true,
  build({ b, intro }) {
    const { x, y, timeline } = b.cursor;
    const wall = x + b.rng.int(160, 230);
    const height = b.rng.int(168, 184);
    const width = b.rng.int(220, 320);
    b.ground(x - 40, wall, y);
    b.solid(Presence.Both, SolidStyle.Mesa, wall, y - height, width, { h: height + 260 });
    b.mark(wall - 40, wall + 60);
    if (intro) {
      b.hint(x - 40, wall, y, 'Leap, shift in mid-air, then leap again.', 'JUMP, tap SHIFT in mid-air, then JUMP again.');
    }
    b.walk(wall - 36);
    const after = other(timeline);
    b.leap(wall + 70, [airShift(after, { feetAbove: y - 80 }), airJump({ descending: true })]);
    b.walk(wall + 100);
    b.cursor.timeline = after;
    b.move(wall + 100, y - height, after);
  },
};

const riftGap: SegmentTemplate = {
  id: 'riftGap',
  requires: [Discovery.RiftLeap],
  features: [Discovery.RiftLeap],
  slope: Slope.Flat,
  flow: true,
  build({ b, difficulty }) {
    const { x, y, timeline } = b.cursor;
    const edge = x + b.rng.int(150, 220);
    const width = Math.round(lerp(180, 215, difficulty));
    const far = edge + width;
    b.ground(x - 40, edge, y);
    b.ground(far, far + b.rng.int(240, 320), y);
    b.mark(edge, far);
    const after = other(timeline);
    b.walk(edge - 8);
    b.leap(far + 50, [airShift(after, { afterSeconds: 0.3 }), airJump({ afterSeconds: 0.36 })]);
    b.walk(far + 80);
    b.move(far + 80, y, after);
  },
};

const chainedPassage: SegmentTemplate = {
  id: 'chainedPassage',
  requires: [Discovery.Chains, Discovery.Thorns],
  features: [Discovery.Chains],
  slope: Slope.Flat,
  flow: true,
  build({ b, intro }) {
    const { x, y } = b.cursor;
    const inner = intro ? ECLIPSE : b.rng.pick([DAWN, ECLIPSE]);
    const start = x + b.rng.int(150, 200);
    const width = b.rng.int(280, 360);
    const end = start + width;
    const thornStart = end + 70;
    const thornEnd = thornStart + b.rng.int(140, 220);
    b.ground(x - 40, thornEnd + 220, y);
    b.zone(ZoneKind.Anchor, Presence.Both, start, y - 300, width, 310);
    const blocker = start + Math.round(width / 2) - 22;
    b.solid(presenceOf(other(inner)), other(inner) === DAWN ? SolidStyle.Door : SolidStyle.Portcullis, blocker, y - 230, 44, { h: 230 });
    b.thorns(presenceOf(inner), thornStart, thornEnd, y);
    if (intro) {
      b.hint(x - 40, start + 40, y, 'Beneath the chains the rift is sealed. Choose your reality before you enter.');
    }
    b.walk(start - 40);
    b.ensure(inner);
    b.walk(end + 30);
    b.shift(other(inner));
    b.walk(thornEnd + 60);
    b.move(thornEnd + 60, y, other(inner));
  },
};

const chainedLeap: SegmentTemplate = {
  id: 'chainedLeap',
  requires: [Discovery.Chains, Discovery.AirShift],
  features: [Discovery.Chains],
  slope: Slope.Flat,
  flow: true,
  build({ b, difficulty }) {
    const { x, y } = b.cursor;
    const landing = b.rng.pick([DAWN, ECLIPSE]);
    const edge = x + b.rng.int(200, 260);
    const width = Math.round(lerp(84, 112, difficulty));
    const far = edge + width;
    const landingEnd = far + b.rng.int(160, 220);
    b.ground(x - 40, edge, y);
    b.ground(far, landingEnd, y, floorStyleFor(landing), presenceOf(landing));
    b.ground(landingEnd, landingEnd + b.rng.int(220, 300), y);
    b.zone(ZoneKind.Anchor, Presence.Both, edge - 40, y - 300, landingEnd - edge + 40, 310);
    b.mark(edge - 40, landingEnd);
    b.walk(edge - 90);
    b.ensure(landing);
    b.walk(edge - 8);
    b.leap(far + 50);
    b.walk(landingEnd + 60);
    b.move(landingEnd + 60, y, landing);
  },
};

const dashGap: SegmentTemplate = {
  id: 'dashGap',
  requires: [Discovery.Dash],
  features: [Discovery.Dash],
  slope: Slope.Flat,
  flow: true,
  build({ b, difficulty, intro }) {
    const { x, y } = b.cursor;
    const edge = x + b.rng.int(150, 220);
    const width = intro ? 168 : Math.round(lerp(172, 204, difficulty));
    const far = edge + width;
    const landingY = y + (intro ? 0 : b.rng.int(-20, 30));
    b.ground(x - 40, edge, y);
    b.ground(far, far + b.rng.int(240, 320), landingY);
    b.mark(edge, far);
    if (intro) {
      b.hint(x - 40, edge, y, 'Leap, then press Q (or K) to dash across.', 'JUMP, then tap DASH to cross.');
    }
    b.walk(edge - 8);
    b.leap(far + 50, [airDash(1, { afterSeconds: 0.3 })]);
    b.walk(far + 80);
    b.move(far + 80, landingY);
  },
};

const dashShift: SegmentTemplate = {
  id: 'dashShift',
  requires: [Discovery.Dash, Discovery.AirShift],
  features: [Discovery.Dash],
  slope: Slope.Flat,
  flow: true,
  build({ b, difficulty }) {
    const { x, y } = b.cursor;
    const takeoff = b.rng.pick([DAWN, ECLIPSE]);
    const landing = other(takeoff);
    const edge = x + b.rng.int(160, 220);
    const width = Math.round(lerp(168, 196, difficulty));
    const far = edge + width;
    const landingEnd = far + b.rng.int(160, 220);
    const wall = edge + Math.round(width * 0.55);
    b.ground(x - 40, edge, y);
    b.solid(presenceOf(takeoff), takeoff === DAWN ? SolidStyle.Ward : SolidStyle.Portcullis, wall, y - 300, 36, { h: 300 });
    b.ground(far, landingEnd, y, floorStyleFor(landing), presenceOf(landing));
    b.ground(landingEnd, landingEnd + b.rng.int(220, 300), y);
    b.mark(edge, landingEnd);
    b.walk(edge - 80);
    b.ensure(takeoff);
    b.walk(edge - 8);
    b.leap(far + 50, [airShift(landing, { afterSeconds: 0.2 }), airDash(1, { afterSeconds: 0.3 })]);
    b.walk(landingEnd + 60);
    b.move(landingEnd + 60, y, landing);
  },
};

const ferry: SegmentTemplate = {
  id: 'ferry',
  requires: [Discovery.Drifters],
  features: [Discovery.Drifters],
  slope: Slope.Flat,
  flow: false,
  build({ b, intro }) {
    const { x, y } = b.cursor;
    const edge = x + b.rng.int(150, 210);
    const width = b.rng.int(300, 440);
    const far = edge + width;
    const base = edge - 40;
    const range = width - 30;
    const period = b.rng.range(4.6, 6);
    b.ground(x - 40, edge, y);
    const mover = b.solid(Presence.Both, SolidStyle.Drifter, base, y, 110, { h: 22, motion: { axis: MotionAxis.X, range, period, phase: 0 } });
    b.ground(far, far + b.rng.int(240, 320), y);
    b.mark(edge - 40, far + 40);
    if (intro) {
      b.hint(x - 40, edge, y, 'Wait for the drifting stone, then ride it across.');
    }
    b.walk(edge - 30);
    b.waitMover(mover, base - 1, base + 3);
    b.board(mover, 1);
    b.waitMover(mover, base + range - 3, base + range + 1);
    b.walk(far + 70);
    b.move(far + 70, y);
  },
};

const elevator: SegmentTemplate = {
  id: 'elevator',
  requires: [Discovery.Drifters],
  features: [Discovery.Drifters],
  slope: Slope.Up,
  flow: false,
  build({ b }) {
    const { x, y } = b.cursor;
    const lift = x + b.rng.int(160, 220);
    const height = b.rng.int(200, 300);
    const period = b.rng.range(5.5, 7);
    b.ground(x - 40, lift - 12, y);
    const mover = b.solid(Presence.Both, SolidStyle.Drifter, lift, y, 100, { h: 22, motion: { axis: MotionAxis.Y, range: -height, period, phase: 0 } });
    const ledge = lift + 112;
    b.ground(ledge, ledge + b.rng.int(240, 320), y - height);
    b.mark(lift - 20, ledge + 40);
    b.walk(lift - 30);
    b.waitMover(mover, y - 2, y + 1);
    b.leap(lift + 50);
    b.waitMover(mover, y - height - 1, y - height + 3);
    b.leap(ledge + 50);
    b.walk(ledge + 80);
    b.move(ledge + 80, y - height);
  },
};

const glideCanyon: SegmentTemplate = {
  id: 'glideCanyon',
  requires: [Discovery.Glide],
  features: [Discovery.Glide],
  slope: Slope.Down,
  flow: true,
  build({ b, difficulty, intro }) {
    const { x, y } = b.cursor;
    const edge = x + b.rng.int(150, 220);
    const width = intro ? 300 : Math.round(lerp(300, 380, difficulty));
    const drop = b.rng.int(40, 100);
    const far = edge + width;
    b.ground(x - 40, edge, y);
    b.ground(far, far + b.rng.int(260, 340), y + drop);
    b.mark(edge, far);
    if (intro) {
      b.hint(x - 40, edge, y, 'Hold W after leaping to glide across.', 'Hold JUMP after leaping to glide across.');
    }
    b.walk(edge - 8);
    b.leap(far + 60);
    b.walk(far + 90);
    b.move(far + 90, y + drop);
  },
};

const updraft: SegmentTemplate = {
  id: 'updraft',
  requires: [Discovery.Glide],
  features: [Discovery.Glide],
  slope: Slope.Up,
  flow: true,
  build({ b }) {
    const { x, y } = b.cursor;
    const column = x + b.rng.int(170, 230);
    const height = b.rng.int(260, 350);
    b.ground(x - 40, column + 110, y);
    b.zone(ZoneKind.Updraft, Presence.Both, column, y - height - 70, 110, height + 70);
    const ledge = column + 110;
    b.ground(ledge, ledge + b.rng.int(240, 320), y - height);
    b.mark(column - 20, ledge + 30);
    b.walk(column + 20);
    b.leap(column + 55, [retarget(ledge + 70, { feetAbove: y - height - 24 })]);
    b.walk(ledge + 90);
    b.move(ledge + 90, y - height);
  },
};

const wraithHall: SegmentTemplate = {
  id: 'wraithHall',
  requires: [Discovery.Wraiths, Discovery.Thorns],
  features: [Discovery.Wraiths],
  slope: Slope.Flat,
  flow: false,
  build({ b, intro }) {
    const { x, y } = b.cursor;
    const haunted = b.rng.pick([DAWN, ECLIPSE]);
    const safe = other(haunted);
    const strip = x + b.rng.int(320, 380);
    const stripEnd = strip + b.rng.int(110, 124);
    const base = strip - 10;
    const range = 520;
    b.ground(x - 40, base + range + 220, y);
    b.thorns(presenceOf(safe), strip, stripEnd, y);
    const wraith = b.hazard(presenceOf(haunted), HazardStyle.Wraith, base, y - 60, 30, 54, { axis: MotionAxis.X, range, period: b.rng.range(4.6, 5.2), phase: 0 });
    b.mark(base, base + range + 30);
    if (intro) {
      b.hint(x - 40, strip, y, 'A wraith walks one reality. Cross while it is far away, then slip back out of its reach.');
    }
    b.walk(base - 60);
    b.ensure(safe);
    b.walk(strip - 26);
    b.waitHazard(wraith, base + range - 4, base + range + 1);
    b.shift(haunted);
    b.walk(stripEnd + 24);
    b.shift(safe);
    b.walk(base + range + 100);
    b.move(base + range + 100, y, safe);
  },
};

const chimney: SegmentTemplate = {
  id: 'chimney',
  requires: [Discovery.WallGrip],
  features: [Discovery.WallGrip],
  slope: Slope.Up,
  flow: true,
  build({ b, intro }) {
    const { x, y } = b.cursor;
    const base = x + b.rng.int(140, 200);
    const shaft = b.rng.int(104, 124);
    const height = b.rng.int(240, 340);
    const rightWall = base + 40 + shaft;
    b.ground(x - 40, rightWall, y);
    b.solid(Presence.Both, SolidStyle.Wall, base, y - height - 40, 40, { h: height - 50 });
    b.solid(Presence.Both, SolidStyle.Tower, rightWall, y - height, 60, { h: height + 260 });
    b.ground(rightWall, rightWall + b.rng.int(260, 330), y - height);
    b.mark(base - 20, rightWall + 60);
    if (intro) {
      b.hint(x - 40, rightWall, y, 'Hold toward a wall to slide on it, then jump to kick off. Climb the shaft.', 'Hold toward a wall to slide on it, then tap JUMP to kick off. Climb the shaft.');
    }
    b.walk(base + 40 + shaft / 2);
    b.wallClimb(1, y - height - 12, rightWall + 70);
    b.walk(rightWall + 90);
    b.move(rightWall + 90, y - height);
  },
};

const crumbleRun: SegmentTemplate = {
  id: 'crumbleRun',
  requires: [Discovery.Crumble],
  features: [Discovery.Crumble],
  slope: Slope.Flat,
  flow: true,
  build({ b, difficulty, intro }) {
    const { x, y } = b.cursor;
    let edge = x + b.rng.int(140, 200);
    b.ground(x - 40, edge, y);
    const start = edge;
    b.walk(edge - 8);
    const count = b.rng.int(3, difficulty > 0.5 ? 5 : 4);
    let first = true;
    for (let index = 0; index < count; index++) {
      const width = b.rng.int(66, 80);
      const px = edge + Math.round(lerp(52, 80, difficulty)) + b.rng.int(-4, 4);
      b.solid(Presence.Both, SolidStyle.Crumble, px, y, width, { h: 22, crumble: true });
      b.leap(px + width - 20, undefined, first);
      first = false;
      edge = px + width;
    }
    const land = edge + b.rng.int(56, 80);
    b.ground(land, land + b.rng.int(240, 320), y);
    b.mark(start, land);
    if (intro) {
      b.hint(x - 40, start, y, 'This stone will not hold you for long. Keep moving.');
    }
    b.leap(land + 40, undefined, false);
    b.walk(land + 70);
    b.move(land + 70, y);
  },
};

const pulseGates: SegmentTemplate = {
  id: 'pulseGates',
  requires: [Discovery.Pulse],
  features: [Discovery.Pulse],
  slope: Slope.Flat,
  flow: false,
  build({ b, intro }) {
    const { x, y } = b.cursor;
    const period = b.rng.pick([1.6, 1.8, 2]);
    const count = intro ? 2 : b.rng.int(2, 3);
    const spacing = 240;
    const start = x + b.rng.int(140, 200);
    const width = count * spacing + 120;
    const end = start + width;
    b.ground(x - 40, end + 240, y);
    b.zone(ZoneKind.Pulse, Presence.Both, start, y - 330, width, 340, period);
    let blocked = b.rng.pick([DAWN, ECLIPSE]);
    if (intro) {
      b.hint(x - 40, start + 60, y, 'Inside the seam reality flips on its own. Wait for the reality without the wall, then go.');
    }
    b.walk(start - 40);
    for (let index = 0; index < count; index++) {
      const wall = start + 120 + index * spacing;
      b.solid(presenceOf(blocked), blocked === DAWN ? SolidStyle.Ward : SolidStyle.Portcullis, wall, y - 260, 28, { h: 260 });
      b.walk(wall - 34);
      b.waitPulse(0.02, 0.4, other(blocked));
      b.walk(wall + 28 + 34);
      blocked = other(blocked);
    }
    b.walk(end + 50);
    b.shift(DAWN);
    b.move(end + 50, y, DAWN);
  },
};

const chainVault: SegmentTemplate = {
  id: 'chainVault',
  requires: [Discovery.RiftChain],
  features: [Discovery.RiftChain],
  slope: Slope.Up,
  flow: true,
  build({ b, difficulty, intro }) {
    const { x, y, timeline } = b.cursor;
    const edge = x + b.rng.int(160, 220);
    const width = intro ? 236 : Math.round(lerp(236, 262, difficulty));
    const far = edge + width;
    b.ground(x - 40, edge, y);
    b.ground(far, far + b.rng.int(240, 320), y - 60);
    b.mark(edge, far);
    if (intro) {
      b.hint(x - 40, edge, y, 'Dash, shift in mid-air, and dash again.', 'DASH, SHIFT in mid-air, then DASH again.');
    }
    const after = other(timeline);
    b.walk(edge - 8);
    b.leap(far + 50, [airDash(1, { afterSeconds: 0.3 }), airShift(after, { afterSeconds: 0.48 }), airDash(1, { afterSeconds: 0.5 })]);
    b.walk(far + 80);
    b.move(far + 80, y - 60, after);
  },
};

export const SEGMENTS: readonly SegmentTemplate[] = [
  gap,
  ascent,
  descent,
  pillars,
  sealedDoor,
  splitFloor,
  wardBridge,
  otherStair,
  winchGate,
  echoBridge,
  thornField,
  thornHop,
  echoClimb,
  phaseGap,
  bellStair,
  riftWall,
  riftGap,
  chainedPassage,
  chainedLeap,
  dashGap,
  dashShift,
  ferry,
  elevator,
  glideCanyon,
  updraft,
  wraithHall,
  chimney,
  crumbleRun,
  pulseGates,
  chainVault,
];

export const DESCENT = descent;
