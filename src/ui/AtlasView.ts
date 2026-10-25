import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { NodeState, type AtlasModel } from '../levels/atlas';
import { DiscoveryKind, LEVELS_PER_CHAPTER } from '../levels/progression';
import { FadingGroup, type Fadeable } from './FadingGroup';
import { formatDuration } from './Menu';
import { diamond } from './MenuView';
import { applyRealityGradient, bodyStyle, COLORS, displayStyle } from './textStyles';

export interface AtlasCallbacks {
  pickLevel(level: number): void;
  changeChapter(delta: number): void;
  back(): void;
}

const NODE_Y = 300;
const NODE_SPACING = 108;
const NODE_RADIUS = 30;
const FINALE_RADIUS = 38;
const CENTER = GAME_WIDTH / 2;

function nodeX(index: number): number {
  return CENTER + (index - (LEVELS_PER_CHAPTER - 1) / 2) * NODE_SPACING;
}

export class AtlasView {
  private readonly group: FadingGroup;
  private readonly chapterTitle: Phaser.GameObjects.Text;
  private readonly chapterSubtitle: Phaser.GameObjects.Text;
  private readonly previous: Phaser.GameObjects.Text;
  private readonly next: Phaser.GameObjects.Text;
  private readonly nodes: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly numbers: Phaser.GameObjects.Text[];
  private readonly tags: Phaser.GameObjects.Text[];
  private readonly detailTitle: Phaser.GameObjects.Text;
  private readonly detailLine: Phaser.GameObjects.Text;
  private readonly detailNote: Phaser.GameObjects.Text;
  private readonly totals: Phaser.GameObjects.Text;
  private readonly help: Phaser.GameObjects.Text;
  private readonly zones: Phaser.GameObjects.Zone[] = [];
  private model: AtlasModel | null = null;
  private time = 0;

  constructor(scene: Phaser.Scene, callbacks: AtlasCallbacks) {
    const veil = scene.add.rectangle(CENTER, GAME_HEIGHT / 2, 4200, GAME_HEIGHT, 0x07060d, 0.84);
    const label = scene.add.text(CENTER, 62, 'ATLAS  OF  ECHOES', displayStyle(15, COLORS.mist)).setOrigin(0.5).setLetterSpacing(6);
    this.chapterTitle = scene.add.text(CENTER, 112, '', displayStyle(36)).setOrigin(0.5).setLetterSpacing(4).setPadding(30, 16, 30, 16);
    this.chapterSubtitle = scene.add.text(CENTER, 156, '', bodyStyle(23, true, COLORS.mist)).setOrigin(0.5);
    this.previous = scene.add.text(CENTER - 500, 120, '‹', displayStyle(56, COLORS.gold)).setOrigin(0.5);
    this.next = scene.add.text(CENTER + 500, 120, '›', displayStyle(56, COLORS.violet)).setOrigin(0.5);
    const back = scene.add.text(CENTER - 560, 62, '‹  TITLE', displayStyle(14, COLORS.mist)).setOrigin(0, 0.5).setLetterSpacing(3);
    this.glow = scene.add.graphics();
    this.nodes = scene.add.graphics();
    this.numbers = Array.from({ length: LEVELS_PER_CHAPTER }, (_, index) => scene.add.text(nodeX(index), NODE_Y, '', displayStyle(20)).setOrigin(0.5));
    this.tags = Array.from({ length: LEVELS_PER_CHAPTER }, (_, index) => scene.add.text(nodeX(index), NODE_Y + 58, '', displayStyle(11, COLORS.gold)).setOrigin(0.5).setLetterSpacing(2));
    this.detailTitle = scene.add.text(CENTER, 418, '', displayStyle(25)).setOrigin(0.5).setLetterSpacing(2);
    this.detailLine = scene.add.text(CENTER, 458, '', bodyStyle(23, true, COLORS.mist)).setOrigin(0.5);
    this.detailNote = scene.add.text(CENTER, 504, '', bodyStyle(23, false, COLORS.gold)).setOrigin(0.5).setAlign('center').setWordWrapWidth(960);
    this.totals = scene.add.text(CENTER, 574, '', displayStyle(14, COLORS.mist)).setOrigin(0.5).setLetterSpacing(4);
    this.help = scene.add.text(CENTER, GAME_HEIGHT - 46, '', bodyStyle(19, false, COLORS.mist)).setOrigin(0.5);

    const items: Fadeable[] = [veil, label, this.chapterTitle, this.chapterSubtitle, this.previous, this.next, back, this.glow, this.nodes, ...this.numbers, ...this.tags, this.detailTitle, this.detailLine, this.detailNote, this.totals, this.help];
    this.group = new FadingGroup(items, 7, 7);

    for (let index = 0; index < LEVELS_PER_CHAPTER; index++) {
      const zone = scene.add.zone(nodeX(index), NODE_Y + 10, NODE_SPACING, 130).setInteractive();
      zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer: Phaser.Input.Pointer) => {
        const node = this.model?.nodes[index];
        if (pointer.wasTouch && node) callbacks.pickLevel(node.level);
      });
      this.zones.push(zone);
    }
    const arrow = (x: number, delta: number): void => {
      const zone = scene.add.zone(x, 120, 130, 130).setInteractive();
      zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer: Phaser.Input.Pointer) => {
        if (pointer.wasTouch) callbacks.changeChapter(delta);
      });
      this.zones.push(zone);
    };
    arrow(CENTER - 500, -1);
    arrow(CENTER + 500, 1);
    const backZone = scene.add.zone(CENTER - 500, 62, 180, 80).setInteractive();
    backZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) callbacks.back();
    });
    this.zones.push(backZone);
    this.setInteractive(false);
  }

  get opacity(): number {
    return this.group.opacity;
  }

  show(model: AtlasModel, help: string): void {
    this.group.show();
    this.setInteractive(true);
    this.render(model, help);
  }

  hide(): void {
    this.group.hide();
    this.setInteractive(false);
  }

  hideImmediately(): void {
    this.group.hideImmediately();
    this.setInteractive(false);
  }

  render(model: AtlasModel, help: string): void {
    this.model = model;
    this.help.setText(help);
    const { chapter } = model;
    this.chapterTitle.setText(`${chapter.numeral}  ·  ${chapter.title.toUpperCase()}`);
    applyRealityGradient(this.chapterTitle);
    this.chapterSubtitle.setText(chapter.subtitle);
    this.previous.setAlpha(model.hasPrevious ? 1 : 0.18);
    this.next.setAlpha(model.hasNext ? 1 : 0.18);

    const g = this.nodes;
    g.clear();
    g.lineStyle(2, 0xf1e6ff, 0.18);
    g.lineBetween(nodeX(0), NODE_Y, nodeX(LEVELS_PER_CHAPTER - 1), NODE_Y);
    model.nodes.forEach((node, index) => {
      const x = nodeX(index);
      const radius = node.finale ? FINALE_RADIUS : NODE_RADIUS;
      const locked = node.state === NodeState.Locked;
      const ring = index % 2 === 0 ? 0xf3cf7a : 0xc9a4ff;
      g.fillStyle(0x0d0a16, locked ? 0.7 : 0.92);
      g.fillCircle(x, NODE_Y, radius);
      if (node.state === NodeState.Completed) {
        g.fillStyle(ring, 0.22);
        g.fillCircle(x, NODE_Y, radius - 4);
      }
      g.lineStyle(node.finale ? 3 : 2, locked ? 0x5d5670 : ring, locked ? 0.7 : 0.95);
      g.strokeCircle(x, NODE_Y, radius);
      if (node.finale) {
        g.lineStyle(1.5, locked ? 0x5d5670 : 0xf6eeff, locked ? 0.5 : 0.7);
        g.strokeCircle(x, NODE_Y, radius + 7);
      }
      if (node.shard) {
        g.fillStyle(0xf6eeff, 1);
        diamond(g, x + radius * 0.72, NODE_Y - radius * 0.72, 6);
      }
      const number = this.numbers[index] as Phaser.GameObjects.Text;
      number.setText(locked ? '·' : String(node.level));
      number.setColor(locked ? '#5d5670' : node.state === NodeState.Completed ? '#fff3d6' : '#d9cfee');
      const tag = this.tags[index] as Phaser.GameObjects.Text;
      tag.setText(node.discovery ? (node.discovery.kind === DiscoveryKind.Ability ? 'NEW POWER' : 'NEW') : node.finale ? 'TRIAL' : '');
      tag.setColor(node.discovery ? (node.discovery.kind === DiscoveryKind.Ability ? '#f3cf7a' : '#c9a4ff') : '#a99fbf');
      tag.setAlpha(locked ? 0.45 : 1);
    });

    const selected = model.nodes.find((node) => node.level === model.selected);
    this.detailTitle.setText(`ECHO ${model.selected}  ·  ${model.selectedName.toUpperCase()}`);
    if (model.selectedState === NodeState.Locked) {
      this.detailLine.setText(`Sealed. Restore Echo ${model.selected - 1} to open this path.`);
    } else if (model.bestTime !== null) {
      this.detailLine.setText(`Best ${formatDuration(model.bestTime)}   ·   ${model.shardFound ? 'echo shard recovered' : 'an echo shard still hides here'}`);
    } else {
      this.detailLine.setText(selected?.finale ? 'A chapter trial. Three lost memories wait inside.' : 'Not yet walked.');
    }
    const discovery = selected?.discovery ?? null;
    if (discovery) {
      const kind = discovery.kind === DiscoveryKind.Ability ? 'New ability' : 'New phenomenon';
      this.detailNote.setText(model.selectedState === NodeState.Locked ? `${kind} awaits here.` : `${kind}  ·  ${discovery.title}`);
      this.detailNote.setColor(discovery.kind === DiscoveryKind.Ability ? COLORS.gold : COLORS.violet);
    } else {
      this.detailNote.setText('');
    }
    this.totals.setText(`ECHOES  ${model.completed} / 100     ·     SHARDS  ${model.shards}`);
  }

  update(dt: number): void {
    this.time += dt;
    this.group.update(dt);
    const model = this.model;
    this.glow.clear();
    if (!model || this.group.opacity <= 0) return;
    const index = model.nodes.findIndex((node) => node.level === model.selected);
    if (index < 0) return;
    const node = model.nodes[index];
    const x = nodeX(index);
    const radius = (node?.finale ? FINALE_RADIUS : NODE_RADIUS) + 6 + Math.sin(this.time * 4) * 2;
    this.glow.lineStyle(3, 0xfff3d6, 0.85);
    this.glow.strokeCircle(x, NODE_Y, radius);
    this.glow.fillStyle(0xf3cf7a, 1);
    diamond(this.glow, x - radius - 14, NODE_Y);
    this.glow.fillStyle(0xc9a4ff, 1);
    diamond(this.glow, x + radius + 14, NODE_Y);
  }

  private setInteractive(enabled: boolean): void {
    for (const zone of this.zones) {
      if (zone.input) zone.input.enabled = enabled;
    }
  }
}
