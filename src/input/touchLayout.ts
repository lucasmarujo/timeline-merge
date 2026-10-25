import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { clamp } from '../core/geometry';

export enum TouchButton {
  Jump = 'jump',
  Shift = 'shift',
  Interact = 'interact',
  Pause = 'pause',
}

export const ACTION_BUTTONS = [TouchButton.Jump, TouchButton.Shift, TouchButton.Interact] as const;

export type ActionButton = (typeof ACTION_BUTTONS)[number];

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TouchViewport {
  width: number;
  height: number;
  safe: Insets;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export interface TouchLayout {
  unit: number;
  gameInsets: { top: number; bottom: number };
  pad: Box;
  padZone: Box;
  actionZone: Box;
  buttons: Record<TouchButton, Circle>;
}

export const TOUCH_METRICS = {
  referenceSide: 390,
  minUnit: 0.9,
  maxUnit: 1.3,
  margin: 18,
  gap: 12,
  padWidth: 172,
  padHeight: 82,
  padReach: 34,
  deadZone: 10,
  knobRatio: 0.34,
  jumpRadius: 44,
  shiftRadius: 38,
  interactRadius: 31,
  pauseRadius: 25,
  hitSlop: 1.2,
} as const;

function clampBox(box: Box, width: number, height: number): Box {
  const left = clamp(box.x, 0, width);
  const top = clamp(box.y, 0, height);
  const right = clamp(box.x + box.width, 0, width);
  const bottom = clamp(box.y + box.height, 0, height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function boundsOf(circles: readonly Circle[], slop: number): Box {
  const left = Math.min(...circles.map((circle) => circle.x - circle.radius * slop));
  const right = Math.max(...circles.map((circle) => circle.x + circle.radius * slop));
  const top = Math.min(...circles.map((circle) => circle.y - circle.radius * slop));
  const bottom = Math.max(...circles.map((circle) => circle.y + circle.radius * slop));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function computeTouchLayout(viewport: TouchViewport): TouchLayout {
  const { width, height, safe } = viewport;
  const metrics = TOUCH_METRICS;
  const unit = clamp(Math.min(width, height) / metrics.referenceSide, metrics.minUnit, metrics.maxUnit);
  const margin = metrics.margin * unit;
  const gap = metrics.gap * unit;
  const jumpRadius = metrics.jumpRadius * unit;
  const shiftRadius = metrics.shiftRadius * unit;
  const interactRadius = metrics.interactRadius * unit;
  const pauseRadius = metrics.pauseRadius * unit;
  const padWidth = metrics.padWidth * unit;
  const padHeight = metrics.padHeight * unit;

  const scale = Math.min(width / GAME_WIDTH, height / GAME_HEIGHT);
  const spareY = Math.max(0, height - GAME_HEIGHT * scale);
  const clusterHeight = safe.bottom + margin * 2 + Math.max(padHeight, jumpRadius * 2);
  const band = Math.min(spareY, clusterHeight);
  const top = (spareY - band) / 2;

  const baseline = height - safe.bottom - margin;
  const jump: Circle = { x: width - safe.right - margin - jumpRadius, y: baseline - jumpRadius, radius: jumpRadius };
  const shift: Circle = { x: jump.x - jumpRadius - gap - shiftRadius, y: baseline - shiftRadius, radius: shiftRadius };
  const interact: Circle = { x: jump.x, y: jump.y - jumpRadius - gap - interactRadius, radius: interactRadius };
  const pause: Circle = { x: width - safe.right - margin - pauseRadius, y: safe.top + margin + pauseRadius, radius: pauseRadius };
  const pad: Box = { x: safe.left + margin, y: jump.y - padHeight / 2, width: padWidth, height: padHeight };
  const reach = metrics.padReach * unit;
  const padZone = clampBox({ x: pad.x - reach, y: pad.y - reach, width: padWidth + reach * 2, height: padHeight + reach * 2 }, width / 2, height);

  return {
    unit,
    gameInsets: { top, bottom: spareY - top },
    pad,
    padZone,
    actionZone: clampBox(boundsOf([jump, shift, interact], metrics.hitSlop), width, height),
    buttons: {
      [TouchButton.Jump]: jump,
      [TouchButton.Shift]: shift,
      [TouchButton.Interact]: interact,
      [TouchButton.Pause]: pause,
    },
  };
}

export function padOffset(layout: TouchLayout, x: number): number {
  return x - (layout.pad.x + layout.pad.width / 2);
}

export function padAxis(layout: TouchLayout, x: number): number {
  const offset = padOffset(layout, x);
  return Math.abs(offset) <= TOUCH_METRICS.deadZone * layout.unit ? 0 : Math.sign(offset);
}

export function knobTravel(layout: TouchLayout, x: number): number {
  const limit = layout.pad.width / 2 - layout.pad.height * TOUCH_METRICS.knobRatio - TOUCH_METRICS.margin * 0.25 * layout.unit;
  return clamp(padOffset(layout, x), -limit, limit);
}

export function hitActionButton(layout: TouchLayout, x: number, y: number): ActionButton | null {
  let closest: ActionButton | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const button of ACTION_BUTTONS) {
    const circle = layout.buttons[button];
    const distance = Math.hypot(x - circle.x, y - circle.y);
    if (distance <= circle.radius * TOUCH_METRICS.hitSlop && distance < closestDistance) {
      closest = button;
      closestDistance = distance;
    }
  }
  return closest;
}
