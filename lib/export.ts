// Exports et copie : Markdown (.zip avec images/), JSON (images en base64),
// HTML riche pour le presse-papier (images intégrées) — c'est ce dernier que
// Notion et Jira interprètent au collage ; le text/plain associé est le Markdown.
import { strToU8, zipSync } from 'fflate';
import { enDataUrl, lireImage } from './store';
import { STATUTS, type Feedback, type Piece, type Session } from './types';

export const titreDe = (f: Feedback) => f.commentaire.trim().split('\n')[0]?.trim() || 'Sans titre';
export const corpsDe = (f: Feedback) => f.commentaire.trim().split('\n').slice(1).join('\n').trim();
export const dateFr = (t: number) => new Date(t).toLocaleDateString('fr-FR');
const n2 = (n: number) => String(n).padStart(2, '0');
const nomImage = (i: number, j: number) => `images/${n2(i + 1)}-${j + 1}.png`;

/** Ligne technique d'une pièce : où et comment elle a été prise. */
export function ligneTechnique(p: Piece, pageDuFeedback?: string) {
  const quoi = p.element?.fil ?? (p.type === 'zone' ? 'Zone' : 'Écran visible');
  const parts: [string, ...string[]] = [quoi, `${p.viewport.l}×${p.viewport.h}`];
  if (pageDuFeedback && p.page.url !== pageDuFeedback) parts.push(p.page.url);
  return parts;
}

function entete(s: Session, fbs: Feedback[]) {
  return `${dateFr(Date.now())} · ${fbs.length} feedback${fbs.length > 1 ? 's' : ''}`;
}

// --- Markdown ---
export function markdown(s: Session, fbs: Feedback[], avecImages = true) {
  const blocs = fbs.map((f, i) => {
    const page = f.pieces[0]?.page;
    const l = [`## ${i + 1}. ${titreDe(f)}`, ''];
    l.push(`**Page** : ${page ? `[${page.titre || page.url}](${page.url})` : '—'} · **Statut** : ${STATUTS[f.statut]}`, '');
    const corps = corpsDe(f);
    if (corps) l.push(corps.replace(/\n/g, '  \n'), '');
    f.pieces.forEach((p, j) => {
      if (avecImages) l.push(`![${i + 1}.${j + 1}](${nomImage(i, j)})`, '');
      const [quoi, ...reste] = ligneTechnique(p, page?.url);
      l.push(['`' + quoi + '`', ...reste].join(' · '), '');
    });
    return l.join('\n');
  });
  return [`# ${s.nom}`, '', entete(s, fbs), '', '---', '', blocs.join('\n---\n\n'), ''].join('\n');
}

// --- HTML pour le presse-papier ---
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export async function html(s: Session, fbs: Feedback[], avecEntete = true) {
  const blocs: string[] = [];
  if (avecEntete) blocs.push(`<h1>${esc(s.nom)}</h1>`, `<p>${esc(entete(s, fbs))}</p>`, '<hr>');
  for (const [i, f] of fbs.entries()) {
    const page = f.pieces[0]?.page;
    blocs.push(`<h2>${avecEntete ? `${i + 1}. ` : ''}${esc(titreDe(f))}</h2>`);
    blocs.push(
      `<p><strong>Page</strong> : ${page ? `<a href="${esc(page.url)}">${esc(page.titre || page.url)}</a>` : '—'} · <strong>Statut</strong> : ${STATUTS[f.statut]}</p>`,
    );
    const corps = corpsDe(f);
    if (corps) blocs.push(`<p>${esc(corps).replace(/\n/g, '<br>')}</p>`);
    for (const p of f.pieces) {
      const blob = await lireImage(p.image);
      if (blob) {
        const largeur = Math.min(720, Math.round(p.l / p.viewport.dpr));
        blocs.push(`<p><img src="${await enDataUrl(blob)}" width="${largeur}" alt=""></p>`);
      }
      const [quoi, ...reste] = ligneTechnique(p, page?.url);
      blocs.push(`<p><code>${esc(quoi)}</code>${reste.map((r) => ` · ${esc(r)}`).join('')}</p>`);
    }
    if (i < fbs.length - 1 || !avecEntete) blocs.push('<hr>');
  }
  return blocs.join('\n');
}

export async function copier(s: Session, fbs: Feedback[], avecEntete = true) {
  const h = await html(s, fbs, avecEntete);
  const t = markdown(s, fbs, false);
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([h], { type: 'text/html' }),
      'text/plain': new Blob([t], { type: 'text/plain' }),
    }),
  ]);
}

export async function copierImage(p: Piece) {
  const blob = await lireImage(p.image);
  if (blob) await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
}

// --- Fichiers ---
const slug = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'session';

function telecharger(blob: Blob, nom: string) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nom });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export async function exporterZip(s: Session, fbs: Feedback[]) {
  const fichiers: Record<string, Uint8Array> = { [`${slug(s.nom)}.md`]: strToU8(markdown(s, fbs)) };
  for (const [i, f] of fbs.entries())
    for (const [j, p] of f.pieces.entries()) {
      const blob = await lireImage(p.image);
      if (blob) fichiers[nomImage(i, j)] = new Uint8Array(await blob.arrayBuffer());
    }
  const zip = zipSync(fichiers, { level: 0 }); // les PNG sont déjà compressés
  telecharger(new Blob([zip as BlobPart], { type: 'application/zip' }), `${slug(s.nom)}.zip`);
}

export async function exporterJson(s: Session, fbs: Feedback[]) {
  const feedbacks = [];
  for (const f of fbs) {
    const pieces = [];
    for (const p of f.pieces) {
      const blob = await lireImage(p.image);
      pieces.push({ ...p, image: blob ? await enDataUrl(blob) : null });
    }
    feedbacks.push({ ...f, titre: titreDe(f), pieces });
  }
  const json = { format: 'designer-feedback/1', exporte: new Date().toISOString(), session: s, feedbacks };
  telecharger(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }), `${slug(s.nom)}.json`);
}
