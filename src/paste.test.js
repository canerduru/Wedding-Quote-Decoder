import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPasteFiles, isEditableTarget } from './paste.js';

const file = (name, type) => ({ name, type, size: 10 });
const item = (kind, type, f) => ({ kind, type, getAsFile: () => f });

test('extractPasteFiles: panodaki gorselleri ve pdf leri alir, benzersiz adlandirir', () => {
  const data = { files: [file('image.png', 'image/png'), file('image.png', 'image/png'), file('teklif.pdf', 'application/pdf')], items: [] };
  const out = extractPasteFiles(data, 1000);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((f) => f.type), ['image/png', 'image/png', 'application/pdf']);
  assert.equal(new Set(out.map((f) => f.name)).size, 3);
  assert.ok(out[0].name.endsWith('.png'));
  assert.ok(out[2].name.endsWith('.pdf'));
  assert.equal(out[2].name.includes('teklif'), false);
});

test('extractPasteFiles: files bossa items icinden dosya alir', () => {
  const f = file('image.png', 'image/png');
  const data = { files: [], items: [item('file', 'image/png', f), item('string', 'text/plain', null)] };
  assert.equal(extractPasteFiles(data, 1000).length, 1);
});

test('extractPasteFiles: desteklenmeyen turler ve metin yok sayilir', () => {
  const data = { files: [file('a.zip', 'application/zip'), file('b.txt', 'text/plain')], items: [] };
  assert.deepEqual(extractPasteFiles(data, 1000), []);
  assert.deepEqual(extractPasteFiles(null, 1000), []);
  assert.deepEqual(extractPasteFiles({}, 1000), []);
});

test('isEditableTarget: yazi alanlarinda yapistirma yakalanmaz', () => {
  assert.equal(isEditableTarget({ tagName: 'INPUT' }), true);
  assert.equal(isEditableTarget({ tagName: 'TEXTAREA' }), true);
  assert.equal(isEditableTarget({ tagName: 'SELECT' }), true);
  assert.equal(isEditableTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isEditableTarget({ tagName: 'DIV' }), false);
  assert.equal(isEditableTarget({ tagName: 'BODY' }), false);
  assert.equal(isEditableTarget(null), false);
});
