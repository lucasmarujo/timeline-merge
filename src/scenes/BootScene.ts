import Phaser from 'phaser';
import { GAME_HEIGHT, SCENE_KEYS } from '../config';
import { generateSharedArt } from '../render/art/ArtLibrary';
import { showFatalError } from '../ui/fatalError';
import { bodyStyle } from '../ui/textStyles';

export const ART_REGISTRY_KEY = 'art';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#07060d');
    this.add.rectangle(this.scale.width / 2, GAME_HEIGHT / 2, 2, GAME_HEIGHT, 0xd9c2ff, 0.9);
    this.add.text(this.scale.width / 2, GAME_HEIGHT / 2 + 60, 'Weaving two realities…', bodyStyle(24)).setOrigin(0.5);
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () => this.generate());
  }

  private generate(): void {
    try {
      const started = performance.now();
      const art = generateSharedArt(this);
      this.registry.set(ART_REGISTRY_KEY, art);
      console.info(`[Timeline Merge] Generated artwork in ${Math.round(performance.now() - started)} ms.`);
      this.scene.start(SCENE_KEYS.game);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[Timeline Merge] Artwork generation failed:', error);
      showFatalError('The worlds could not be woven', `A required resource failed to generate: ${detail}. Please reload the page or try a different browser.`);
    }
  }
}
