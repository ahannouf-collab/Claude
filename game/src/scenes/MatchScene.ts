import Phaser from "phaser";
import { Joystick } from "../touch/Joystick";
import { ActionButton } from "../touch/ActionButton";
import { FORMATION_LAYOUT, type SlotLayout } from "../data/formationLayout";
import { generatePlayer, overallOf, rarityFor, makeRng, type Player, type Position } from "../data/players";
import type { GameState } from "../state";

const GAME_W = 960;
const GAME_H = 540;
const PITCH = { left: 46, right: 914, top: 34, bottom: 506 };
const GOAL_TOP = 210;
const GOAL_BOTTOM = 330;
const PLAYER_RADIUS = 13;
const BALL_RADIUS = 8;
const KICK_RANGE = 30;
const MATCH_SECONDS = 120;

interface Actor {
  obj: Phaser.GameObjects.Arc;
  body: Phaser.Physics.Arcade.Body;
  team: "user" | "cpu";
  role: Position;
  player: Player;
  slot: SlotLayout;
  isControlled: boolean;
  label?: Phaser.GameObjects.Text;
}

export interface MatchSceneData {
  state: GameState;
  onFinish: (scoreUser: number, scoreOpp: number) => void;
}

export class MatchScene extends Phaser.Scene {
  private matchData!: MatchSceneData;
  private actors: Actor[] = [];
  private ball!: Phaser.GameObjects.Arc;
  private ballBody!: Phaser.Physics.Arcade.Body;
  private joystick!: Joystick;
  private kickBtn!: ActionButton;
  private scoreUser = 0;
  private scoreOpp = 0;
  private timeLeft = MATCH_SECONDS;
  private scoreText!: Phaser.GameObjects.Text;
  private clockText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private frozen = false;
  private finished = false;
  private timerEvent!: Phaser.Time.TimerEvent;

  constructor() {
    super("MatchScene");
  }

  init(data: MatchSceneData): void {
    this.matchData = data;
    this.actors = [];
    this.scoreUser = 0;
    this.scoreOpp = 0;
    this.timeLeft = MATCH_SECONDS;
    this.frozen = false;
    this.finished = false;
  }

  create(): void {
    this.drawPitch();
    this.spawnTeams();
    this.spawnBall();
    this.setupHud();
    this.setupControls();
    this.physics.add.collider(this.ball, this.actors.map((a) => a.obj), undefined, undefined, this);

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.tickClock(),
    });

    this.kickoff(true);
  }

  private drawPitch(): void {
    const g = this.add.graphics();
    g.fillStyle(0x0a5c33, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);
    // bandes de tonte
    g.fillStyle(0x0c6a3b, 1);
    const stripeW = (PITCH.right - PITCH.left) / 8;
    for (let i = 0; i < 8; i += 2) {
      g.fillRect(PITCH.left + i * stripeW, PITCH.top, stripeW, PITCH.bottom - PITCH.top);
    }
    g.lineStyle(3, 0xffffff, 0.85);
    g.strokeRect(PITCH.left, PITCH.top, PITCH.right - PITCH.left, PITCH.bottom - PITCH.top);
    g.lineBetween((PITCH.left + PITCH.right) / 2, PITCH.top, (PITCH.left + PITCH.right) / 2, PITCH.bottom);
    g.strokeCircle((PITCH.left + PITCH.right) / 2, (PITCH.top + PITCH.bottom) / 2, 60);
    // surfaces de but
    g.strokeRect(PITCH.left, GOAL_TOP - 40, 90, GOAL_BOTTOM - GOAL_TOP + 80);
    g.strokeRect(PITCH.right - 90, GOAL_TOP - 40, 90, GOAL_BOTTOM - GOAL_TOP + 80);
    // buts (filets)
    g.fillStyle(0xdddddd, 0.5);
    g.fillRect(PITCH.left - 14, GOAL_TOP, 14, GOAL_BOTTOM - GOAL_TOP);
    g.fillRect(PITCH.right, GOAL_TOP, 14, GOAL_BOTTOM - GOAL_TOP);
    g.lineStyle(3, 0xffffff, 1);
    g.strokeRect(PITCH.left - 14, GOAL_TOP, 14, GOAL_BOTTOM - GOAL_TOP);
    g.strokeRect(PITCH.right, GOAL_TOP, 14, GOAL_BOTTOM - GOAL_TOP);
  }

  private slotToXY(slot: SlotLayout, mirrored: boolean): { x: number; y: number } {
    const frac = mirrored ? 1 - slot.x : slot.x;
    const x = PITCH.left + frac * (PITCH.right - PITCH.left);
    const y = PITCH.top + slot.y * (PITCH.bottom - PITCH.top);
    return { x, y };
  }

  private spawnTeams(): void {
    const { state } = this.matchData;
    const formation = state.club.formation;
    const slots = FORMATION_LAYOUT[formation];

    const userSquad = resolveMatchXI(state.squad, state.club.startingXI, slots);
    const controlledId = pickControlledPlayer(userSquad);

    userSquad.forEach(({ slot, player }) => {
      const { x, y } = this.slotToXY(slot, false);
      this.createActor(x, y, "user", slot, player, player.id === controlledId, state.club.primaryColor);
    });

    const oppRng = makeRng(hashString(state.fixtures[state.nextMatchday]?.opponent ?? "cpu") + state.season * 7);
    const oppStrength = state.fixtures[state.nextMatchday]?.opponentStrength ?? 65;
    const cpuLayout = FORMATION_LAYOUT["4-4-2"];
    const cpuSquad = cpuLayout.map((slot) => ({ slot, player: generatePlayer(slot.role, oppRng, rarityFor(oppStrength + Math.round((oppRng() - 0.5) * 12))) }));
    cpuSquad.forEach(({ slot, player }) => {
      const { x, y } = this.slotToXY(slot, true);
      this.createActor(x, y, "cpu", slot, player, false, "#c02929");
    });
  }

  private createActor(
    x: number,
    y: number,
    team: "user" | "cpu",
    slot: SlotLayout,
    player: Player,
    isControlled: boolean,
    colorHex: string
  ): void {
    const color = Phaser.Display.Color.HexStringToColor(colorHex).color;
    const obj = this.add.circle(x, y, PLAYER_RADIUS, color);
    if (isControlled) {
      obj.setStrokeStyle(3, 0xffff00);
    } else if (slot.role === "GK") {
      obj.setStrokeStyle(2, 0x111111);
    }
    this.physics.add.existing(obj);
    const body = obj.body as Phaser.Physics.Arcade.Body;
    body.setCircle(PLAYER_RADIUS);
    body.setCollideWorldBounds(true);
    body.setBounce(0.2);
    body.setDamping(true);
    body.setDrag(0.85, 0.85);
    this.actors.push({ obj, body, team, role: slot.role, player, slot, isControlled });
  }

  private spawnBall(): void {
    this.ball = this.add.circle(GAME_W / 2, GAME_H / 2, BALL_RADIUS, 0xffffff);
    this.ball.setStrokeStyle(1, 0x222222);
    this.physics.add.existing(this.ball);
    this.ballBody = this.ball.body as Phaser.Physics.Arcade.Body;
    this.ballBody.setCircle(BALL_RADIUS);
    this.ballBody.setCollideWorldBounds(true, 0.6, 0.6);
    this.ballBody.setBounce(0.6);
    this.ballBody.setDamping(true);
    this.ballBody.setDrag(0.985, 0.985);
    this.ballBody.setMaxVelocity(560);
  }

  private setupHud(): void {
    const { state } = this.matchData;
    const oppName = state.fixtures[state.nextMatchday]?.opponent ?? "Adversaire";
    this.scoreText = this.add
      .text(GAME_W / 2, 14, `${truncate(state.club.name, 14)} 0 - 0 ${truncate(oppName, 14)}`, {
        fontSize: "18px",
        color: "#eaf2fb",
        fontStyle: "bold",
        backgroundColor: "#0009",
        padding: { left: 10, right: 10, top: 4, bottom: 4 },
      })
      .setOrigin(0.5, 0)
      .setDepth(100);
    this.clockText = this.add
      .text(GAME_W - 14, 14, "2:00", { fontSize: "16px", color: "#eaf2fb", backgroundColor: "#0009", padding: { left: 8, right: 8, top: 4, bottom: 4 } })
      .setOrigin(1, 0)
      .setDepth(100);
    this.banner = this.add
      .text(GAME_W / 2, GAME_H / 2 - 40, "", { fontSize: "40px", color: "#fbbf24", fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(110);

    const exitBtn = this.add
      .text(14, 14, "✕ Quitter", { fontSize: "13px", color: "#eaf2fb", backgroundColor: "#0009", padding: { left: 8, right: 8, top: 6, bottom: 6 } })
      .setOrigin(0, 0)
      .setDepth(100)
      .setInteractive({ useHandCursor: false });
    exitBtn.on("pointerdown", () => this.endMatch(true));
  }

  private setupControls(): void {
    this.joystick = new Joystick(this, 0, 0, GAME_W * 0.45, GAME_H);
    this.kickBtn = new ActionButton(this, GAME_W - 90, GAME_H - 90, 44, "TIR");
  }

  private kickoff(userTouch: boolean): void {
    this.frozen = true;
    for (const a of this.actors) {
      const { x, y } = this.slotToXY(a.slot, a.team === "cpu");
      a.obj.setPosition(x, y);
      a.body.setVelocity(0, 0);
    }
    this.ball.setPosition(GAME_W / 2, GAME_H / 2);
    this.ballBody.setVelocity(0, 0);
    this.time.delayedCall(500, () => {
      this.frozen = false;
    });
  }

  private tickClock(): void {
    if (this.finished) return;
    this.timeLeft -= 1;
    const m = Math.floor(this.timeLeft / 60);
    const s = this.timeLeft % 60;
    this.clockText.setText(`${m}:${s.toString().padStart(2, "0")}`);
    if (this.timeLeft <= 0) {
      this.endMatch(false);
    }
  }

  update(_time: number, deltaMs: number): void {
    if (this.finished) return;
    const dt = deltaMs / 1000;
    if (!this.frozen) {
      this.updateControlled();
      this.updateAI(dt);
      this.checkGoal();
    }
  }

  private updateControlled(): void {
    const controlled = this.actors.find((a) => a.isControlled);
    if (!controlled) return;
    const v = this.joystick.getVector();
    const speed = 150 + (controlled.player.base.pace - 50) * 1.4;
    controlled.body.setVelocity(v.x * speed, v.y * speed);

    const dist = Phaser.Math.Distance.Between(controlled.obj.x, controlled.obj.y, this.ball.x, this.ball.y);
    if (this.kickBtn.consumeJustPressed()) {
      if (dist <= KICK_RANGE + PLAYER_RADIUS) {
        this.kickBall(controlled, true, v);
      } else {
        // p'tit sprint vers le ballon si hors de portée
        const angle = Phaser.Math.Angle.Between(controlled.obj.x, controlled.obj.y, this.ball.x, this.ball.y);
        controlled.body.setVelocity(Math.cos(angle) * speed * 1.6, Math.sin(angle) * speed * 1.6);
      }
    }
  }

  private updateAI(dt: number): void {
    for (const team of ["user", "cpu"] as const) {
      const mine = this.actors.filter((a) => a.team === team && !a.isControlled);
      if (mine.length === 0) continue;
      let chaser = mine[0];
      let bestDist = Infinity;
      for (const a of mine) {
        if (a.role === "GK") continue;
        const d = Phaser.Math.Distance.Between(a.obj.x, a.obj.y, this.ball.x, this.ball.y);
        if (d < bestDist) {
          bestDist = d;
          chaser = a;
        }
      }
      for (const a of mine) {
        const speed = 120 + (a.player.base.pace - 50) * 1.1;
        if (a.role === "GK") {
          const homeY = this.slotToXY(a.slot, a.team === "cpu").y;
          const targetY = Phaser.Math.Clamp(this.ball.y, GOAL_TOP + 10, GOAL_BOTTOM - 10) * 0.6 + homeY * 0.4;
          const homeX = this.slotToXY(a.slot, a.team === "cpu").x;
          const angle = Phaser.Math.Angle.Between(a.obj.x, a.obj.y, homeX, targetY);
          const d = Phaser.Math.Distance.Between(a.obj.x, a.obj.y, homeX, targetY);
          if (d > 3) a.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
          else a.body.setVelocity(0, 0);
          continue;
        }
        if (a === chaser && bestDist < 260) {
          const angle = Phaser.Math.Angle.Between(a.obj.x, a.obj.y, this.ball.x, this.ball.y);
          a.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
          const d = Phaser.Math.Distance.Between(a.obj.x, a.obj.y, this.ball.x, this.ball.y);
          if (d <= KICK_RANGE + PLAYER_RADIUS && Math.random() < 0.05) {
            this.kickBall(a, false, { x: 0, y: 0 });
          }
        } else {
          const home = this.slotToXY(a.slot, a.team === "cpu");
          const targetY = home.y * 0.75 + this.ball.y * 0.25;
          const angle = Phaser.Math.Angle.Between(a.obj.x, a.obj.y, home.x, targetY);
          const d = Phaser.Math.Distance.Between(a.obj.x, a.obj.y, home.x, targetY);
          if (d > 8) a.body.setVelocity(Math.cos(angle) * speed * 0.7, Math.sin(angle) * speed * 0.7);
          else a.body.setVelocity(0, 0);
        }
      }
    }
  }

  private kickBall(actor: Actor, isUserAction: boolean, aim: { x: number; y: number }): void {
    const attackRight = actor.team === "user";
    const goalX = attackRight ? PITCH.right : PITCH.left;
    const goalY = GAME_H / 2 + (isUserAction ? aim.y * 90 : (Math.random() - 0.5) * 100);
    const angle = Phaser.Math.Angle.Between(this.ball.x, this.ball.y, goalX, goalY);
    const accuracy = Phaser.Math.Clamp(actor.player.base.shooting / 99, 0.35, 1);
    const spread = (1 - accuracy) * 0.5 * (Math.random() - 0.5);
    const power = 380 + actor.player.base.shooting * 1.6;
    this.ballBody.setVelocity(Math.cos(angle + spread) * power, Math.sin(angle + spread) * power);
  }

  private checkGoal(): void {
    if (this.frozen) return;
    const y = this.ball.y;
    if (this.ball.x <= PITCH.left - BALL_RADIUS + 2) {
      if (y > GOAL_TOP && y < GOAL_BOTTOM) {
        this.onGoal("cpu");
      } else {
        this.ball.x = PITCH.left + 4;
        this.ballBody.setVelocity(-this.ballBody.velocity.x * 0.2, this.ballBody.velocity.y);
      }
    } else if (this.ball.x >= PITCH.right + BALL_RADIUS - 2) {
      if (y > GOAL_TOP && y < GOAL_BOTTOM) {
        this.onGoal("user");
      } else {
        this.ball.x = PITCH.right - 4;
        this.ballBody.setVelocity(-this.ballBody.velocity.x * 0.2, this.ballBody.velocity.y);
      }
    }
    if (this.ball.y <= PITCH.top + BALL_RADIUS) {
      this.ball.y = PITCH.top + BALL_RADIUS;
      this.ballBody.setVelocity(this.ballBody.velocity.x, Math.abs(this.ballBody.velocity.y) * 0.3);
    } else if (this.ball.y >= PITCH.bottom - BALL_RADIUS) {
      this.ball.y = PITCH.bottom - BALL_RADIUS;
      this.ballBody.setVelocity(this.ballBody.velocity.x, -Math.abs(this.ballBody.velocity.y) * 0.3);
    }
  }

  private onGoal(scorer: "user" | "cpu"): void {
    if (scorer === "user") this.scoreUser += 1;
    else this.scoreOpp += 1;
    const { state } = this.matchData;
    const oppName = state.fixtures[state.nextMatchday]?.opponent ?? "Adversaire";
    this.scoreText.setText(`${truncate(state.club.name, 14)} ${this.scoreUser} - ${this.scoreOpp} ${truncate(oppName, 14)}`);
    this.banner.setText("⚽ BUT !");
    this.time.delayedCall(1200, () => this.banner.setText(""));
    this.kickoff(scorer !== "user");
  }

  private endMatch(forfeited: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.timerEvent?.remove();
    const finalUser = forfeited ? Math.min(this.scoreUser, this.scoreOpp) : this.scoreUser;
    const finalOpp = forfeited ? this.scoreOpp + (this.scoreOpp <= this.scoreUser ? 1 : 0) : this.scoreOpp;
    this.matchData.onFinish(finalUser, finalOpp);
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

function pickControlledPlayer(xi: { slot: SlotLayout; player: Player }[]): string {
  const outfield = xi.filter((e) => e.slot.role !== "GK");
  if (outfield.length === 0) return xi[0]?.player.id ?? "";
  const best = outfield.reduce((a, b) => (b.player.base.shooting > a.player.base.shooting ? b : a));
  return best.player.id;
}

function resolveMatchXI(squad: Player[], startingXI: string[], slots: SlotLayout[]): { slot: SlotLayout; player: Player }[] {
  const chosen = squad.filter((p) => startingXI.includes(p.id));
  const bench = [...squad]
    .filter((p) => !startingXI.includes(p.id))
    .sort((a, b) => overallOf(b) - overallOf(a));
  const pool = [...chosen];
  while (pool.length < slots.length && bench.length > 0) {
    pool.push(bench.shift()!);
  }
  const remaining = [...pool];
  const result: { slot: SlotLayout; player: Player }[] = [];
  for (const slot of slots) {
    let idx = remaining.findIndex((p) => p.position === slot.role);
    if (idx < 0) idx = 0;
    result.push({ slot, player: remaining[idx] });
    remaining.splice(idx, 1);
  }
  return result;
}

export const MATCH_CANVAS = { width: GAME_W, height: GAME_H };
