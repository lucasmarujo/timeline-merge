import type Phaser from 'phaser';
import { FONTS } from '../config';

export const COLORS = {
  ivory: '#fbf3e4',
  gold: '#f3cf7a',
  violet: '#c9a4ff',
  mist: '#e9e0f7',
  ink: '#0c0915',
} as const;

export function displayStyle(size: number, color: string = COLORS.ivory): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONTS.display,
    fontSize: `${size}px`,
    color,
    stroke: COLORS.ink,
    strokeThickness: Math.max(2, Math.round(size / 9)),
  };
}

export function bodyStyle(size: number, italic = true, color: string = COLORS.ivory): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONTS.body,
    fontSize: `${size}px`,
    fontStyle: italic ? 'italic' : 'normal',
    color,
    stroke: COLORS.ink,
    strokeThickness: Math.max(3, Math.round(size / 7)),
  };
}

export function applyRealityGradient(text: Phaser.GameObjects.Text): void {
  const gradient = text.context.createLinearGradient(0, 0, text.width, 0);
  gradient.addColorStop(0, '#ffdf96');
  gradient.addColorStop(0.46, '#fff6e6');
  gradient.addColorStop(0.54, '#f1e6ff');
  gradient.addColorStop(1, '#b58bff');
  text.setFill(gradient);
}
