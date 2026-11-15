const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

export function extractPasteFiles(clipboardData, now = Date.now()) {
  if (!clipboardData) return [];
  let files = Array.from(clipboardData.files || []);
  if (files.length === 0) {
    files = Array.from(clipboardData.items || [])
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter(Boolean);
  }
  return files
    .filter((file) => Object.hasOwn(EXTENSIONS, file.type))
    .map((file, index) => new File([file], `yapistirilan-${now}-${index + 1}.${EXTENSIONS[file.type]}`, { type: file.type }));
}

export function isEditableTarget(element) {
  if (!element) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable === true;
}
