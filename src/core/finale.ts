import { FRAGMENTS_REQUIRED } from './constants';
import { clamp } from './geometry';

export const FINALE_TIMING = {
  fragmentsStart: 1.4,
  fragmentStagger: 0.35,
  fragmentFlight: 0.9,
  mergeStart: 3.0,
  mergeDuration: 2.2,
  flashPeak: 5.4,
  flashWidth: 0.45,
  textStart: 5.8,
  duration: 8.4,
} as const;

export interface FinaleFrame {
  merge: number;
  ringSpeed: number;
  portalPower: number;
  fragmentFlight: number[];
  flash: number;
  textAlpha: number;
  done: boolean;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function finaleFrame(elapsed: number): FinaleFrame {
  const t = Math.max(0, elapsed);
  const merge = smoothstep(
    FINALE_TIMING.mergeStart,
    FINALE_TIMING.mergeStart + FINALE_TIMING.mergeDuration,
    t,
  );
  const fragmentFlight: number[] = [];
  for (let index = 0; index < FRAGMENTS_REQUIRED; index++) {
    const start = FINALE_TIMING.fragmentsStart + index * FINALE_TIMING.fragmentStagger;
    fragmentFlight.push(smoothstep(start, start + FINALE_TIMING.fragmentFlight, t));
  }
  const settled = fragmentFlight.reduce((sum, value) => sum + value, 0) / FRAGMENTS_REQUIRED;
  const flashDistance = Math.abs(t - FINALE_TIMING.flashPeak) / FINALE_TIMING.flashWidth;

  return {
    merge,
    ringSpeed: 1 + settled * 2 + merge * 5,
    portalPower: clamp(0.35 + settled * 0.35 + merge * 0.3, 0, 1),
    fragmentFlight,
    flash: clamp(1 - flashDistance, 0, 1),
    textAlpha: smoothstep(FINALE_TIMING.textStart, FINALE_TIMING.textStart + 1, t),
    done: t >= FINALE_TIMING.duration,
  };
}
