// Review : tableau façon base Notion. Édition sur place, glisser-déposer,
// sélection multiple (statut, fusion, copie, suppression), panneau de détail.
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown, ClipboardCopy, ExternalLink, GripVertical, Merge, PanelRightOpen, Plus, Search, Split, Trash2, X,
} from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useEffect, useMemo, useState } from 'react';
import {
  BoutonsExport, copierAvecToast, hoteEtChemin, Image, Marque, quand, StatutBadge, Toaster, toast, useFeedbacks, useSessions,
} from '@/components/shared';
import { Confirmer, useDialoguesSession } from '@/components/sessions';
import { Button } from '@/components/ui/button';
import { DialogTitle, SheetContent } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input, Textarea } from '@/components/ui/input';
import { Checkbox, Kbd, TooltipProvider } from '@/components/ui/misc';
import { copierImage, corpsDe, dateFr, titreDe } from '@/lib/export';
import { envoyer } from '@/lib/messages';
import { combo } from '@/lib/plateforme';
import {
  changerStatut, choisirSession, deplacer, detacher, fusionner, majFeedback, renommerSession, retirerPiece, supprimerFeedbacks,
} from '@/lib/store';
import { STATUTS, type Feedback, type Piece, type Session, type Statut } from '@/lib/types';
import { cn } from '@/lib/utils';

const COLONNES = 'grid grid-cols-[20px_20px_28px_104px_minmax(0,1fr)_minmax(0,220px)_96px_64px] items-start gap-x-3';
type FiltreStatut = 'tous' | Statut;

const localiser = (p?: Piece) => p && envoyer({ t: 'localiser', url: p.page.url, element: p.element });
const cleDePage = (f: Feedback) => {
  const { hote, chemin } = hoteEtChemin(f.pieces[0]?.page.url ?? '');
  return hote + chemin;
};

export default function App() {
  const { sessions, courante } = useSessions();
  const fbs = useFeedbacks(courante?.id);
  const { ouvrir, rendu } = useDialoguesSession(courante);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<string | null>(() => location.hash.slice(1) || null);
  const [statut, setStatut] = useState<FiltreStatut>('tous');
  const [page, setPage] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [confirmer, setConfirmer] = useState(false);

  // Changer de session remet les filtres à zéro.
  useEffect(() => (setSelection(new Set()), setPage(null), setStatut('tous')), [courante?.id]);
  useEffect(() => {
    history.replaceState(null, '', detail ? `#${detail}` : location.pathname);
  }, [detail]);
  useEffect(() => {
    document.title = courante ? `${courante.nom} — Designer Feedback` : 'Review — Designer Feedback';
  }, [courante?.nom]);

  const pages = useMemo(() => [...new Set(fbs.map(cleDePage))], [fbs]);
  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return fbs.filter(
      (f) =>
        (statut === 'tous' || f.statut === statut) &&
        (!page || cleDePage(f) === page) &&
        (!q || f.commentaire.toLowerCase().includes(q) || f.pieces.some((p) => p.page.url.toLowerCase().includes(q))),
    );
  }, [fbs, statut, page, recherche]);
  const choisis = fbs.filter((f) => selection.has(f.id));
  const numero = (f: Feedback) => fbs.indexOf(f) + 1;

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t.tagName) || document.querySelector('[role=dialog]')) return;
      if (e.key === 'Escape') setSelection(new Set());
      if ((e.key === 'Backspace' || e.key === 'Delete') && selection.size) setConfirmer(true);
      if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSelection(new Set(visibles.map((f) => f.id)));
      }
    };
    addEventListener('keydown', surTouche);
    return () => removeEventListener('keydown', surTouche);
  }, [selection, visibles]);

  const capteurs = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const finGlisser = (e: DragEndEvent) => {
    if (courante && e.over && e.active.id !== e.over.id) deplacer(courante.id, String(e.active.id), String(e.over.id));
  };

  const basculerSel = (id: string, v: boolean) =>
    setSelection((s) => {
      const n = new Set(s);
      v ? n.add(id) : n.delete(id);
      return n;
    });
  const toutCoche = visibles.length > 0 && visibles.every((f) => selection.has(f.id));
  const aTraiter = fbs.filter((f) => f.statut === 'a-traiter').length;
  const enDetail = fbs.find((f) => f.id === detail);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen">
        <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
          <Marque className="px-4 py-4" />
          <div className="flex items-center justify-between px-4 pt-2 pb-1">
            <span className="text-xs font-medium text-muted-foreground">Sessions</span>
            <Button variant="ghost" size="icon-xs" title="Nouvelle session" onClick={() => ouvrir('nouvelle')}>
              <Plus />
            </Button>
          </div>
          <nav className="grid gap-0.5 overflow-y-auto px-2 pb-4">
            {[...sessions].reverse().map((s) => (
              <LienSession key={s.id} s={s} active={s.id === courante?.id} />
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto">
          {!courante ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              <div className="grid justify-items-center gap-3">
                Aucune session.
                <Button size="sm" onClick={() => ouvrir('nouvelle')}>
                  <Plus />
                  Créer une session
                </Button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-6xl px-8 pt-10 pb-28">
              <header className="flex items-end justify-between gap-6">
                <div className="grid min-w-0 flex-1 gap-1">
                  <TitreEditable session={courante} />
                  <p className="px-1 text-sm text-muted-foreground">
                    Créée le {dateFr(courante.creee)} · {fbs.length} feedback{fbs.length > 1 ? 's' : ''}
                    {fbs.length > 0 && ` · ${aTraiter} à traiter`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <BoutonsExport session={courante} feedbacks={visibles} />
                  <Button variant="ghost" size="icon-sm" title="Supprimer la session" onClick={() => ouvrir('supprimer')}>
                    <Trash2 />
                  </Button>
                </div>
              </header>

              <div className="mt-8 flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border bg-card p-0.5">
                  {(['tous', 'a-traiter', 'traite'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatut(s)}
                      className={cn('h-7 rounded-md px-2.5 text-sm text-muted-foreground transition-colors', statut === s && 'bg-muted font-medium text-foreground')}
                    >
                      {s === 'tous' ? 'Tous' : STATUTS[s]}
                    </button>
                  ))}
                </div>
                {pages.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className={cn('max-w-72', page && 'border-azur/50 text-foreground')}>
                        <span className="truncate">{page ?? 'Toutes les pages'}</span>
                        <ChevronDown className="text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-w-md">
                      <DropdownMenuItem onSelect={() => setPage(null)}>Toutes les pages</DropdownMenuItem>
                      {pages.map((p) => (
                        <DropdownMenuItem key={p} onSelect={() => setPage(p)}>
                          <span className="truncate">{p}</span>
                          <span className="ml-auto pl-3 text-xs text-muted-foreground tabular-nums">{fbs.filter((f) => cleDePage(f) === p).length}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <div className="relative ml-auto w-64">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher" className="h-8 pl-8" />
                </div>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border bg-card">
                <div className={cn(COLONNES, 'border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground')}>
                  <span />
                  <Checkbox
                    checked={toutCoche}
                    onCheckedChange={(v) => setSelection(v ? new Set(visibles.map((f) => f.id)) : new Set())}
                    aria-label="Tout sélectionner"
                    className="mt-px"
                  />
                  <span>#</span>
                  <span>Aperçu</span>
                  <span>Feedback</span>
                  <span>Page</span>
                  <span>Statut</span>
                  <span className="text-right">Date</span>
                </div>
                {visibles.length === 0 ? (
                  <p className="px-6 py-14 text-center text-sm text-muted-foreground">
                    {fbs.length ? 'Aucun feedback ne correspond aux filtres.' : 'Cette session est vide. Active le mode feedback sur une page depuis le panneau pour commencer.'}
                  </p>
                ) : (
                  <DndContext sensors={capteurs} collisionDetection={closestCenter} onDragEnd={finGlisser}>
                    <SortableContext items={visibles.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                      {visibles.map((f) => (
                        <Ligne
                          key={f.id}
                          f={f}
                          n={numero(f)}
                          session={courante}
                          coche={selection.has(f.id)}
                          cocher={(v) => basculerSel(f.id, v)}
                          ouvrir={() => setDetail(f.id)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {courante && selection.size > 0 && (
        <BarreSelection
          session={courante}
          choisis={choisis}
          vider={() => setSelection(new Set())}
          supprimer={() => setConfirmer(true)}
        />
      )}

      <DialogPrimitive.Root open={!!enDetail} onOpenChange={(o) => !o && setDetail(null)}>
        {enDetail && courante && <Detail f={enDetail} n={numero(enDetail)} session={courante} />}
      </DialogPrimitive.Root>

      <Confirmer
        ouvert={confirmer}
        titre={`Supprimer ${selection.size} feedback${selection.size > 1 ? 's' : ''} ?`}
        texte="Les commentaires et leurs captures seront définitivement effacés."
        onClose={() => setConfirmer(false)}
        onValider={() => {
          if (courante) supprimerFeedbacks(courante.id, [...selection]);
          setSelection(new Set());
        }}
      />
      {rendu}
      <Toaster />
    </TooltipProvider>
  );
}

function LienSession({ s, active }: { s: Session; active: boolean }) {
  const n = useFeedbacks(s.id).length;
  return (
    <button
      type="button"
      onClick={() => choisirSession(s.id)}
      className={cn(
        'flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        active && 'bg-muted font-medium text-foreground',
      )}
    >
      <span className="flex-1 truncate">{s.nom}</span>
      <span className="text-xs tabular-nums opacity-70">{n}</span>
    </button>
  );
}

function TitreEditable({ session }: { session: Session }) {
  const [nom, setNom] = useState(session.nom);
  useEffect(() => setNom(session.nom), [session.nom]);
  const valider = () => (nom.trim() && nom !== session.nom ? renommerSession(session.id, nom.trim()) : setNom(session.nom));
  return (
    <input
      value={nom}
      onChange={(e) => setNom(e.target.value)}
      onBlur={valider}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      aria-label="Nom de la session"
      className="w-full rounded-md bg-transparent px-1 text-3xl font-semibold tracking-tight outline-none hover:bg-muted/60 focus:bg-muted/60"
    />
  );
}

function CommentaireEditable({ f, session, className }: { f: Feedback; session: Session; className?: string }) {
  const [edition, setEdition] = useState(false);
  const [texte, setTexte] = useState(f.commentaire);
  useEffect(() => setTexte(f.commentaire), [f.commentaire]);
  const valider = () => {
    setEdition(false);
    if (texte !== f.commentaire) majFeedback(session.id, f.id, { commentaire: texte });
  };
  if (edition)
    return (
      <Textarea
        autoFocus
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        onBlur={valider}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') (setTexte(f.commentaire), setEdition(false));
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.blur();
        }}
        className={cn('-mx-2 -my-1.5 w-[calc(100%+1rem)] px-2 py-1.5', className)}
      />
    );
  const corps = corpsDe(f);
  return (
    <div
      role="textbox"
      tabIndex={0}
      title="Cliquer pour modifier"
      onClick={(e) => (e.stopPropagation(), setEdition(true))}
      onKeyDown={(e) => e.key === 'Enter' && setEdition(true)}
      className={cn('-mx-2 -my-1.5 cursor-text rounded-md px-2 py-1.5 hover:bg-muted/70', className)}
    >
      <p className={cn('text-sm font-medium', !f.commentaire.trim() && 'font-normal text-muted-foreground italic')}>
        {f.commentaire.trim() ? titreDe(f) : 'Ajouter un commentaire…'}
      </p>
      {corps && <p className="mt-0.5 line-clamp-3 text-sm whitespace-pre-line text-muted-foreground">{corps}</p>}
    </div>
  );
}

function Ligne({
  f, n, session, coche, cocher, ouvrir,
}: { f: Feedback; n: number; session: Session; coche: boolean; cocher: (v: boolean) => void; ouvrir: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: f.id });
  const page = f.pieces[0]?.page;
  const { hote, chemin } = hoteEtChemin(page?.url ?? '');
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform && { ...transform, x: 0 }), transition }}
      onClick={ouvrir}
      className={cn(
        COLONNES,
        'group relative cursor-default border-b bg-card px-3 py-3 last:border-b-0 hover:bg-muted/30',
        coche && 'bg-azur/[0.04] hover:bg-azur/[0.06]',
        isDragging && 'z-10 shadow-lg ring-1 ring-border',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        type="button"
        onClick={(e) => e.stopPropagation()}
        title="Glisser pour réordonner"
        className="mt-0.5 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <Checkbox checked={coche} onCheckedChange={(v) => cocher(!!v)} onClick={(e) => e.stopPropagation()} className="mt-0.5" aria-label={`Sélectionner ${n}`} />
      <span className="pt-px text-sm text-muted-foreground tabular-nums">{n}</span>
      <div className="relative">
        {f.pieces[0] && <Image id={f.pieces[0].image} className="h-16 w-[104px] rounded-md border object-cover object-top" />}
        {f.pieces.length > 1 && (
          <span className="absolute right-1 bottom-1 rounded bg-foreground/80 px-1 text-[10px] font-semibold text-background tabular-nums">
            {f.pieces.length}
          </span>
        )}
      </div>
      <div className="relative min-w-0">
        <CommentaireEditable f={f} session={session} />
        <Button
          size="xs"
          variant="outline"
          onClick={(e) => (e.stopPropagation(), ouvrir())}
          className="absolute -top-1 right-0 hidden bg-card text-muted-foreground shadow-xs group-hover:inline-flex"
        >
          <PanelRightOpen />
          Ouvrir
        </Button>
      </div>
      <button
        type="button"
        onClick={(e) => (e.stopPropagation(), localiser(f.pieces.find((p) => p.element) ?? f.pieces[0]))}
        className="grid min-w-0 rounded-md text-left text-sm"
        title={`Voir sur la page — ${page?.url}`}
      >
        <span className="truncate text-foreground hover:text-azur hover:underline">{page?.titre || hote}</span>
        <span className="truncate text-xs text-muted-foreground">
          {hote}
          {chemin}
        </span>
      </button>
      <div onClick={(e) => e.stopPropagation()}>
        <StatutBadge statut={f.statut} onChange={(s) => changerStatut(session.id, [f.id], s)} />
      </div>
      <span className="pt-px text-right text-sm text-muted-foreground tabular-nums">{quand(f.cree)}</span>
    </div>
  );
}

function BarreSelection({ session, choisis, vider, supprimer }: { session: Session; choisis: Feedback[]; vider: () => void; supprimer: () => void }) {
  const ids = choisis.map((f) => f.id);
  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 animate-in items-center gap-1 rounded-xl border bg-card p-1.5 shadow-xl fade-in-0 slide-in-from-bottom-2">
      <span className="px-2.5 text-sm font-medium tabular-nums">
        {choisis.length} sélectionné{choisis.length > 1 ? 's' : ''}
      </span>
      <div className="mx-1 h-5 w-px bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost">
            Statut
            <ChevronDown className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {(Object.keys(STATUTS) as Statut[]).map((s) => (
            <DropdownMenuItem key={s} onSelect={() => changerStatut(session.id, ids, s)}>
              <StatutBadge statut={s} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        size="sm"
        variant="ghost"
        disabled={choisis.length < 2}
        title="Regrouper en un seul feedback"
        onClick={() => fusionner(session.id, ids).then(() => (vider(), toast(`${choisis.length} feedbacks fusionnés`)))}
      >
        <Merge />
        Fusionner
      </Button>
      <Button size="sm" variant="ghost" onClick={() => copierAvecToast(session, choisis)}>
        <ClipboardCopy />
        Copier
      </Button>
      <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={supprimer}>
        <Trash2 />
        Supprimer
        <Kbd className="ml-0.5">{combo('suppr')}</Kbd>
      </Button>
      <div className="mx-1 h-5 w-px bg-border" />
      <Button size="icon-sm" variant="ghost" title="Désélectionner (Esc)" onClick={vider}>
        <X />
      </Button>
    </div>
  );
}

function Detail({ f, n, session }: { f: Feedback; n: number; session: Session }) {
  const [texte, setTexte] = useState(f.commentaire);
  useEffect(() => setTexte(f.commentaire), [f.id, f.commentaire]);
  const page = f.pieces[0]?.page;
  return (
    <SheetContent aria-describedby={undefined} onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-2xl">
      <div className="grid gap-3 border-b px-6 pt-6 pb-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">Feedback n°{n}</span>
          <span>·</span>
          <span>{new Date(f.cree).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        </div>
        <DialogTitle className="pr-8 text-xl font-semibold tracking-tight">{titreDe(f)}</DialogTitle>
        <div className="flex items-center gap-3">
          <StatutBadge statut={f.statut} onChange={(s) => changerStatut(session.id, [f.id], s)} />
          {page && (
            <a href={page.url} target="_blank" rel="noreferrer" className="truncate text-sm text-azur hover:underline">
              {page.titre || page.url}
            </a>
          )}
          <Button size="xs" variant="outline" className="ml-auto" onClick={() => copierAvecToast(session, [f], false)}>
            <ClipboardCopy />
            Copier
          </Button>
        </div>
      </div>
      <div className="grid flex-1 content-start gap-6 overflow-y-auto px-6 py-5">
        <Textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onBlur={() => texte !== f.commentaire && majFeedback(session.id, f.id, { commentaire: texte })}
          placeholder="Commentaire — la première ligne sert de titre"
          className="min-h-28"
        />
        {f.pieces.map((p, j) => (
          <figure key={p.id} className="grid gap-2">
            <div className="overflow-hidden rounded-lg border bg-muted">
              <Image id={p.image} className="mx-auto max-h-[60vh] w-auto object-contain" style={{ maxWidth: Math.round(p.l / p.viewport.dpr) }} />
            </div>
            <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {j + 1}. {p.type === 'dom' ? 'Élément' : p.type === 'zone' ? 'Zone' : 'Écran visible'}
              </span>
              {p.element && <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">{p.element.fil}</code>}
              <span>
                {p.viewport.l}×{p.viewport.h}
              </span>
              {p.page.url !== page?.url && <span className="truncate">{p.page.url}</span>}
              <span className="ml-auto flex gap-1">
                <Button size="xs" variant="ghost" onClick={() => copierImage(p).then(() => toast('Image copiée'))}>
                  <ClipboardCopy />
                  Image
                </Button>
                <Button size="xs" variant="ghost" onClick={() => localiser(p)}>
                  <ExternalLink />
                  Voir
                </Button>
                {f.pieces.length > 1 && (
                  <>
                    <Button size="xs" variant="ghost" title="En faire un feedback à part" onClick={() => detacher(session.id, f.id, p.id)}>
                      <Split />
                      Détacher
                    </Button>
                    <Button size="xs" variant="ghost" title="Retirer cette pièce" className="hover:text-destructive" onClick={() => retirerPiece(session.id, f.id, p.id)}>
                      <Trash2 />
                    </Button>
                  </>
                )}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </SheetContent>
  );
}
