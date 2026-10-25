import { GAME_HEIGHT, GAME_WIDTH } from '../config';

export const MAX_GAME_WIDTH = 2560;
export const MAX_HALF_WIDTH = MAX_GAME_WIDTH / 2;

export function computeGameWidth(parentWidth: number, parentHeight: number): number {
  if (!(parentWidth > 0) || !(parentHeight > 0)) return GAME_WIDTH;
  const ideal = Math.round(((parentWidth / parentHeight) * GAME_HEIGHT) / 2) * 2;
  return Math.min(MAX_GAME_WIDTH, Math.max(GAME_WIDTH, ideal));
}

export function uiOffset(gameWidth: number): number {
  return (gameWidth - GAME_WIDTH) / 2;
}
