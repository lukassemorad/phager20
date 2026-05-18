import Phaser from 'phaser';
import { COLORS, FLEET_SPEED, FLEET_RADIUS } from '../config/GameConfig';
import type { Planet, PlanetOwner } from './Planet';

export class Fleet {
  readonly owner: PlanetOwner;
  readonly targetPlanet: Planet;
  readonly unitCount: number;

  private progress = 0;
  private readonly fromX: number;
  private readonly fromY: number;
  private readonly toX: number;
  private readonly toY: number;
  private readonly totalDist: number;
  private graphics: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    fromPlanet: Planet,
    toPlanet: Planet,
    unitCount: number,
  ) {
    this.owner = fromPlanet.owner;
    this.targetPlanet = toPlanet;
    this.unitCount = unitCount;

    this.fromX = fromPlanet.x;
    this.fromY = fromPlanet.y;
    this.toX = toPlanet.x;
    this.toY = toPlanet.y;
    this.totalDist = Math.max(
      1,
      Phaser.Math.Distance.Between(this.fromX, this.fromY, this.toX, this.toY),
    );

    this.graphics = scene.add.graphics().setDepth(5);
    this.label = scene.add
      .text(this.fromX, this.fromY, String(unitCount), {
        fontSize: '12px',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(6);

    this.renderAt(this.fromX, this.fromY);
  }

  tick(delta: number): boolean {
    this.progress += (FLEET_SPEED * delta) / (1000 * this.totalDist);
    if (this.progress >= 1) {
      this.cleanup();
      return true;
    }
    const t = this.progress;
    this.renderAt(
      this.fromX + (this.toX - this.fromX) * t,
      this.fromY + (this.toY - this.fromY) * t,
    );
    return false;
  }

  private renderAt(x: number, y: number): void {
    this.graphics.clear();
    this.graphics.fillStyle(COLORS[this.owner], 1);
    this.graphics.fillCircle(x, y, FLEET_RADIUS);
    this.label.setPosition(x, y);
  }

  cleanup(): void {
    this.graphics.destroy();
    this.label.destroy();
  }
}
