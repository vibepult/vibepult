// node --test web/steer.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { steer, bpmOf, tempoOf, parseP, formatP, promptKey, BPM, PRODUCTION, PRODUCTION_SHARE, ANCHORS, STYLES, GENRE, INSTRUMENTS, MAX_INSTRUMENTS, MAX_CLAUSES, GROUP_WORDS } from './steer.js';

const IDS = ['aggression', 'serenity', 'darkness', 'rawness', 'speed', 'heaviness', 'grandeur', 'melody',
  'technicality', 'consistency', 'humanity', 'theatricality'];
const board = (values = {}, extra = {}) => ({
  faders: Object.fromEntries(IDS.map(id => [id, { value: values[id] ?? 50, bypass: false }])),
  selectors: { subgenre: { value: null, bypass: true } },
  lyrics: [],
  ...extra,
});
const pack = id => ({ selectors: { subgenre: { value: id, bypass: false } } });
const death = pack('death');
const band = { style: 'melodic' }; // p
const ofDeath = (values = {}, extra = {}) => board(values, { ...death, ...extra });
const anchor = r => r.prompts[0].text;
const layer = r => r.prompts.filter(p => Object.values(PRODUCTION).includes(p.text));
const share = r => layer(r)[0].weight / r.prompts.reduce((s, p) => s + p.weight, 0);

test('at rest: one anchor sentence, the pack production phrase, no fader words, a bare config', () => {
  const r = steer(ofDeath(), band);
  assert.equal(r.prompts.length, 2);
  assert.ok(anchor(r).startsWith('melodic death metal song with '), anchor(r));
  for (const id of ANCHORS.death.pads) assert.ok(anchor(r).includes(INSTRUMENTS[id]));
  assert.equal(r.prompts[0].weight, 1.0);
  assert.equal(r.prompts[1].text, PRODUCTION.death);
  assert.deepEqual(r.config, { bpm: BPM['death metal'], guidance: 4, musicGenerationMode: 'QUALITY' }); // the genre's own priors decide the rest
});

test('the production layer holds its share of the total weight; p.production pins it, 0 drops it', () => {
  for (const r of [steer(ofDeath(), band), steer(ofDeath({ speed: 100, darkness: 90, grandeur: 5 }), { ...band, inst: ['fiddle', 'bagpipes'] })]) {
    assert.ok(Math.abs(share(r) - PRODUCTION_SHARE) < 0.02, `${share(r)}`);
  }
  assert.equal(PRODUCTION_SHARE, 0.2);
  assert.ok(Math.abs(share(steer(ofDeath(), { production: 0.4 })) - 0.4) < 0.02);
  assert.equal(steer(ofDeath(), { production: 0 }).prompts.length, 1);
  for (const id of Object.keys(GENRE)) assert.ok(PRODUCTION[id].startsWith('studio recording, ') && PRODUCTION[id].includes('live drummer'), id);
});

test('faders steer from inside the sentence: riff words lead, lead words qualify, layers close', () => {
  const r = steer(board({ speed: 100, aggression: 75, melody: 10 }));
  assert.ok(anchor(r).startsWith('fast, frantic, aggressive heavy metal song with '), anchor(r)); // strongest push first
  assert.ok(anchor(r).endsWith(', with atonal, riff-driven lead lines'), anchor(r));
  assert.equal(r.prompts.length, 2); // no tag prompts
  const all = steer(board({ aggression: 100, speed: 90, heaviness: 80, rawness: 70, grandeur: 95 }));
  assert.ok(anchor(all).startsWith('aggressive, fast, frantic heavy metal song'), anchor(all)); // GROUP_WORDS: Heavy and Raw are cut
  assert.ok(anchor(all).endsWith(', epic orchestral layers behind the band'), anchor(all));
  assert.equal(GROUP_WORDS, 2);
});

test('MAX_CLAUSES caps what follows "song with": pads first, then the strongest fader clauses', () => {
  const b = board({ melody: 100, grandeur: 90, theatricality: 80, humanity: 70 });
  const three = anchor(steer(b)); // three default pads leave two slots
  assert.ok(three.includes('with melodic, harmonized lead lines, epic orchestral layers behind the band'), three);
  assert.ok(!three.includes('choir') && !three.includes('live band'), three);
  const five = anchor(steer(b, { inst: ['rhythm', 'lead', 'bass', 'keys', 'choir'] }));
  assert.ok(!five.includes('lead lines') && !five.includes('orchestral'), five); // five pads: the listener chose
  const none = anchor(steer(b, { inst: [] }));
  assert.equal(none, 'heavy metal song with melodic, harmonized lead lines, epic orchestral layers behind the band, a dramatic symphonic choir'); // GROUP_WORDS cuts Human
  assert.equal(MAX_CLAUSES, 5);
  assert.ok(MAX_INSTRUMENTS <= MAX_CLAUSES);
});

test('a pack may reword a pad: black metal is tremolo, doom slow fuzz, the rest palm-muted', () => {
  const black = anchor(steer(board({}, pack('black'))));
  assert.ok(black.includes('tremolo-picked') && !black.includes('palm-muted'), black);
  assert.ok(anchor(steer(board({}, pack('doom')))).includes('fuzzed-out'));
  assert.ok(anchor(steer(ofDeath())).includes(INSTRUMENTS.rhythm));
  for (const a of Object.values(ANCHORS)) for (const id of Object.keys(a.words ?? {})) assert.ok(INSTRUMENTS[id], id);
});

test('bypass and the deadband drop a fader, its words and its config field', () => {
  const b = board({ speed: 100, aggression: 54, darkness: 100 });
  b.faders.speed.bypass = true;
  b.faders.darkness.bypass = true;
  assert.ok(anchor(steer(b)).startsWith('heavy metal song'), anchor(steer(b)));
  assert.equal(steer(b).config.bpm, 130); // bypassed Fast reads as 50
  assert.equal(steer(b).config.brightness, undefined);
});

test('the anchor is the selector pack plus a style of that pack; a foreign style is dropped', () => {
  assert.equal(steer(ofDeath(), band).anchor, 'melodic death metal');
  assert.equal(steer(board()).anchor, 'heavy metal'); // bypassed selector: steel
  assert.equal(steer(board(), { style: 'funeral' }).anchor, 'heavy metal'); // not a steel style
  const doom = board({}, pack('doom'));
  assert.equal(steer(doom, { style: 'sludge metal' }).anchor, 'sludge metal'); // a whole genre replaces the word
  assert.equal(steer(doom, { style: 'funeral' }).anchor, 'funeral doom metal');
  assert.equal(steer(doom).config.musicGenerationMode, 'QUALITY');
  assert.equal(steer(board({}, pack('folk')), { style: 'pagan' }).config.musicGenerationMode, 'VOCALIZATION');
  for (const id of Object.keys(GENRE)) { // every pack offers styles, names known pads, has a tempo and a production phrase
    assert.ok(STYLES[id].length, id);
    assert.ok(ANCHORS[id].pads.every(x => INSTRUMENTS[x]), id);
    assert.ok(BPM[GENRE[id]] && PRODUCTION[id], id);
  }
});

test('the config carries only what a fader asked for; p= pins any field', () => {
  const r = steer(board({ speed: 20, darkness: 80, technicality: 25, consistency: 100 }));
  assert.deepEqual(r.config, { bpm: 120, brightness: 0.2, density: 0.25, temperature: 0.7, guidance: 4, musicGenerationMode: 'QUALITY' });
  assert.equal(steer(board({ consistency: 0 })).config.temperature, 1.4);
  const p = parseP('style:middle+eastern,inst:fiddle+nope+choir,mode:VOCALIZATION,guidance:5.5,seed:7,temperature:0.7,brightness:0.3,bogus:1,bpm:x');
  assert.deepEqual(steer(board(), p).config, { bpm: 130, brightness: 0.3, temperature: 0.7, guidance: 5.5, musicGenerationMode: 'VOCALIZATION', seed: 7 });
  assert.equal(p.style, 'middle eastern');
  assert.deepEqual(p.inst, ['fiddle', 'choir']);
  assert.equal(formatP(p), 'style:middle+eastern,inst:fiddle+choir,mode:VOCALIZATION,guidance:5.5,seed:7,temperature:0.7,brightness:0.3');
  assert.deepEqual(parseP(formatP(p)), p);
});

test('bpm is the anchor word\'s tempo; Fast moves it ±20 in 5 bpm steps', () => {
  assert.equal(bpmOf(0), 110);
  assert.equal(bpmOf(100), 150);
  assert.equal(bpmOf(20), 120);
  assert.equal(bpmOf(22), 120); // same step: no new deck
  assert.equal(tempoOf('doom', ''), 70);
  assert.equal(tempoOf('doom', 'funeral'), 50); // a modifier the table knows
  assert.equal(tempoOf('doom', 'sludge metal'), 75); // a whole style
  assert.equal(tempoOf('doom', 'epic'), 70); // an unknown modifier: the pack's word
  assert.equal(steer(board({}, pack('doom'))).config.bpm, 70);
  assert.equal(steer(board({ speed: 100 }, pack('thrash'))).config.bpm, 190);
  for (const [word, bpm] of Object.entries(BPM)) assert.ok(bpm >= 50 && bpm <= 200 && bpm % 5 === 0, word);
});

test('instrument pads: the pack defaults until p.inst, capped, joined into the anchor sentence', () => {
  const mine = steer(ofDeath(), { inst: ['bagpipes'] });
  assert.equal(anchor(mine), `death metal song with ${INSTRUMENTS.bagpipes}`);
  assert.equal(anchor(steer(ofDeath(), { inst: [] })), 'death metal song');
  assert.equal(parseP(`inst:${Object.keys(INSTRUMENTS).join('+')}`).inst.length, MAX_INSTRUMENTS);
  assert.notEqual(steer(ofDeath()).cut, mine.cut); // a pad change is a new deck
  assert.equal(steer(ofDeath({ speed: 90 })).cut, steer(ofDeath()).cut); // a fader move is not
});

test('promptKey ignores order and matches what the relay echoes', () => {
  const sent = [{ text: 'a', weight: 0.37 }, { text: 'b', weight: 1 }];
  assert.equal(promptKey(sent), promptKey([{ text: 'b', weight: 1.0 }, { text: 'a', weight: 0.37 }]));
  assert.notEqual(promptKey(sent), promptKey([{ text: 'a', weight: 0.4 }, { text: 'b', weight: 1 }]));
});
