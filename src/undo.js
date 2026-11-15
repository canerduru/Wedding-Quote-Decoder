export function removeWithUndo(list, id, idOf = (item) => item.id) {
  const index = list.findIndex((item) => idOf(item) === id);
  if (index === -1) return null;
  return { list: list.filter((_, i) => i !== index), undo: { index, item: list[index] } };
}

export function restoreRemoved(list, undo, idOf = (item) => item.id) {
  if (list.some((item) => idOf(item) === idOf(undo.item))) return list;
  const next = [...list];
  next.splice(Math.min(undo.index, next.length), 0, undo.item);
  return next;
}
