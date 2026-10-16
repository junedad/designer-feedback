// Briques partagées par le side panel et la review : abonnement au stockage,
// images, logo, statut, menus d'export, toasts.
import { Check, ClipboardCopy, Download, FileJson, FileText } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';
import { copier, exporterJson, exporterZip } from '@/lib/export';
import { LOGO_COULEUR, LOGO_PATHS, LOGO_VIEWBOX } from '@/lib/logo';
import { cleFb, lireImage } from '@/lib/store';
import { STATUTS, type Feedback, type Session, type Statut } from '@/lib/types';
import { cn } from '@/lib/utils';

export function useStockage<T>(cle: string | null, defaut: T): T {
  const [val, setVal] = useState<T>(defaut);
  useEffect(() => {
    if (!cle) return setVal(defaut);
    let vivant = true;
    chrome.storage.local.get(cle).then((r) => vivant && setVal((r[cle] as T) ?? defaut));
    const ecoute = (ch: Record<string, chrome.storage.StorageChange>, aire: string) => {
      if (aire === 'local' && cle in ch) setVal((ch[cle]?.newValue as T) ?? defaut);
    };
    chrome.storage.onChanged.addListener(ecoute);
    return () => {
      vivant = false;
      chrome.storage.onChanged.removeListener(ecoute);
    };
  }, [cle]);
  return val;
}

export function useSessions() {
  const sessions = useStockage<Session[]>('sessions', []);
  const courante = useStockage<string | null>('courante', null);
  return { sessions, courante: sessions.find((s) => s.id === courante) ?? null };
}

export const useFeedbacks = (sid: string | null | undefined) => useStockage<Feedback[]>(sid ? cleFb(sid) : null, []);

// Les images ne changent jamais une fois prises : cache d'URL objet pour la durée de la page.
const urls = new Map<string, string>();
const abonnes = new Set<() => void>();
const enCours = new Set<string>();
export function useImage(id: string) {
  const url = useSyncExternalStore(
    (f) => (abonnes.add(f), () => abonnes.delete(f)),
    () => urls.get(id),
  );
  useEffect(() => {
    if (urls.has(id) || enCours.has(id)) return;
    enCours.add(id);
    lireImage(id).then((b) => {
      if (b) urls.set(id, URL.createObjectURL(b));
      abonnes.forEach((f) => f());
    });
  }, [id]);
  return url;
}

export function Image({ id, className, ...props }: { id: string } & React.ComponentProps<'img'>) {
  const url = useImage(id);
  return url ? <img src={url} alt="" draggable={false} className={className} {...props} /> : <div className={cn('animate-pulse bg-muted', className)} />;
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox={LOGO_VIEWBOX} fill={LOGO_COULEUR} fillRule="evenodd" className={className} aria-hidden>
      {LOGO_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function Marque({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative flex size-7 items-center justify-center rounded-md border bg-card">
        <Logo className="w-[18px]" />
      </div>
      <span className="text-sm font-semibold tracking-tight">Designer Feedback</span>
    </div>
  );
}

export function StatutBadge({ statut, onChange, className }: { statut: Statut; onChange?: (s: Statut) => void; className?: string }) {
  const badge = (
    <Badge
      className={cn(
        statut === 'traite' ? 'bg-pistache text-pistache-foreground' : 'bg-peche text-peche-foreground',
        onChange && 'cursor-pointer transition-opacity hover:opacity-80',
        className,
      )}
    >
      {statut === 'traite' && <Check />}
      {STATUTS[statut]}
    </Badge>
  );
  if (!onChange) return badge;
  return (
    <button
      type="button"
      title="Changer le statut"
      onClick={(e) => {
        e.stopPropagation();
        onChange(statut === 'traite' ? 'a-traiter' : 'traite');
      }}
    >
      {badge}
    </button>
  );
}

// --- toasts ---
let pousser: (t: string) => void = () => {};
export const toast = (t: string) => pousser(t);
export function Toaster() {
  const [liste, setListe] = useState<{ id: number; t: string }[]>([]);
  useEffect(() => {
    pousser = (t) => {
      const id = Date.now() + Math.random();
      setListe((l) => [...l, { id, t }]);
      setTimeout(() => setListe((l) => l.filter((x) => x.id !== id)), 2600);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {liste.map((x) => (
        <div key={x.id} className="animate-in fade-in-0 slide-in-from-bottom-2 rounded-lg bg-foreground px-3.5 py-2 text-sm text-background shadow-lg">
          {x.t}
        </div>
      ))}
    </div>
  );
}

export async function copierAvecToast(s: Session, fbs: Feedback[], avecEntete = true) {
  if (!fbs.length) return toast('Rien à copier');
  try {
    await copier(s, fbs, avecEntete);
    toast(fbs.length > 1 ? `${fbs.length} feedbacks copiés — prêts à coller` : 'Feedback copié — prêt à coller');
  } catch (e) {
    toast(`Copie impossible : ${e}`);
  }
}

export function BoutonsExport({ session, feedbacks, compact }: { session: Session; feedbacks: Feedback[]; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={() => copierAvecToast(session, feedbacks)} disabled={!feedbacks.length} className={cn(compact && 'flex-1')}>
        <ClipboardCopy />
        Copier {feedbacks.length > 1 ? `les ${feedbacks.length}` : ''}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={!feedbacks.length}>
            <Download />
            Exporter
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => exporterZip(session, feedbacks)}>
            <FileText />
            Markdown + images (.zip)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => exporterJson(session, feedbacks)}>
            <FileJson />
            JSON (images incluses)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const hoteEtChemin = (url: string) => {
  try {
    const u = new URL(url);
    return { hote: u.host, chemin: u.pathname + u.search };
  } catch {
    return { hote: url, chemin: '' };
  }
};

export const quand = (t: number) => {
  const d = new Date(t);
  const auj = new Date().toDateString() === d.toDateString();
  return auj
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};
