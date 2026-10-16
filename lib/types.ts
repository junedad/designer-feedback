// Modèle de données. Un feedback = un commentaire + 1..N pièces ; une pièce est
// un élément DOM sélectionné, une zone tracée ou l'écran visible, toujours avec
// une image. Les métadonnées vivent dans storage.local, les images dans IndexedDB.

export type Statut = 'a-traiter' | 'traite';
export type TypePiece = 'dom' | 'zone' | 'visible';

export interface Session {
  id: string;
  nom: string;
  creee: number;
}

export interface Rect {
  x: number;
  y: number;
  l: number;
  h: number;
}

export interface InfoElement {
  /** Sélecteur unique ; les frontières de Shadow DOM sont notées ` >>> `. */
  selecteur: string;
  /** Fil d'Ariane lisible : `Card › Header › button "Valider"`. */
  fil: string;
  tag: string;
  texte?: string;
  rect: Rect;
}

export interface Piece {
  id: string;
  type: TypePiece;
  /** Clé de l'image dans IndexedDB. */
  image: string;
  /** Taille de l'image en pixels réels. */
  l: number;
  h: number;
  page: { url: string; titre: string };
  viewport: { l: number; h: number; dpr: number };
  element?: InfoElement;
  prise: number;
}

export interface Feedback {
  id: string;
  commentaire: string;
  statut: Statut;
  cree: number;
  modifie: number;
  pieces: Piece[];
}

export const STATUTS: Record<Statut, string> = {
  'a-traiter': 'À traiter',
  traite: 'Traité',
};
