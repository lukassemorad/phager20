import Phaser from 'phaser';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_PADDING,
  PLANET_COUNT,
  MIN_PLANET_RADIUS,
  MAX_PLANET_RADIUS,
  MIN_PLANET_DISTANCE,
  PLANET_EDGE_MARGIN,
  ZOOM_MAX,
  COLORS,
  STARTING_UNITS,
  UNIT_GEN_INTERVAL_MS,
  UNIT_GEN_BASE,
  MAX_UNITS,
  FLEET_SEND_RATIO,
  FLEET_MIN_UNITS,
  ENEMY_AI_INTERVAL_MS,
  ENEMY_AI_MIN_UNITS,
  TAP_MOVE_THRESHOLD,
} from '../config/GameConfig';
import { Planet, PlanetOwner } from '../objects/Planet';
import { Fleet } from '../objects/Fleet';

export class GameScene extends Phaser.Scene {
  private planets: Planet[] = [];
  private fleets: Fleet[] = [];
  private worldGraphics!: Phaser.GameObjects.Graphics;
  private aimLine!: Phaser.GameObjects.Graphics;
  private selectedPlanet: Planet | null = null;
  private gameOver = false;

  // Drag
  private isDragging = false;
  private prevDragX = 0;
  private prevDragY = 0;

  // Pinch
  private isPinching = false;
  private prevMidX = 0;
  private prevMidY = 0;
  private prevPinchDist = 1;

  // Tap detection: distinguishes quick tap from drag/pinch
  private tapDownX = 0;
  private tapDownY = 0;
  private tapMoved = false;
  private wasPinching = false;

  // Game timers
  private lastGenTime = 0;
  private lastEnemyTime = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Reset all mutable state so scene.restart() works cleanly
    this.planets = [];
    this.fleets = [];
    this.selectedPlanet = null;
    this.gameOver = false;
    this.isDragging = false;
    this.isPinching = false;
    this.tapMoved = false;
    this.wasPinching = false;
    this.prevDragX = 0;
    this.prevDragY = 0;
    this.lastGenTime = 0;
    this.lastEnemyTime = 0;

    this.drawWorld();
    this.generatePlanets();
    this.aimLine = this.add.graphics().setDepth(4);
    this.setupCamera();
    this.setupInput();
  }

  update(time: number, delta: number): void {
    if (this.isPinching) this.tickPinch();
    if (this.gameOver) return;

    if (time - this.lastGenTime >= UNIT_GEN_INTERVAL_MS) {
      this.lastGenTime = time;
      this.tickUnitGen();
    }

    this.fleets = this.fleets.filter(fleet => {
      const arrived = fleet.tick(delta);
      if (arrived) this.resolveArrival(fleet, fleet.targetPlanet);
      return !arrived;
    });

    if (time - this.lastEnemyTime >= ENEMY_AI_INTERVAL_MS) {
      this.lastEnemyTime = time;
      this.tickEnemyAI();
    }

    this.drawAimLine();
    this.checkWinLoss();
  }

  // ─── World ───────────────────────────────────────────────────────────────

  private drawWorld(): void {
    this.worldGraphics = this.add.graphics().setDepth(0);

    this.worldGraphics.fillStyle(COLORS.worldBg, 1);
    this.worldGraphics.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.worldGraphics.lineStyle(2, COLORS.worldBorder, 0.8);
    this.worldGraphics.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const rng = new Phaser.Math.RandomDataGenerator(['phager-stars']);
    this.worldGraphics.fillStyle(0xffffff, 0.4);
    for (let i = 0; i < 220; i++) {
      const sx = rng.between(0, WORLD_WIDTH);
      const sy = rng.between(0, WORLD_HEIGHT);
      this.worldGraphics.fillCircle(sx, sy, rng.realInRange(0.5, 1.5));
    }
  }

  // ─── Planets ─────────────────────────────────────────────────────────────

  private generatePlanets(): void {
    const placed: { x: number; y: number; r: number }[] = [];

    for (let i = 0; i < PLANET_COUNT; i++) {
      let ok = false;
      for (let attempt = 0; attempt < 500; attempt++) {
        const r = Phaser.Math.Between(MIN_PLANET_RADIUS, MAX_PLANET_RADIUS);
        const x = Phaser.Math.Between(PLANET_EDGE_MARGIN + r, WORLD_WIDTH - PLANET_EDGE_MARGIN - r);
        const y = Phaser.Math.Between(PLANET_EDGE_MARGIN + r, WORLD_HEIGHT - PLANET_EDGE_MARGIN - r);

        const tooClose = placed.some(p =>
          Phaser.Math.Distance.Between(x, y, p.x, p.y) < MIN_PLANET_DISTANCE + r + p.r,
        );
        if (!tooClose) {
          placed.push({ x, y, r });
          ok = true;
          break;
        }
      }
      if (!ok) console.warn(`Could not place planet ${i}`);
    }

    placed.forEach(({ x, y, r }, index) => {
      let owner: PlanetOwner;
      let units: number;
      if (index === 0) {
        owner = 'player';
        units = STARTING_UNITS.player;
      } else if (index === 1) {
        owner = 'enemy';
        units = STARTING_UNITS.enemy;
      } else {
        owner = 'neutral';
        units = Phaser.Math.Between(STARTING_UNITS.neutralMin, STARTING_UNITS.neutralMax);
      }
      this.planets.push(new Planet(this, x, y, r, owner, units));
    });
  }

  // ─── Camera ──────────────────────────────────────────────────────────────

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setZoom(this.calcMinZoom(cam.width, cam.height));
    cam.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      const newMin = this.calcMinZoom(gameSize.width, gameSize.height);
      if (cam.zoom < newMin) cam.setZoom(newMin);
      this.clampScroll();
    });
  }

  // Centres the world when the viewport is larger; clamps scroll otherwise.
  // In Phaser 3.60+, cam.scrollX = worldX_at_screenCenter - cam.width/2, so all
  // bounds are offset by ±cam.width/2 compared to the old "top-left" convention.
  private clampScroll(): void {
    const cam = this.cameras.main;
    const vw = cam.width / cam.zoom;
    const vh = cam.height / cam.zoom;
    const bx = -WORLD_PADDING;
    const by = -WORLD_PADDING;
    const bw = WORLD_WIDTH + 2 * WORLD_PADDING;
    const bh = WORLD_HEIGHT + 2 * WORLD_PADDING;
    const hw = cam.width / 2;
    const hh = cam.height / 2;

    cam.scrollX = vw >= bw
      ? bx + bw / 2 - hw
      : Phaser.Math.Clamp(cam.scrollX, bx + vw / 2 - hw, bx + bw - vw / 2 - hw);
    cam.scrollY = vh >= bh
      ? by + bh / 2 - hh
      : Phaser.Math.Clamp(cam.scrollY, by + vh / 2 - hh, by + bh - vh / 2 - hh);
  }

  private calcMinZoom(w: number, h: number): number {
    return Math.min(
      w / (WORLD_WIDTH + WORLD_PADDING * 2),
      h / (WORLD_HEIGHT + WORLD_PADDING * 2),
    );
  }

  private clampZoom(z: number): number {
    const cam = this.cameras.main;
    return Phaser.Math.Clamp(z, this.calcMinZoom(cam.width, cam.height), ZOOM_MAX);
  }

  // ─── Input ───────────────────────────────────────────────────────────────

  private setupInput(): void {
    const cam = this.cameras.main;

    // Scroll wheel: zoom toward cursor
    this.input.on(
      'wheel',
      (ptr: Phaser.Input.Pointer, _: Phaser.GameObjects.GameObject[], __: number, dy: number) => {
        const wp = cam.getWorldPoint(ptr.x, ptr.y);
        const newZoom = this.clampZoom(cam.zoom * Math.pow(0.999, dy));
        cam.setZoom(newZoom);
        // scrollX = worldX_at_screenCenter − cam.width/2, so to keep wp.x under ptr.x:
        cam.scrollX = wp.x - cam.width / 2 - (ptr.x - cam.width / 2) / newZoom;
        cam.scrollY = wp.y - cam.height / 2 - (ptr.y - cam.height / 2) / newZoom;
        this.clampScroll();
      },
    );

    // Pointer down: start drag or switch to pinch
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (ptr: Phaser.Input.Pointer) => {
      if (this.input.pointer1.isDown && this.input.pointer2?.isDown) {
        this.isDragging = false;
        this.startPinch();
        return;
      }
      if (this.isPinching) return;

      this.tapDownX = ptr.x;
      this.tapDownY = ptr.y;
      this.tapMoved = false;
      this.wasPinching = false;
      this.prevDragX = ptr.x;
      this.prevDragY = ptr.y;
      this.isDragging = true;
    });

    // Pointer move: delta-based pan + tap-move detection
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (ptr: Phaser.Input.Pointer) => {
      if (
        Phaser.Math.Distance.Between(ptr.x, ptr.y, this.tapDownX, this.tapDownY) >
        TAP_MOVE_THRESHOLD
      ) {
        this.tapMoved = true;
      }
      if (this.isPinching || !this.isDragging || !ptr.isDown) return;
      cam.scrollX -= (ptr.x - this.prevDragX) / cam.zoom;
      cam.scrollY -= (ptr.y - this.prevDragY) / cam.zoom;
      this.clampScroll();
      this.prevDragX = ptr.x;
      this.prevDragY = ptr.y;
    });

    // Pointer up: stop gestures; fire tap if pointer barely moved
    this.input.on(Phaser.Input.Events.POINTER_UP, (ptr: Phaser.Input.Pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;

      if (!p1.isDown && !p2?.isDown) {
        if (!this.tapMoved && !this.wasPinching) {
          this.handleTap(ptr.x, ptr.y);
        }
        this.isDragging = false;
        this.isPinching = false;
        this.wasPinching = false;
        return;
      }

      // One finger still down after pinch: continue as drag
      if (this.isPinching) {
        this.isPinching = false;
        const active = p1.isDown ? p1 : p2;
        this.prevDragX = active.x;
        this.prevDragY = active.y;
        this.isDragging = true;
      }
    });
  }

  // ─── Pinch ───────────────────────────────────────────────────────────────

  private startPinch(): void {
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    this.isPinching = true;
    this.wasPinching = true; // prevents tap from firing on finger-lift
    this.tapMoved = true;
    this.prevMidX = (p1.x + p2.x) / 2;
    this.prevMidY = (p1.y + p2.y) / 2;
    this.prevPinchDist = Math.max(1, Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y));
  }

  private tickPinch(): void {
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;

    if (!p1.isDown || !p2.isDown) {
      this.isPinching = false;
      const active = p1.isDown ? p1 : p2;
      if (active.isDown) {
        this.prevDragX = active.x;
        this.prevDragY = active.y;
        this.isDragging = true;
      }
      return;
    }

    const cam = this.cameras.main;
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const dist = Math.max(1, Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y));

    // Zoom toward previous midpoint, then pan by midpoint delta
    const wp = cam.getWorldPoint(this.prevMidX, this.prevMidY);
    const newZoom = this.clampZoom(cam.zoom * (dist / this.prevPinchDist));
    cam.setZoom(newZoom);
    cam.scrollX = wp.x - cam.width / 2 - (midX - cam.width / 2) / newZoom;
    cam.scrollY = wp.y - cam.height / 2 - (midY - cam.height / 2) / newZoom;
    this.clampScroll();

    this.prevMidX = midX;
    this.prevMidY = midY;
    this.prevPinchDist = dist;
  }

  // ─── Selection & Fleets ──────────────────────────────────────────────────

  private handleTap(screenX: number, screenY: number): void {
    if (this.gameOver) return;

    const wp = this.cameras.main.getWorldPoint(screenX, screenY);
    const hit = this.planets.find(p => p.isPointInside(wp.x, wp.y));

    if (!hit) {
      this.deselect();
      return;
    }

    if (!this.selectedPlanet) {
      if (hit.owner === 'player') {
        hit.setSelected(true);
        this.selectedPlanet = hit;
      }
      return;
    }

    if (hit === this.selectedPlanet) {
      this.deselect();
      return;
    }

    this.sendFleet(this.selectedPlanet, hit);
    this.deselect();
  }

  private deselect(): void {
    this.selectedPlanet?.setSelected(false);
    this.selectedPlanet = null;
  }

  private sendFleet(from: Planet, to: Planet): void {
    if (from.unitCount <= FLEET_MIN_UNITS) return;
    const units = Math.max(FLEET_MIN_UNITS, Math.floor(from.unitCount * FLEET_SEND_RATIO));
    from.setUnitCount(from.unitCount - units);
    this.fleets.push(new Fleet(this, from, to, units));
  }

  private resolveArrival(fleet: Fleet, target: Planet): void {
    if (fleet.owner === target.owner) {
      target.setUnitCount(Math.min(target.unitCount + fleet.unitCount, MAX_UNITS));
    } else if (fleet.unitCount > target.unitCount) {
      if (this.selectedPlanet === target) this.deselect();
      target.setOwner(fleet.owner);
      target.setUnitCount(fleet.unitCount - target.unitCount);
    } else {
      target.setUnitCount(target.unitCount - fleet.unitCount);
    }
  }

  // ─── Unit Generation ─────────────────────────────────────────────────────

  private tickUnitGen(): void {
    for (const planet of this.planets) {
      if (planet.owner === 'neutral') continue;
      planet.setUnitCount(Math.min(planet.unitCount + UNIT_GEN_BASE, MAX_UNITS));
    }
  }

  // ─── Enemy AI ────────────────────────────────────────────────────────────

  private tickEnemyAI(): void {
    const candidates = this.planets.filter(
      p => p.owner === 'enemy' && p.unitCount >= ENEMY_AI_MIN_UNITS,
    );
    if (candidates.length === 0) return;

    const attacker = candidates.reduce((a, b) => (a.unitCount >= b.unitCount ? a : b));

    const targets = this.planets.filter(p => p.owner !== 'enemy');
    if (targets.length === 0) return;

    const target = targets.reduce((a, b) =>
      Phaser.Math.Distance.Between(attacker.x, attacker.y, a.x, a.y) <=
      Phaser.Math.Distance.Between(attacker.x, attacker.y, b.x, b.y)
        ? a
        : b,
    );

    this.sendFleet(attacker, target);
  }

  // ─── Aim Line ────────────────────────────────────────────────────────────

  private drawAimLine(): void {
    this.aimLine.clear();
    if (!this.selectedPlanet) return;

    const ptr = this.input.activePointer;
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    this.aimLine.lineStyle(1.5, COLORS.player, 0.55);
    this.aimLine.beginPath();
    this.aimLine.moveTo(this.selectedPlanet.x, this.selectedPlanet.y);
    this.aimLine.lineTo(wp.x, wp.y);
    this.aimLine.strokePath();
  }

  // ─── Win / Loss ───────────────────────────────────────────────────────────

  private checkWinLoss(): void {
    if (this.gameOver) return;

    const hasPlayer = this.planets.some(p => p.owner === 'player');
    const hasEnemy = this.planets.some(p => p.owner === 'enemy');
    const fleetPlayer = this.fleets.some(f => f.owner === 'player');
    const fleetEnemy = this.fleets.some(f => f.owner === 'enemy');

    if (!hasPlayer && !fleetPlayer) {
      this.showResult('defeat');
    } else if (!hasEnemy && !fleetEnemy) {
      this.showResult('victory');
    }
  }

  private showResult(outcome: 'victory' | 'defeat'): void {
    this.gameOver = true;
    this.deselect();

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add
      .graphics()
      .fillStyle(0x000000, 0.65)
      .fillRect(0, 0, this.scale.width, this.scale.height)
      .setScrollFactor(0)
      .setDepth(99);

    const titleColor = outcome === 'victory' ? '#00ffcc' : '#ff4444';
    this.add
      .text(cx, cy - 36, outcome === 'victory' ? 'VICTORY' : 'DEFEAT', {
        fontSize: '56px',
        color: titleColor,
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(cx, cy + 28, 'Tap to play again', {
        fontSize: '20px',
        color: '#aaaaaa',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(100);

    this.input.once(Phaser.Input.Events.POINTER_UP, () => {
      this.scene.restart();
    });
  }
}
