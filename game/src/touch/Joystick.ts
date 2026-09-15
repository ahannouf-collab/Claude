import Phaser from "phaser";

/** Joystick virtuel tactile : apparaît où le doigt touche la zone gauche de l'écran. */
export class Joystick {
  private scene: Phaser.Scene;
  private zone: Phaser.GameObjects.Zone;
  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private pointerId: number | null = null;
  private origin = { x: 0, y: 0 };
  private vector = { x: 0, y: 0 };
  private readonly radius = 55;

  constructor(scene: Phaser.Scene, zoneX: number, zoneY: number, zoneW: number, zoneH: number) {
    this.scene = scene;
    this.zone = scene.add.zone(zoneX, zoneY, zoneW, zoneH).setOrigin(0, 0).setInteractive();
    this.base = scene.add.circle(0, 0, this.radius, 0xffffff, 0.12).setVisible(false).setDepth(90);
    this.thumb = scene.add.circle(0, 0, 26, 0xffffff, 0.35).setVisible(false).setDepth(91);

    this.zone.on("pointerdown", (p: Phaser.Input.Pointer) => this.start(p));
    scene.input.on("pointermove", (p: Phaser.Input.Pointer) => this.move(p));
    scene.input.on("pointerup", (p: Phaser.Input.Pointer) => this.end(p));
    scene.input.on("pointerupoutside", (p: Phaser.Input.Pointer) => this.end(p));
  }

  private start(p: Phaser.Input.Pointer): void {
    if (this.pointerId !== null) return;
    this.pointerId = p.id;
    this.origin = { x: p.x, y: p.y };
    this.base.setPosition(p.x, p.y).setVisible(true);
    this.thumb.setPosition(p.x, p.y).setVisible(true);
  }

  private move(p: Phaser.Input.Pointer): void {
    if (this.pointerId !== p.id) return;
    const dx = p.x - this.origin.x;
    const dy = p.y - this.origin.y;
    const dist = Math.min(this.radius, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    this.thumb.setPosition(this.origin.x + tx, this.origin.y + ty);
    this.vector = { x: tx / this.radius, y: ty / this.radius };
  }

  private end(p: Phaser.Input.Pointer): void {
    if (this.pointerId !== p.id) return;
    this.pointerId = null;
    this.vector = { x: 0, y: 0 };
    this.base.setVisible(false);
    this.thumb.setVisible(false);
  }

  getVector(): { x: number; y: number } {
    return this.vector;
  }

  isActive(): boolean {
    return this.pointerId !== null;
  }
}
