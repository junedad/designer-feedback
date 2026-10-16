import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  // Pas de navigateur lancé par `wxt dev` : on charge le dossier à la main (Canary ignore --load-extension).
  webExt: { disabled: true },
  manifest: {
    name: 'Designer Feedback',
    description: 'Sessions de feedback sur n’importe quelle page : sélection DOM, captures, commentaire, revue et export Notion / Jira.',
    permissions: ['storage', 'unlimitedStorage', 'sidePanel', 'tabs', 'scripting', 'clipboardWrite'],
    host_permissions: ['<all_urls>'],
    action: { default_title: 'Designer Feedback' },
    // Alt+Shift+lettre : libre dans Chrome sur macOS, Windows et Linux, et rarement pris par les sites
    // (contrairement à Ctrl+Shift). Sur Mac, Alt = ⌥.
    commands: {
      _execute_action: { suggested_key: { default: 'Alt+Shift+P' }, description: 'Ouvrir le panneau' },
      'basculer-mode': { suggested_key: { default: 'Alt+Shift+F' }, description: 'Activer / couper le mode feedback sur l’onglet' },
      'capture-zone': { suggested_key: { default: 'Alt+Shift+S' }, description: 'Capturer une zone' },
      'capture-element': { suggested_key: { default: 'Alt+Shift+E' }, description: 'Sélectionner un élément (une fois)' },
    },
  },
});
