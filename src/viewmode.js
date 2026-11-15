export const VIEW_KEY = 'wqd:view';

const MODES = ['cards', 'table'];

export function resolveViewMode(saved) {
  return MODES.includes(saved) ? saved : 'table';
}

export function loadViewMode(storage) {
  try {
    return resolveViewMode(storage?.getItem(VIEW_KEY));
  } catch {
    return 'table';
  }
}

export function saveViewMode(storage, mode) {
  if (!MODES.includes(mode)) return;
  try {
    storage?.setItem(VIEW_KEY, mode);
  } catch {
    // storage blocked: keep the choice in memory only
  }
}
