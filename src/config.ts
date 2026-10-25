export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const HALF_WIDTH = GAME_WIDTH / 2;
export const SEAM_X = HALF_WIDTH;

export const PIXEL = 2;

export const CAMERA = {
  focusRatioY: 0.6,
  lookAhead: 70,
  followX: 6,
  followY: 3.5,
  lookAheadRate: 2.5,
} as const;

export const SCENE_KEYS = {
  boot: 'boot',
  game: 'game',
  ui: 'ui',
} as const;

export const FONTS = {
  display: '"Cinzel", "Trajan Pro", Georgia, serif',
  body: '"Cormorant Garamond", Georgia, serif',
} as const;
