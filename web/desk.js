// The control surface both desks share: strips, levers, stepped selectors, the lyrics bank, pointer and
// keyboard wiring, the per-frame control render, skins and the desk scale. A page (console.js for the v0
// browser, pult.js for the v1 player, v2.js for v2) mounts it with hooks for what the controls drive.
import { applyKey } from './engine.js';
import { skin, SLOTS } from './skins.js';

export const $ = id => document.getElementById(id);
export const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v);
  }
  n.append(...kids);
  return n;
};
const SEGMENTS = 16; // meter LEDs per strip
const CAP = 36; // fader cap height, matches --cap-h in style.css
const LEVER_CAP = 28; // lever cap width / master cap height, matches --lever-cap
const CHEVRON = { '-1': 'M15 6l-6 6 6 6', '1': 'M9 6l6 6-6 6' };
const READOUT_HIDE_MS = 600;
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export let data, state, manifest = {};
export const ui = { faders: {}, knobs: {}, selectors: {}, lyrics: {} };
let page, openReadout, touched = false;

// Hooks: render() runs after the controls each frame, commit() on release or a stepped change, filter() before
// render when a selector or lyric pad changes, readout() adds to the slider readout, dead(id) and deadLyrics()
// name options to grey.
export function mount(d, s, hooks) {
  data = d; state = s;
  page = { render() {}, commit() {}, filter() {}, readout: () => '', dead: () => [], deadLyrics: () => [], ...hooks };
  touched = Boolean($('hint')?.hidden);
  $('switch')?.addEventListener('click', e => { // the other desk, same board
    e.currentTarget.href = e.currentTarget.getAttribute('href').split('#')[0] + location.hash;
  });
  addEventListener('hashchange', () => location.reload()); // a pasted share link in an open tab
}

// ---------------------------------------------------------------------------------------------- load

export class LoadError extends Error {
  constructor(message, fix) { super(message); this.fix = fix; }
}

export async function fetchData() {
  try {
    if (location.protocol === 'file:') throw new LoadError('opened from file://, where the browser blocks loading bands.json', 'serve');
    const res = await fetch('bands.json', { cache: 'no-store' });
    if (res.status === 404) throw new LoadError('bands.json is missing because publish has not run', 'publish');
    if (!res.ok) throw new LoadError(`bands.json returned HTTP ${res.status}`, 'serve');
    const d = await res.json();
    manifest = await fetch('skins/manifest.json').then(m => (m.ok ? m.json() : {})).catch(() => ({})); // bitmap slot overrides, optional
    return d;
  } catch (e) {
    throw e instanceof LoadError ? e : new LoadError(`bands.json could not be read (${e.message})`, 'publish');
  }
}

export function loadErrorLines(e) {
  return [
    el('p', { text: `Cause: ${e.message}.` }),
    el('p', { text: e.fix === 'serve' ? 'Serve the page over http:' : 'Publish the pool, then reload:' }),
    el('code', { text: e.fix === 'serve' ? 'python web/serve.py' : 'python -m ingest publish && python -m ingest check' }),
    el('p', { text: `then open http://localhost:8000${location.pathname === '/' ? '' : location.pathname}` }),
  ];
}

// --------------------------------------------------------------------------------------------- build

// The ON/OFF button on every fader and lever: ON while the control is engaged, OFF while bypassed.
export function bypassButton(name, ctl, wrap, onToggle) {
  const b = el('button', { class: 'onoff', type: 'button', 'aria-label': `Use ${name}` });
  b.addEventListener('click', () => {
    ctl.bypass = !ctl.bypass;
    onToggle?.();
    syncBypass(b, ctl, wrap);
    interacted();
    render();
    page.commit();
  });
  syncBypass(b, ctl, wrap);
  return b;
}

function syncBypass(button, ctl, wrap) {
  button.setAttribute('aria-pressed', String(!ctl.bypass));
  button.textContent = ctl.bypass ? 'OFF' : 'ON';
  wrap.classList.toggle('is-off', ctl.bypass);
}

export function buildStrips(faderText, onTouch, onUntouch) {
  data.faders.forEach((f, i) => buildStrip(f, i + 1, faderText, onTouch, onUntouch));
}

function buildStrip(f, n, faderText, onTouch, onUntouch) {
  const ctl = state.faders[f.id];
  const strip = el('div', { class: 'strip', 'data-id': f.id });
  const onoff = bypassButton(f.label, ctl, strip, () => { if (ctl.bypass) onUntouch?.(f.id); });
  const head = el('div', { class: 'strip__head' }, el('span', { class: 'strip__num', text: `CH${n}` }), onoff);
  const cap = el('div', {
    class: 'cap', role: 'slider', tabindex: '0', 'aria-labelledby': `lbl-${f.id}`,
    'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-orientation': 'vertical',
  });
  const rail = el('div', { class: 'rail' }, cap);
  // Reference ticks: the band nearest each quintile, names on hover (docs/designs/console).
  const ticks = el('div', { class: 'ticks' }, ...f.ticks.map(t => {
    const s = el('span', { class: 'tick', title: t.name, text: t.short });
    s.style.setProperty('--v', t.value);
    return s;
  }));
  const meter = el('div', { class: 'meter', 'aria-hidden': 'true' }, ...Array.from({ length: SEGMENTS }, () => el('i')));
  const readout = el('div', { class: 'readout', hidden: '' });
  const value = el('span', { class: 'lcd' });
  const scribble = el('div', { class: 'scribble' }, value, el('span', { class: 'scribble__name', id: `lbl-${f.id}`, text: f.label }));
  strip.append(scribble, el('div', { class: 'strip__fader' }, meter, el('div', { class: 'fader' }, ticks, rail)), head, readout); // name and value on top, ON/OFF below
  document.querySelector(`.strips[data-group="${f.group}"] .strips__inner`).append(strip);

  const setValue = v => { ctl.value = Math.round(Math.min(100, Math.max(0, v))); };
  const fromPointer = e => {
    const r = rail.getBoundingClientRect();
    setValue(100 * (r.bottom - CAP / 2 - e.clientY) / (r.height - CAP));
  };
  const text = () => faderText(f, ctl.value);
  ui.faders[f.id] = { strip, cap, meter, ctl, text, engage: onoff, value };
  wireSlider({ surface: rail, focus: cap, ctl, readout, text, fromPointer, setValue, min: 0, max: 100, unit: 1,
               onTouch: () => onTouch?.(f.id) });
}

// Knobs are horizontal levers (2026-10-07): a cap on a rail with a notch per detent, absolute like a fader.
export function buildKnob(k, knobText) {
  const ctl = state.knobs[k.id];
  const wrap = el('div', { class: 'lever' });
  const engage = bypassButton(k.label, ctl, wrap);
  ui.knobs[k.id] = buildLever(k, ctl, wrap, engage, () => knobText(k, ctl.value),
    () => (k.step ? String(Math.round(ctl.value)) : ctl.value.toFixed(2)));
  document.querySelector('.levers').append(wrap);
}

export function buildLever(k, ctl, wrap, engage, text, valueText, vertical = false) {
  const cap = el('div', {
    class: 'lever__cap', role: 'slider', tabindex: '0', 'aria-label': k.label,
    'aria-orientation': vertical ? 'vertical' : 'horizontal',
    'aria-valuemin': String(k.min), 'aria-valuemax': String(k.max),
  });
  const pct = v => 100 * (v - k.min) / (k.max - k.min);
  const track = el('div', { class: 'lever__track' }, ...(k.detents || []).map(d => {
    const n = el('i', { class: 'detent' });
    n.style.setProperty('--v', pct(d));
    return n;
  }), cap);
  const value = el('span', { class: 'lcd lever__val' });
  const readout = el('div', { class: 'readout', hidden: '' });
  wrap.append(el('div', { class: 'lever__head' }, ...(engage ? [engage] : []), el('span', { class: 'lever__name', text: k.label }), value), track, readout);

  const range = k.max - k.min;
  const unit = k.step || range / 100;
  const setValue = v => { ctl.value = Math.min(k.max, Math.max(k.min, k.step ? Math.round(v / k.step) * k.step : v)); };
  const fromPointer = e => {
    const r = track.getBoundingClientRect();
    const t = vertical ? (r.bottom - LEVER_CAP / 2 - e.clientY) / (r.height - LEVER_CAP)
      : (e.clientX - r.left - LEVER_CAP / 2) / (r.width - LEVER_CAP);
    setValue(k.min + range * t);
  };
  wireSlider({ surface: track, focus: cap, ctl, readout, text, fromPointer, setValue, min: k.min, max: k.max, unit });
  track.addEventListener('wheel', e => {
    if (!e.deltaY) return; // horizontal trackpad swipe: not a turn, and the page may scroll
    e.preventDefault();
    setValue(ctl.value - Math.sign(e.deltaY) * unit);
    ctl.bypass = false;
    interacted();
    render();
    clearTimeout(track.wheelTimer);
    track.wheelTimer = setTimeout(() => page.commit(), 300);
  }, { passive: false });
  return { cap, value, ctl, text, valueText, wrap, engage, pct };
}

export function buildSelector(s, label) {
  const ctl = state.selectors[s.id];
  buildStepped(s.id, s.label, [{ v: '', t: 'Any' }, ...s.options.map(o => ({ v: o, t: label(o) }))],
    () => (ctl.bypass ? '' : ctl.value),
    v => { ctl.value = v || null; ctl.bypass = ctl.value === null; },
    () => page.dead(s.id));
}

// Stepped selector (the mock's take on a dropdown): prev/next buttons around a native select styled as an LCD.
// Option 0 is Any, which is the bypass. Stepping skips options the page greys.
export function buildStepped(id, label, options, get, set, dead = () => []) {
  const wrap = el('div', { class: 'select' });
  const select = el('select', { id: `sel-${id}`, class: 'select__value lcd' },
    ...options.map(o => el('option', { value: o.v, text: o.t })));
  const pos = el('span', { class: 'select__pos' });
  const change = () => { set(select.value); interacted(); page.filter(); render(); page.commit(); };
  select.addEventListener('change', change);
  const step = dir => {
    let i = select.selectedIndex;
    do i = (i + dir + options.length) % options.length; while (select.options[i].disabled);
    select.selectedIndex = i;
    change();
  };
  const arrow = dir => {
    const b = el('button', { class: 'select__step', type: 'button', 'aria-label': `${dir < 0 ? 'Previous' : 'Next'} ${label}` });
    b.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="${CHEVRON[dir]}"/></svg>`;
    b.addEventListener('click', () => step(dir));
    return b;
  };
  wrap.append(el('div', { class: 'select__head' }, el('label', { class: 'select__name', for: `sel-${id}`, text: label }), pos),
    el('div', { class: 'select__box' }, arrow(-1), select, arrow(1)));
  document.querySelector('.selects').append(wrap);
  ui.selectors[id] = { select, pos, wrap, get, dead };
}

// Lyrics: the button bank. One pad per lyric axis from Metal Archives themes; pressed pads are a union, none
// pressed means any. No bypass button: an empty bank is the bypass.
export function buildLyrics(l) {
  const grid = document.querySelector('.bank__grid');
  for (const o of l.options) {
    const b = el('button', { class: 'pad', type: 'button', 'aria-pressed': 'false', text: o.label });
    b.addEventListener('click', () => {
      state.lyrics = state.lyrics.includes(o.id) ? state.lyrics.filter(x => x !== o.id) : [...state.lyrics, o.id];
      interacted();
      page.filter();
      render();
      page.commit();
    });
    ui.lyrics[o.id] = b;
    grid.append(b);
  }
}

// One handler for faders and levers (D13): pointer drag, keys, readout, commit on release.
function wireSlider({ surface, focus, ctl, readout, text, fromPointer, setValue, min, max, unit, onTouch }) {
  let hideTimer;
  readout.refresh = () => { readout.textContent = text() + page.readout(); };
  const show = () => {
    clearTimeout(hideTimer);
    if (openReadout && openReadout !== readout) openReadout.hidden = true; // only the most recent one shows
    openReadout = readout;
    readout.hidden = false;
    readout.refresh();
  };
  const hideSoon = () => { clearTimeout(hideTimer); hideTimer = setTimeout(() => { readout.hidden = true; }, READOUT_HIDE_MS); };
  const engage = () => { ctl.bypass = false; onTouch?.(); interacted(); };

  surface.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !e.isPrimary) return;
    if (e.pointerType !== 'mouse' && e.target !== focus) return; // a finger grabs the cap; on the rail it scrolls the page
    surface.setPointerCapture(e.pointerId);
    focus.focus({ preventScroll: true });
    engage();
    fromPointer(e);
    render();
    show();
    surface.dragging = true;
  });
  surface.addEventListener('pointermove', e => {
    if (!surface.dragging) return;
    fromPointer(e);
    scheduleRender();
    show();
  });
  const end = () => {
    if (!surface.dragging) return;
    surface.dragging = false;
    hideSoon();
    page.commit();
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);
  surface.addEventListener('lostpointercapture', end);
  surface.addEventListener('pointerenter', show);
  surface.addEventListener('pointerleave', () => { if (!surface.dragging && document.activeElement !== focus) hideSoon(); });
  focus.addEventListener('focus', show);
  focus.addEventListener('blur', hideSoon);
  let keyHeld = false;
  focus.addEventListener('keydown', e => {
    const v = applyKey(ctl.value, e.key, e.shiftKey, min, max, unit);
    if (v === null) return;
    e.preventDefault();
    keyHeld = true;
    setValue(v);
    engage();
    render();
    show();
  });
  focus.addEventListener('keyup', e => {
    if (!keyHeld || applyKey(0, e.key, false) === null) return; // a key pressed elsewhere and released here commits nothing
    keyHeld = false;
    page.commit(); // key release commits (D5)
  });
}

// -------------------------------------------------------------------------------------------- render

let frame = 0;
export function scheduleRender() {
  if (!frame) frame = requestAnimationFrame(() => { frame = 0; render(); });
}

// Live, every frame (D5): slider positions, selector values, pads, then the page's own readouts.
export function render() {
  for (const { strip, cap, ctl, text, engage, value } of Object.values(ui.faders)) {
    syncBypass(engage, ctl, strip);
    strip.style.setProperty('--v', ctl.value);
    cap.setAttribute('aria-valuenow', String(ctl.value));
    cap.setAttribute('aria-valuetext', text());
    value.textContent = String(ctl.value);
  }
  for (const { cap, value, ctl, text, valueText, wrap, engage, pct } of Object.values(ui.knobs)) {
    if (engage) syncBypass(engage, ctl, wrap);
    wrap.style.setProperty('--v', pct(ctl.value));
    cap.setAttribute('aria-valuenow', String(+ctl.value.toFixed(2)));
    cap.setAttribute('aria-valuetext', text());
    value.textContent = valueText();
  }
  for (const { select, pos, wrap, get, dead } of Object.values(ui.selectors)) {
    select.value = get();
    const gone = new Set(dead());
    for (const o of select.options) {
      o.disabled = o.value !== '' && gone.has(o.value) && o.value !== select.value;
      o.title = o.disabled ? 'no band left' : '';
    }
    pos.textContent = `${select.selectedIndex + 1}/${select.options.length}`;
    wrap.classList.toggle('is-any', select.value === '');
  }
  const deadAxes = new Set(page.deadLyrics());
  for (const [id, b] of Object.entries(ui.lyrics)) {
    const pressed = state.lyrics.includes(id);
    b.setAttribute('aria-pressed', String(pressed));
    b.disabled = !pressed && deadAxes.has(id);
    b.title = b.disabled ? 'no band left' : '';
  }
  page.render();
  if (openReadout && !openReadout.hidden) openReadout.refresh(); // after the page knows its answer
}

// Two brightnesses: dim up to the fader (the ask), bright up to where the reference band sits. `asks` replaces the
// fader as the dim level (v2: where the day alone would put it).
export function lightMeters(band, asks = null) {
  for (const [id, { meter, ctl }] of Object.entries(ui.faders)) {
    const lit = band && band.faders[id] !== undefined ? Math.round(band.faders[id] / 100 * SEGMENTS) : 0;
    const ask = ctl.bypass ? 0 : Math.round((asks ? asks[id] : ctl.value) / 100 * SEGMENTS);
    [...meter.children].forEach((seg, i) => {
      seg.classList.toggle('on', i < lit);
      seg.classList.toggle('ask', i < ask);
    });
  }
}

// Adopt a state the engine computed. The ui closures hold the control objects, so each is updated in place.
// Caps glide 150 ms.
export function settle(next) {
  for (const group of ['faders', 'knobs', 'switches', 'selectors']) {
    for (const [id, ctl] of Object.entries(next[group])) Object.assign(state[group][id], ctl);
  }
  state.lyrics = next.lyrics;
  state.underground.value = next.underground.value;
  const root = document.documentElement;
  root.classList.add('settling');
  setTimeout(() => root.classList.remove('settling'), 200);
}

// ---------------------------------------------------------------------------------------------- skin

export function applyPack(name, slug, trim) {
  const p = data.packs[name] || data.packs.steel;
  applyAssets(name, p, skin(name, slug, p, manifest, trim)); // procedural asset set (docs/designs/skins.md), null for a palette-only pack
}

// Put a skin on the page: the slot images (none when `assets` is null), the light layer, the palette, the font and
// the shape slots. v2 brings its own palette and asset set (skins2.js).
export function applyAssets(name, p, assets) {
  const root = document.documentElement;
  for (const slot of SLOTS) {
    if (assets) root.style.setProperty(`--${slot}`, `url("${assets[slot]}")`);
    else root.style.removeProperty(`--${slot}`);
  }
  renderLights(assets?.lights || []);
  for (const slot of ['panel', 'panel_inset', 'cap', 'led_on', 'led_off', 'label', 'accent']) {
    root.style.setProperty(`--${slot.replace('_', '-')}`, p[slot]);
  }
  root.style.setProperty('--font-display', p.font_display);
  root.dataset.cap = p.cap_shape;
  root.dataset.led = p.led_shape;
  root.dataset.pack = name;
}

// The animated light layer behind the desk: one blurred disc per light the scene reported, in scene coordinates
// that fitDesk maps onto the viewport the same way background-size: cover maps the scene.
function renderLights(lights) {
  let box = $('lights');
  if (!box) box = document.body.insertBefore(el('div', { id: 'lights', 'aria-hidden': 'true' }), $('console'));
  box.replaceChildren(...lights.map(l => {
    const n = el('i', { class: `light light--${l.kind}` });
    n.style.cssText = `--x:${l.x};--y:${l.y};--r:${l.r};--c:${l.color};--d:${l.d}s;--t:${l.t}s`;
    return n;
  }));
}

// ---------------------------------------------------------------------------------------------- misc

// Screen readers re-announce a live region on every write, so write only when the text changes (render runs per frame).
export const say = text => { if ($('announce').textContent !== text) $('announce').textContent = text; };

export function interacted() {
  if (touched) return;
  touched = true;
  $('hint').hidden = true;
}

// Share link: `#s=<board>&p=<player>`, each page rewrites its own key and the other rides along
// Hand-split, so values keep their `:` and `,` unencoded.
export const readHash = key => location.hash.slice(1).split('&').find(kv => kv.startsWith(`${key}=`))?.slice(key.length + 1) ?? null;
export function writeHash(key, value) {
  const rest = location.hash.slice(1).split('&').filter(kv => kv && !kv.startsWith(`${key}=`));
  history.replaceState(null, '', `#${[...(value ? [`${key}=${value}`] : []), ...rest].join('&')}`); // an empty value drops the key
}

// Desktop scale: the 1440 x 876 reference desk fills 80 percent of the viewport, whichever side binds (DESK_SHARE).
const DESK_SHARE = 0.8;
function fitDesk() {
  $('console').style.setProperty('--zoom', Math.min(DESK_SHARE * innerWidth / 1440, DESK_SHARE * innerHeight / 876).toFixed(3));
  const ss = Math.max(innerWidth / 1600, innerHeight / 900); // the scene's cover scale, for the light layer
  const root = document.documentElement.style;
  root.setProperty('--ss', ss.toFixed(4));
  root.setProperty('--sx', `${((innerWidth - 1600 * ss) / 2).toFixed(1)}px`);
  root.setProperty('--sy', `${((innerHeight - 900 * ss) / 2).toFixed(1)}px`);
}
addEventListener('resize', fitDesk);
fitDesk();
