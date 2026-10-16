// macOS vs Windows / Linux : libellés des touches et gestes qui n'existent que sur Mac.
// Sur Windows / Linux, Alt seul active le menu de Chrome et Alt+clic déplace la fenêtre
// sous plusieurs bureaux Linux : « tenir ⌥ pour viser » n'y est donc pas proposé,
// le raccourci global « Sélectionner un élément » (Alt+Shift+E) le remplace.
const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
export const MAC = /mac|iphone|ipad/i.test(nav.userAgentData?.platform || navigator.platform);

const SYMBOLES = MAC
  ? { mod: '⌘', maj: '⇧', alt: '⌥', entree: '↵', suppr: '⌫' }
  : { mod: 'Ctrl', maj: 'Maj', alt: 'Alt', entree: 'Entrée', suppr: 'Suppr' };

/** `combo('mod', 'entree')` → `⌘↵` sur Mac, `Ctrl+Entrée` ailleurs. */
export const combo = (...touches: (keyof typeof SYMBOLES)[]) => touches.map((t) => SYMBOLES[t]).join(MAC ? '' : '+');

/** Raccourcis globaux tels qu'assignés (l'utilisateur peut les changer dans chrome://extensions/shortcuts). */
export interface Raccourcis {
  panneau: string;
  basculer: string;
  zone: string;
  element: string;
}

export const DEFAUTS: Raccourcis = MAC
  ? { panneau: '⌥⇧P', basculer: '⌥⇧F', zone: '⌥⇧S', element: '⌥⇧E' }
  : { panneau: 'Alt+Maj+P', basculer: 'Alt+Maj+F', zone: 'Alt+Maj+S', element: 'Alt+Maj+E' };

/** Chrome renvoie `Alt+Shift+F` hors Mac : on francise la touche Maj. */
const franciser = (s: string) => s.replace(/Shift/g, 'Maj');

export function lireRaccourcis(commandes: chrome.commands.Command[]): Raccourcis {
  const de = (nom: string, defaut: string) => {
    const c = commandes.find((x) => x.name === nom);
    return c ? franciser(c.shortcut ?? '') : defaut;
  };
  return {
    panneau: de('_execute_action', DEFAUTS.panneau),
    basculer: de('basculer-mode', DEFAUTS.basculer),
    zone: de('capture-zone', DEFAUTS.zone),
    element: de('capture-element', DEFAUTS.element),
  };
}
