// Gestion des sessions : sélecteur, dialogues nom / confirmation.
import { Check, ChevronsUpDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { choisirSession, creerSession, nomParDefaut, renommerSession, supprimerSession } from '@/lib/store';
import type { Session } from '@/lib/types';
import { useFeedbacks } from './shared';

export function DialogueNom({
  ouvert, titre, initial, action, onClose, onValider,
}: { ouvert: boolean; titre: string; initial: string; action: string; onClose: () => void; onValider: (nom: string) => void }) {
  const [nom, setNom] = useState(initial);
  return (
    <Dialog open={ouvert} onOpenChange={(o) => !o && onClose()}>
      <DialogContent onOpenAutoFocus={() => setNom(initial)}>
        <DialogTitle>{titre}</DialogTitle>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (nom.trim()) onValider(nom.trim());
            onClose();
          }}
        >
          <Input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} onFocus={(e) => e.target.select()} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit">{action}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Confirmer({
  ouvert, titre, texte, action = 'Supprimer', onClose, onValider,
}: { ouvert: boolean; titre: string; texte: string; action?: string; onClose: () => void; onValider: () => void }) {
  return (
    <Dialog open={ouvert} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <div className="grid gap-1.5">
          <DialogTitle>{titre}</DialogTitle>
          <DialogDescription>{texte}</DialogDescription>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="destructive" autoFocus onClick={() => (onValider(), onClose())}>{action}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Dialogue = null | 'nouvelle' | 'renommer' | 'supprimer';

/** Dialogues de session pilotés par un état ; partagés par le panneau et la review. */
export function useDialoguesSession(session: Session | null) {
  const [d, setD] = useState<Dialogue>(null);
  const fbs = useFeedbacks(session?.id);
  const fermer = () => setD(null);
  const rendu = (
    <>
      <DialogueNom ouvert={d === 'nouvelle'} titre="Nouvelle session" initial={nomParDefaut()} action="Créer" onClose={fermer} onValider={(n) => creerSession(n)} />
      <DialogueNom ouvert={d === 'renommer'} titre="Renommer la session" initial={session?.nom ?? ''} action="Renommer" onClose={fermer} onValider={(n) => session && renommerSession(session.id, n)} />
      <Confirmer
        ouvert={d === 'supprimer'}
        titre={`Supprimer « ${session?.nom} » ?`}
        texte={`${fbs.length} feedback${fbs.length > 1 ? 's' : ''} et leurs captures seront définitivement effacés.`}
        onClose={fermer}
        onValider={() => session && supprimerSession(session.id)}
      />
    </>
  );
  return { ouvrir: setD, rendu };
}

function LigneSession({ s, active }: { s: Session; active: boolean }) {
  const n = useFeedbacks(s.id).length;
  return (
    <DropdownMenuItem onSelect={() => choisirSession(s.id)}>
      <Check className={active ? 'opacity-100' : 'opacity-0'} />
      <span className="flex-1 truncate">{s.nom}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{n}</span>
    </DropdownMenuItem>
  );
}

export function SelecteurSession({ sessions, session, ouvrir }: { sessions: Session[]; session: Session | null; ouvrir: (d: Dialogue) => void }) {
  const n = useFeedbacks(session?.id).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between px-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{session?.nom ?? 'Aucune session'}</span>
            {session && <span className="text-xs font-normal text-muted-foreground tabular-nums">{n}</span>}
          </span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]" align="start">
        {sessions.length > 0 && <DropdownMenuLabel>Sessions</DropdownMenuLabel>}
        {[...sessions].reverse().map((s) => (
          <LigneSession key={s.id} s={s} active={s.id === session?.id} />
        ))}
        {sessions.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onSelect={() => ouvrir('nouvelle')}>
          <Plus />
          Nouvelle session
        </DropdownMenuItem>
        {session && (
          <>
            <DropdownMenuItem onSelect={() => ouvrir('renommer')}>
              <Pencil />
              Renommer
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => ouvrir('supprimer')}>
              <Trash2 />
              Supprimer la session
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
