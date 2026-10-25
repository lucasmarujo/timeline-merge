import { Timeline } from '../../core/enums';
import type { Palette } from './palette';
import { PixelCanvas, type Point } from './PixelCanvas';

export const TRAVELER_FRAME = 32;
export const TRAVELER_FEET_Y = 30;

export enum TravelerAnimation {
  Idle = 'idle',
  Run = 'run',
  Rise = 'rise',
  Fall = 'fall',
  Land = 'land',
}

export interface AnimationSequence {
  start: number;
  count: number;
  frameRate: number;
  repeat: number;
}

export const TRAVELER_SEQUENCES: Readonly<Record<TravelerAnimation, AnimationSequence>> = {
  [TravelerAnimation.Idle]: { start: 0, count: 6, frameRate: 6, repeat: -1 },
  [TravelerAnimation.Run]: { start: 6, count: 8, frameRate: 14, repeat: -1 },
  [TravelerAnimation.Rise]: { start: 14, count: 2, frameRate: 8, repeat: -1 },
  [TravelerAnimation.Fall]: { start: 16, count: 2, frameRate: 8, repeat: -1 },
  [TravelerAnimation.Land]: { start: 18, count: 1, frameRate: 1, repeat: 0 },
};

export const TRAVELER_FRAME_COUNT = 19;

interface LegPose {
  dx: number;
  lift: number;
}

interface CapePose {
  reach: number;
  drop: number;
  wave: number;
}

interface Pose {
  bob: number;
  front: LegPose;
  back: LegPose;
  armFront: number;
  armBack: number;
  armRaise: number;
  cape: CapePose;
  hairSweep: number;
}

function buildPoses(): Pose[] {
  const poses: Pose[] = [];
  const breathing = [0, 0, 0, 1, 1, 0];
  for (let index = 0; index < 6; index++) {
    const phase = (index / 6) * Math.PI * 2;
    poses.push({
      bob: breathing[index] as number,
      front: { dx: 1, lift: 0 },
      back: { dx: -1, lift: 0 },
      armFront: 0,
      armBack: 0,
      armRaise: 0,
      cape: { reach: 4.6 + Math.sin(phase) * 0.6, drop: 11, wave: Math.sin(phase) * 0.6 },
      hairSweep: 0,
    });
  }
  for (let index = 0; index < 8; index++) {
    const phase = (index / 8) * Math.PI * 2;
    poses.push({
      bob: Math.abs(Math.sin(phase)) > 0.7 ? 1 : 0,
      front: { dx: Math.round(3.2 * Math.sin(phase)), lift: Math.round(Math.max(0, 2 * Math.cos(phase))) },
      back: {
        dx: Math.round(3.2 * Math.sin(phase + Math.PI)),
        lift: Math.round(Math.max(0, 2 * Math.cos(phase + Math.PI))),
      },
      armFront: Math.round(-2.5 * Math.sin(phase)),
      armBack: Math.round(2.5 * Math.sin(phase)),
      armRaise: 0,
      cape: { reach: 8.5 + Math.sin(phase * 2), drop: 4 + Math.cos(phase * 2) * 1.5, wave: Math.sin(phase * 2 + 1) * 1.2 },
      hairSweep: 1,
    });
  }
  for (let index = 0; index < 2; index++) {
    poses.push({
      bob: 0,
      front: { dx: 2, lift: 3 },
      back: { dx: -1, lift: 1 },
      armFront: -1,
      armBack: 1,
      armRaise: 2,
      cape: { reach: 4 + index * 0.5, drop: 12 + index, wave: index ? 0.6 : -0.6 },
      hairSweep: 0,
    });
  }
  for (let index = 0; index < 2; index++) {
    poses.push({
      bob: 0,
      front: { dx: 1, lift: 1 },
      back: { dx: -2, lift: 0 },
      armFront: 1,
      armBack: -1,
      armRaise: 4,
      cape: { reach: 6 + index * 0.5, drop: -1 - index, wave: index ? 0.8 : -0.8 },
      hairSweep: 1,
    });
  }
  poses.push({
    bob: 2,
    front: { dx: 2, lift: 0 },
    back: { dx: -2, lift: 0 },
    armFront: 1,
    armBack: -1,
    armRaise: -1,
    cape: { reach: 3, drop: 8, wave: 0 },
    hairSweep: 0,
  });
  return poses;
}

function drawCape(pc: PixelCanvas, ox: number, oy: number, pose: Pose, palette: Palette): void {
  const shoulder = oy + 15 + pose.bob;
  const { reach, drop, wave } = pose.cape;
  const tip: Point = { x: ox + 14 - reach, y: shoulder + drop };
  const hem: Point = { x: ox + 14, y: shoulder + 10 };
  const outer: Point = {
    x: ox + 12 - reach * 0.55 - Math.abs(wave) * 0.5,
    y: shoulder + drop * 0.45 + 1 + wave,
  };
  const hemMid: Point = {
    x: (tip.x + hem.x) / 2 + wave * 0.5,
    y: (tip.y + hem.y) / 2 + 1.5 - wave,
  };
  const shape: Point[] = [
    { x: ox + 15.5, y: shoulder },
    { x: ox + 12, y: shoulder },
    { x: ox + 11 - reach * 0.15, y: shoulder + 2 },
    outer,
    tip,
    hemMid,
    hem,
  ];
  pc.poly(shape, palette.cape);
  pc.line(tip.x, tip.y, hemMid.x, hemMid.y, palette.capeTrim);
  pc.line(hemMid.x, hemMid.y, hem.x, hem.y, palette.capeTrim);
  pc.line(ox + 13, shoulder + 1, (hemMid.x + hem.x) / 2, (hemMid.y + hem.y) / 2 - 1, palette.capeShade);
}

function drawLeg(
  pc: PixelCanvas,
  hipX: number,
  hipY: number,
  footBaseY: number,
  leg: LegPose,
  palette: Palette,
  isBack: boolean,
): void {
  const footY = footBaseY - leg.lift;
  const length = Math.max(1, footY - hipY);
  const pants = isBack ? palette.pants : palette.tunic;
  const boots = isBack ? palette.boots : palette.bootsLight;
  for (let row = hipY; row <= footY; row++) {
    const x = hipX + Math.round((leg.dx * (row - hipY)) / length);
    const isBoot = row >= footY - 2;
    pc.rect(x, row, 2, 1, isBoot ? boots : pants);
    if (row === footY) {
      pc.px(x + 2, row, boots);
    }
  }
}

function drawArm(pc: PixelCanvas, shoulderX: number, shoulderY: number, handDx: number, raise: number, sleeve: string, skin: string): void {
  const handX = shoulderX + handDx;
  const handY = shoulderY + 5 - raise;
  pc.line(shoulderX, shoulderY, handX, handY, sleeve);
  pc.px(handX, handY + (raise > 2 ? -1 : 1), skin);
}

function drawHead(pc: PixelCanvas, ox: number, oy: number, pose: Pose, palette: Palette): void {
  const top = oy + 7 + pose.bob;
  const sweep = pose.hairSweep;
  pc.rect(ox + 15, top + 3, 5, 4, palette.skin);
  pc.rect(ox + 15, top + 7, 4, 1, palette.skin);
  pc.rect(ox + 15, top + 3, 1, 5, palette.skinShade);
  pc.px(ox + 18, top + 5, palette.ink);
  pc.px(ox + 19, top + 7, palette.skinShade);

  pc.rect(ox + 13, top, 7, 3, palette.hair);
  pc.rect(ox + 12, top + 2, 4, 5, palette.hair);
  pc.rect(ox + 13, top + 3, 4, 1, palette.hair);
  pc.px(ox + 18, top + 3, palette.hair);
  pc.px(ox + 20, top + 2, palette.hair);
  pc.px(ox + 14, top - 1, palette.hair);
  pc.px(ox + 16, top - 2, palette.hair);
  pc.px(ox + 16, top - 1, palette.hair);
  pc.px(ox + 18, top - 1, palette.hair);
  pc.px(ox + 12 - sweep, top + 1, palette.hair);
  pc.px(ox + 11 - sweep, top + 3, palette.hair);
  pc.px(ox + 11 - sweep, top + 5, palette.hair);
  pc.px(ox + 16, top, palette.hairLight);
  pc.px(ox + 17, top + 1, palette.hairLight);
  pc.px(ox + 14, top + 1, palette.hairLight);
}

function drawTraveler(pc: PixelCanvas, ox: number, oy: number, pose: Pose, palette: Palette): void {
  const bob = pose.bob;
  const hipY = oy + 22 + bob;
  const footBaseY = oy + TRAVELER_FEET_Y - 1;

  drawCape(pc, ox, oy, pose, palette);
  drawArm(pc, ox + 13, oy + 16 + bob, pose.armBack, pose.armRaise, palette.tunic, palette.skinShade);
  drawLeg(pc, ox + 13, hipY, footBaseY, pose.back, palette, true);

  pc.rect(ox + 13, oy + 15 + bob, 6, 6, palette.tunic);
  pc.rect(ox + 17, oy + 15 + bob, 2, 5, palette.tunicLight);
  pc.rect(ox + 13, oy + 20 + bob, 6, 1, palette.belt);
  pc.px(ox + 17, oy + 20 + bob, palette.buckle);
  pc.rect(ox + 13, oy + 21 + bob, 6, 1, palette.pants);
  pc.rect(ox + 14, oy + 15 + bob, 3, 1, palette.capeTrim);

  drawLeg(pc, ox + 16, hipY, footBaseY, pose.front, palette, false);
  drawHead(pc, ox, oy, pose, palette);
  drawArm(pc, ox + 18, oy + 16 + bob, pose.armFront, pose.armRaise, palette.tunicLight, palette.skin);
}

export function paintTravelerSheet(palette: Palette): PixelCanvas {
  const poses = buildPoses();
  const sheet = new PixelCanvas(TRAVELER_FRAME * poses.length, TRAVELER_FRAME);
  poses.forEach((pose, index) => drawTraveler(sheet, index * TRAVELER_FRAME, 0, pose, palette));
  sheet.rim(palette.rim, palette.lightDirection, -1, 0.55);
  sheet.outline(palette.ink, palette.timeline === Timeline.Dawn ? 0.75 : 0.9);
  return sheet;
}
