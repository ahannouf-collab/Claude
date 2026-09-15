import {
  createNewGame,
  loadState,
  saveState,
  hasSave,
  currentFixture,
  recordMatchResult,
  openPack,
  releasePlayer,
  setStartingXI,
  setFormation,
  setClubColors,
  setClubName,
  PACKS,
  type GameState,
} from "../state";
import { FORMATIONS, squadOverall, type Formation } from "../data/clubs";
import { KIT_COLORS } from "../data/names";
import { overallOf, fullName, type Player } from "../data/players";

type Screen = "home" | "career" | "squad" | "transfers";

export class UIApp {
  private root: HTMLElement;
  private state: GameState;
  private screen: Screen = "home";
  private onPlayMatch: (state: GameState, onFinish: (scoreUser: number, scoreOpp: number) => void) => void;
  private draftFormation: Formation = "4-4-2";
  private draftPrimary = KIT_COLORS[0];
  private draftSecondary = KIT_COLORS[5];

  constructor(root: HTMLElement, onPlayMatch: UIApp["onPlayMatch"]) {
    this.root = root;
    this.onPlayMatch = onPlayMatch;
    const saved = loadState();
    this.state = saved ?? createNewGame("Mon Club", KIT_COLORS[0], KIT_COLORS[5], "4-4-2");
    if (!saved) this.screen = "home";
  }

  mount(): void {
    if (!hasSave()) {
      this.renderOnboarding();
    } else {
      this.render();
    }
  }

  private persist(): void {
    saveState(this.state);
  }

  private setScreen(s: Screen): void {
    this.screen = s;
    this.render();
  }

  // ---------- Layout helpers ----------

  private shell(contentHtml: string): string {
    const gf = this.state.leagueTable.find((r) => r.isUser);
    return `
      <div class="screen">
        <div class="topbar">
          <div class="club-title">
            <div class="club-badge" style="background:${this.state.club.primaryColor}; box-shadow: inset 0 0 0 6px ${this.state.club.secondaryColor}"></div>
            <h1>${escapeHtml(this.state.club.name)}</h1>
          </div>
          <div class="currency">🪙 ${this.state.currency.toLocaleString("fr-FR")}</div>
        </div>
        <div class="content">${contentHtml}</div>
        <div class="bottomnav">
          ${this.navBtn("home", "🏠", "Accueil")}
          ${this.navBtn("career", "🏆", "Carrière")}
          ${this.navBtn("squad", "👥", "Effectif")}
          ${this.navBtn("transfers", "🎁", "Transferts")}
        </div>
      </div>
      ${gf ? "" : ""}
    `;
  }

  private navBtn(id: Screen, icon: string, label: string): string {
    return `<button class="navbtn ${this.screen === id ? "active" : ""}" data-nav="${id}"><span class="icon">${icon}</span>${label}</button>`;
  }

  private bindNav(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => this.setScreen(btn.dataset.nav as Screen));
    });
  }

  private render(): void {
    let html = "";
    if (this.screen === "home") html = this.shell(this.homeContent());
    else if (this.screen === "career") html = this.shell(this.careerContent());
    else if (this.screen === "squad") html = this.shell(this.squadContent());
    else if (this.screen === "transfers") html = this.shell(this.transfersContent());
    this.root.innerHTML = html;
    this.bindNav();
    if (this.screen === "home") this.bindHome();
    if (this.screen === "squad") this.bindSquad();
    if (this.screen === "transfers") this.bindTransfers();
  }

  // ---------- Onboarding ----------

  private renderOnboarding(): void {
    this.root.innerHTML = `
      <div class="screen">
        <div class="content">
          <div class="card">
            <h2>Créer mon club</h2>
            <p style="color:var(--text-dim); font-size:13px; margin-top:-4px;">Univers 100% fictif : clubs, joueurs et ligue inventés.</p>
            <input type="text" id="clubNameInput" maxlength="24" placeholder="Nom du club" value="AS Nouveau Départ" />
          </div>
          <div class="card">
            <h2>Couleur principale</h2>
            <div class="row wrap" id="primarySwatches">
              ${KIT_COLORS.map((c) => `<button class="color-swatch ${c === this.draftPrimary ? "selected" : ""}" data-primary="${c}" style="background:${c}"></button>`).join("")}
            </div>
          </div>
          <div class="card">
            <h2>Couleur secondaire</h2>
            <div class="row wrap" id="secondarySwatches">
              ${KIT_COLORS.map((c) => `<button class="color-swatch ${c === this.draftSecondary ? "selected" : ""}" data-secondary="${c}" style="background:${c}"></button>`).join("")}
            </div>
          </div>
          <div class="card">
            <h2>Formation de départ</h2>
            <div class="row wrap">
              ${Object.keys(FORMATIONS).map((f) => `<button class="btn ${f === this.draftFormation ? "" : "secondary"}" style="width:auto; flex:1" data-formation="${f}">${f}</button>`).join("")}
            </div>
          </div>
          <button class="btn" id="createClubBtn" style="margin-top:6px;">Lancer la carrière ⚽</button>
        </div>
      </div>
    `;
    const nameInput = this.root.querySelector<HTMLInputElement>("#clubNameInput")!;
    this.root.querySelectorAll<HTMLButtonElement>("[data-primary]").forEach((b) =>
      b.addEventListener("click", () => {
        this.draftPrimary = b.dataset.primary!;
        this.renderOnboardingKeepName(nameInput.value);
      })
    );
    this.root.querySelectorAll<HTMLButtonElement>("[data-secondary]").forEach((b) =>
      b.addEventListener("click", () => {
        this.draftSecondary = b.dataset.secondary!;
        this.renderOnboardingKeepName(nameInput.value);
      })
    );
    this.root.querySelectorAll<HTMLButtonElement>("[data-formation]").forEach((b) =>
      b.addEventListener("click", () => {
        this.draftFormation = b.dataset.formation as Formation;
        this.renderOnboardingKeepName(nameInput.value);
      })
    );
    this.root.querySelector<HTMLButtonElement>("#createClubBtn")!.addEventListener("click", () => {
      const name = nameInput.value.trim() || "Mon Club";
      this.state = createNewGame(name, this.draftPrimary, this.draftSecondary, this.draftFormation);
      this.persist();
      this.screen = "home";
      this.render();
    });
  }

  private renderOnboardingKeepName(name: string): void {
    this.renderOnboarding();
    const input = this.root.querySelector<HTMLInputElement>("#clubNameInput");
    if (input) input.value = name;
  }

  // ---------- Home ----------

  private homeContent(): string {
    const fixture = currentFixture(this.state);
    const myOverall = squadOverall(this.state.squad, this.state.club.startingXI);
    return `
      <div class="card">
        <h2>Prochain match — Saison ${this.state.season}</h2>
        ${
          fixture
            ? `<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                 <div><div style="font-size:18px;font-weight:700;">${escapeHtml(this.state.club.name)}</div><div class="tag">OVR ${myOverall}</div></div>
                 <div style="font-size:13px;color:var(--text-dim)">Journée ${fixture.matchday}</div>
                 <div style="text-align:right"><div style="font-size:18px;font-weight:700;">${escapeHtml(fixture.opponent)}</div><div class="tag">OVR ${fixture.opponentStrength}</div></div>
               </div>
               <button class="btn" id="playMatchBtn">▶ Jouer le match</button>`
            : `<p>Saison terminée, préparation de la suivante…</p>`
        }
      </div>
      <div class="card">
        <h2>Journal de club</h2>
        ${this.state.log.slice(0, 6).map((l) => `<div class="log-line">${escapeHtml(l)}</div>`).join("") || `<div class="log-line">Aucun événement pour l'instant.</div>`}
      </div>
    `;
  }

  private bindHome(): void {
    const btn = this.root.querySelector<HTMLButtonElement>("#playMatchBtn");
    btn?.addEventListener("click", () => {
      this.onPlayMatch(this.state, (scoreUser, scoreOpp) => this.finishMatch(scoreUser, scoreOpp));
    });
  }

  private finishMatch(scoreUser: number, scoreOpp: number): void {
    const { state, rewards } = recordMatchResult(this.state, scoreUser, scoreOpp);
    this.state = state;
    this.persist();
    this.screen = "home";
    this.render();
    this.showModal(`
      <div class="result-banner" style="color:${rewards.outcome === "Victoire" ? "var(--good)" : rewards.outcome === "Nul" ? "var(--warn)" : "var(--bad)"}">${rewards.outcome}</div>
      <div class="score-line">${scoreUser} - ${scoreOpp}</div>
      <p style="text-align:center;color:var(--text-dim)">+${rewards.currency} 🪙 · +${rewards.xpPerStarter} XP pour les titulaires</p>
      <button class="btn" data-close-modal>Continuer</button>
    `);
  }

  // ---------- Career ----------

  private careerContent(): string {
    const rows = this.state.leagueTable
      .map(
        (r, i) => `
      <tr class="${r.isUser ? "me" : ""}">
        <td>${i + 1}. ${escapeHtml(r.name)}</td>
        <td>${r.played}</td>
        <td>${r.won}</td>
        <td>${r.drawn}</td>
        <td>${r.lost}</td>
        <td>${r.gf - r.ga >= 0 ? "+" : ""}${r.gf - r.ga}</td>
        <td>${r.points}</td>
      </tr>`
      )
      .join("");
    return `
      <div class="card">
        <h2>Classement — Saison ${this.state.season}</h2>
        <table class="league">
          <thead><tr><th>Club</th><th>J</th><th>G</th><th>N</th><th>P</th><th>Diff</th><th>Pts</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="card">
        <h2>Calendrier</h2>
        ${this.state.fixtures
          .map(
            (f) => `<div class="log-line">J${f.matchday} — ${escapeHtml(f.opponent)} ${f.played ? `: ${f.scoreUser}-${f.scoreOpp}` : "(à jouer)"}</div>`
          )
          .join("")}
      </div>
    `;
  }

  // ---------- Squad ----------

  private squadContent(): string {
    const sorted = [...this.state.squad].sort((a, b) => overallOf(b) - overallOf(a));
    const startersCount = this.state.club.startingXI.length;
    const needed = FORMATIONS[this.state.club.formation].length;
    return `
      <div class="card">
        <h2>Formation</h2>
        <div class="row wrap">
          ${Object.keys(FORMATIONS)
            .map(
              (f) =>
                `<button class="btn ${f === this.state.club.formation ? "" : "secondary"}" style="width:auto;flex:1" data-set-formation="${f}">${f}</button>`
            )
            .join("")}
        </div>
        <p style="font-size:12px;color:var(--text-dim);margin-bottom:0">Titulaires sélectionnés : ${startersCount}/${needed}</p>
      </div>
      <div class="card">
        <h2>Effectif (${this.state.squad.length})</h2>
        ${sorted.map((p) => this.playerRow(p)).join("")}
      </div>
    `;
  }

  private playerRow(p: Player): string {
    const isStarter = this.state.club.startingXI.includes(p.id);
    return `
      <div class="player-row ${isStarter ? "starter" : ""}">
        <div class="ovr-badge rarity-${p.rarity}">${overallOf(p)}</div>
        <div class="pos-chip">${p.position}</div>
        <div class="player-info">
          <div class="player-name">${escapeHtml(fullName(p))}</div>
          <div class="player-meta">${p.rarity} · Niv. ${p.level} · ${p.age} ans</div>
        </div>
        <button class="btn ${isStarter ? "secondary" : "ghost"}" style="width:auto;padding:8px 10px;font-size:12px;" data-toggle-starter="${p.id}">${isStarter ? "Titulaire" : "Banc"}</button>
        <button class="btn danger" style="width:auto;padding:8px 10px;font-size:12px;" data-release="${p.id}">✕</button>
      </div>
    `;
  }

  private bindSquad(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-set-formation]").forEach((b) =>
      b.addEventListener("click", () => {
        this.state = setFormation(this.state, b.dataset.setFormation as Formation);
        this.persist();
        this.render();
      })
    );
    this.root.querySelectorAll<HTMLButtonElement>("[data-toggle-starter]").forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.dataset.toggleStarter!;
        const needed = FORMATIONS[this.state.club.formation].length;
        const xi = this.state.club.startingXI;
        const nextXI = xi.includes(id) ? xi.filter((x) => x !== id) : xi.length < needed ? [...xi, id] : xi;
        this.state = setStartingXI(this.state, nextXI);
        this.persist();
        this.render();
      })
    );
    this.root.querySelectorAll<HTMLButtonElement>("[data-release]").forEach((b) =>
      b.addEventListener("click", () => {
        this.state = releasePlayer(this.state, b.dataset.release!);
        this.persist();
        this.render();
      })
    );
  }

  // ---------- Transfers ----------

  private transfersContent(): string {
    return `
      <div class="card">
        <h2>Personnalisation du club</h2>
        <input type="text" id="renameInput" maxlength="24" value="${escapeHtml(this.state.club.name)}" />
        <p style="font-size:12px;color:var(--text-dim);margin:8px 0 4px;">Couleur principale</p>
        <div class="row wrap">${KIT_COLORS.map((c) => `<button class="color-swatch ${c === this.state.club.primaryColor ? "selected" : ""}" data-club-primary="${c}" style="background:${c}"></button>`).join("")}</div>
        <p style="font-size:12px;color:var(--text-dim);margin:8px 0 4px;">Couleur secondaire</p>
        <div class="row wrap">${KIT_COLORS.map((c) => `<button class="color-swatch ${c === this.state.club.secondaryColor ? "selected" : ""}" data-club-secondary="${c}" style="background:${c}"></button>`).join("")}</div>
        <button class="btn secondary" id="renameBtn" style="margin-top:10px;">Renommer le club</button>
      </div>
      <div class="card">
        <h2>Marché des transferts — Packs</h2>
        ${PACKS.map(
          (pack) => `
          <div class="row" style="align-items:center; margin-bottom:8px;">
            <div class="grow">
              <div style="font-weight:700">${pack.label}</div>
              <div class="player-meta">${pack.size} joueurs · ${pack.minOverallHint}</div>
            </div>
            <button class="btn" style="width:auto;padding:12px 16px" data-open-pack="${pack.id}" ${this.state.currency < pack.cost ? "disabled" : ""}>🪙 ${pack.cost}</button>
          </div>`
        ).join("")}
      </div>
    `;
  }

  private bindTransfers(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-club-primary]").forEach((b) =>
      b.addEventListener("click", () => {
        this.state = setClubColors(this.state, b.dataset.clubPrimary!, this.state.club.secondaryColor);
        this.persist();
        this.render();
      })
    );
    this.root.querySelectorAll<HTMLButtonElement>("[data-club-secondary]").forEach((b) =>
      b.addEventListener("click", () => {
        this.state = setClubColors(this.state, this.state.club.primaryColor, b.dataset.clubSecondary!);
        this.persist();
        this.render();
      })
    );
    this.root.querySelector<HTMLButtonElement>("#renameBtn")?.addEventListener("click", () => {
      const input = this.root.querySelector<HTMLInputElement>("#renameInput")!;
      this.state = setClubName(this.state, input.value.trim() || this.state.club.name);
      this.persist();
      this.render();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-open-pack]").forEach((b) =>
      b.addEventListener("click", () => {
        try {
          const { state, players } = openPack(this.state, b.dataset.openPack as any);
          this.state = state;
          this.persist();
          this.render();
          this.showModal(`
            <h2 style="text-align:center">🎁 Pack ouvert !</h2>
            ${players.map((p) => this.playerRow(p)).join("")}
            <button class="btn" data-close-modal style="margin-top:10px;">Super !</button>
          `);
        } catch (e) {
          // pièces insuffisantes : bouton déjà désactivé, on ignore
        }
      })
    );
  }

  // ---------- Modal ----------

  private showModal(innerHtml: string): void {
    const overlay = document.createElement("div");
    overlay.className = "center-modal";
    overlay.innerHTML = `<div class="modal-card">${innerHtml}</div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll<HTMLButtonElement>("[data-close-modal]").forEach((b) =>
      b.addEventListener("click", () => overlay.remove())
    );
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
