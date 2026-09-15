import "./style.css";
import Phaser from "phaser";
import { UIApp } from "./ui/app";
import { MatchScene, MATCH_CANVAS, type MatchSceneData } from "./scenes/MatchScene";
import type { GameState } from "./state";

const appRoot = document.getElementById("app")!;

const menuHost = document.createElement("div");
menuHost.id = "menuHost";
menuHost.style.position = "absolute";
menuHost.style.inset = "0";
appRoot.appendChild(menuHost);

const gameHost = document.createElement("div");
gameHost.id = "gameHost";
gameHost.style.display = "none";
appRoot.appendChild(gameHost);

let phaserGame: Phaser.Game | null = null;

function launchMatch(state: GameState, onFinish: (scoreUser: number, scoreOpp: number) => void): void {
  menuHost.style.display = "none";
  gameHost.style.display = "block";
  requestLandscapeFullscreen();

  const data: MatchSceneData = {
    state,
    onFinish: (scoreUser, scoreOpp) => {
      phaserGame?.destroy(true);
      phaserGame = null;
      gameHost.style.display = "none";
      menuHost.style.display = "block";
      onFinish(scoreUser, scoreOpp);
    },
  };

  phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "gameHost",
    width: MATCH_CANVAS.width,
    height: MATCH_CANVAS.height,
    backgroundColor: "#0a5c33",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [MatchScene],
  });
  phaserGame.scene.start("MatchScene", data);
}

function requestLandscapeFullscreen(): void {
  const el = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
  el.requestFullscreen?.().catch(() => undefined);
  const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  orientation?.lock?.("landscape").catch(() => undefined);
}

const uiApp = new UIApp(menuHost, launchMatch);
uiApp.mount();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
