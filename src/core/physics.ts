import { MOVEMENT, PLAYER_SIZE } from './constants';
import { clamp } from './geometry';
import type { Rect } from './types';

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
  coyoteTimer: number;
  jumpBufferTimer: number;
  jumpCut: boolean;
}

export interface MoveIntent {
  moveX: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
}

export interface BodyStepOutcome {
  jumped: boolean;
  landed: boolean;
  impactSpeed: number;
}

export function createBody(feetX: number, feetY: number): Body {
  return {
    x: feetX - PLAYER_SIZE.width / 2,
    y: feetY - PLAYER_SIZE.height,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    jumpCut: true,
  };
}

export function placeBody(body: Body, feetX: number, feetY: number): void {
  body.x = feetX - PLAYER_SIZE.width / 2;
  body.y = feetY - PLAYER_SIZE.height;
  body.vx = 0;
  body.vy = 0;
  body.onGround = false;
  body.coyoteTimer = 0;
  body.jumpBufferTimer = 0;
  body.jumpCut = true;
}

export function bodyRect(body: Body): Rect {
  return { x: body.x, y: body.y, w: PLAYER_SIZE.width, h: PLAYER_SIZE.height };
}

export function bodyCenterX(body: Body): number {
  return body.x + PLAYER_SIZE.width / 2;
}

export function bodyCenterY(body: Body): number {
  return body.y + PLAYER_SIZE.height / 2;
}

function approach(value: number, target: number, delta: number): number {
  return value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
}

function overlapsBody(body: Body, solid: Rect): boolean {
  return (
    body.x < solid.x + solid.w &&
    body.x + PLAYER_SIZE.width > solid.x &&
    body.y < solid.y + solid.h &&
    body.y + PLAYER_SIZE.height > solid.y
  );
}

function horizontalAcceleration(body: Body, target: number): number {
  const turning = target !== 0 && body.vx !== 0 && Math.sign(target) !== Math.sign(body.vx);
  if (body.onGround) {
    if (target === 0) return MOVEMENT.groundDecel;
    return turning ? MOVEMENT.turnAccel : MOVEMENT.groundAccel;
  }
  if (target === 0) return MOVEMENT.airDecel;
  return turning ? MOVEMENT.airTurnAccel : MOVEMENT.airAccel;
}

function resolveHorizontal(body: Body, solids: readonly Rect[]): void {
  for (const solid of solids) {
    if (!overlapsBody(body, solid)) continue;
    if (body.vx > 0) {
      body.x = solid.x - PLAYER_SIZE.width;
    } else if (body.vx < 0) {
      body.x = solid.x + solid.w;
    } else {
      const pushLeft = body.x + PLAYER_SIZE.width - solid.x;
      const pushRight = solid.x + solid.w - body.x;
      body.x = pushLeft < pushRight ? solid.x - PLAYER_SIZE.width : solid.x + solid.w;
    }
    body.vx = 0;
  }
}

function resolveVertical(body: Body, solids: readonly Rect[]): boolean {
  let landed = false;
  for (const solid of solids) {
    if (!overlapsBody(body, solid)) continue;
    if (body.vy > 0) {
      body.y = solid.y - PLAYER_SIZE.height;
      landed = true;
    } else if (body.vy < 0) {
      body.y = solid.y + solid.h;
    } else {
      body.y = solid.y - PLAYER_SIZE.height;
      landed = true;
    }
    body.vy = 0;
  }
  return landed;
}

function findSupport(body: Body, solids: readonly Rect[]): Rect | null {
  const feet = body.y + PLAYER_SIZE.height;
  for (const solid of solids) {
    if (
      body.x < solid.x + solid.w &&
      body.x + PLAYER_SIZE.width > solid.x &&
      solid.y < feet + 1 &&
      solid.y + solid.h > feet
    ) {
      return solid;
    }
  }
  return null;
}

export function isSupported(body: Body, solids: readonly Rect[]): boolean {
  return findSupport(body, solids) !== null;
}

export function stepBody(
  body: Body,
  intent: MoveIntent,
  solids: readonly Rect[],
  dt: number,
): BodyStepOutcome {
  const outcome: BodyStepOutcome = { jumped: false, landed: false, impactSpeed: 0 };
  const moveX = clamp(intent.moveX, -1, 1);
  const targetSpeed = moveX * MOVEMENT.runSpeed;

  body.vx = approach(body.vx, targetSpeed, horizontalAcceleration(body, targetSpeed) * dt);
  if (moveX !== 0) {
    body.facing = moveX > 0 ? 1 : -1;
  }

  body.coyoteTimer = body.onGround ? MOVEMENT.coyoteTime : Math.max(0, body.coyoteTimer - dt);
  body.jumpBufferTimer = intent.jumpPressed
    ? MOVEMENT.jumpBufferTime
    : Math.max(0, body.jumpBufferTimer - dt);

  if (body.jumpBufferTimer > 0 && body.coyoteTimer > 0) {
    body.vy = -MOVEMENT.jumpVelocity;
    body.onGround = false;
    body.coyoteTimer = 0;
    body.jumpBufferTimer = 0;
    body.jumpCut = false;
    outcome.jumped = true;
  }

  if (!intent.jumpHeld && body.vy < 0 && !body.jumpCut) {
    body.vy *= MOVEMENT.jumpCutMultiplier;
    body.jumpCut = true;
  }

  const gravity = body.vy < 0 ? MOVEMENT.riseGravity : MOVEMENT.fallGravity;
  body.vy = Math.min(body.vy + gravity * dt, MOVEMENT.maxFallSpeed);

  const wasOnGround = body.onGround;

  body.x += body.vx * dt;
  resolveHorizontal(body, solids);

  const verticalSpeed = body.vy;
  body.y += body.vy * dt;
  const hitFloor = resolveVertical(body, solids);

  const support = hitFloor || body.vy < 0 ? null : findSupport(body, solids);
  if (support) {
    body.y = support.y - PLAYER_SIZE.height;
  }
  body.onGround = hitFloor || support !== null;
  if (body.onGround) {
    body.vy = 0;
  }
  if (body.onGround && !wasOnGround) {
    outcome.landed = true;
    outcome.impactSpeed = Math.max(0, verticalSpeed);
  }

  return outcome;
}
