/* Node test for the interface catalog. Run with:
     node frontend/i18n.test.cjs
   tests/test_i18n_js.py invokes this file from pytest. */
'use strict';

const assert = require('assert');

/* i18n.js is a browser script: give it the few globals it touches. */
const storage = {};
global.window = global;
global.document = { documentElement: { setAttribute() {} } };
global.localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); }
};
require('./i18n.js');
const I18N = window.IsnadI18n;
const { ar, en } = I18N.catalog;

/* 1. Both languages carry the same keys, plural forms included. */
assert.deepStrictEqual(Object.keys(ar).sort(), Object.keys(en).sort());

/* 2. Both sides of a key use the same placeholders, so no value is dropped. */
const placeholders = (value) => {
  const text = typeof value === 'object' ? Object.values(value).join(' ') : value;
  return [...new Set(text.match(/\{\w+\}/g) || [])].sort();
};
for (const key of Object.keys(en)) {
  const a = placeholders(ar[key]).filter((p) => p !== '{n}');
  const e = placeholders(en[key]).filter((p) => p !== '{n}');
  assert.deepStrictEqual(a, e, 'placeholder mismatch in ' + key);
  if (typeof en[key] === 'object') assert.ok(en[key].other && ar[key].other, 'plural without other: ' + key);
}

/* 3. Arabic copy is Arabic, and never presents a status as a grade or ruling. */
for (const key of Object.keys(ar)) {
  const text = typeof ar[key] === 'object' ? Object.values(ar[key]).join(' ') : ar[key];
  assert.ok(text.trim(), 'empty Arabic string: ' + key);
}
for (const key of Object.keys(ar).filter((k) => k.startsWith('status.') && k.endsWith('.label'))) {
  assert.ok(/[؀-ۿ]/.test(ar[key]), 'status label not in Arabic: ' + key);
  assert.ok(!/صحيح|ضعيف|موضوع|حسن/.test(ar[key]), 'status label reads as a grade: ' + key);
}
assert.ok(ar['composer.note'].includes('ليست حكمًا على صحة الحديث'));
assert.ok(ar['composer.note'].includes('لا يعني أن النص غير موجود'));

/* 4. Arabic plurals pick all six forms; {n} follows the numeral setting. */
I18N.setLanguage('ar');
I18N.setFormat({ numerals: 'arab' });
assert.strictEqual(I18N.t('msg.statsChecked', { n: 0 }), 'لا استشهادات');
assert.strictEqual(I18N.t('msg.statsChecked', { n: 1 }), 'فُحص استشهاد واحد');
assert.strictEqual(I18N.t('msg.statsChecked', { n: 2 }), 'فُحص استشهادان');
assert.strictEqual(I18N.t('msg.statsChecked', { n: 3 }), 'فُحصت ٣ استشهادات');
assert.strictEqual(I18N.t('msg.statsChecked', { n: 11 }), 'فُحص ١١ استشهادًا');
assert.strictEqual(I18N.t('msg.statsChecked', { n: 100 }), 'فُحص ١٠٠ استشهاد');
I18N.setFormat({ numerals: 'latn' });
assert.strictEqual(I18N.t('msg.statsChecked', { n: 3 }), 'فُحصت 3 استشهادات');

/* 5. English, and the language choice is remembered. */
I18N.setLanguage('en');
assert.strictEqual(I18N.t('msg.statsChecked', { n: 1 }), '1 citation checked');
assert.strictEqual(I18N.t('msg.statsChecked', { n: 0 }), 'no citations');
assert.strictEqual(JSON.parse(storage['isnad.gui.lang.v1']), 'en');
assert.strictEqual(I18N.t('no.such.key'), 'no.such.key');

/* 6. Conversation search ignores tashkeel, Qur'anic marks and letter variants. */
const k = I18N.searchKey;
assert.ok(k('بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ').includes(k('الرحمن')));
assert.strictEqual(k('إِيمَان'), k('ايمان'));
assert.strictEqual(k('مدرسة'), k('مدرسه'));
assert.strictEqual(k('على'), k('علي'));
assert.strictEqual(k('Patience'), 'patience');

console.log('all assertions passed');
