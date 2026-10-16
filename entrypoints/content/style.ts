// Styles de l'overlay (Shadow DOM fermé) : mêmes tokens que les pages React,
// écrits à la main pour garder le content script léger (pas de React en page).
export const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.racine {
  --bg: #ffffff; --fg: #131D38; --muted: #F1F3F6; --muted-fg: #5B6478; --border: #E3E6EC;
  --primary: #131D38; --primary-fg: #ffffff; --azur: #3377FF; --danger: #E5484D; --voile: rgb(13 20 39 / .35);
  font: 13px/1.45 'Inter Variable', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, Cantarell, system-ui, sans-serif;
  color: var(--fg); -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  .racine { --bg: #131D38; --fg: #F7F7F7; --muted: #1B2645; --muted-fg: #98A2B8; --border: #26324F;
    --primary: #F7F7F7; --primary-fg: #131D38; --voile: rgb(0 0 0 / .45); }
}
[hidden] { display: none !important; }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
svg.i { width: 15px; height: 15px; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
kbd { font: 500 11px/1 inherit; font-family: inherit; min-width: 18px; height: 18px; padding: 0 4px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 4px; background: var(--muted); color: var(--muted-fg); border: 1px solid var(--border); }

/* cadre de survol */
.cadre { position: fixed; border: 2px solid var(--azur); background: rgb(51 119 255 / .08); border-radius: 3px; pointer-events: none; transition: all 60ms ease-out; }
.etiquette { position: absolute; left: -2px; bottom: 100%; margin-bottom: 4px; display: flex; gap: 6px; align-items: center; max-width: min(560px, 90vw);
  background: #131D38; color: #fff; padding: 3px 8px; border-radius: 6px; font-size: 12px; white-space: nowrap; box-shadow: 0 2px 8px rgb(0 0 0 / .2); }
.etiquette.dessous { bottom: auto; top: 100%; margin: 4px 0 0; }
.etiquette .fil { overflow: hidden; text-overflow: ellipsis; }
.etiquette .dim { color: #98A2B8; flex: none; }
.flash { position: fixed; border: 3px solid var(--azur); border-radius: 4px; pointer-events: none; animation: flash .8s ease-in-out 3; }
@keyframes flash { 50% { box-shadow: 0 0 0 8px rgb(51 119 255 / .35); background: rgb(51 119 255 / .12); } }

/* barre d'outils */
.barre { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); pointer-events: auto; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.pilule { display: flex; align-items: center; gap: 2px; padding: 4px; background: var(--bg); border: 1px solid var(--border); border-radius: 12px;
  box-shadow: 0 8px 24px rgb(13 20 39 / .16), 0 1px 2px rgb(13 20 39 / .08); }
.marque { display: flex; align-items: center; gap: 8px; padding: 0 8px 0 6px; max-width: 220px; }
.marque svg { width: 16px; height: 16px; flex: none; }
.marque .nom { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.marque .compte { color: var(--muted-fg); font-variant-numeric: tabular-nums; }
.sep { width: 1px; align-self: stretch; margin: 4px 4px; background: var(--border); }
.outil { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 8px; border-radius: 8px; color: var(--muted-fg); }
.outil:hover { background: var(--muted); color: var(--fg); }
.outil[aria-pressed=true] { background: var(--muted); color: var(--fg); }
.outil[aria-pressed=true] svg { color: var(--azur); }
.outil.icone { width: 30px; justify-content: center; padding: 0; }
.puce { display: flex; align-items: center; gap: 8px; padding: 5px 6px 5px 10px; border-radius: 99px; background: #131D38; color: #fff; font-size: 12px; box-shadow: 0 4px 12px rgb(0 0 0 / .2); }
.puce kbd { background: rgb(255 255 255 / .12); border-color: transparent; color: #fff; }

/* zone */
.voile { position: fixed; inset: 0; pointer-events: auto; cursor: crosshair; }
.voile.vide { background: var(--voile); }
.trace { position: fixed; border: 1.5px solid var(--azur); box-shadow: 0 0 0 100vmax var(--voile); }
.trace .dim { position: absolute; right: 0; top: 100%; margin-top: 4px; background: #131D38; color: #fff; font-size: 11px; padding: 2px 6px; border-radius: 4px; }
.consigne { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); pointer-events: none; }

/* carte commentaire */
.carte { position: fixed; width: 340px; pointer-events: auto; background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 12px;
  box-shadow: 0 16px 40px rgb(13 20 39 / .2), 0 2px 6px rgb(13 20 39 / .08); display: flex; flex-direction: column; gap: 10px; animation: entree 140ms ease-out; }
@keyframes entree { from { opacity: 0; transform: translateY(4px) scale(.98); } }
.carte header { display: flex; align-items: baseline; gap: 8px; }
.carte h3 { margin: 0; font-size: 13px; font-weight: 600; }
.carte header .meta { color: var(--muted-fg); font-size: 12px; }
.pieces { display: flex; gap: 6px; flex-wrap: wrap; }
.vignette { position: relative; width: 64px; height: 48px; border-radius: 6px; border: 1px solid var(--border); background: var(--muted) center / cover no-repeat; }
.vignette button { position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 99px; background: var(--fg); color: var(--bg);
  display: none; align-items: center; justify-content: center; }
.vignette button svg { width: 11px; height: 11px; stroke-width: 2.5; }
.vignette:hover button { display: flex; }
.ajout { width: 64px; height: 48px; border-radius: 6px; border: 1px dashed var(--border); color: var(--muted-fg); display: flex; align-items: center; justify-content: center; }
.ajout:hover { border-color: var(--azur); color: var(--azur); background: rgb(51 119 255 / .06); }
.lieu { font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, 'DejaVu Sans Mono', monospace; color: var(--muted-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
textarea { width: 100%; min-height: 92px; max-height: 40vh; resize: vertical; font: inherit; color: var(--fg); background: var(--bg);
  border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; outline: none; }
textarea:focus { border-color: var(--azur); box-shadow: 0 0 0 3px rgb(51 119 255 / .2); }
textarea::placeholder { color: var(--muted-fg); }
.carte footer { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
/* L'aide prend toute la largeur : « Ctrl+Maj+Entrée » ne tient pas à côté des boutons. */
.carte footer .aide { flex: 1 0 100%; order: -1; margin-top: -2px; color: var(--muted-fg); font-size: 11px; display: flex; gap: 5px; align-items: center; white-space: nowrap; }
.carte footer .btn.principal { margin-left: auto; }
.btn { height: 30px; padding: 0 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; font-weight: 500; }
.btn.principal { background: var(--primary); color: var(--primary-fg); }
.btn.principal:hover { opacity: .9; }
.btn.principal kbd { background: transparent; border-color: rgb(255 255 255 / .25); color: inherit; }
@media (prefers-color-scheme: dark) { .btn.principal kbd { border-color: rgb(19 29 56 / .25); } }
.btn.fantome { color: var(--muted-fg); padding: 0 8px; }
.btn.fantome:hover { background: var(--muted); color: var(--danger); }

/* pastilles des feedbacks déjà posés */
.pin { position: fixed; pointer-events: auto; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 99px; background: var(--azur); color: #fff;
  font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; box-shadow: 0 2px 6px rgb(0 0 0 / .25); }
.pin:hover { transform: scale(1.1); }
.contour { position: fixed; border: 1.5px dashed var(--azur); border-radius: 3px; pointer-events: none; }

.toast { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); background: #131D38; color: #fff; padding: 8px 12px; border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / .2); pointer-events: none; }
`;

// Icônes Lucide (MIT), en ligne.
const ic = (d: string) => `<svg class="i" viewBox="0 0 24 24">${d}</svg>`;
export const ICONES = {
  pointeur: ic('<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>'),
  zone: ic('<path d="M5 3a2 2 0 0 0-2 2"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M21 19a2 2 0 0 1-2 2"/><path d="M5 21a2 2 0 0 1-2-2"/><path d="M9 3h1"/><path d="M9 21h1"/><path d="M14 3h1"/><path d="M14 21h1"/><path d="M3 9v1"/><path d="M21 9v1"/><path d="M3 14v1"/><path d="M21 14v1"/>'),
  ecran: ic('<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>'),
  x: ic('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  plus: ic('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  poubelle: ic('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'),
};
