// Overlay en page. En sommeil tant que le mode feedback est coupé : seuls les
// raccourcis globaux « élément » / « zone » et, sur Mac, ⌥ tenu (viser + ⌥+clic)
// le réveillent ponctuellement.
//
// Anti-conflit : un seul écouteur par type d'événement, sur window en phase de
// capture, posé à document_start donc avant les scripts de la page. Tout ce qui
// vient de notre UI est traité ici puis stoppé (la page ne voit jamais nos
// frappes, clics ni changements de focus) ; côté page, on ne bloque que les
// touches et clics qu'on consomme.
import { envoyer, type ReponseCapture, type VersContent } from '@/lib/messages';
import { logoSvg } from '@/lib/logo';
import { combo, DEFAUTS, MAC, type Raccourcis } from '@/lib/plateforme';
import { cleFb } from '@/lib/store';
import type { Feedback, InfoElement, Rect, Session } from '@/lib/types';
import { accrocher, decrire, enSaisie, profond, rectDe, resoudre, versEnfant, versParent, versVoisin } from './dom';
import { CSS, ICONES } from './style';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    demarrer();
  },
});

const ARRET = 'designer-feedback:arret';
const EVENEMENTS = ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick',
  'contextmenu', 'keydown', 'keyup', 'keypress', 'focusin', 'focusout', 'input', 'beforeinput'] as const;
const CLIC = new Set(['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu']);

function demarrer() {
  // Une instance orpheline (extension rechargée) se retire d'elle-même.
  document.dispatchEvent(new CustomEvent(ARRET));

  // --- état ---
  let actif = false; // mode feedback sur l'onglet
  let alt = false; // ⌥ tenu, hors mode (Mac seulement)
  let unique = false; // sélection d'un seul élément, hors mode (raccourci global)
  let raccourcis: Raccourcis = DEFAUTS;
  let cible: Element | null = null;
  let pile: Element[] = []; // pour redescendre avec ↓ après des ↑
  let verrou: { x: number; y: number } | null = null; // la souris ne reprend la main qu'après avoir bougé
  let souris = { x: -1, y: -1 };
  let zone: { ajouter: boolean; depart: { x: number; y: number } | null; fin?: { x: number; y: number } } | null = null;
  let carte: { fid: string; nouveau: boolean; minuteur?: number } | null = null;
  let ajoutA: string | null = null; // feedback qui attend une pièce de plus
  let session: Session | null = null;
  let fbs: Feedback[] = [];
  const apercus = new Map<string, string>();
  let intervallePins: number | undefined;

  // --- UI (créée au premier besoin) ---
  let host: HTMLElement | null = null;
  let racine: HTMLElement;
  const el = <K extends string>(cls: K) => racine.querySelector<HTMLElement>(`.${cls}`)!;

  function ui() {
    if (!host) {
      host = document.createElement('designer-feedback');
      host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647';
      // Ouvert, pas fermé : depuis window, composedPath() s'arrête à l'hôte d'un Shadow DOM fermé,
      // et la délégation de clics (barre, carte, pastilles) ne verrait jamais nos boutons.
      const ombre = host.attachShadow({ mode: 'open' });
      ombre.innerHTML = `<style>${CSS}</style><div class="racine">
        <div class="cadre" hidden><div class="etiquette"><span class="fil"></span><span class="dim"></span></div></div>
        <div class="pins"></div>
        <div class="voile" hidden><div class="trace" hidden><span class="dim"></span></div></div>
        <div class="consigne" hidden><div class="puce"></div></div>
        <div class="barre" hidden></div>
        <div class="carte" hidden></div>
        <div class="toast" hidden></div>
      </div>`;
      racine = ombre.querySelector('.racine')!;
    }
    if (!host.isConnected) document.documentElement.append(host);
    return racine;
  }

  // --- données de la session courante (lues directement, écrites via le background) ---
  const local = chrome.storage.local;
  async function charger() {
    const { courante, sessions } = await local.get(['courante', 'sessions']);
    session = (sessions as Session[] | undefined)?.find((s) => s.id === courante) ?? null;
    fbs = session ? (((await local.get(cleFb(session.id)))[cleFb(session.id)] as Feedback[]) ?? []) : [];
    rendreBarre();
    placerPins();
    if (carte) rendrePieces();
  }
  const surStockage = (ch: Record<string, chrome.storage.StorageChange>, aire: string) => {
    if (aire !== 'local' || !(actif || carte)) return;
    if (ch.courante || ch.sessions || (session && ch[cleFb(session.id)])) charger();
  };
  chrome.storage.onChanged.addListener(surStockage);

  // --- mode ---
  function definirActif(v: boolean) {
    actif = v;
    if (v) {
      ui();
      charger();
      clearInterval(intervallePins);
      intervallePins = window.setInterval(placerPins, 1500); // contenus qui bougent / SPA
    } else {
      clearInterval(intervallePins);
      ajoutA = null;
      if (host) {
        el('barre').hidden = true;
        el('pins').innerHTML = '';
      }
      if (!alt) masquerCadre();
    }
  }
  const domActif = () => !carte && !zone && (actif || alt || unique);

  function consigne(html: string | null) {
    ui();
    el('consigne').hidden = !html;
    if (html) el('consigne').querySelector('.puce')!.innerHTML = html;
  }

  function demarrerUnique() {
    if (carte) fermerCarte();
    finirZone();
    unique = true;
    consigne(`Cliquez un élément <kbd>↑</kbd><kbd>↓</kbd> ajuster <kbd>${combo('maj')}</kbd> ajoute au dernier <kbd>Esc</kbd>`);
    if (souris.x >= 0) viser(souris.x, souris.y);
  }

  function finirUnique() {
    if (!unique) return;
    unique = false;
    consigne(null);
    if (!actif) masquerCadre();
  }

  // --- survol ---
  function viser(x: number, y: number) {
    const brut = profond(x, y, host!);
    if (!brut || brut === host) return masquerCadre();
    const accroche = accrocher(brut);
    if (accroche !== cible) {
      cible = accroche;
      pile = [];
      dessinerCadre(true);
    }
  }

  function dessinerCadre(majTexte = false) {
    if (!cible?.isConnected) return masquerCadre();
    ui();
    const r = rectDe(cible);
    const c = el('cadre');
    Object.assign(c.style, { left: `${r.x - 2}px`, top: `${r.y - 2}px`, width: `${r.l + 4}px`, height: `${r.h + 4}px` });
    c.hidden = false;
    racine.querySelector('.etiquette')!.classList.toggle('dessous', r.y < 30);
    if (majTexte) {
      const info = decrire(cible);
      c.querySelector('.fil')!.textContent = info.fil;
      c.querySelector('.dim')!.textContent = `${Math.round(r.l)}×${Math.round(r.h)}`;
    }
  }

  function masquerCadre() {
    cible = null;
    if (host) el('cadre').hidden = true;
  }

  function naviguer(vers: Element | null, empiler = false) {
    if (!vers || !cible) return;
    if (empiler) pile.push(cible);
    cible = vers;
    verrou = { ...souris };
    cible.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    dessinerCadre(true);
  }

  // --- capture ---
  const images = (n: number) => new Promise<void>((ok) => {
    const f = () => (--n ? requestAnimationFrame(f) : setTimeout(ok, 16));
    requestAnimationFrame(f);
  });

  async function capturer(type: 'dom' | 'zone' | 'visible', opts: { rect?: Rect; element?: InfoElement; ajouter?: boolean } = {}) {
    const ajouterA = ajoutA ?? (opts.ajouter ? 'dernier' : undefined);
    ajoutA = null;
    ui();
    masquerCadre();
    host!.style.visibility = 'hidden'; // l'overlay ne doit pas apparaître sur la capture
    await images(2);
    let rep: (ReponseCapture & { erreur?: string }) | undefined;
    try {
      rep = await envoyer<ReponseCapture & { erreur?: string }>({
        t: 'capturer', type, rect: opts.rect, element: opts.element, ajouterA,
        page: { url: location.href, titre: document.title },
        viewport: { l: innerWidth, h: innerHeight, dpr: devicePixelRatio },
      });
    } catch (e) {
      rep = { erreur: String(e) } as never;
    }
    host!.style.visibility = '';
    if (!rep || rep.erreur) return toast(`Capture impossible : ${rep?.erreur ?? 'pas de réponse'}`);
    const piece = rep.feedback.pieces.at(-1)!;
    apercus.set(piece.id, rep.apercu);
    await charger();
    ouvrirCarte(rep.feedback.id, rep.nouveau, opts.rect ?? { x: innerWidth / 2, y: innerHeight / 3, l: 0, h: 0 });
  }

  const borne = (r: Rect): Rect => {
    const x = Math.max(0, r.x), y = Math.max(0, r.y);
    return { x, y, l: Math.min(innerWidth, r.x + r.l) - x, h: Math.min(innerHeight, r.y + r.h) - y };
  };

  function selectionner(ajouter: boolean) {
    if (!cible) return;
    const info = decrire(cible);
    finirUnique();
    capturer('dom', { rect: borne(info.rect), element: info, ajouter });
  }

  // --- zone ---
  function demarrerZone(ajouter: boolean) {
    if (carte) fermerCarte();
    unique = false;
    masquerCadre();
    ui();
    zone = { ajouter, depart: null };
    el('voile').hidden = false;
    el('voile').classList.add('vide');
    consigne(`Tracez une zone <kbd>${combo('maj')}</kbd> ajoute au dernier <kbd>Esc</kbd>`);
  }

  function finirZone() {
    zone = null;
    if (!host) return;
    el('voile').hidden = true;
    el('voile').classList.remove('vide');
    el('trace').hidden = true;
    el('consigne').hidden = true;
  }

  function rectZone(): Rect {
    const d = zone!.depart!, f = zone!.fin!;
    return { x: Math.min(d.x, f.x), y: Math.min(d.y, f.y), l: Math.abs(f.x - d.x), h: Math.abs(f.y - d.y) };
  }

  // Avec la capture du pointeur, la souris peut sortir de la page : on borne au viewport.
  const borner = (e: PointerEvent) => ({
    x: Math.min(Math.max(e.clientX, 0), innerWidth),
    y: Math.min(Math.max(e.clientY, 0), innerHeight),
  });

  function lacherZone(shift: boolean) {
    if (!zone?.depart) return;
    const r = rectZone();
    const ajouter = zone.ajouter || shift;
    finirZone();
    if (r.l >= 8 && r.h >= 8) capturer('zone', { rect: r, ajouter });
  }

  function evenementZone(e: Event) {
    if (!zone || !(e instanceof PointerEvent)) return;
    if (e.type === 'pointerdown' && e.button === 0) {
      zone.depart = zone.fin = borner(e);
      el('voile').classList.remove('vide');
      // Le tracé continue de suivre la souris si elle passe sur le side panel, les onglets…
      el('voile').setPointerCapture(e.pointerId);
    } else if (e.type === 'pointermove' && zone.depart) {
      // Bouton relâché hors de la page (side panel, autre fenêtre) : le pointerup ne nous est jamais
      // parvenu. On termine sur le dernier point vu au lieu de laisser le tracé collé à la souris.
      if (!(e.buttons & 1)) return lacherZone(e.shiftKey);
      zone.fin = borner(e);
      const r = rectZone();
      const t = el('trace');
      Object.assign(t.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.l}px`, height: `${r.h}px` });
      t.hidden = false;
      t.querySelector('.dim')!.textContent = `${Math.round(r.l)}×${Math.round(r.h)}`;
    } else if (e.type === 'pointerup' && zone.depart) {
      zone.fin = borner(e);
      lacherZone(e.shiftKey);
    } else if (e.type === 'pointercancel') lacherZone(false);
  }

  // --- carte commentaire ---
  function ouvrirCarte(fid: string, nouveau: boolean, ancre: Rect) {
    ui();
    const f = fbs.find((x) => x.id === fid);
    if (!f) return;
    carte = { fid, nouveau };
    masquerCadre();
    const c = el('carte');
    const num = fbs.indexOf(f) + 1;
    c.innerHTML = `
      <header><h3>Feedback n°${num}</h3><span class="meta">${session ? echapper(session.nom) : ''}</span></header>
      <div class="pieces"></div>
      <div class="lieu"></div>
      <textarea placeholder="Qu’est-ce qui ne va pas ? La première ligne sert de titre."></textarea>
      <footer>
        <span class="aide"><kbd>${combo('mod', 'maj', 'entree')}</kbd> pièce de plus <kbd>Esc</kbd> fermer</span>
        <button class="btn fantome" data-a="supprimer" title="Supprimer ce feedback">${ICONES.poubelle}</button>
        <button class="btn principal" data-a="enregistrer">Enregistrer <kbd>${combo('mod', 'entree')}</kbd></button>
      </footer>`;
    const ta = c.querySelector('textarea')!;
    ta.value = f.commentaire;
    rendrePieces();
    c.hidden = false;
    // À droite de l'ancre, sinon à gauche, sinon en bas à droite.
    const L = 340, H = c.offsetHeight, m = 12;
    let x = ancre.x + ancre.l + m;
    if (x + L > innerWidth - m) x = ancre.x - L - m;
    if (x < m) x = innerWidth - L - 20;
    const y = Math.min(Math.max(m, ancre.y), innerHeight - H - 20);
    Object.assign(c.style, { left: `${x}px`, top: `${y}px` });
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  function rendrePieces() {
    if (!carte) return;
    const f = fbs.find((x) => x.id === carte!.fid);
    if (!f) return fermerCarte(false);
    const conteneur = el('carte').querySelector('.pieces')!;
    conteneur.innerHTML =
      f.pieces.map((p) => `<div class="vignette" data-piece="${p.id}" title="${p.type === 'dom' ? 'Élément' : p.type === 'zone' ? 'Zone' : 'Écran'}"><button data-a="retirer" data-id="${p.id}" title="Retirer">${ICONES.x}</button></div>`).join('') +
      `<button class="ajout" data-a="ajouter" title="Ajouter une pièce (${combo('mod', 'maj', 'entree')})">${ICONES.plus}</button>`;
    for (const p of f.pieces) {
      const v = conteneur.querySelector<HTMLElement>(`[data-piece="${p.id}"]`)!;
      const url = apercus.get(p.id);
      if (url) v.style.backgroundImage = `url("${url}")`;
      else envoyer<string>({ t: 'image', id: p.image }).then((u) => u && (apercus.set(p.id, u), (v.style.backgroundImage = `url("${u}")`)));
    }
    const der = f.pieces.at(-1);
    el('carte').querySelector('.lieu')!.textContent = der?.element?.fil ?? (der?.type === 'zone' ? 'Zone' : 'Écran visible');
  }

  function sauver() {
    if (!carte) return;
    clearTimeout(carte.minuteur);
    const ta = el('carte').querySelector('textarea');
    if (ta) envoyer({ t: 'majCommentaire', feedbackId: carte.fid, commentaire: ta.value });
  }

  function fermerCarte(enregistrer = true) {
    if (!carte) return;
    const { fid, nouveau } = carte;
    const ta = el('carte').querySelector('textarea');
    const f = fbs.find((x) => x.id === fid);
    // Esc sur une capture toute fraîche sans un mot : on l'abandonne.
    if (enregistrer && nouveau && !ta?.value.trim() && f?.pieces.length === 1) envoyer({ t: 'supprimerFeedback', feedbackId: fid });
    else if (enregistrer) sauver();
    carte = null;
    el('carte').hidden = true;
    rendreBarre();
  }

  function ajouterPiece() {
    if (!carte) return;
    const fid = carte.fid;
    carte.nouveau = false; // il a déjà une pièce qu'on veut garder
    fermerCarte();
    ajoutA = fid;
    if (!actif) envoyer({ t: 'basculer', actif: true });
    rendreBarre();
  }

  // --- barre d'outils ---
  function rendreBarre() {
    if (!host) return;
    const b = el('barre');
    b.hidden = !actif;
    if (!actif) return;
    const n = ajoutA ? fbs.findIndex((f) => f.id === ajoutA) + 1 : 0;
    b.innerHTML = `
      ${n ? `<div class="puce">Ajout d’une pièce au feedback n°${n} <kbd>Esc</kbd></div>` : ''}
      <div class="pilule">
        <div class="marque">${logoSvg()}<span class="nom">${echapper(session?.nom ?? 'Nouvelle session')}</span><span class="compte">${fbs.length}</span></div>
        <div class="sep"></div>
        <button class="outil" data-a="dom" aria-pressed="${!zone}" title="Sélection d’élément (D)">${ICONES.pointeur}Élément <kbd>D</kbd></button>
        <button class="outil" data-a="zone" aria-pressed="${!!zone}" title="Capture de zone (Z)">${ICONES.zone}Zone <kbd>Z</kbd></button>
        <button class="outil" data-a="visible" title="Capture de l’écran visible (V)">${ICONES.ecran}Écran <kbd>V</kbd></button>
        <div class="sep"></div>
        <button class="outil icone" data-a="quitter" title="Quitter le mode feedback${raccourcis.basculer ? ` (${raccourcis.basculer})` : ''}">${ICONES.x}</button>
      </div>`;
  }

  // --- pastilles ---
  const sansAncre = (u: string) => u.split('#')[0];
  function placerPins() {
    if (!host) return;
    const zonePins = el('pins');
    if (!actif) return void (zonePins.innerHTML = '');
    const ici = sansAncre(location.href);
    let html = '';
    fbs.forEach((f, i) => {
      const p = f.pieces.find((x) => x.type === 'dom' && x.element && sansAncre(x.page.url) === ici);
      const cibleP = p?.element && resoudre(p.element);
      if (!cibleP) return;
      const r = cibleP.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || !r.width) return;
      html += `<div class="contour" style="left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px"></div>`;
      html += `<button class="pin" data-a="pin" data-id="${f.id}" style="left:${Math.max(2, r.x - 9)}px;top:${Math.max(2, r.y - 9)}px" title="${echapper(f.commentaire.split('\n')[0] || 'Sans titre')}">${i + 1}</button>`;
    });
    zonePins.innerHTML = html;
  }

  // --- retrouver ---
  function localiser(info?: InfoElement) {
    if (!info) return true;
    const trouve = resoudre(info);
    if (!trouve) return false;
    trouve.scrollIntoView({ block: 'center', inline: 'nearest' });
    requestAnimationFrame(() => {
      ui();
      const r = trouve.getBoundingClientRect();
      const f = document.createElement('div');
      f.className = 'flash';
      Object.assign(f.style, { left: `${r.x - 3}px`, top: `${r.y - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px` });
      racine.append(f);
      setTimeout(() => f.remove(), 2600);
    });
    return true;
  }

  function toast(texte: string) {
    ui();
    const t = el('toast');
    t.textContent = texte;
    t.hidden = false;
    setTimeout(() => (t.hidden = true), 3000);
  }

  // --- actions de notre UI (délégation) ---
  function action(nom: string, cibleAction: HTMLElement) {
    switch (nom) {
      case 'dom': finirZone(); rendreBarre(); break;
      case 'zone': demarrerZone(false); rendreBarre(); break;
      case 'visible': capturer('visible'); break;
      case 'quitter': envoyer({ t: 'basculer', actif: false }); break;
      case 'enregistrer': fermerCarte(); break;
      case 'supprimer':
        if (carte) envoyer({ t: 'supprimerFeedback', feedbackId: carte.fid });
        carte = null;
        el('carte').hidden = true;
        break;
      case 'ajouter': ajouterPiece(); break;
      case 'retirer':
        if (carte) envoyer({ t: 'retirerPiece', feedbackId: carte.fid, pieceId: cibleAction.dataset.id! });
        break;
      case 'pin': {
        const r = cibleAction.getBoundingClientRect();
        if (carte) fermerCarte();
        ouvrirCarte(cibleAction.dataset.id!, false, { x: r.x, y: r.y, l: r.width, h: r.height });
        break;
      }
    }
  }

  function dansNotreUi(e: Event) {
    if (!host) return false;
    const chemin = e.composedPath();
    return chemin.includes(host) || chemin[0] === host;
  }

  function evenementUi(e: Event) {
    if (zone) evenementZone(e);
    if (e.type === 'click') {
      const btn = (e.composedPath() as HTMLElement[]).find((n) => n instanceof HTMLElement && n.dataset?.a);
      if (btn) {
        action(btn.dataset.a!, btn);
        // Rendre le focus à la page : sinon D / Z / V partiraient vers notre bouton.
        btn.blur();
      }
    }
    if (e.type === 'input' && carte && (e.composedPath()[0] as Element).tagName === 'TEXTAREA') {
      clearTimeout(carte.minuteur);
      carte.minuteur = window.setTimeout(sauver, 400);
    }
    if (e instanceof KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (e.type === 'keydown' && carte && e.key === 'Enter' && mod) {
        e.preventDefault();
        e.shiftKey ? ajouterPiece() : fermerCarte();
      } else if (e.type === 'keydown' && e.key === 'Escape' && (carte || zone)) {
        e.preventDefault();
        if (carte) fermerCarte();
        else (finirZone(), rendreBarre());
      } else if (!enSaisie(e)) evenementPage(e); // focus sur un bouton de la barre : mêmes raccourcis
    }
  }

  // --- événements de la page ---
  function evenementPage(e: Event) {
    if (e instanceof PointerEvent && e.type === 'pointermove') {
      souris = { x: e.clientX, y: e.clientY };
      if (!domActif()) return;
      if (verrou && Math.hypot(e.clientX - verrou.x, e.clientY - verrou.y) < 8) return;
      verrou = null;
      viser(e.clientX, e.clientY);
      return;
    }
    if (CLIC.has(e.type)) {
      if (!domActif() || !cible) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.type === 'click' && (e as MouseEvent).button === 0) selectionner((e as MouseEvent).shiftKey);
      return;
    }
    if (!(e instanceof KeyboardEvent)) return;
    if (e.type === 'keyup' && e.key === 'Alt') {
      alt = false;
      if (!actif) masquerCadre();
      return;
    }
    if (e.type !== 'keydown') {
      // On avale aussi keyup/keypress des touches qu'on consomme.
      if ((actif || unique) && !carte && !enSaisie(e) && !e.metaKey && !e.ctrlKey && !e.altKey && touche(e)) e.stopImmediatePropagation();
      return;
    }
    if (e.key === 'Alt') {
      if (MAC && !actif && !carte && !zone && !e.shiftKey && !enSaisie(e)) {
        alt = true;
        if (souris.x >= 0) viser(souris.x, souris.y);
      }
      return;
    }
    if (enSaisie(e)) return;
    const consommer = () => (e.preventDefault(), e.stopImmediatePropagation());
    if (e.key === 'Escape' && (zone || carte)) {
      consommer();
      if (zone) (finirZone(), rendreBarre());
      else fermerCarte();
      return;
    }
    if (!(actif || unique) || carte || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = touche(e);
    // Hors mode, la sélection ponctuelle ne prend que ses touches à elle.
    if (!actif && !['escape', 'enter', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k!)) return;
    if (!actif && k === 'escape') return void (finirUnique(), consommer());
    switch (k) {
      case 'd': finirZone(); rendreBarre(); break;
      case 'z': demarrerZone(e.shiftKey); rendreBarre(); break;
      case 'v': capturer('visible', { ajouter: e.shiftKey }); break;
      case 'escape':
        if (ajoutA) (ajoutA = null), rendreBarre();
        else envoyer({ t: 'basculer', actif: false });
        break;
      case 'enter': if (!cible) return; selectionner(e.shiftKey); break;
      case 'arrowup': if (!cible) return; naviguer(versParent(cible), true); break;
      case 'arrowdown': if (!cible) return; naviguer(pile.pop() ?? versEnfant(cible)); break;
      case 'arrowleft': if (!cible) return; naviguer(versVoisin(cible, -1)); break;
      case 'arrowright': if (!cible) return; naviguer(versVoisin(cible, 1)); break;
      default: return;
    }
    consommer();
  }

  const touche = (e: KeyboardEvent) => {
    // Disposition non latine (cyrillique, grec…) : e.key ne donne pas D/Z/V, on prend la touche physique.
    let k = e.key.toLowerCase();
    if (k.length === 1 && !/[a-z]/.test(k) && /^Key[A-Z]$/.test(e.code)) k = e.code.slice(3).toLowerCase();
    return ['d', 'z', 'v', 'escape', 'enter', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) ? k : null;
  };

  const garde = (e: Event) => {
    if (dansNotreUi(e)) {
      evenementUi(e);
      e.stopImmediatePropagation();
    } else evenementPage(e);
  };

  let rafDefil = 0;
  const surDefil = () => {
    cancelAnimationFrame(rafDefil);
    rafDefil = requestAnimationFrame(() => {
      if (cible) dessinerCadre();
      if (actif) placerPins();
    });
  };
  const surFlou = () => {
    if (alt) (alt = false), !actif && masquerCadre();
    lacherZone(false); // clic dans le side panel en plein tracé
  };

  for (const t of EVENEMENTS) window.addEventListener(t, garde, true);
  window.addEventListener('scroll', surDefil, { capture: true, passive: true });
  window.addEventListener('resize', surDefil, { passive: true });
  window.addEventListener('blur', surFlou);

  // --- messages du background ---
  const surMessage = (m: VersContent, _s: chrome.runtime.MessageSender, repondre: (r: unknown) => void) => {
    if (m.t === 'ping') repondre(true);
    if (m.t === 'mode') (definirActif(m.actif), repondre(true));
    if (m.t === 'zone') (demarrerZone(false), repondre(true));
    if (m.t === 'element') (demarrerUnique(), repondre(true));
    if (m.t === 'localiser') repondre(localiser(m.element));
  };
  chrome.runtime.onMessage.addListener(surMessage);

  document.addEventListener(ARRET, function arret() {
    document.removeEventListener(ARRET, arret);
    for (const t of EVENEMENTS) window.removeEventListener(t, garde, true);
    window.removeEventListener('scroll', surDefil, true);
    window.removeEventListener('resize', surDefil);
    window.removeEventListener('blur', surFlou);
    clearInterval(intervallePins);
    try {
      chrome.runtime.onMessage.removeListener(surMessage);
      chrome.storage.onChanged.removeListener(surStockage);
    } catch { /* contexte invalidé */ }
    host?.remove();
  });

  envoyer<{ actif: boolean; raccourcis: Raccourcis }>({ t: 'etat' })
    .then((r) => {
      if (r?.raccourcis) raccourcis = r.raccourcis;
      if (r?.actif) definirActif(true);
    })
    .catch(() => {});
}

const echapper = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
