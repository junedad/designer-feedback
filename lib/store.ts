// Accès aux données, partagé par le service worker, le side panel et la review.
// storage.local : `sessions`, `courante`, `dernier`, `fb:<sessionId>` (liste ordonnée).
// IndexedDB (origine de l'extension) : les images, en Blob, par id.
// Le content script n'écrit jamais lui-même : il passe par des messages au background.
import { createStore, del, delMany, get, set } from 'idb-keyval';
import type { Feedback, Piece, Session, Statut } from './types';

const local = chrome.storage.local;
const images = createStore('designer-feedback', 'images');

export const uid = () => crypto.randomUUID().slice(0, 8);
export const cleFb = (sid: string) => `fb:${sid}`;

export async function lire<T>(cle: string, defaut: T): Promise<T> {
  const r = await local.get(cle);
  return (r[cle] as T) ?? defaut;
}

export const listeSessions = () => lire<Session[]>('sessions', []);
export const listeFeedbacks = (sid: string) => lire<Feedback[]>(cleFb(sid), []);
export const ecrireFeedbacks = (sid: string, liste: Feedback[]) => local.set({ [cleFb(sid)]: liste });

export function nomParDefaut() {
  return `Session du ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`;
}

export async function creerSession(nom = nomParDefaut()): Promise<Session> {
  const s: Session = { id: uid(), nom, creee: Date.now() };
  await local.set({ sessions: [...(await listeSessions()), s], courante: s.id, [cleFb(s.id)]: [] });
  return s;
}

export async function sessionCourante(creerSiAbsente: true): Promise<Session>;
export async function sessionCourante(creerSiAbsente?: boolean): Promise<Session | null>;
export async function sessionCourante(creerSiAbsente = false) {
  const [sessions, courante] = await Promise.all([listeSessions(), lire<string | null>('courante', null)]);
  const s = sessions.find((x) => x.id === courante) ?? null;
  return s ?? (creerSiAbsente ? creerSession() : null);
}

export const choisirSession = (id: string) => local.set({ courante: id });

export async function renommerSession(id: string, nom: string) {
  const sessions = await listeSessions();
  await local.set({ sessions: sessions.map((s) => (s.id === id ? { ...s, nom } : s)) });
}

export async function supprimerSession(id: string) {
  const [sessions, fbs, courante] = await Promise.all([listeSessions(), listeFeedbacks(id), lire('courante', null)]);
  await supprimerImages(fbs.flatMap((f) => f.pieces));
  const restantes = sessions.filter((s) => s.id !== id);
  await local.remove(cleFb(id));
  await local.set({ sessions: restantes, courante: courante === id ? (restantes.at(-1)?.id ?? null) : courante });
}

/** Lecture-modification-écriture de la liste d'une session.
 * ponytail: pas de verrou entre contextes (background, panneau, review) — les écritures sont à vitesse humaine ;
 * à revoir si une écriture automatique en rafale apparaît. */
export async function modifier(sid: string, f: (liste: Feedback[]) => Feedback[]) {
  const liste = f(await listeFeedbacks(sid));
  await ecrireFeedbacks(sid, liste);
  return liste;
}

export function majFeedback(sid: string, id: string, champs: Partial<Pick<Feedback, 'commentaire' | 'statut'>>) {
  return modifier(sid, (l) => l.map((f) => (f.id === id ? { ...f, ...champs, modifie: Date.now() } : f)));
}

export const changerStatut = (sid: string, ids: string[], statut: Statut) =>
  modifier(sid, (l) => l.map((f) => (ids.includes(f.id) ? { ...f, statut, modifie: Date.now() } : f)));

export async function supprimerFeedbacks(sid: string, ids: string[]) {
  const liste = await listeFeedbacks(sid);
  await supprimerImages(liste.filter((f) => ids.includes(f.id)).flatMap((f) => f.pieces));
  await ecrireFeedbacks(sid, liste.filter((f) => !ids.includes(f.id)));
}

/** Fusionne dans le premier (ordre de la liste) : pièces mises bout à bout, commentaires concaténés. */
export function fusionner(sid: string, ids: string[]) {
  return modifier(sid, (l) => {
    const choisis = l.filter((f) => ids.includes(f.id));
    if (choisis.length < 2) return l;
    const cible = choisis[0]!;
    const autres = choisis.slice(1);
    const fusion: Feedback = {
      ...cible,
      commentaire: choisis.map((f) => f.commentaire.trim()).filter(Boolean).join('\n\n'),
      pieces: choisis.flatMap((f) => f.pieces),
      modifie: Date.now(),
    };
    return l.filter((f) => !autres.includes(f)).map((f) => (f === cible ? fusion : f));
  });
}

/** Sort une pièce de son feedback pour en faire un nouveau, juste après. */
export function detacher(sid: string, fid: string, pieceId: string) {
  return modifier(sid, (l) => {
    const i = l.findIndex((f) => f.id === fid);
    const f = l[i];
    const piece = f?.pieces.find((p) => p.id === pieceId);
    if (!f || !piece || f.pieces.length < 2) return l;
    const neuf: Feedback = { id: uid(), commentaire: '', statut: f.statut, cree: Date.now(), modifie: Date.now(), pieces: [piece] };
    const reste = { ...f, pieces: f.pieces.filter((p) => p !== piece), modifie: Date.now() };
    return [...l.slice(0, i), reste, neuf, ...l.slice(i + 1)];
  });
}

export async function retirerPiece(sid: string, fid: string, pieceId: string) {
  let retiree: Piece | undefined;
  await modifier(sid, (l) =>
    l.map((f) => {
      if (f.id !== fid) return f;
      retiree = f.pieces.find((p) => p.id === pieceId);
      return { ...f, pieces: f.pieces.filter((p) => p.id !== pieceId), modifie: Date.now() };
    }),
  );
  if (retiree) await supprimerImages([retiree]);
}

export function deplacer(sid: string, id: string, versId: string) {
  return modifier(sid, (l) => {
    const de = l.findIndex((f) => f.id === id);
    const vers = l.findIndex((f) => f.id === versId);
    if (de < 0 || vers < 0) return l;
    const copie = [...l];
    copie.splice(vers, 0, ...copie.splice(de, 1));
    return copie;
  });
}

// --- images ---
export const lireImage = (id: string) => get<Blob>(id, images);
export const ecrireImage = (id: string, blob: Blob) => set(id, blob, images);
export const supprimerImage = (id: string) => del(id, images);
const supprimerImages = (pieces: Piece[]) => delMany(pieces.map((p) => p.image), images);

export async function enDataUrl(blob: Blob): Promise<string> {
  const octets = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < octets.length; i += 0x8000) bin += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return `data:${blob.type || 'image/png'};base64,${btoa(bin)}`;
}
