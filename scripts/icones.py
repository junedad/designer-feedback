# Génère public/logo.svg et public/icon/*.png : le logo orange (appareil photo cadré) sur fond transparent.
# Rendu par Chrome Canary (Playwright). Lancer : uv run --with playwright python scripts/icones.py
import pathlib
from playwright.sync_api import sync_playwright

PATHS = [
    'M0 0H4V1H1V4H0Z', 'M9 0H13V4H12V1H9Z', 'M0 9H1V12H4V13H0Z', 'M12 9H13V13H9V12H12Z',
    'M2.5 3.2H4.3L4.9 2.4H8.1L8.7 3.2H10.5V9.8H2.5ZM3.6 4.3V8.7H9.4V4.3Z',
    'M6.5 5.1A1.4 1.4 0 1 1 6.5 7.9A1.4 1.4 0 1 1 6.5 5.1Z',
]
SVG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 14 14" fill="#F26B1D" fill-rule="evenodd">'
       + ''.join(f'<path d="{d}"/>' for d in PATHS) + '</svg>')

sortie = pathlib.Path(__file__).parent.parent / 'public' / 'icon'
sortie.mkdir(parents=True, exist_ok=True)
(sortie.parent / 'logo.svg').write_text(SVG)
with sync_playwright() as p:
    nav = p.chromium.launch(channel='chrome-canary')
    page = nav.new_page()
    page.set_viewport_size({'width': 800, 'height': 800})
    for taille in (16, 32, 48, 128):
        page.set_content(f'<style>html,body{{margin:0;background:transparent}}svg{{display:block;width:{taille}px;height:{taille}px}}</style>{SVG}')
        page.locator('svg').screenshot(path=str(sortie / f'{taille}.png'), omit_background=True)
    nav.close()
print('ok')
