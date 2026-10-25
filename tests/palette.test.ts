import { describe, expect, it } from 'vitest';
import { Timeline } from '../src/core/enums';
import { CHAPTERS } from '../src/levels/progression';
import { hexToRgb, hslToRgb, retone, rgbToHex, rgbToHsl } from '../src/render/art/color';
import { DAWN_PALETTE, ECLIPSE_PALETTE, isNeutralTone, themedPalette } from '../src/render/art/palette';

const NEUTRAL = { hue: 0, saturation: 1, light: 0 };

describe('retone', () => {
  it('round-trips colours through HSL', () => {
    for (const color of ['#000000', '#ffffff', '#ff0000', '#3f3138', '#b88cff', '#7ad0c4']) {
      expect(rgbToHex(hslToRgb(rgbToHsl(hexToRgb(color))))).toBe(color);
    }
  });

  it('leaves a colour alone for a neutral tone', () => {
    expect(retone('#b88cff', 0, 1, 0)).toBe('#b88cff');
  });

  it('rotates hue, scales saturation and shifts lightness within range', () => {
    expect(retone('#ff0000', 120, 1, 0)).toBe('#00ff00');
    expect(retone('#ff0000', 0, 0, 0)).toBe('#808080');
    expect(retone('#808080', 0, 1, 1)).toBe('#ffffff');
    expect(retone('#808080', 0, 1, -1)).toBe('#000000');
  });
});

describe('themedPalette', () => {
  it('returns the original palette for a neutral tone', () => {
    expect(isNeutralTone(NEUTRAL)).toBe(true);
    expect(themedPalette(Timeline.Dawn, NEUTRAL)).toBe(DAWN_PALETTE);
    expect(themedPalette(Timeline.Eclipse, NEUTRAL)).toBe(ECLIPSE_PALETTE);
  });

  it('tints the world but never the character', () => {
    const tone = { hue: 40, saturation: 1.2, light: -0.05 };
    const palette = themedPalette(Timeline.Dawn, tone);
    expect(palette.skyTop).not.toBe(DAWN_PALETTE.skyTop);
    expect(palette.stoneMid).not.toBe(DAWN_PALETTE.stoneMid);
    expect(palette.boots).toBe(DAWN_PALETTE.boots);
    expect(palette.buckle).toBe(DAWN_PALETTE.buckle);
  });

  it('reuses the palette it already built for a tone', () => {
    const tone = { hue: -25, saturation: 0.9, light: 0.03 };
    expect(themedPalette(Timeline.Eclipse, tone)).toBe(themedPalette(Timeline.Eclipse, { ...tone }));
  });

  it('gives every chapter its own look', () => {
    const skies = new Set(CHAPTERS.map((chapter) => `${themedPalette(Timeline.Dawn, chapter.dawn).skyTop}|${themedPalette(Timeline.Eclipse, chapter.eclipse).skyTop}`));
    expect(skies.size).toBe(CHAPTERS.length);
  });
});
