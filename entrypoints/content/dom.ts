// Détection et description des éléments : accroche sur l'élément qui a du sens,
// navigation au clavier, sélecteur unique (traverse les Shadow DOM), fil d'Ariane.
import type { InfoElement, Rect } from '@/lib/types';

const INTERACTIF = [
  'a[href]', 'button', 'input', 'select', 'textarea', 'summary', 'label', 'img', 'video', 'canvas', 'iframe',
  '[role=button]', '[role=link]', '[role=tab]', '[role=menuitem]', '[role=option]', '[role=checkbox]',
  '[role=switch]', '[role=radio]', '[role=combobox]', '[role=slider]', '[contenteditable=""]', '[contenteditable=true]',
].join(',');
const EN_LIGNE = new Set(['SPAN', 'B', 'I', 'EM', 'STRONG', 'SMALL', 'MARK', 'ABBR', 'SUB', 'SUP', 'CODE', 'U', 'S', 'BR', 'WBR']);
const REPERES = 'nav,header,main,aside,footer,dialog,form,section[aria-label],[role=dialog],[role=navigation],[role=toolbar],[role=menu],[role=listbox],[role=tablist],[role=grid],[role=table]';

/** Parent qui traverse la frontière d'un Shadow DOM. */
export const parent = (el: Element): Element | null =>
  el.parentElement ?? ((el.getRootNode() as ShadowRoot).host || null);

const estRacine = (el: Element) => el === document.documentElement || el === document.body;

/** Élément le plus profond sous le point, à travers les Shadow DOM ouverts. */
export function profond(x: number, y: number, ignorer: Element): Element | null {
  let el = document.elementFromPoint(x, y);
  if (!el || el === ignorer) return null;
  while (el.shadowRoot) {
    const dedans = el.shadowRoot.elementFromPoint(x, y);
    if (!dedans || dedans === el) break; // l'hôte se renvoie lui-même : sans ce garde, boucle infinie
    el = dedans;
  }
  return el;
}

const memeBoite = (a: DOMRect, b: DOMRect) =>
  Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2 && Math.abs(a.width - b.width) < 2 && Math.abs(a.height - b.height) < 2;

function closestProfond(el: Element, sel: string, niveaux: number): Element | null {
  for (let e: Element | null = el, n = 0; e && n <= niveaux && !estRacine(e); e = parent(e), n++) if (e.matches(sel)) return e;
  return null;
}

/** Remonte de l'élément le plus profond à celui qu'on veut vraiment désigner. */
export function accrocher(el: Element): Element {
  // Morceau de SVG → le SVG entier (le plus externe).
  if (el instanceof SVGElement) {
    let svg: Element = el.closest('svg') ?? el;
    for (let p = svg.parentElement?.closest('svg'); p; p = p.parentElement?.closest('svg')) svg = p;
    el = svg;
  }
  // Un bouton, lien, champ… proche gagne sur son contenu.
  const inter = closestProfond(el, INTERACTIF, 5);
  if (inter && !(inter.tagName === 'LABEL' && inter !== el && inter.querySelector('input,select,textarea'))) el = inter;
  else {
    // Texte en ligne sans boîte à lui → son bloc.
    while (EN_LIGNE.has(el.tagName) && parent(el) && !estRacine(parent(el)!)) el = parent(el)!;
  }
  // Enveloppes de même taille → la plus externe (racine du composant), sauf si l'élément est interactif.
  if (!el.matches(INTERACTIF)) {
    const r = el.getBoundingClientRect();
    for (let p = parent(el); p && !estRacine(p) && memeBoite(p.getBoundingClientRect(), r); p = parent(p)) el = p;
  }
  return el;
}

const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/** ↑ : parent qui change vraiment de boîte. */
export function versParent(el: Element): Element | null {
  const r = el.getBoundingClientRect();
  for (let p = parent(el); p && !estRacine(p); p = parent(p)) if (!memeBoite(p.getBoundingClientRect(), r)) return p;
  return null;
}

/** ↓ : premier enfant visible (en traversant les enveloppes de même taille). */
export function versEnfant(el: Element): Element | null {
  const r = el.getBoundingClientRect();
  let e: Element | undefined = el;
  while (e) {
    const enfants: Element[] = [...(e.shadowRoot?.children ?? []), ...e.children].filter(visible);
    const premier = enfants[0];
    if (!premier) return null;
    if (!memeBoite(premier.getBoundingClientRect(), r)) return premier;
    e = premier;
  }
  return null;
}

/** ← / → : voisin visible. */
export function versVoisin(el: Element, sens: 1 | -1): Element | null {
  for (let s = sens > 0 ? el.nextElementSibling : el.previousElementSibling; s; s = sens > 0 ? s.nextElementSibling : s.previousElementSibling)
    if (visible(s)) return s;
  return null;
}

// --- description ---
const attrTest = (el: Element) => ['data-testid', 'data-test', 'data-cy', 'data-qa'].find((a) => el.hasAttribute(a));
const idStable = (id: string) => !!id && !/\d{3,}|^[:«]|[:]|^radix-|^headlessui-|^mui-|^react-/.test(id);

function texteDe(el: Element) {
  const t = ((el as HTMLElement).innerText ?? el.textContent ?? '').trim().replace(/\s+/g, ' ');
  return t.length > 40 ? t.slice(0, 38) + '…' : t;
}

// Un conteneur se désigne par sa classe, pas par tout le texte qu'il contient.
const feuille = (el: Element) =>
  el.matches(INTERACTIF) || /^H[1-6]$|^(P|LI|TD|TH|DT|DD|FIGCAPTION|LEGEND)$/.test(el.tagName) || [...el.children].every((c) => EN_LIGNE.has(c.tagName));

export function libelle(el: Element) {
  const tag = el.tagName.toLowerCase();
  const test = attrTest(el);
  const role = el.getAttribute('role');
  let s = test ? `${tag}[${el.getAttribute(test)}]` : role && role !== tag ? `${tag}[role=${role}]` : tag;
  const nom =
    el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('title') ||
    el.getAttribute('placeholder') || (el as HTMLInputElement).labels?.[0]?.innerText.trim() ||
    (feuille(el) ? texteDe(el) : '');
  if (nom) s += ` "${nom}"`;
  else if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/)[0];
  return s;
}

function composants(el: Element): string[] {
  el.dispatchEvent(new CustomEvent('designer-feedback:composants', { bubbles: true, composed: true }));
  const v = el.getAttribute('data-wf-composants');
  el.removeAttribute('data-wf-composants');
  return v ? v.split('|') : [];
}

export function fil(el: Element) {
  let haut = composants(el).slice(0, 3).reverse();
  if (!haut.length) {
    // Pas de framework lisible : on cite les repères qui l'entourent.
    for (let p = parent(el); p && haut.length < 2 && !estRacine(p); p = parent(p))
      if (p.tagName.includes('-')) haut.unshift(p.tagName.toLowerCase());
      else if (p.matches(REPERES) || attrTest(p) || (p.id && idStable(p.id))) haut.unshift(p.id && idStable(p.id) ? `#${p.id}` : libelle(p).split(' "')[0]!);
  }
  return [...haut, libelle(el)].join(' › ');
}

// --- sélecteur ---
function segment(el: Element, racine: Document | ShadowRoot): string {
  const parts: string[] = [];
  for (let e: Element | null = el; e && e !== document.documentElement && e.parentNode; e = e.parentElement) {
    const test = attrTest(e);
    let p: string;
    if (e.id && idStable(e.id)) p = `#${CSS.escape(e.id)}`;
    else if (test) p = `[${test}="${CSS.escape(e.getAttribute(test)!)}"]`;
    else {
      p = e.tagName.toLowerCase();
      const freres = e.parentElement ? [...e.parentElement.children].filter((f) => f.tagName === e!.tagName) : [];
      if (freres.length > 1) p += `:nth-of-type(${freres.indexOf(e) + 1})`;
    }
    parts.unshift(p);
    const s = parts.join(' > ');
    try {
      if (racine.querySelectorAll(s).length === 1) return s;
    } catch { /* sélecteur invalide : on continue à remonter */ }
    if (!e.parentElement) break; // haut d'un Shadow DOM
  }
  return parts.join(' > ');
}

export function selecteur(el: Element): string {
  const segs: string[] = [];
  for (let e: Element | null = el; e; ) {
    const racine = e.getRootNode() as Document | ShadowRoot;
    segs.unshift(segment(e, racine));
    e = racine instanceof ShadowRoot ? racine.host : null;
  }
  return segs.join(' >>> ');
}

export function resoudre(info: InfoElement): Element | null {
  let racine: Document | ShadowRoot | null = document;
  let el: Element | null = null;
  for (const seg of info.selecteur.split(' >>> ')) {
    try { el = racine?.querySelector(seg) ?? null; } catch { el = null; }
    racine = el?.shadowRoot ?? null;
  }
  if (el) return el;
  // Secours : même balise, même texte.
  if (!info.texte) return null;
  return [...document.querySelectorAll(info.tag)].find((e) => texteDe(e) === info.texte) ?? null;
}

export const rectDe = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, l: r.width, h: r.height };
};

export function decrire(el: Element): InfoElement {
  return { selecteur: selecteur(el), fil: fil(el), tag: el.tagName.toLowerCase(), texte: texteDe(el) || undefined, rect: rectDe(el) };
}

/** Le focus est-il dans un champ de saisie (page ou Shadow DOM) ? */
export function enSaisie(e: Event) {
  const t = e.composedPath()[0] as HTMLElement | undefined;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}
