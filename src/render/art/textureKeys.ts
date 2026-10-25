import type { Timeline } from '../../core/enums';
import type { BackdropLayerId } from './backdropArt';
import type { TravelerAnimation } from './characterArt';

export const FxTexture = {
  Glow: 'fx-glow',
  GlowTight: 'fx-glow-tight',
  Ring: 'fx-ring',
  Spark: 'fx-spark',
  Mote: 'fx-mote',
  Pixel: 'fx-pixel',
  Shaft: 'fx-shaft',
  Seam: 'fx-seam',
  Vignette: 'fx-vignette',
  Fade: 'fx-fade',
  Fog: 'fx-fog',
  PortalCore: 'portal-core',
} as const;

export const TextureKey = {
  traveler: (timeline: Timeline): string => `traveler-${timeline}`,
  solid: (id: string, timeline: Timeline): string => `solid-${id}-${timeline}`,
  hazard: (id: string, timeline: Timeline): string => `hazard-${id}-${timeline}`,
  decor: (index: number, timeline: Timeline): string => `decor-${index}-${timeline}`,
  glowOf: (key: string): string => `${key}-glow`,
  fragment: (timeline: Timeline): string => `fragment-${timeline}`,
  checkpoint: (timeline: Timeline, lit: boolean): string => `checkpoint-${timeline}-${lit ? 'on' : 'off'}`,
  crankBase: (timeline: Timeline): string => `crank-base-${timeline}`,
  crankWheel: (timeline: Timeline): string => `crank-wheel-${timeline}`,
  bell: (timeline: Timeline): string => `bell-${timeline}`,
  bellFrame: (timeline: Timeline): string => `bell-frame-${timeline}`,
  portalRing: (timeline: Timeline): string => `portal-ring-${timeline}`,
  portalRunes: (timeline: Timeline): string => `portal-runes-${timeline}`,
  portalShard: (timeline: Timeline): string => `portal-shard-${timeline}`,
  sky: (timeline: Timeline): string => `sky-${timeline}`,
  cloudBand: (timeline: Timeline): string => `clouds-${timeline}`,
  backdrop: (layer: BackdropLayerId, timeline: Timeline): string => `backdrop-${layer}-${timeline}`,
  waterfall: (timeline: Timeline): string => `waterfall-${timeline}`,
};

export function animationKey(timeline: Timeline, animation: TravelerAnimation): string {
  return `traveler-${timeline}-${animation}`;
}
