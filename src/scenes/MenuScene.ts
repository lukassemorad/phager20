import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    // Stub — will become the main menu in a future phase
    this.scene.start('GameScene');
  }
}
