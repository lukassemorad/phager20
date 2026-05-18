import Phaser from 'phaser';
import { COLORS } from '../config/GameConfig';

export type PlanetOwner = 'player' | 'enemy' | 'neutral';

export class Planet {
  private graphics: Phaser.GameObjects.Graphics;
  private selectionRing: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;

  readonly x: number;
  readonly y: number;
  readonly radius: number;
  owner: PlanetOwner;
  unitCount: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    radius: number,
    owner: PlanetOwner,
    unitCount: number,
  ) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.owner = owner;
    this.unitCount = unitCount;

    this.graphics = scene.add.graphics().setDepth(1);
    this.draw();

    this.selectionRing = scene.add.graphics().setDepth(2);
    this.drawSelectionRing();
    this.selectionRing.setVisible(false);

    this.label = scene.add
      .text(x, y, String(unitCount), {
        fontSize: `${Math.round(radius * 0.6)}px`,
        color: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(3);
  }

  private draw(): void {
    const color = COLORS[this.owner];
    this.graphics.clear();

    this.graphics.lineStyle(2, color, 0.3);
    this.graphics.strokeCircle(this.x, this.y, this.radius + 6);

    this.graphics.fillStyle(color, 1);
    this.graphics.fillCircle(this.x, this.y, this.radius);

    this.graphics.fillStyle(0xffffff, 0.08);
    this.graphics.fillCircle(
      this.x - this.radius * 0.25,
      this.y - this.radius * 0.25,
      this.radius * 0.45,
    );
  }

  private drawSelectionRing(): void {
    this.selectionRing.clear();
    this.selectionRing.lineStyle(2.5, 0xffffff, 0.9);
    this.selectionRing.strokeCircle(this.x, this.y, this.radius + 11);
  }

  setUnitCount(count: number): void {
    this.unitCount = count;
    this.label.setText(String(count));
  }

  setOwner(owner: PlanetOwner): void {
    this.owner = owner;
    this.draw();
  }

  setSelected(selected: boolean): void {
    this.selectionRing.setVisible(selected);
  }

  isPointInside(wx: number, wy: number): boolean {
    return Phaser.Math.Distance.Between(wx, wy, this.x, this.y) <= this.radius + 4;
  }

  destroy(): void {
    this.graphics.destroy();
    this.selectionRing.destroy();
    this.label.destroy();
  }
}
