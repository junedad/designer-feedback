// Service worker : raccourcis globaux, mode par onglet, captures (captureVisibleTab
// + recadrage OffscreenCanvas), et toutes les écritures venant du content script.
import type { ReponseCapture, VersBackground, VersContent } from '@/lib/messages';
import {
  ecrireImage, enDataUrl, lire, lireImage, majFeedback, modifier, retirerPiece,
  sessionCourante, supprimerFeedbacks, uid,
} from '@/lib/store';
import { lireRaccourcis } from '@/lib/plateforme';
import type { Feedback, Piece, Rect } from '@/lib/types';

const AZUR = '#3377FF';
const MARGE = 16; // px CSS de contexte autour d'un élément sélectionné

export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.commands.onCommand.addListener(async (cmd, tab) => {
    if (!tab?.id) return;
    if (cmd === 'basculer-mode') await basculer(tab.id);
    if (cmd === 'capture-zone') await versOnglet(tab.id, { t: 'zone' });
    if (cmd === 'capture-element') await versOnglet(tab.id, { t: 'element' });
  });

  chrome.runtime.onMessage.addListener((m: VersBackground, sender, repondre) => {
    traiter(m, sender).then(repondre, (e) => repondre({ erreur: String(e?.message ?? e) }));
    return true;
  });

  chrome.tabs.onRemoved.addListener((id) => chrome.storage.session.remove(`mode:${id}`));
});

async function traiter(m: VersBackground, sender: chrome.runtime.MessageSender): Promise<unknown> {
  const tabId = sender.tab?.id;
  switch (m.t) {
    case 'etat': {
      const actif = tabId ? await estActif(tabId) : false;
      if (tabId && actif) await chrome.action.setBadgeText({ tabId, text: 'ON' }); // le badge saute à la navigation
      return { actif, raccourcis: lireRaccourcis(await chrome.commands.getAll()) };
    }
    case 'basculer': {
      const id = m.tabId ?? tabId;
      return id ? basculer(id, m.actif) : null;
    }
    case 'capturer':
      return capturer(m, sender.tab!);
    case 'image': {
      const b = await lireImage(m.id);
      return b ? enDataUrl(b) : null;
    }
    case 'majCommentaire': {
      const s = await sessionCourante();
      return s && majFeedback(s.id, m.feedbackId, { commentaire: m.commentaire }).then(() => true);
    }
    case 'supprimerFeedback': {
      const s = await sessionCourante();
      return s && supprimerFeedbacks(s.id, [m.feedbackId]).then(() => true);
    }
    case 'retirerPiece': {
      const s = await sessionCourante();
      return s && retirerPiece(s.id, m.feedbackId, m.pieceId).then(() => true);
    }
    case 'localiser':
      return localiser(m.url, m.element);
  }
}

// --- mode par onglet ---
const estActif = async (tabId: number) => !!(await chrome.storage.session.get(`mode:${tabId}`))[`mode:${tabId}`];

async function basculer(tabId: number, actif?: boolean) {
  const etat = actif ?? !(await estActif(tabId));
  await chrome.storage.session.set({ [`mode:${tabId}`]: etat });
  await chrome.action.setBadgeText({ tabId, text: etat ? 'ON' : '' });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: AZUR });
  await versOnglet(tabId, { t: 'mode', actif: etat }).catch(() => {}); // pages chrome:// : rien à faire
  return etat;
}

/** Envoie au content script, en l'injectant d'abord s'il manque (onglet ouvert avant l'installation). */
async function versOnglet(tabId: number, m: VersContent) {
  try {
    return await chrome.tabs.sendMessage(tabId, m);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content-scripts/react-main.js'], world: 'MAIN' });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content-scripts/content.js'] });
    return chrome.tabs.sendMessage(tabId, m);
  }
}

// --- capture ---
async function captureVisible(windowId: number): Promise<string> {
  try {
    return await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  } catch (e) {
    // Quota Chrome : 2 captures par seconde.
    if (!String(e).includes('MAX_CAPTURE')) throw e;
    await new Promise((r) => setTimeout(r, 600));
    return chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  }
}

async function recadrer(dataUrl: string, viewportL: number, rect?: Rect, element?: Rect) {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const k = bitmap.width / viewportL; // pixels réels par pixel CSS (dpr × zoom)
  let zone: Rect = rect ?? { x: 0, y: 0, l: viewportL, h: bitmap.height / k };
  if (element) zone = { x: zone.x - MARGE, y: zone.y - MARGE, l: zone.l + 2 * MARGE, h: zone.h + 2 * MARGE };
  const x = Math.max(0, Math.round(zone.x * k));
  const y = Math.max(0, Math.round(zone.y * k));
  const l = Math.max(1, Math.min(bitmap.width - x, Math.round((zone.x * k - x) + zone.l * k)));
  const h = Math.max(1, Math.min(bitmap.height - y, Math.round((zone.y * k - y) + zone.h * k)));
  const canvas = new OffscreenCanvas(l, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, x, y, l, h, 0, 0, l, h);
  if (element) {
    ctx.strokeStyle = AZUR;
    ctx.lineWidth = 2 * k;
    ctx.strokeRect(element.x * k - x - k, element.y * k - y - k, element.l * k + 2 * k, element.h * k + 2 * k);
  }
  return { blob: await canvas.convertToBlob({ type: 'image/png' }), l, h };
}

async function capturer(m: Extract<VersBackground, { t: 'capturer' }>, tab: chrome.tabs.Tab): Promise<ReponseCapture> {
  const brut = await captureVisible(tab.windowId);
  const { blob, l, h } = await recadrer(brut, m.viewport.l, m.rect, m.type === 'dom' ? m.element?.rect : undefined);
  const piece: Piece = {
    id: uid(), type: m.type, image: uid(), l, h,
    page: m.page, viewport: m.viewport, element: m.element, prise: Date.now(),
  };
  await ecrireImage(piece.image, blob);

  const s = await sessionCourante(true);
  const cible = m.ajouterA === 'dernier' ? await lire<string | null>('dernier', null) : m.ajouterA;
  let feedback: Feedback | undefined;
  let nouveau = false;
  await modifier(s.id, (liste) => {
    const existant = liste.find((f) => f.id === cible);
    if (existant) {
      feedback = { ...existant, pieces: [...existant.pieces, piece], modifie: Date.now() };
      return liste.map((f) => (f === existant ? feedback! : f));
    }
    nouveau = true;
    feedback = { id: uid(), commentaire: '', statut: 'a-traiter', cree: Date.now(), modifie: Date.now(), pieces: [piece] };
    return [...liste, feedback];
  });
  await chrome.storage.local.set({ dernier: feedback!.id });
  return { feedback: feedback!, nouveau, apercu: await enDataUrl(blob) };
}

// --- retrouver un élément ---
const sansAncre = (u: string) => u.split('#')[0];

async function localiser(url: string, element?: Piece['element']) {
  const [existant] = (await chrome.tabs.query({})).filter((t) => t.url && sansAncre(t.url) === sansAncre(url));
  const tab = existant
    ? await chrome.tabs.update(existant.id!, { active: true })
    : await chrome.tabs.create({ url });
  if (existant?.windowId) await chrome.windows.update(existant.windowId, { focused: true });
  if (!tab?.id || !element) return true;
  await attendreChargement(tab.id);
  // Les SPA rendent après `complete` : quelques essais espacés.
  for (let essai = 0; essai < 8; essai++) {
    const trouve = await versOnglet(tab.id, { t: 'localiser', element }).catch(() => false);
    if (trouve) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function attendreChargement(tabId: number) {
  return new Promise<void>((ok) => {
    const verifier = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === 'complete') fin();
    };
    const fin = () => (chrome.tabs.onUpdated.removeListener(verifier), ok());
    chrome.tabs.onUpdated.addListener(verifier);
    chrome.tabs.get(tabId).then((t) => t.status === 'complete' && fin());
  });
}
