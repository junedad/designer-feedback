// Messages échangés entre le content script, les pages de l'extension et le background.
import type { Feedback, InfoElement, Piece, Rect, TypePiece } from './types';

export type VersBackground =
  | { t: 'etat' }
  | { t: 'basculer'; tabId?: number; actif?: boolean }
  | {
      t: 'capturer';
      type: TypePiece;
      /** Zone à recadrer, en pixels CSS du viewport (absente pour l'écran visible). */
      rect?: Rect;
      element?: InfoElement;
      page: Piece['page'];
      viewport: Piece['viewport'];
      /** Ajouter au feedback donné, ou au dernier feedback de la session. */
      ajouterA?: string | 'dernier';
    }
  | { t: 'image'; id: string }
  | { t: 'majCommentaire'; feedbackId: string; commentaire: string }
  | { t: 'supprimerFeedback'; feedbackId: string }
  | { t: 'retirerPiece'; feedbackId: string; pieceId: string }
  | { t: 'localiser'; url: string; element?: InfoElement };

export type VersContent =
  | { t: 'mode'; actif: boolean }
  | { t: 'zone' }
  | { t: 'element' }
  | { t: 'localiser'; element?: InfoElement }
  | { t: 'ping' };

export interface ReponseCapture {
  feedback: Feedback;
  nouveau: boolean;
  apercu: string;
}

export const envoyer = <R = unknown>(m: VersBackground) => chrome.runtime.sendMessage(m) as Promise<R>;
