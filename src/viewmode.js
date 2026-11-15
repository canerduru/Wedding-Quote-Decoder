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

export const DENSITY_KEY = 'wqd:density';

const DENSITY_ZOOM = { large: 1, medium: 0.85, small: 0.7 };
const CARD_MIN_WIDTH = { large: 330, medium: 310, small: 290 };

export function resolveDensity(saved) {
  return typeof saved === 'string' && Object.hasOwn(DENSITY_ZOOM, saved) ? saved : 'large';
}

export function loadDensity(storage) {
  try {
    return resolveDensity(storage?.getItem(DENSITY_KEY));
  } catch {
    return 'large';
  }
}

export function saveDensity(storage, density) {
  if (typeof density !== 'string' || !Object.hasOwn(DENSITY_ZOOM, density)) return;
  try {
    storage?.setItem(DENSITY_KEY, density);
  } catch {
    // storage blocked: keep the choice in memory only
  }
}

export function densityZoom(density) {
  return typeof density === 'string' && Object.hasOwn(DENSITY_ZOOM, density) ? DENSITY_ZOOM[density] : 1;
}

export function gridStyle(venueCount, density) {
  const style = { zoom: densityZoom(density) };
  if (venueCount >= 2) {
    const min = Object.hasOwn(CARD_MIN_WIDTH, density) ? CARD_MIN_WIDTH[density] : CARD_MIN_WIDTH.large;
    style.gridTemplateColumns = `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`;
  }
  return style;
}
