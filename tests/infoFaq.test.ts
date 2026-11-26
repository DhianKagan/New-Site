import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FAQ, SOLAR_MAINTENANCE_FAQ } from '../src/components/InfoPage.tsx';

test('SOLAR_MAINTENANCE_FAQ includes installation and maintenance Q&As in UK and RU', () => {
  assert.equal(typeof FAQ, 'function');
  assert.ok(SOLAR_MAINTENANCE_FAQ.length >= 4);

  const topics = new Set(SOLAR_MAINTENANCE_FAQ.map((item) => item.topic));
  assert.ok(topics.has('installation'));
  assert.ok(topics.has('maintenance'));

  for (const item of SOLAR_MAINTENANCE_FAQ) {
    assert.ok(item.id.trim().length > 0);
    assert.ok(item.questionUk.trim().length > 10);
    assert.ok(item.questionRu.trim().length > 10);
    assert.ok(item.answerUk.trim().length > 30);
    assert.ok(item.answerRu.trim().length > 30);
  }
});

test('InfoPage.tsx defines exported FAQ component and renders it on info pages', () => {
  const source = readFileSync(new URL('../src/components/InfoPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /export function FAQ\s*\(/);
  assert.match(source, /<FAQ\s*\/>/);
});
