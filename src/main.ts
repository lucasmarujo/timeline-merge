import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { computeGameWidth } from './render/viewport';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { showFatalError } from './ui/fatalError';
import './styles.css';

const FONT_TIMEOUT_MS = 2500;

async function loadFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  const requests = Promise.all([
    document.fonts.load('500 32px "Cinzel"'),
    document.fonts.load('700 32px "Cinzel"'),
    document.fonts.load('500 24px "Cormorant Garamond"'),
    document.fonts.load('italic 500 24px "Cormorant Garamond"'),
  ]);
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, FONT_TIMEOUT_MS));
  try {
    await Promise.race([requests, timeout]);
  } catch (error) {
    console.warn('[Timeline Merge] Fonts failed to load, falling back to system serif.', error);
  }
}

async function boot(): Promise<void> {
  await loadFonts();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#07060d',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      roundPixels: true,
      powerPreference: 'high-performance',
    },
    audio: {
      noAudio: true,
    },
    input: {
      gamepad: false,
      mouse: true,
      touch: true,
    },
    scene: [BootScene, GameScene, UIScene],
  });
  const fitWidth = (): void => {
    const width = computeGameWidth(game.scale.parentSize.width, game.scale.parentSize.height);
    if (width !== game.scale.gameSize.width) game.scale.setGameSize(width, GAME_HEIGHT);
  };
  game.events.once(Phaser.Core.Events.READY, () => {
    fitWidth();
    game.scale.on(Phaser.Scale.Events.RESIZE, fitWidth);
  });
  document.getElementById('loading')?.remove();
  window.addEventListener('beforeunload', () => game.destroy(true));
  if (import.meta.env.DEV) {
    (window as unknown as { timelineMerge?: Phaser.Game }).timelineMerge = game;
  }
}

window.addEventListener('error', (event) => {
  console.error('[Timeline Merge] Unhandled error:', event.error ?? event.message);
});

boot().catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  showFatalError('Timeline Merge could not start', `${detail}. Please reload the page or try another browser.`);
});
