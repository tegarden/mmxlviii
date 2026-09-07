const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function boot(saved, broken = false) {
  const elements = new Map();
  const listeners = {};
  const element = () => ({ dataset: {}, classList: { add() {} }, append() {}, setAttribute() {}, listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; }, setPointerCapture() {}, focus() {} });
  const storage = { value: saved, getItem() { if (broken) throw Error(); return this.value; }, setItem(key, value) { if (broken) throw Error(); this.value = value; } };
  const context = vm.createContext({ localStorage: storage, document: { addEventListener(type, handler) { listeners[type] = handler; }, createElement: element, querySelectorAll: () => [], querySelector(selector) { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); } } });
  vm.runInContext(source, context);
  return { run: code => { const value = vm.runInContext(code, context); return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }, storage, elements, listeners };
}
const padded = row => [...row, ...Array(12).fill(0)];
test('merges each tile once, compresses gaps, and scores the merged values', () => {
  const app = boot();
  for (const [input, output, score] of [[[2,2,2,2],[4,4,0,0],8], [[2,2,4,0],[4,4,0,0],4], [[2,0,2,4],[4,4,0,0],4], [[4,4,8,8],[8,16,0,0],24]]) {
    const result = app.run(`slide(${JSON.stringify(padded(input))}, 'left')`);
    assert.deepEqual(result.board, padded(output)); assert.equal(result.gained, score);
  }
});
test('all four directions and unchanged moves', () => {
  const app = boot();
  assert.deepEqual(app.run(`slide(${JSON.stringify(padded([2,2,0,0]))}, 'right').board`), padded([0,0,0,4]));
  assert.deepEqual(app.run("slide([2,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0], 'down').board"), [...Array(12).fill(0),4,0,0,0]);
  assert.deepEqual(app.run("slide([2,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0], 'up').board"), padded([4,0,0,0]));
  app.run(`state.board = ${JSON.stringify(padded([2,0,0,0]))}`);
  app.run("move('left')"); assert.deepEqual(app.run('state.board'), padded([2,0,0,0]));
});
test('game over requires a full board without adjacent matches', () => {
  const app = boot();
  assert.equal(app.run('canMove([2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2])'), false);
  assert.equal(app.run('canMove([2,2,2,4,4,2,4,2,2,4,2,4,4,2,4,2])'), true);
});
test('valid moves spawn exactly one tile and persist board, score, best through reload and reset', () => {
  const app = boot(JSON.stringify({ version: 1, board: padded([2,2,0,0]), score: 8, best: 10 }));
  app.run("move('left')");
  assert.equal(app.run('state.score'), 12); assert.equal(app.run('state.best'), 12);
  assert.equal(app.run('state.board.filter(Boolean).length'), 2);
  const reload = boot(app.storage.value); assert.deepEqual(reload.run('state'), app.run('state'));
  reload.run('newGame(); state.score'); assert.equal(reload.run('state.score'), 0); assert.equal(reload.run('state.best'), 12);
});
test('invalid saves recover and preserve valid best; inaccessible storage stays playable', () => {
  for (const saved of ['invalid json', JSON.stringify({version:1,board:[3],score:-1,best:100})]) {
    const app = boot(saved); assert.equal(app.run('state.board.filter(Boolean).length'), 2);
    if (saved.startsWith('{')) assert.equal(app.run('state.best'), 100);
  }
  const app = boot(null, true); assert.equal(app.elements.get('#storage-note').hidden, false);
  assert.equal(app.run('state.board.filter(Boolean).length'), 2);
});

test('arrow keys move, score, and save; other keys and modified arrows are ignored', () => {
  for (const [key, board, destination] of [
    ['ArrowLeft', padded([2,2,0,0]), 0],
    ['ArrowRight', padded([2,2,0,0]), 3],
    ['ArrowUp', [2,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0], 0],
    ['ArrowDown', [2,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0], 12]
  ]) {
    const app = boot(JSON.stringify({version:1, board, score:0, best:0}));
    let prevented = false;
    app.listeners.keydown({key, preventDefault() { prevented = true; }});
    assert.equal(prevented, true);
    assert.equal(app.run('state.score'), 4);
    assert.equal(app.run(`state.board[${destination}]`), 4);
    assert.deepEqual(JSON.parse(app.storage.value).board, app.run('state.board'));
  }
  const app = boot();
  const before = app.run('state');
  for (const event of [{key:'a'}, {key:'ArrowLeft', altKey:true}, {key:'ArrowUp', ctrlKey:true}, {key:'ArrowDown', metaKey:true}, {key:'ArrowRight', shiftKey:true}]) {
    app.listeners.keydown({...event, preventDefault() { assert.fail('Unrelated key intercepted'); }});
  }
  assert.deepEqual(app.run('state'), before);
});

test('spawn selects 2 below the 90% threshold and 4 at or above it', () => {
  const app = boot();
  for (const [random, expected] of [[0, 2], [0.899999, 2], [0.9, 4], [0.999999, 4]]) {
    app.run(`state.board = Array(16).fill(0); Math.random = () => ${random}; spawn()`);
    assert.deepEqual(app.run('state.board.filter(Boolean)'), [expected]);
  }
});

test('grid swipes move in all four directions and persist the result', () => {
  for (const [dx, dy, board, destination] of [
    [-60, 8, padded([2,2,0,0]), 0],
    [60, -8, padded([2,2,0,0]), 3],
    [8, -60, [2,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0], 0],
    [-8, 60, [2,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0], 12]
  ]) {
    const app = boot(JSON.stringify({version:1, board, score:0, best:0}));
    const events = app.elements.get('#board').listeners;
    events.pointerdown({isPrimary:true, button:0, pointerId:1, clientX:100, clientY:100});
    events.pointerup({pointerId:1, clientX:100+dx, clientY:100+dy});
    assert.equal(app.run('state.score'), 4);
    assert.equal(app.run(`state.board[${destination}]`), 4);
    assert.equal(app.run('state.board.filter(Boolean).length'), 2);
    assert.deepEqual(JSON.parse(app.storage.value).board, app.run('state.board'));
    const after = app.run('state');
    events.pointerup({pointerId:1, clientX:100+dx, clientY:100+dy});
    assert.deepEqual(app.run('state'), after);
  }
});

test('taps, short swipes, canceled gestures, and unrelated pointers do not move', () => {
  const app = boot();
  const events = app.elements.get('#board').listeners;
  const before = app.run('state');
  const start = {isPrimary:true, button:0, pointerId:1, clientX:100, clientY:100};
  for (const delta of [0, 23]) {
    events.pointerdown(start);
    events.pointerup({pointerId:1, clientX:100+delta, clientY:100});
  }
  for (const type of ['pointercancel', 'lostpointercapture']) {
    events.pointerdown(start);
    events[type]({pointerId:1});
    events.pointerup({pointerId:1, clientX:200, clientY:100});
  }
  events.pointerdown({...start, button:2});
  events.pointerup({pointerId:1, clientX:200, clientY:100});
  events.pointerdown(start);
  events.pointerup({pointerId:2, clientX:200, clientY:100});
  events.pointerdown({...start, isPrimary:false, pointerId:2});
  events.pointerup({pointerId:1, clientX:200, clientY:100});
  assert.deepEqual(app.run('state'), before);
});

test('game-over overlay appears for a blocked board and clears on restart', () => {
  const board = [2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2];
  const app = boot(JSON.stringify({version:1, board, score:0, best:0}));
  assert.equal(app.elements.get('#game-over').hidden, false);
  app.run('newGame()');
  assert.equal(app.elements.get('#game-over').hidden, true);
  app.run(`state.board = ${JSON.stringify(board)}; state.board[1] = 2; render()`);
  assert.equal(app.elements.get('#game-over').hidden, true);
  app.run(`state.board = ${JSON.stringify(board)}; render()`);
  assert.equal(app.elements.get('#game-over').hidden, false);
});
