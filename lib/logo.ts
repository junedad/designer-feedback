// Logo : appareil photo cadré par quatre coins, sur une grille de 13 × 13. Orange.
export const LOGO_COULEUR = '#F26B1D';
export const LOGO_VIEWBOX = '0 0 13 13';
export const LOGO_PATHS = [
  'M0 0H4V1H1V4H0Z',
  'M9 0H13V4H12V1H9Z',
  'M0 9H1V12H4V13H0Z',
  'M12 9H13V13H9V12H12Z',
  // corps + bosse, ouverture intérieure (evenodd)
  'M2.5 3.2H4.3L4.9 2.4H8.1L8.7 3.2H10.5V9.8H2.5ZM3.6 4.3V8.7H9.4V4.3Z',
  // objectif
  'M6.5 5.1A1.4 1.4 0 1 1 6.5 7.9A1.4 1.4 0 1 1 6.5 5.1Z',
];
export const logoSvg = (classe = '') =>
  `<svg class="${classe}" viewBox="${LOGO_VIEWBOX}" fill="${LOGO_COULEUR}" fill-rule="evenodd" aria-hidden="true">${LOGO_PATHS.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
