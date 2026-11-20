/**
 * GitHub Achievement skin tone customization helpers (Quickdraw & Starstruck).
 */

export const GITHUB_APPEARANCE_URL = 'https://github.com/settings/appearance';
export const SKIN_TONE_STORAGE_KEY = 'gh-achievements-skin-tone';
export const SKIN_TONE_AFFECTED_ACHIEVEMENTS = ['quickdraw', 'starstruck'];

export const SKIN_TONE_OPTIONS = [
  { id: 'default', emoji: '👋', swatch: '#f5c542', labelPt: 'Padrão', labelEn: 'Default' },
  { id: 'light', emoji: '👋🏻', swatch: '#f9dcc4', labelPt: 'Claro', labelEn: 'Light' },
  { id: 'medium-light', emoji: '👋🏼', swatch: '#e6b89c', labelPt: 'Médio-claro', labelEn: 'Medium-Light' },
  { id: 'medium', emoji: '👋🏽', swatch: '#c68b59', labelPt: 'Médio', labelEn: 'Medium' },
  { id: 'medium-dark', emoji: '👋🏾', swatch: '#8d5524', labelPt: 'Médio-escuro', labelEn: 'Medium-Dark' },
  { id: 'dark', emoji: '👋🏿', swatch: '#4a2c18', labelPt: 'Escuro', labelEn: 'Dark' },
];

/**
 * Resolves a skin tone option by id, falling back to the default option.
 * @param {string} id
 */
export function getSkinToneOption(id) {
  return SKIN_TONE_OPTIONS.find((item) => item.id === id) || SKIN_TONE_OPTIONS[0];
}
