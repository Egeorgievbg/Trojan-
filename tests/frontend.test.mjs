import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../public/app.js', import.meta.url), 'utf8')).split('init().catch')[0];
function browser() {
  const state = { modal: null, note: null, choice: null };
  const app = { innerHTML: '', querySelectorAll(selector) { return selector === '[data-choice]' && state.choice ? [state.choice] : []; } };
  const document = {
    getElementById() { return app; },
    querySelector(selector) { return selector === '#lightbox' ? state.modal : selector === '#note' ? state.note : null; },
    body: { appendChild(modal) { state.modal = modal; } },
    createElement() {
      const previous = { dataset: { dir: '-1' } }, next = { dataset: { dir: '1' } }, close = {};
      return { innerHTML: '', setAttribute() {}, addEventListener() {}, remove() { state.modal = null; },
        querySelector() { return close; }, querySelectorAll() { return [previous, next]; }, previous, next };
    }
  };
  const context = vm.createContext({ document, window: { addEventListener() {} }, console, URL, Date, setTimeout });
  vm.runInContext(source, context);
  return { state, app, run: code => vm.runInContext(code, context) };
}

test('gallery cycles through all six photos and wraps in both directions', () => {
  const { state, run } = browser();
  run('showPhoto(0)');
  for (let i = 0; i < 6; i++) {
    assert.match(state.modal.innerHTML, new RegExp(`${i + 1} / 6`));
    state.modal.next.onclick();
  }
  assert.match(state.modal.innerHTML, /1 \/ 6/);
  state.modal.previous.onclick();
  assert.match(state.modal.innerHTML, /6 \/ 6/);
});

test('choice rerender retains typed notes', () => {
  const { state, run } = browser();
  state.note = { value: 'Keep this note' };
  state.choice = { dataset: { choice: 'Пица' }, addEventListener(_, fn) { this.click = fn; } };
  run('guestDraft={selected:[],note:""}; renderGuest=()=>{}; attach()');
  state.choice.click();
  assert.equal(run('guestDraft.note'), 'Keep this note');
  assert.equal(run('guestDraft.selected[0]'), 'Пица');
});

test('malformed invitation displays error without crashing', async () => {
  const { app, run } = browser();
  await run('fromInvite("#invite=%E0%A4%A")');
  assert.match(app.innerHTML, /Невалиден семеен линк/);
});

test('organizer sees escaped allergy details and notes', () => {
  const { run } = browser();
  run(`adminData={families:[{family:{id:'test',title:'Test',members:[{id:'child',name:'Child'}]},attendance:{},answers:{child:{restrictions:{selected:[],allergyStatus:'has',allergens:'<nuts>',dislikes:'test dislike',note:'test note'}}}}]};`);
  const html = run('adminView()');
  assert.match(html, /&lt;nuts&gt;/);
  assert.match(html, /test dislike/);
  assert.match(html, /test note/);
});

test('six original villa files exist and are JPEGs', async () => {
  for (const name of ['aerial','veranda','garden-wide','garden-terrace','garden-loungers','bedroom']) {
    const bytes = await readFile(new URL(`../public/resources/villa-${name}.jpg`, import.meta.url));
    assert.ok(bytes.length > 1000);
    assert.equal(bytes.readUInt16BE(0), 0xffd8);
  }
});
