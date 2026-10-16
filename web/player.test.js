// node --test web/player.test.js — the two-deck cross-fade, with Web Audio and WebSocket stubbed.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const sockets = [], curves = [], starts = [];
class WS {
  static OPEN = 1;
  constructor() { this.sent = []; this.readyState = 1; this.closed = false; sockets.push(this); queueMicrotask(() => { this.onopen?.(); if (!WS.refuse) queueMicrotask(() => this.text({ deck: 0, status: 'connecting' })); else this.close(WS.refuse); }); }
  send(s) { this.sent.push(JSON.parse(s)); }
  close(code = 1000) { this.closed = true; this.readyState = 3; this.onclose?.({ code }); }
  text(m) { this.onmessage({ data: JSON.stringify(m) }); }
  pcm(seconds) { this.onmessage({ data: new ArrayBuffer(seconds * 48000 * 4) }); }
}
const gain = () => ({ gain: { value: 1, setValueCurveAtTime: (c, at, dur) => curves.push({ edge: c[0], at, dur }) }, connect() {}, disconnect() {} });
globalThis.WebSocket = WS;
globalThis.location = { hostname: 'pages.test', hash: '#a=1&token=sekret', pathname: '/v2.html', search: '' };
globalThis.localStorage = {};
globalThis.document = { body: { hidden: true } }; // <body hidden> in the html
let replaced;
globalThis.history = { replaceState: (...a) => { replaced = a[2]; } };
globalThis.AudioContext = class {
  currentTime = 10; destination = {};
  resume() {}
  createGain = gain;
  createBuffer(ch, frames) { return { duration: frames / 48000, getChannelData: () => new Float32Array(frames) }; }
  createBufferSource() { return { connect() {}, start: t => starts.push(t) }; }
};
mock.timers.enable({ apis: ['setTimeout'] });
const player = await import('./player.js');

test('cross: the new deck fades in when its first chunk is scheduled, then the old deck closes', async () => {
  const seen = [];
  await player.connect('ws://x', m => seen.push(m.status));
  player.send({ prompts: [{ text: 'a', weight: 1 }], control: 'play' });
  sockets[0].text({ status: 'playing' });
  sockets[0].pcm(2);
  assert.deepEqual(starts, [12]); // LEAD
  assert.equal(player.status().buffered, 4);

  await player.cross({ prompts: [{ text: 'b', weight: 1 }], config: { bpm: 130 }, control: 'play' });
  assert.equal(sockets.length, 2);
  assert.equal(sockets[1].sent[1].control, 'play');
  player.send({ config: { bpm: 130, density: 0.5 } }); // steers go to the new deck
  assert.equal(sockets[1].sent.length, 3);
  sockets[0].text({ status: 'reconnecting' }); // the old deck's news is dropped
  sockets[0].pcm(2);
  assert.deepEqual(seen, ['playing']);

  sockets[1].pcm(2);
  assert.deepEqual(curves.map(c => [c.edge, c.at, c.dur]), [[1, 12, 5], [0, 12, 5]]); // out and in, equal power
  mock.timers.tick(2000);
  assert.deepEqual(seen, ['playing', 'crossfading']);
  assert.equal(sockets[0].closed, false);
  mock.timers.tick(5000);
  assert.equal(sockets[0].closed, true);
  assert.deepEqual(seen, ['playing', 'crossfading', 'playing']);
  assert.ok(player.isOpen());
});

test('cross during a fade: no third deck, the current deck takes the reset', async () => {
  await player.cross({ prompts: [{ text: 'c', weight: 1 }], config: { bpm: 135 }, control: 'play' });
  assert.equal(sockets.length, 3);
  sockets[2].pcm(2); // the fade starts, the old deck is still open
  assert.equal(sockets[1].closed, false);
  await player.cross({ prompts: [{ text: 'd', weight: 1 }], config: { bpm: 140 }, control: 'play' });
  assert.equal(sockets.length, 3); // no new socket
  assert.equal(sockets[2].sent.at(-1).control, 'reset');
  assert.equal(curves.length, 4); // no curve on a bus that is still fading
  mock.timers.tick(7000); // LEAD + FADE
  assert.equal(sockets[1].closed, true);
  await player.cross({ prompts: [{ text: 'e', weight: 1 }], config: { bpm: 145 }, control: 'play' }); // after the fade, a new deck again
  assert.equal(sockets.length, 4);
});

test('token: from the fragment into storage, sent first, forgotten on 4401, close code on the rejection, the page goes blank', async () => {
  assert.equal(replaced, '/v2.html#a=1'); // only the token leaves the URL
  assert.equal(localStorage.relayToken, 'sekret');
  assert.equal(document.body.hidden, false); // a token from the fragment: the module shows the page
  assert.deepEqual(sockets.at(-1).sent[0], { token: 'sekret' });
  WS.refuse = 4429;
  await assert.rejects(player.connect('ws://x', () => {}), { code: 4429 });
  assert.equal(localStorage.relayToken, 'sekret'); // busy is not a bad token
  WS.refuse = 4401;
  assert.equal(document.body.hidden, false); // busy does not blank the page
  await assert.rejects(player.connect('ws://x', () => {}), { code: 4401 });
  assert.equal(localStorage.relayToken, undefined);
  assert.equal(document.body.hidden, true);
  document.body.hidden = false;
});

test('reconnect: a lost relay mid-play comes back with backoff and the last prompts; not after STOP', async () => {
  assert.equal(player.RELAY, 'wss://vibepult-relay.fly.dev'); // not a local page
  WS.refuse = undefined;
  localStorage.relayToken = 'sekret';
  const seen = [];
  await player.connect('ws://x', m => seen.push(m.status));
  player.send({ prompts: [{ text: 'f', weight: 1 }], config: { bpm: 150 }, control: 'play' });
  const n = sockets.length;
  sockets.at(-1).close(1006);
  assert.deepEqual(seen, ['reconnecting']);
  WS.refuse = 1006; // the machine is still booting
  mock.timers.tick(1000);
  await new Promise(r => setImmediate(r));
  assert.equal(sockets.length, n + 1);
  WS.refuse = undefined;
  mock.timers.tick(1000); // 2 s: nothing yet
  await new Promise(r => setImmediate(r));
  assert.equal(sockets.length, n + 1);
  mock.timers.tick(1000);
  await new Promise(r => setImmediate(r));
  assert.equal(sockets.length, n + 2);
  assert.deepEqual(sockets.at(-1).sent, [{ token: 'sekret' }, { deck: 0, prompts: [{ text: 'f', weight: 1 }], config: { bpm: 150 }, control: 'play' }]);
  assert.ok(player.isOpen());
  player.send({ control: 'stop' });
  sockets.at(-1).close(1006);
  mock.timers.tick(30000);
  await new Promise(r => setImmediate(r));
  assert.equal(sockets.length, n + 2);
  assert.equal(seen.at(-1), 'closed');
});

test('blank: a page off localhost with no token shows nothing', async () => {
  location.hash = ''; delete localStorage.relayToken;
  await import('./player.js?fresh'); // a second copy of the module, loaded without a token
  assert.equal(document.body.hidden, true);
});
