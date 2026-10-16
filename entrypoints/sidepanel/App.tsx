// Side panel : la « maison » du plugin. Session active, mode sur l'onglet,
// aperçu des feedbacks (d'où l'on copie), export, accès à la review.
import { ClipboardCopy, Crosshair, ExternalLink, Image as ImageIcon, MousePointer2, SquareDashed, Table2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  BoutonsExport, copierAvecToast, hoteEtChemin, Image, Marque, quand, StatutBadge, Toaster, toast, useFeedbacks, useSessions,
} from '@/components/shared';
import { Confirmer, SelecteurSession, useDialoguesSession } from '@/components/sessions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Kbd, Switch, Tip, TooltipProvider } from '@/components/ui/misc';
import { copierImage, titreDe } from '@/lib/export';
import { envoyer } from '@/lib/messages';
import { combo, DEFAUTS, lireRaccourcis, MAC } from '@/lib/plateforme';
import { changerStatut, majFeedback, supprimerFeedbacks } from '@/lib/store';
import type { Feedback, Session } from '@/lib/types';
import { cn } from '@/lib/utils';

const ouvrirReview = (fid?: string) => chrome.tabs.create({ url: chrome.runtime.getURL(`/review.html${fid ? `#${fid}` : ''}`) });

function useOngletActif() {
  const [onglet, setOnglet] = useState<{ id?: number; url?: string; actif: boolean }>({ actif: false });
  useEffect(() => {
    const maj = async () => {
      const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!t?.id) return;
      const cle = `mode:${t.id}`;
      setOnglet({ id: t.id, url: t.url, actif: !!(await chrome.storage.session.get(cle))[cle] });
    };
    maj();
    const surMaj = (_: number, info: { url?: string }) => info.url && maj();
    const surStockage = (_: unknown, aire: string) => aire === 'session' && maj();
    chrome.tabs.onActivated.addListener(maj);
    chrome.tabs.onUpdated.addListener(surMaj);
    chrome.windows.onFocusChanged.addListener(maj);
    chrome.storage.onChanged.addListener(surStockage);
    return () => {
      chrome.tabs.onActivated.removeListener(maj);
      chrome.tabs.onUpdated.removeListener(surMaj);
      chrome.windows.onFocusChanged.removeListener(maj);
      chrome.storage.onChanged.removeListener(surStockage);
    };
  }, []);
  return onglet;
}

function useRaccourcis() {
  const [r, setR] = useState(DEFAUTS);
  useEffect(() => {
    const lire = () => chrome.commands.getAll().then((c) => setR(lireRaccourcis(c)));
    lire();
    // Réassignés dans chrome://extensions/shortcuts : relus au retour sur le panneau.
    addEventListener('focus', lire);
    return () => removeEventListener('focus', lire);
  }, []);
  return r;
}

const pageInterdite = (url?: string) => !url || /^(chrome|edge|about|chrome-extension|devtools|view-source):/.test(url) || url.startsWith('https://chromewebstore.google.com');

export default function App() {
  const { sessions, courante } = useSessions();
  const fbs = useFeedbacks(courante?.id);
  const onglet = useOngletActif();
  const { ouvrir, rendu } = useDialoguesSession(courante);
  const [deplie, setDeplie] = useState<string | null>(null);
  const interdite = pageInterdite(onglet.url);
  const raccourcis = useRaccourcis();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col">
        <header className="flex items-center justify-between border-b bg-card px-3 py-2.5">
          <Marque />
          <Tip label="Ouvrir la review" side="left">
            <Button variant="ghost" size="icon-sm" onClick={() => ouvrirReview()}>
              <Table2 />
            </Button>
          </Tip>
        </header>

        <div className="grid gap-2.5 border-b bg-card px-3 pt-2.5 pb-3">
          <SelecteurSession sessions={sessions} session={courante} ouvrir={ouvrir} />
          <label className={cn('flex items-center justify-between gap-3 rounded-lg border px-3 py-2', onglet.actif && 'border-azur/40 bg-azur/5')}>
            <span className="grid">
              <span className="text-sm font-medium">Mode feedback</span>
              <span className="text-xs text-muted-foreground">{interdite ? 'Indisponible sur cette page' : 'Sur cet onglet'}</span>
            </span>
            <span className="flex items-center gap-2">
              {raccourcis.basculer && <Kbd>{raccourcis.basculer}</Kbd>}
              <Switch
                checked={onglet.actif}
                disabled={interdite}
                onCheckedChange={(v) => onglet.id && envoyer({ t: 'basculer', tabId: onglet.id, actif: v })}
              />
            </span>
          </label>
        </div>

        <main className="flex-1 overflow-y-auto p-3">
          {fbs.length === 0 ? (
            <Vide raccourcis={raccourcis} />
          ) : (
            <ol className="grid gap-2">
              {fbs.map((f, i) => (
                <Carte
                  key={f.id}
                  f={f}
                  n={i + 1}
                  session={courante!}
                  deplie={deplie === f.id}
                  basculer={() => setDeplie(deplie === f.id ? null : f.id)}
                />
              ))}
            </ol>
          )}
        </main>

        {courante && (
          <footer className="border-t bg-card p-3">
            <BoutonsExport session={courante} feedbacks={fbs} compact />
          </footer>
        )}
      </div>
      {rendu}
      <Toaster />
    </TooltipProvider>
  );
}

function Vide({ raccourcis }: { raccourcis: typeof DEFAUTS }) {
  const ligne = (icone: React.ReactNode, texte: string, touches: string[]) => (
    <li className="flex items-center gap-2.5">
      <span className="flex size-7 items-center justify-center rounded-md border bg-card text-muted-foreground">{icone}</span>
      <span className="flex-1">{texte}</span>
      <span className="flex gap-1">{touches.map((t) => <Kbd key={t}>{t}</Kbd>)}</span>
    </li>
  );
  return (
    <div className="grid gap-4 px-1 pt-6">
      <div className="grid gap-1">
        <p className="text-sm font-medium">Aucun feedback pour l’instant</p>
        <p className="text-sm text-muted-foreground">Active le mode sur la page à commenter, puis :</p>
      </div>
      <ul className="grid gap-2 text-sm">
        {ligne(<MousePointer2 className="size-3.5" />, 'Cliquer un élément', ['D'])}
        {ligne(<SquareDashed className="size-3.5" />, 'Tracer une zone', ['Z'])}
        {ligne(<ImageIcon className="size-3.5" />, 'Capturer l’écran', ['V'])}
        {ligne(<Crosshair className="size-3.5" />, 'Ajuster la sélection', ['↑', '↓', '←', '→'])}
      </ul>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Hors mode : {raccourcis.element && <><Kbd>{raccourcis.element}</Kbd> sélectionne un élément, </>}
        {raccourcis.zone && <><Kbd>{raccourcis.zone}</Kbd> capture une zone</>}
        {MAC && <>, <Kbd>⌥</Kbd> tenu vise et <Kbd>⌥</Kbd>+clic sélectionne</>}. <Kbd>{combo('maj')}</Kbd> au moment de capturer ajoute au
        dernier feedback.
      </p>
      <button type="button" className="justify-self-start text-xs text-azur hover:underline" onClick={() => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}>
        Changer les raccourcis
      </button>
    </div>
  );
}

function Carte({ f, n, session, deplie, basculer }: { f: Feedback; n: number; session: Session; deplie: boolean; basculer: () => void }) {
  const page = f.pieces[0]?.page;
  const { hote, chemin } = hoteEtChemin(page?.url ?? '');
  const [texte, setTexte] = useState(f.commentaire);
  const [confirmer, setConfirmer] = useState(false);
  useEffect(() => setTexte(f.commentaire), [f.commentaire]);
  const premiere = f.pieces[0];
  const localiser = () => {
    const p = f.pieces.find((x) => x.element) ?? premiere;
    if (p) envoyer({ t: 'localiser', url: p.page.url, element: p.element });
  };

  return (
    <li className={cn('group rounded-lg border bg-card transition-colors', deplie ? 'border-foreground/15 shadow-sm' : 'hover:border-foreground/15')}>
      <button type="button" className="flex w-full gap-2.5 p-2.5 text-left" onClick={basculer}>
        <div className="relative shrink-0">
          {premiere && <Image id={premiere.image} className="h-12 w-16 rounded-md border object-cover object-top" />}
          {f.pieces.length > 1 && (
            <span className="absolute -right-1.5 -bottom-1.5 rounded-full border bg-card px-1.5 text-[10px] font-semibold tabular-nums">+{f.pieces.length - 1}</span>
          )}
        </div>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="flex gap-1.5 text-sm leading-snug">
            <span className="text-muted-foreground tabular-nums">{n}.</span>
            <span className={cn('font-medium', !deplie && 'line-clamp-2', !f.commentaire.trim() && 'text-muted-foreground italic')}>{titreDe(f)}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground" title={page?.url}>
            {hote}
            <span className="opacity-70">{chemin}</span>
          </p>
          <div className="mt-1 flex items-center gap-2">
            <StatutBadge statut={f.statut} onChange={(s) => changerStatut(session.id, [f.id], s)} />
            <span className="text-xs text-muted-foreground">{quand(f.cree)}</span>
          </div>
        </div>
      </button>

      {deplie && (
        <div className="grid gap-2.5 border-t px-2.5 pt-2.5 pb-2.5">
          <Textarea
            value={texte}
            placeholder="Commentaire — la première ligne sert de titre"
            onChange={(e) => setTexte(e.target.value)}
            onBlur={() => texte !== f.commentaire && majFeedback(session.id, f.id, { commentaire: texte })}
            className="max-h-60 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            {f.pieces.map((p) => (
              <div key={p.id} className="group/img relative overflow-hidden rounded-md border bg-muted">
                <Image id={p.image} className="aspect-[4/3] w-full object-contain" />
                <Button
                  size="icon-xs"
                  variant="outline"
                  title="Copier l’image"
                  className="absolute top-1 right-1 opacity-0 group-hover/img:opacity-100"
                  onClick={() => copierImage(p).then(() => toast('Image copiée'))}
                >
                  <ClipboardCopy />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button size="xs" variant="ghost" onClick={() => copierAvecToast(session, [f], false)}>
              <ClipboardCopy />
              Copier
            </Button>
            <Button size="xs" variant="ghost" onClick={localiser}>
              <ExternalLink />
              Voir sur la page
            </Button>
            <Button size="xs" variant="ghost" onClick={() => ouvrirReview(f.id)}>
              <Table2 />
              Review
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              className="ml-auto text-muted-foreground hover:text-destructive"
              title="Supprimer"
              onClick={() => setConfirmer(true)}
            >
              <Trash2 />
            </Button>
          </div>
          <Confirmer
            ouvert={confirmer}
            titre={`Supprimer le feedback n°${n} ?`}
            texte="Le commentaire et ses captures seront effacés."
            onClose={() => setConfirmer(false)}
            onValider={() => supprimerFeedbacks(session.id, [f.id])}
          />
        </div>
      )}
    </li>
  );
}
