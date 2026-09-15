import Phaser from "phaser";

/** Bouton d'action tactile rond (tir/tacle) affiché en superposition du terrain. */
export class ActionButton {
  private circle: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.Text;
  private pressed = false;
  private justPressed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, radius: number, text: string) {
    this.circle = scene.add.circle(x, y, radius, 0x22d3ee, 0.35).setDepth(90).setInteractive({ useHandCursor: false });
    this.label = scene.add
      .text(x, y, text, { fontSize: "20px", color: "#eaf2fb", fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(91);

    this.circle.on("pointerdown", () => {
      this.pressed = true;
      this.justPressed = true;
      this.circle.setFillStyle(0x22d3ee, 0.65);
    });
    const release = () => {
      this.pressed = false;
      this.circle.setFillStyle(0x22d3ee, 0.35);
    };
    this.circle.on("pointerup", release);
    this.circle.on("pointerout", release);
  }

  isPressed(): boolean {
    return this.pressed;
  }

  /** Vrai une seule fois, à l'instant où le bouton vient d'être pressé. */
  consumeJustPressed(): boolean {
    const v = this.justPressed;
    this.justPressed = false;
    return v;
  }
}
