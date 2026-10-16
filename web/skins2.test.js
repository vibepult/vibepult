import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skin2, PALETTES, FONTS } from './skins2.js';
import { SLOTS } from './skins.js';
import { THEMES, DAY } from './compose.js';

const decode = u => decodeURIComponent(u.replace(/^data:image\/svg\+xml,/, ''));
const STOPS = DAY.map((_, k) => k);

// WCAG relative luminance and contrast ratio.
const lum = c => {
  const [r, g, b] = [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); };
const family = p => p.font_display.match(/"([^"]+)"/)[1];

test('every theme in compose.js has a palette; an unknown theme is null', () => {
  assert.deepEqual(Object.keys(PALETTES).sort(), Object.keys(THEMES).sort());
  assert.equal(skin2('nope', 0), null);
});

test('palettes: every key, own font and shapes, contrast rules, FONTS loads every face', () => {
  const keys = ['label_name', 'panel', 'panel_inset', 'cap', 'led_on', 'led_off', 'label', 'accent', 'font_display', 'cap_shape', 'led_shape'];
  const fonts = new Set(), shapes = new Set();
  for (const [id, p] of Object.entries(PALETTES)) {
    assert.deepEqual(Object.keys(p).sort(), [...keys].sort(), id);
    assert.equal(p.label_name, THEMES[id].label, id);
    assert.ok(['rect', 'pill', 'chamfer'].includes(p.cap_shape) && ['round', 'square', 'bar'].includes(p.led_shape), id);
    assert.ok(contrast(p.label, p.panel) >= 4.5, `${id}: label on panel ${contrast(p.label, p.panel).toFixed(2)}`);
    assert.ok(contrast(p.led_on, p.led_off) >= 3, `${id}: led on against off ${contrast(p.led_on, p.led_off).toFixed(2)}`);
    fonts.add(family(p)); shapes.add(`${p.cap_shape}/${p.led_shape}`);
    assert.ok(FONTS.includes(`family=${family(p).replace(/ /g, '+')}`), `${id}: FONTS loads ${family(p)}`);
  }
  assert.equal(fonts.size, Object.keys(PALETTES).length, 'a display font per theme');
  assert.equal(shapes.size, Object.keys(PALETTES).length, 'the themes differ in a shape slot');
  assert.ok(FONTS.includes('family=Barlow+Condensed:wght@500;600;700') && FONTS.includes('family=IBM+Plex+Mono:wght@500;700') && FONTS.endsWith('&display=swap'));
});

for (const theme of Object.keys(PALETTES)) {
  test(`${theme}: well-formed SVG data URIs at every stop, deterministic, a scene of its own per stop`, () => {
    const p = PALETTES[theme], scenes = new Set();
    for (const stop of STOPS) {
      const a = skin2(theme, stop), b = skin2(theme, stop);
      assert.deepEqual(Object.keys(a), [...SLOTS, 'lights']);
      for (const slot of SLOTS) {
        const s = decode(a[slot]);
        assert.ok(a[slot].startsWith('data:image/svg+xml,'), slot);
        assert.ok(s.startsWith("<svg xmlns='http://www.w3.org/2000/svg'") && s.endsWith('</svg>'), slot);
        assert.ok(!/[<>#"]/.test(a[slot].slice(19)), `${slot}: raw characters a CSS url() would choke on`);
        assert.equal((s.match(/<(?!\/)/g) || []).length, (s.match(/<\//g) || []).length + (s.match(/\/>/g) || []).length, `${slot}: tags balance`);
        assert.equal(a[slot], b[slot], `${slot}: same theme and stop, same asset`);
      }
      assert.deepEqual(a.lights, b.lights);
      for (const l of a.lights) {
        assert.ok(['candle', 'neon', 'firefly', 'pulse', 'ember', 'flash'].includes(l.kind) && l.r > 0 && l.t > 0, 'a well-formed light');
        assert.ok(l.x < 200 || l.x > 1400 || l.y < 300 || l.y > 790, `stop ${stop}: no light under the desk`);
      }
      assert.ok(decode(a.scene).includes(p.accent), `stop ${stop}: the scene borrows the accent`);
      assert.ok(a.scene.length < 60000, `stop ${stop}: scene is ${a.scene.length} bytes`);
      scenes.add(a.scene);
    }
    assert.equal(scenes.size, STOPS.length, 'another stop, another scene');
    assert.ok(skin2(theme, 7).lights.length > 0, 'the night carries lights');
    assert.ok(skin2(theme, 7).lights.length > skin2(theme, 2).lights.length, 'midday carries fewer lights than night');
    assert.equal(skin2(theme, 0).panel, skin2(theme, 7).panel, 'the desk keeps its grain all day');
  });
}

test('every theme draws its own place', () => {
  for (const stop of STOPS) assert.equal(new Set(Object.keys(PALETTES).map(t => skin2(t, stop).scene)).size, Object.keys(PALETTES).length, `stop ${stop}`);
});
