import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DAYS, MEALS, NIGHTS } from '../public/event-catalog.js';
import { DEFAULT_DEFINITION } from '../public/event-catalog.js';
import { normalizeSurvey } from '../server/v2-data.js';
import { thankYouSection } from '../public/thanks.js';

const family = { members: [{ id: 'guest-example', name: 'Тестов гост', child: false }] };

test('the extended trip has four days, three nights and a departure breakfast', () => {
  assert.deepEqual(DAYS.map(item => item.id), ['2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
  assert.equal(NIGHTS.length, 3);
  assert.ok(MEALS.some(item => item.day === '2027-01-02' && item.kind === 'dinner'));
  assert.ok(MEALS.some(item => item.day === '2027-01-03' && item.kind === 'breakfast'));
});

test('additional night can be saved and is limited to the overnight dates', () => {
  const input = { attendance: { 'guest-example': { status: 'yes', meals: MEALS.map(item => item.id), nights: ['2027-01-02'] } } };
  const result = normalizeSurvey(input, family, DEFAULT_DEFINITION);
  assert.deepEqual(result.attendance['guest-example'].nights, ['2027-01-02']);
  assert.equal(result.attendance['guest-example'].meals.length, MEALS.length);
  input.attendance['guest-example'].nights = ['2027-01-03'];
  assert.throws(() => normalizeSurvey(input, family, DEFAULT_DEFINITION), /Невалиден избор на нощувка/);
});

test('a declined guest has neither meal reservations nor overnight reservations', () => {
  const result = normalizeSurvey({ attendance: { 'guest-example': { status:'no', meals:['31-dinner'], nights:['2027-01-02'] } } }, family, DEFAULT_DEFINITION);
  assert.deepEqual(result.attendance['guest-example'].meals, []);
  assert.deepEqual(result.attendance['guest-example'].nights, []);
});

test('confirmation screen is never shown for an unconfirmed draft', () => {
  const model = { status: { revision: 2, submittedRevision: 1, submittedAt: null }, definition: { recipes: [] }, family: { title: 'Тестова група' } };
  assert.equal(thankYouSection(model, '<p>private</p>'), '');
  model.status.submittedRevision = 2;
  model.status.submittedAt = '2026-11-16T10:00:00Z';
  model.sharedContributions = [{ household:'Група', label:'Баница', quantity:1, unit:'tray' }];
  const html = thankYouSection(model, '<p>Обобщение</p>');
  assert.match(html, /Готово, Тестова група/);
  assert.match(html, /Баница/);
  assert.match(html, /Обобщение/);
});
