export function moveIndex(list, from, to) {
  const inRange = (i) => Number.isInteger(i) && i >= 0 && i < list.length;
  if (!inRange(from) || !inRange(to) || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function indexAtPoint(rects, x, y, fallback) {
  const hit = rects.findIndex((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
  return hit === -1 ? fallback : hit;
}
