# Lancer : npm run build && uv run --with playwright python tests/e2e.py [--headed]
# Test e2e de Designer Feedback dans Chrome Canary (CDP + Extensions.loadUnpacked).
import json, os, shutil, subprocess, sys, time, threading, http.server, functools
from playwright.sync_api import sync_playwright

ICI = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.join(ICI, '..', '.output', 'chrome-mv3')
PROFIL = '/tmp/cdp-designer-feedback'
SHOTS = os.path.join(ICI, 'shots'); os.makedirs(SHOTS, exist_ok=True)
PORT_SITE, PORT_CDP = 8791, 9347
HEADLESS = '--headed' not in sys.argv

shutil.rmtree(PROFIL, ignore_errors=True)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT_SITE), functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.join(ICI, 'site')))
threading.Thread(target=srv.serve_forever, daemon=True).start()

args = [os.environ['CHROME_PATH'], f'--remote-debugging-port={PORT_CDP}', '--enable-unsafe-extension-debugging',
        f'--user-data-dir={PROFIL}', '--no-first-run', '--no-default-browser-check', '--window-size=1400,900']
if HEADLESS: args.append('--headless=new')
chrome = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(2.5)

def shot(page, nom):
    page.screenshot(path=os.path.join(SHOTS, nom + '.png'))

ok = True
def verifier(cond, msg):
    global ok
    print(('✔ ' if cond else '✘ ') + msg)
    ok = ok and bool(cond)

try:
    with sync_playwright() as p:
        nav = p.chromium.connect_over_cdp(f'http://127.0.0.1:{PORT_CDP}')
        cdp = nav.new_browser_cdp_session()
        ext_id = cdp.send('Extensions.loadUnpacked', {'path': EXT})['id']
        print('extension', ext_id)
        ctx = nav.contexts[0]
        sw = None
        for _ in range(40):
            sw = next((w for w in ctx.service_workers if ext_id in w.url), None)
            if sw: break
            if _ == 5: ctx.new_page().goto(f'chrome-extension://{ext_id}/review.html')
            time.sleep(0.25)
        assert sw, [w.url for w in ctx.service_workers]

        page = ctx.new_page()
        page.set_viewport_size({'width': 1280, 'height': 800})
        page.goto(f'http://127.0.0.1:{PORT_SITE}/index.html')
        page.wait_for_timeout(500)
        tab_id = sw.evaluate("async () => (await chrome.tabs.query({url: 'http://127.0.0.1/*'}))[0]?.id ?? (await chrome.tabs.query({})).find(t => t.url.includes('8791')).id")
        print('onglet', tab_id)

        # Activer le mode comme le ferait ⌥⇧F
        sw.evaluate(f"async () => {{ await chrome.storage.session.set({{'mode:{tab_id}': true}}); await chrome.tabs.sendMessage({tab_id}, {{t:'mode', actif:true}}); }}")
        page.wait_for_timeout(300)
        shot(page, '01-mode-actif')

        # Survol du texte du bouton → doit accrocher le <button>
        box = page.locator('#valider span').bounding_box()
        page.mouse.move(box['x'] + 5, box['y'] + 5)
        page.wait_for_timeout(200)
        shot(page, '02-survol-bouton')
        # ↑ remonte au parent
        page.keyboard.press('ArrowUp')
        page.wait_for_timeout(150)
        shot(page, '03-fleche-haut')
        page.keyboard.press('ArrowDown')
        page.wait_for_timeout(100)

        # Clic → capture + carte
        page.mouse.click(box['x'] + 5, box['y'] + 5)
        page.wait_for_timeout(1200)
        shot(page, '04-carte')
        verifier(page.evaluate('clicsPage.length') == 0, 'le clic de sélection n’atteint pas la page')
        page.keyboard.type('Le bouton Valider est trop sombre\nContraste insuffisant sur fond foncé, à revoir avec le DS.')
        page.wait_for_timeout(100)
        verifier(page.evaluate('touchesPage.length') == 0, 'les frappes dans la carte n’atteignent pas la page')
        verifier(page.evaluate('window.focusVole || 0') == 0, 'focusin de la carte invisible pour la page')
        page.keyboard.press('Meta+Enter')
        page.wait_for_timeout(600)

        def donnees():
            return sw.evaluate("async () => { const {courante} = await chrome.storage.local.get('courante'); const r = await chrome.storage.local.get('fb:' + courante); return r['fb:' + courante] ?? []; }")
        fbs = donnees()
        verifier(len(fbs) == 1, f'1 feedback enregistré ({len(fbs)})')
        if fbs:
            f = fbs[0]
            print('  fil :', f['pieces'][0]['element']['fil'])
            print('  sélecteur :', f['pieces'][0]['element']['selecteur'])
            verifier(f['pieces'][0]['element']['tag'] == 'button', 'accroche sur le <button> et pas le <span>')
            verifier(f['pieces'][0]['element']['fil'].startswith('AssetCard › CardFooter › Button'), 'noms de composants React dans le fil')
            verifier(f['commentaire'].startswith('Le bouton Valider'), 'commentaire sauvé')

        # Zone avec ⇧ au relâché → ajoutée au dernier feedback
        page.keyboard.press('z')
        page.wait_for_timeout(150)
        page.mouse.move(400, 300)
        page.mouse.down()
        page.mouse.move(600, 420, steps=5)
        shot(page, '05-zone')
        page.keyboard.down('Shift')
        page.mouse.up()
        page.keyboard.up('Shift')
        page.wait_for_timeout(1200)
        shot(page, '06-carte-2-pieces')
        page.keyboard.press('Escape')
        page.wait_for_timeout(400)
        fbs = donnees()
        verifier(len(fbs) == 1 and len(fbs[0]['pieces']) == 2, f'zone ⇧ ajoutée au même feedback ({[len(x["pieces"]) for x in fbs]})')

        # Écran visible, nouveau feedback, puis Esc sans commentaire → abandonné
        page.keyboard.press('v')
        page.wait_for_timeout(1200)
        page.keyboard.press('Escape')
        page.wait_for_timeout(400)
        verifier(len(donnees()) == 1, 'Esc sur capture vide → abandonnée')

        # Écran visible gardé
        page.wait_for_timeout(600)
        page.keyboard.press('v')
        page.wait_for_timeout(1200)
        page.keyboard.type('Vue générale de la page')
        page.keyboard.press('Meta+Enter')
        page.wait_for_timeout(500)

        # Élément dans un Shadow DOM
        b = page.locator('my-widget').bounding_box()
        page.mouse.move(b['x'] + 10, b['y'] + 8)
        page.wait_for_timeout(200)
        shot(page, '07-survol-shadow')
        page.mouse.click(b['x'] + 10, b['y'] + 8)
        page.wait_for_timeout(1200)
        page.keyboard.type('Bouton dans le shadow DOM mal aligné')
        page.keyboard.press('Meta+Enter')
        page.wait_for_timeout(500)
        fbs = donnees()
        verifier(len(fbs) == 3, f'3 feedbacks ({len(fbs)})')
        sh = fbs[-1]['pieces'][0]['element']
        print('  shadow :', sh['selecteur'], '|', sh['fil'])
        verifier('>>>' in sh['selecteur'], 'sélecteur à travers le Shadow DOM')

        # Pastilles
        page.wait_for_timeout(1700)
        shot(page, '08-pastilles')

        # Raccourci page hors mode : touches rendues à la page
        sw.evaluate(f"async () => {{ await chrome.storage.session.set({{'mode:{tab_id}': false}}); await chrome.tabs.sendMessage({tab_id}, {{t:'mode', actif:false}}); }}")
        page.evaluate('touchesPage.length = 0')
        page.keyboard.press('d')
        verifier(page.evaluate('touchesPage') == ['d'], 'mode coupé : la page reçoit ses touches')

        # Localiser
        page.evaluate('scrollTo(0, 900)')
        loc = sw.evaluate(f"async () => {{ const fbs = (await chrome.storage.local.get(null)); const k = Object.keys(fbs).find(k => k.startsWith('fb:')); const p = fbs[k][0].pieces[0]; return chrome.tabs.sendMessage({tab_id}, {{t:'localiser', element: p.element}}); }}")
        page.wait_for_timeout(400)
        shot(page, '09-localiser')
        verifier(loc is True and page.evaluate('scrollY') < 900, 'localiser défile jusqu’à l’élément')

        # Review + side panel
        review = ctx.new_page()
        review.set_viewport_size({'width': 1440, 'height': 900})
        review.goto(f'chrome-extension://{ext_id}/review.html')
        review.wait_for_timeout(900)
        shot(review, '10-review')
        review.locator('text=Le bouton Valider est trop sombre').first.click()
        review.wait_for_timeout(300)
        shot(review, '11-review-edition')
        review.keyboard.press('Escape')
        review.locator('div.group').first.click(position={'x': 300, 'y': 70})
        review.wait_for_timeout(500)
        shot(review, '12-review-detail')
        review.keyboard.press('Escape')
        review.wait_for_timeout(300)
        # sélection multiple
        cases = review.locator('button[role=checkbox]')
        cases.nth(1).click(); cases.nth(2).click()
        review.wait_for_timeout(200)
        shot(review, '13-review-selection')

        # Export : on récupère le HTML et le Markdown via le presse-papier
        review.evaluate("""() => { navigator.clipboard.write = async (items) => { window.__presse = {}; for (const it of items) for (const t of it.types) window.__presse[t] = await (await it.getType(t)).text(); }; }""")
        review.keyboard.press('Escape')
        review.get_by_role('button', name='Copier les 3').click()
        review.wait_for_timeout(800)
        presse = review.evaluate('window.__presse || {}')
        with open(os.path.join(SHOTS, 'presse-papier.html'), 'w') as fh: fh.write(presse.get('text/html', ''))
        with open(os.path.join(SHOTS, 'presse-papier.md'), 'w') as fh: fh.write(presse.get('text/plain', ''))
        verifier('<h2>1. Le bouton Valider' in presse.get('text/html', '') and 'data:image/png;base64' in presse.get('text/html', ''), 'copie HTML riche avec images intégrées')

        for libelle, ext in (('Markdown + images (.zip)', 'zip'), ('JSON (images incluses)', 'json')):
            review.get_by_role('button', name='Exporter').click()
            with review.expect_download() as dl:
                review.get_by_role('menuitem', name=libelle).click()
            chemin = os.path.join(SHOTS, f'export.{ext}')
            dl.value.save_as(chemin)
            verifier(os.path.getsize(chemin) > 1000, f'export .{ext} ({os.path.getsize(chemin)} o)')

        # Réordonner par glisser (poignée de la ligne 3 vers le haut)
        poignee = review.locator('button[title="Glisser pour réordonner"]').nth(2)
        review.locator('div.group').nth(2).hover()
        pb = poignee.bounding_box()
        review.mouse.move(pb['x'] + 5, pb['y'] + 5); review.mouse.down()
        review.mouse.move(pb['x'] + 5, pb['y'] - 60, steps=8); review.mouse.move(pb['x'] + 5, pb['y'] - 200, steps=8)
        review.mouse.up(); review.wait_for_timeout(500)
        verifier(donnees()[0]['commentaire'].startswith('Bouton dans le shadow'), 'glisser-déposer réordonne')
        # Fusionner 1 et 2
        cases = review.locator('button[role=checkbox]')
        cases.nth(1).click(); cases.nth(2).click()
        review.get_by_role('button', name='Fusionner').click(); review.wait_for_timeout(500)
        fbs = donnees()
        verifier(len(fbs) == 2 and len(fbs[0]['pieces']) == 3, f'fusion ({[len(f["pieces"]) for f in fbs]})')
        # Détacher une pièce depuis le détail
        review.locator('div.group').first.locator('span.text-right').click(); review.wait_for_timeout(400)
        review.get_by_role('button', name='Détacher').first.click(); review.wait_for_timeout(400)
        review.keyboard.press('Escape')
        verifier([len(f['pieces']) for f in donnees()] == [2, 1, 1], f'détacher ({[len(f["pieces"]) for f in donnees()]})')
        shot(review, '13b-review-apres')

        panneau = ctx.new_page()
        panneau.set_viewport_size({'width': 380, 'height': 820})
        panneau.goto(f'chrome-extension://{ext_id}/sidepanel.html')
        panneau.wait_for_timeout(800)
        panneau.locator('ol li button').first.click()
        panneau.wait_for_timeout(400)
        shot(panneau, '14-panneau')

        # Sombre
        for pg, nom in ((review, '15-review-sombre'), (panneau, '16-panneau-sombre')):
            pg.emulate_media(color_scheme='dark'); pg.wait_for_timeout(200); shot(pg, nom)
        page.emulate_media(color_scheme='dark')
        sw.evaluate(f"async () => {{ await chrome.tabs.sendMessage({tab_id}, {{t:'mode', actif:true}}); }}")
        page.evaluate('scrollTo(0,0)')
        page.mouse.move(box['x'] + 5, box['y'] + 5)
        page.wait_for_timeout(1700)
        shot(page, '17-page-sombre')

        # Clics souris dans la barre et la carte (Shadow DOM)
        ui = lambda sel: page.locator(f'designer-feedback {sel}')
        page.emulate_media(color_scheme='light')
        n0 = len(donnees())
        ui('button[data-a=zone]').click(); page.wait_for_timeout(200)
        verifier(ui('.voile').is_visible(), 'clic sur « Zone » ouvre le tracé')
        page.mouse.move(300, 300); page.mouse.down(); page.mouse.move(520, 420, steps=5); page.mouse.up()
        page.wait_for_timeout(1200)
        verifier(ui('.carte').is_visible(), 'zone tracée → carte')
        page.keyboard.type('Zone via la barre'); page.wait_for_timeout(800)
        verifier(donnees()[-1]['commentaire'] == 'Zone via la barre', 'sauvegarde auto du commentaire')
        ui('button[data-a=enregistrer]').click(); page.wait_for_timeout(300)
        verifier(not ui('.carte').is_visible(), 'bouton « Enregistrer »')
        page.wait_for_timeout(600)

        # Zone relâchée hors de la page (side panel) : aucun pointerup, la souris revient bouton levé
        ui('button[data-a=zone]').click(); page.wait_for_timeout(200)
        cdpp = ctx.new_cdp_session(page)
        souris = lambda t, x, y, **k: cdpp.send('Input.dispatchMouseEvent', {'type': t, 'x': x, 'y': y, **k})
        souris('mousePressed', 300, 300, button='left', buttons=1, clickCount=1)
        souris('mouseMoved', 500, 420, button='left', buttons=1)
        souris('mouseMoved', 700, 500, button='none', buttons=0)
        page.wait_for_timeout(1200)
        verifier(not ui('.voile').is_visible() and ui('.carte').is_visible(), 'zone relâchée hors page : tracé terminé, plus collé à la souris')
        page.keyboard.press('Escape'); page.wait_for_timeout(400)
        ui('button[data-a=visible]').click(); page.wait_for_timeout(1200)
        verifier(len(donnees()) == n0 + 2 and ui('.carte').is_visible(), 'clic sur « Écran » capture')
        ui('button[data-a=ajouter]').click(); page.wait_for_timeout(700)
        page.keyboard.press('v'); page.wait_for_timeout(1200)
        verifier(len(donnees()[-1]['pieces']) == 2, 'bouton « + » puis V : 2e pièce sur le même feedback')
        ui('button[data-a=enregistrer]').click(); page.wait_for_timeout(300)
        ui('button[data-a=dom]').click(); page.keyboard.press('z'); page.wait_for_timeout(200)
        verifier(ui('.voile').is_visible(), 'Z marche juste après un clic dans la barre')
        page.keyboard.press('Escape'); page.wait_for_timeout(200)
        verifier(not ui('.voile').is_visible(), 'Esc annule le tracé')
        ui('button[data-a=quitter]').click(); page.wait_for_timeout(400)
        verifier(not ui('.barre').is_visible(), 'bouton « × » quitte le mode')
        shot(page, '18-apres-clics')

        # Mac : ⌥ tenu vise, ⌥+clic sélectionne (mode coupé)
        page.mouse.move(box['x'] + 5, box['y'] + 5)
        page.keyboard.down('Alt'); page.mouse.move(box['x'] + 6, box['y'] + 6); page.wait_for_timeout(150)
        verifier(ui('.cadre').is_visible(), 'Mac : ⌥ tenu vise un élément')
        page.mouse.click(box['x'] + 6, box['y'] + 6); page.keyboard.up('Alt'); page.wait_for_timeout(1200)
        verifier(ui('.carte').is_visible() and '⌘↵' in ui('.carte').inner_text(), 'Mac : ⌥+clic → carte, libellé ⌘↵')
        page.keyboard.press('Escape'); page.wait_for_timeout(300)

        # Disposition cyrillique : la touche physique Z ouvre la zone
        sw.evaluate(f"async () => chrome.tabs.sendMessage({tab_id}, {{t:'mode', actif:true}})")
        page.wait_for_timeout(200)
        page.evaluate("dispatchEvent(new KeyboardEvent('keydown', { key: 'я', code: 'KeyZ', bubbles: true }))")
        page.wait_for_timeout(150)
        verifier(ui('.voile').is_visible(), 'clavier cyrillique : touche physique Z → zone')
        page.keyboard.press('Escape')
        sw.evaluate(f"async () => chrome.tabs.sendMessage({tab_id}, {{t:'mode', actif:false}})")

        # Windows simulé
        win = ctx.new_page()
        win.set_viewport_size({'width': 1280, 'height': 800})
        cdpw = ctx.new_cdp_session(win)
        cdpw.send('Emulation.setUserAgentOverride', {
            'userAgent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36',
            'platform': 'Win32',
            'userAgentMetadata': {'platform': 'Windows', 'platformVersion': '15.0.0', 'architecture': 'x86', 'model': '', 'mobile': False,
                                  'brands': [{'brand': 'Chromium', 'version': '158'}]},
        })
        win.goto(f'http://127.0.0.1:{PORT_SITE}/index.html'); win.wait_for_timeout(500)
        uiw = lambda sel: win.locator(f'designer-feedback {sel}')
        verifier(win.evaluate('navigator.platform') == 'Win32', 'émulation Windows active')
        wid = sw.evaluate("async () => (await chrome.tabs.query({})).filter(t => t.url.includes('8791')).at(-1).id")
        bw = win.locator('#valider').bounding_box()
        win.mouse.move(bw['x'] + 5, bw['y'] + 5)
        win.keyboard.down('Alt'); win.mouse.move(bw['x'] + 6, bw['y'] + 6); win.wait_for_timeout(150)
        verifier(uiw('.cadre').count() == 0 or not uiw('.cadre').is_visible(), 'Windows : Alt tenu ne vise rien (menu Chrome / WM Linux)')
        win.keyboard.up('Alt')
        # Alt+Maj+E (commande globale) → sélection ponctuelle
        sw.evaluate(f"async () => chrome.tabs.sendMessage({wid}, {{t:'element'}})"); win.wait_for_timeout(200)
        verifier(uiw('.consigne').is_visible() and uiw('.cadre').is_visible(), 'Alt+Maj+E : sélection ponctuelle hors mode')
        shot(win, '19-windows-element')
        win.mouse.click(bw['x'] + 6, bw['y'] + 6); win.wait_for_timeout(1200)
        txt = uiw('.carte').inner_text() if uiw('.carte').is_visible() else ''
        verifier('Ctrl+Entrée' in txt and 'Ctrl+Maj+Entrée' in txt, 'Windows : libellés Ctrl+Entrée / Ctrl+Maj+Entrée')
        shot(win, '20-windows-carte')
        win.keyboard.type('Vu sous Windows'); win.keyboard.press('Control+Enter'); win.wait_for_timeout(500)
        verifier(donnees()[-1]['commentaire'] == 'Vu sous Windows' and not uiw('.carte').is_visible(), 'Windows : Ctrl+Entrée enregistre')
        verifier(not uiw('.consigne').is_visible(), 'la sélection ponctuelle se termine après un élément')

        erreurs = []
        nav.close()
finally:
    chrome.terminate()
    srv.shutdown()
print('RÉSULTAT', 'OK' if ok else 'ÉCHECS')
