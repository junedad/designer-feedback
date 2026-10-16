// Monde MAIN : seul endroit où l'on voit les propriétés que React / Vue posent
// sur les nœuds DOM. Le content script (monde isolé) déclenche un événement
// synchrone sur l'élément ; on répond en posant un attribut qu'il relit aussitôt.
export default defineContentScript({
  matches: ['<all_urls>'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    const IGNORES = /^(Provider|Consumer|Context|Fragment|Suspense|StrictMode|Profiler|ForwardRef|Memo|Slot|Slottable|Primitive|Presence|Portal|Anonymous|ErrorBoundary|Router|Routes|Route|RenderedRoute|Outlet)$|(Provider|Context|Boundary)$/;
    const valable = (n: unknown): n is string => typeof n === 'string' && /^[A-Z][A-Za-z0-9]{2,}$/.test(n) && !IGNORES.test(n);

    function nomDuType(t: any): unknown {
      if (!t) return null;
      if (typeof t === 'function') return t.displayName || t.name;
      if (typeof t === 'object') return t.displayName || nomDuType(t.render) || nomDuType(t.type);
      return null;
    }

    function composants(el: Element | null): string[] {
      const noms: string[] = [];
      const ajouter = (n: unknown) => valable(n) && noms.at(-1) !== n && noms.push(n);
      // On remonte jusqu'au premier nœud qui porte une fiber.
      let n: any = el;
      while (n && !Object.keys(n).some((k) => k.startsWith('__reactFiber$') || k.startsWith('__vueParentComponent'))) n = n.parentNode ?? n.host;
      if (!n) return noms;
      const cle = Object.keys(n).find((k) => k.startsWith('__reactFiber$'));
      for (let f = cle ? n[cle] : null; f && noms.length < 4; f = f.return) ajouter(nomDuType(f.type));
      for (let v = n.__vueParentComponent; v && noms.length < 4; v = v.parent) ajouter(v.type?.name || v.type?.__name);
      return noms; // du plus proche au plus lointain
    }

    document.addEventListener(
      'designer-feedback:composants',
      (e) => {
        const el = e.composedPath()[0] as Element;
        el.setAttribute('data-wf-composants', composants(el).join('|'));
      },
      true,
    );
  },
});
