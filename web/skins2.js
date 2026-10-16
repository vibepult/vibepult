// v2 theme skins: each theme in compose.js THEMES gets its own palette and its own place, seen at the stop of the day.
// Same rules as skins.js (docs/designs/skins.md): tiles are grey overlay, scenes own their colours and borrow the
// accent for lights, motifs go where the desk does not cover (x < 160 or > 1440, y < 110 or > 790 of 1600 x 900).
// The scene seed is `${theme}:${stop}`; the tiles are seeded by the theme alone, so the desk keeps its grain all day.
import { kit } from './skins.js';
import { THEMES } from './compose.js';

const { hash, rng, between, i, svg, use, grain, relief, mist, blur, vignette, sky, glow, dots, neon, light, SCENE, W, H, corners, faces,
  lcd, matte, carbon, parchment, knurl, diamondPlate, tolex, oak, leather, gold } = kit;

// ------------------------------------------------------------------------------------------ palettes
// The bands.json pack shape. Dark panels: the page derives the whole desk from these (top of style.css).

const pack = (id, o) => ({ label_name: THEMES[id].label, ...o });
export const PALETTES = {
  techno: pack('techno', { panel: '#2c2d2f', panel_inset: '#1b1c1e', cap: '#b4b7ba', led_on: '#ff6a13', led_off: '#3b3c3f', label: '#d9dbdd', accent: '#ff6a13',
    font_display: '"Michroma", "Barlow Condensed", sans-serif', cap_shape: 'rect', led_shape: 'bar' }),
  house: pack('house', { panel: '#2f2119', panel_inset: '#1f150f', cap: '#c9a25a', led_on: '#ff4fa3', led_off: '#46322a', label: '#ead6b4', accent: '#ff4fa3',
    font_display: '"Righteous", "Barlow Condensed", sans-serif', cap_shape: 'pill', led_shape: 'round' }),
  bass: pack('bass', { panel: '#17213a', panel_inset: '#0e1526', cap: '#c3c9d6', led_on: '#ffd400', led_off: '#2a3552', label: '#cbd5e8', accent: '#ffd400',
    font_display: '"Bungee", "Barlow Condensed", sans-serif', cap_shape: 'chamfer', led_shape: 'square' }),
  balearic: pack('balearic', { panel: '#1c3448', panel_inset: '#122434', cap: '#eef0ea', led_on: '#ff7a5c', led_off: '#30485c', label: '#e8f0f4', accent: '#ff7a5c',
    font_display: '"Pacifico", "Barlow Condensed", cursive', cap_shape: 'pill', led_shape: 'bar' }),
  afro: pack('afro', { panel: '#3a2219', panel_inset: '#26150f', cap: '#d9a441', led_on: '#2fe0c8', led_off: '#4c3126', label: '#f2dcb8', accent: '#2fe0c8',
    font_display: '"Rammetto One", "Barlow Condensed", sans-serif', cap_shape: 'chamfer', led_shape: 'round' }),
  dubstep: pack('dubstep', { panel: '#121514', panel_inset: '#0a0c0b', cap: '#8f9692', led_on: '#7dff3a', led_off: '#26302a', label: '#c9d4cc', accent: '#7dff3a',
    font_display: '"Zen Dots", "Barlow Condensed", sans-serif', cap_shape: 'rect', led_shape: 'square' }),
};
// Every display face above, plus the two faces the desk itself needs.
export const FONTS = `https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@500;700&${
  Object.values(PALETTES).map(p => `family=${p.font_display.match(/"([^"]+)"/)[1].replace(/ /g, '+')}`).join('&')}&display=swap`;

// ------------------------------------------------------------------------------------------ daylight
// One row per stop of compose.js DAY: sky top and bottom, the sun (or moon) colour and place, the haze, and how lit
// the place is (1 is noon, near 0 is night). Every scene reads it, so each place is seen through the whole day.

const DAYLIGHT = [
  { top: '#33406e', bottom: '#f0a982', sun: '#ffd9a8', x: 150, y: 330, haze: '#f4c3a6', lit: .62 }, // 7:00 dawn
  { top: '#4a8bd0', bottom: '#cfe5f1', sun: '#fff6dc', x: 380, y: 160, haze: '#e6f0f4', lit: .95 }, // 9:00 bright morning
  { top: '#2c79d2', bottom: '#a8d4ef', sun: '#ffffff', x: 800, y: 58, haze: '#eef5f8', lit: 1 }, // 12:30 midday
  { top: '#3d82c6', bottom: '#d3e3e6', sun: '#fff2cc', x: 1200, y: 92, haze: '#efe8d6', lit: .9 }, // 14:00 afternoon
  { top: '#5679b0', bottom: '#f4c07c', sun: '#ffd07a', x: 1430, y: 230, haze: '#f4d09a', lit: .74 }, // 16:30 golden hour
  { top: '#363a70', bottom: '#ff7f4e', sun: '#ff9348', x: 1470, y: 380, haze: '#ff9a70', lit: .5 }, // 19:00 sunset
  { top: '#161c40', bottom: '#6e4468', sun: '#f2eedc', x: 130, y: 210, haze: '#5e4470', lit: .28, moon: true }, // 20:30 dusk
  { top: '#060914', bottom: '#131a30', sun: '#e6ebf4', x: 1460, y: 110, haze: '#262c4c', lit: .12, moon: true }, // 22:30 night
];
const daylight = stop => DAYLIGHT[Math.max(0, Math.min(DAYLIGHT.length - 1, stop | 0))];

const rgb = c => [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16));
const mix = (a, b, t) => `#${rgb(a).map((v, k) => i(v + (rgb(b)[k] - v) * t).toString(16).padStart(2, '0')).join('')}`;
// tone: a day colour dimmed by the hour; far: the same, sunk into the haze.
const shades = d => { const tone = c => mix(c, '#05070c', .88 * (1 - d.lit)); return { tone, far: c => mix(tone(c), d.haze, .4), on: d.lit < .55 }; };
// A light for the animated layer, dropped when the desk would hide it.
const shine = (r, L, kind, x, y, rad, color) => (x < 200 || x > 1400 || y < 300 || y > 790) && light(r, L, kind, x, y, rad, color);

// The sky at a stop: gradient, the sun or a crescent moon with its glow, stars after dark, a haze band on the horizon.
const heaven = (r, d, horizon) => `${sky(d.top, d.bottom)}${glow('sun', d.sun, d.moon ? .35 : .6)}
  <linearGradient id='haze' x2='0' y2='1'><stop offset='0' stop-color='${d.haze}' stop-opacity='0'/><stop offset='1' stop-color='${d.haze}' stop-opacity='.55'/></linearGradient>
  ${d.lit < .4 ? dots(r, 140, [0, 0, W, horizon - 60], '#f4f1e8', .5, 1.6) : ''}
  <circle cx='${d.x}' cy='${d.y}' r='${d.moon ? 200 : 320}' fill='url(#sun)'/><circle cx='${d.x}' cy='${d.y}' r='${d.moon ? 40 : 58}' fill='${d.sun}'/>
  ${d.moon ? `<circle cx='${d.x + 15}' cy='${d.y - 9}' r='36' fill='${mix(d.top, d.bottom, d.y / H)}'/>` : ''}
  <rect y='${horizon - 180}' width='100%' height='180' fill='url(#haze)'/>`;
// A whole scene: shared defs, the sky, the place, a vignette that deepens after dark.
const place = (r, d, horizon, defs, body) => svg(W, H, `<defs>${blur(W, H, 14)}${defs}</defs>${heaven(r, d, horizon)}${body}
  <g opacity='${(.4 + .6 * (1 - d.lit)).toFixed(2)}'>${vignette}</g>`, SCENE);
const beam = `<linearGradient id='beam' x2='0' y2='1'><stop offset='0' stop-color='#fff' stop-opacity='.22'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>`;
const scrawl = (r, x, y, c) => { // a graffiti tag: a run of loops and a flick under it
  let t = `M${i(x)} ${i(y)}`;
  for (let s = 0; s < 4; s++) t += `c${i(between(r, -6, 14))} ${i(between(r, -34, -10))} ${i(between(r, 10, 28))} ${i(between(r, -34, -10))} ${i(between(r, 14, 26))} ${i(between(r, -6, 6))}`;
  return `<path d='${t}' fill='none' stroke='${c}' stroke-width='${between(r, 2, 4).toFixed(1)}' stroke-linecap='round' stroke-linejoin='round' opacity='.85'/><path d='M${i(x - 6)} ${i(y + 8)}h${i(between(r, 70, 110))}' stroke='${c}' stroke-width='2' opacity='.7'/>`;
};

// ------------------------------------------------------------------------------------------- motifs

// A palm crown above a top corner, fronds hanging in: a curved midrib and drooping leaflets on both sides.
const palm = (r, x0, dir, color) => {
  let s = `<g stroke='${color}' stroke-width='2.4' fill='none' stroke-linecap='round'>`;
  for (let f = 0; f < 7; f++) {
    const ang = between(r, .1, 1.35), len = between(r, 200, 320), x1 = x0 + dir * Math.cos(ang) * len, y1 = -30 + Math.sin(ang) * len + len * .25;
    const cx = x0 + dir * Math.cos(ang) * len * .55, cy = -30 + Math.sin(ang) * len * .4;
    let leaf = '';
    for (let t = .08; t < .98; t += .055) { // points along the quadratic, a leaflet pair at each, shorter to the tip
      const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, y = (1 - t) ** 2 * -30 + 2 * (1 - t) * t * cy + t * t * y1;
      const a = Math.atan2(2 * (1 - t) * (cy + 30) + 2 * t * (y1 - cy), 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx)), l = (1 - t) * 48 + 12;
      for (const side of [1, -1]) leaf += `M${i(x)} ${i(y)}l${i(Math.cos(a + side * .9) * l)} ${i(Math.sin(a + side * .9) * l + l * .55)}`;
    }
    s += `<path d='M${i(x0)} -30Q${i(cx)} ${i(cy)} ${i(x1)} ${i(y1)}'/><path d='${leaf}' stroke-width='1.6'/>`;
  }
  return s + '</g>';
};
// An acacia: a forked trunk and flat layered crowns. Silhouette.
const acacia = (r, x, base, h, fill) => {
  const w = h * between(r, .55, .75), top = base - h;
  return `<g fill='${fill}'><path d='M${i(x)} ${i(base)}l-4 ${i(-h * .55)}l${i(-w * .45)} ${i(-h * .38)}M${i(x)} ${i(base)}l4 ${i(-h * .55)}l${i(w * .5)} ${i(-h * .4)}M${i(x)} ${i(base - h * .5)}l6 ${i(-h * .45)}' stroke='${fill}' stroke-width='${i(h / 40) + 1}' fill='none'/>
    <ellipse cx='${i(x)}' cy='${i(top)}' rx='${i(w)}' ry='${i(h * .07)}'/><ellipse cx='${i(x - w * .45)}' cy='${i(top + h * .07)}' rx='${i(w * .55)}' ry='${i(h * .06)}'/><ellipse cx='${i(x + w * .5)}' cy='${i(top + h * .05)}' rx='${i(w * .5)}' ry='${i(h * .055)}'/></g>`;
};
// Drawn once in <defs> at native size around (0, 0), placed with use(): a vinyl record r 30, a djembe 50 x 90, a basket 60 x 40.
const VINYL = accent => `<g id='vinyl'><circle r='30' fill='#0b0b0c'/><circle r='24' fill='none' stroke='#2c2c30' stroke-width='.8'/><circle r='18' fill='none' stroke='#2c2c30' stroke-width='.8'/><circle r='10' fill='${accent}'/><circle r='1.6' fill='#000'/></g>`;
const DJEMBE = (wood, rope) => `<g id='djembe'><path d='M-25 0C-25 30 -8 38 -8 52L-15 90H15L8 52C8 38 25 30 25 0z' fill='${wood}' stroke='#000' stroke-width='1.5'/>
  <path d='M-24 3L-16 26L-8 48L0 26L8 48L16 26L24 3M-16 26L-24 3' fill='none' stroke='${rope}' stroke-width='1.4'/><ellipse cy='0' rx='25' ry='6' fill='${rope}' stroke='#000' stroke-width='1.5'/><path d='M-11 50H11' stroke='${rope}' stroke-width='3'/></g>`;
const BASKET = (straw, band) => `<g id='basket'><path d='M-30 0Q-28 36 0 38Q28 36 30 0z' fill='${straw}' stroke='#000' stroke-width='1.2'/><path d='M-29 10Q0 18 29 10M-27 20Q0 28 27 20M-22 30Q0 36 22 30' fill='none' stroke='${band}' stroke-width='3'/><ellipse rx='30' ry='6' fill='${band}' stroke='#000' stroke-width='1.2'/></g>`;

// ------------------------------------------------------------------------------------------- scenes

function yard(r, p, L, d) { // techno: a Berlin club yard between two concrete warehouses, a steel truss overhead, the TV tower and a smokestack behind
  const { tone, far, on } = shades(d), ground = 800, white = '#f4f1e8', glass = mix(d.bottom, '#1a1d22', .55);
  const facade = (x0, x1, top) => {
    let s = `<rect x='${x0}' y='${top}' width='${x1 - x0}' height='${ground - top}' fill='url(#slab)'/><rect x='${x0}' y='${top}' width='${x1 - x0}' height='${ground - top}' fill='#000' filter='url(#grime)' opacity='.45'/><rect x='${x0 - 6}' y='${top - 12}' width='${x1 - x0 + 12}' height='12' fill='${tone('#5a5955')}'/>`;
    for (let y = top + 40; y < ground - 220; y += 140) for (let x = x0 + 28; x < x1 - 50; x += 84) {
      const lit = on && r() < .55;
      s += `<rect x='${x}' y='${y}' width='46' height='96' fill='${lit ? white : glass}' opacity='${lit ? .85 : 1}'/><path d='M${x + 23} ${y}v96M${x} ${y + 48}h46' stroke='${tone('#2a2b2d')}' stroke-width='3'/>`;
      if (lit) shine(r, L, 'flash', x + 23, y + 48, 80, r() < .6 ? white : p.accent); // the windows strobe
    }
    return s;
  };
  const lx = i(between(r, 200, 280)), rx = i(between(r, 1330, 1400)), sx = i(between(r, 60, 130)), tx = i(between(r, 1460, 1540));
  let back = `<g fill='${far('#8e9296')}'><rect x='${tx - 8}' y='150' width='16' height='${ground - 150}'/><circle cx='${tx}' cy='150' r='30'/><rect x='${tx - 12}' y='106' width='24' height='18'/><rect x='${tx - 3}' y='14' width='6' height='96'/></g><rect x='${tx - 31}' y='146' width='62' height='6' fill='${far('#5a5e64')}'/>`;
  back += `<path d='M${sx - 30} ${ground}L${sx - 20} 34H${sx + 20}L${sx + 30} ${ground}z' fill='${tone('#6e4c3c')}'/>${[44, 74].map(y => `<rect x='${sx - 21}' y='${y}' width='42' height='12' fill='${p.accent}' opacity='${(.25 + .6 * d.lit).toFixed(2)}'/>`).join('')}`;
  for (let k = 0; k < 6; k++) back += `<circle cx='${i(sx + k * 46 + between(r, -10, 10))}' cy='${i(20 - k * 8)}' r='${i(26 + k * 12)}' fill='${far('#d6d6d2')}' opacity='${(.5 - k * .06).toFixed(2)}' filter='url(#blur)'/>`; // smoke drifting off
  if (on) { back += `<circle cx='${tx}' cy='14' r='4' fill='#ff3b2f'/><circle cx='${sx}' cy='30' r='4' fill='#ff3b2f'/>`; shine(r, L, 'pulse', tx, 14, 16, '#ff3b2f'); shine(r, L, 'pulse', sx, 30, 16, '#ff3b2f'); }
  let truss = `<g stroke='${tone('#2a2c2e')}' fill='none'><path d='M0 20H${W}M0 84H${W}' stroke-width='8'/><path d='M0 20`;
  for (let x = 0; x < W; x += 64) truss += `L${x + 32} 84L${x + 64} 20`;
  truss += `' stroke-width='4'/></g>`;
  for (const x of [between(r, 30, 170), between(r, 400, 600), between(r, 1000, 1200), between(r, 1430, 1570)]) { // floodlights under the truss, on after dark
    if (on) { truss += `<polygon points='${i(x)},96 ${i(x - 180)},${ground} ${i(x + 180)},${ground}' fill='url(#beam)'/>`; shine(r, L, 'pulse', x, 98, 60, white); }
    truss += `<rect x='${i(x - 14)}' y='84' width='28' height='14' rx='3' fill='${tone('#3a3c3e')}'/><rect x='${i(x - 10)}' y='96' width='20' height='4' fill='${on ? white : tone('#8a8c8e')}'/>`;
  }
  const nx = i(between(r, 1405, 1460)), ny = i(between(r, 300, 400)); // a neon sign: frame, kick circle, play arrow, bar
  const sign = `M${nx} ${ny}h112v64h-112z M${nx + 14} ${ny + 32}a18 18 0 1 0 36 0a18 18 0 1 0 -36 0 M${nx + 62} ${ny + 18}l20 14l-20 14 M${nx + 94} ${ny + 18}v28`;
  const neonSign = on ? neon(sign, p.accent, 2.5) : `<path d='${sign}' fill='none' stroke='${p.accent}' stroke-width='3' opacity='.45'/>`;
  if (on) for (const x of [nx + 32, nx + 72, nx + 100]) shine(r, L, 'neon', x, ny + 32, 60, p.accent);
  let tags = '';
  for (let k = 0; k < 9; k++) tags += scrawl(r, k % 2 ? between(r, 1360, 1520) : between(r, 10, 170), between(r, 560, 760), [white, p.accent, '#ff3d8a', '#59c8ff'][k % 4]);
  let fence = `<rect y='690' width='100%' height='180' fill='url(#link)'/><path d='M0 690H${W}' stroke='${tone('#7a7c7e')}' stroke-width='5'/>`;
  for (let x = between(r, 0, 60); x < W; x += 200) fence += `<rect x='${i(x)}' y='684' width='7' height='190' fill='${tone('#6a6c6e')}'/>`;
  let bollards = '';
  for (let x = between(r, 8, 30); x < W; x += 64) if (x < 220 || x > 1380) bollards += `<rect x='${i(x)}' y='822' width='24' height='70' rx='11' fill='${tone('#4a4a48')}'/><rect x='${i(x)}' y='836' width='24' height='9' fill='${p.accent}'/>`;
  return place(r, d, 600, `${beam}${mist('grime', '#000000', .01, .025, i(r() * 1e6), 1.4, -.2)}
    <pattern id='slab' width='120' height='90' patternUnits='userSpaceOnUse'><rect width='120' height='90' fill='${tone('#8d8c88')}'/><path d='M0 1H120M1 0V90' stroke='${tone('#5e5d59')}' stroke-width='2'/><g fill='${tone('#4a4945')}'><circle cx='20' cy='22' r='3'/><circle cx='100' cy='22' r='3'/><circle cx='20' cy='68' r='3'/><circle cx='100' cy='68' r='3'/></g></pattern>
    <pattern id='link' width='14' height='14' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><path d='M0 0V14M0 0H14' stroke='${tone('#8a8c8e')}' stroke-width='1.4'/></pattern>`,
  `${back}${facade(0, lx, i(between(r, 160, 240)))}${facade(rx, W, i(between(r, 170, 250)))}${neonSign}${tags}${truss}
    <rect y='${ground}' width='100%' height='${H - ground}' fill='${tone('#2b2b2c')}'/>${fence}${bollards}`);
}

function block(r, p, L, d) { // house: a Chicago street of brick fronts with a record store, the L track overhead, a lamp post, a crate of records
  const { tone, far, on } = shades(d), ground = 810, warm = '#ffcf7a', glass = mix(d.bottom, '#1c1612', .55), trim = tone('#d8c8a8');
  let city = ''; // the Loop in the haze, seen above the track
  for (let x = 160; x < 1440; x += between(r, 50, 120)) {
    const top = between(r, 30, 260), w = between(r, 40, 100);
    city += `<rect x='${i(x)}' y='${i(top)}' width='${i(w)}' height='${i(H - top)}' fill='${far('#6c7686')}'/>${r() < .3 ? `<path d='M${i(x + w * .3)} ${i(top)}v-40M${i(x + w * .7)} ${i(top)}v-28' stroke='${far('#6c7686')}' stroke-width='4'/>` : ''}`;
  }
  const front = (x0, x1, top) => { // brick, a cornice, arched windows, then the shop: awning in stripes, a window of sleeves, a neon sign
    let s = `<rect x='${x0}' y='${top}' width='${x1 - x0}' height='${ground - top}' fill='url(#brick)'/><rect x='${x0 - 8}' y='${top - 18}' width='${x1 - x0 + 16}' height='18' fill='${tone('#3e281c')}'/><rect x='${x0 - 4}' y='${top}' width='${x1 - x0 + 8}' height='6' fill='${trim}'/>`;
    for (let y = top + 40; y < 400; y += 130) for (let x = x0 + 26; x < x1 - 50; x += 80) {
      const lit = on && r() < .5;
      s += `<path d='M${x} ${y + 90}v-68a22 22 0 0 1 44 0v68z' fill='${lit ? warm : glass}' stroke='${trim}' stroke-width='4'/><rect x='${x - 4}' y='${y + 90}' width='52' height='7' fill='${trim}'/>`;
      if (lit && r() < .5) shine(r, L, 'candle', x + 22, y + 55, 50, warm);
    }
    const wx = x0 + 16, ww = x1 - x0 - 32;
    s += `<rect x='${wx}' y='596' width='${ww}' height='170' fill='${on ? mix(warm, '#2a1a10', .35) : glass}' stroke='${tone('#1a120c')}' stroke-width='6'/>`;
    for (let x = wx + 14, k = 0; x < wx + ww - 50; x += 58, k++) {
      const c = ['#e84a3a', '#2a9ad8', '#f2c53a', p.accent, '#3ac88a'][Math.floor(r() * 5)];
      s += k % 3 === 1 ? use('vinyl', x + 26, 700, .85) : `<rect x='${x}' y='${i(between(r, 660, 690))}' width='50' height='50' fill='${tone(c)}' stroke='#000' stroke-width='1'/>`;
    }
    s += `<rect x='${x0 + 6}' y='552' width='${x1 - x0 - 12}' height='40' fill='url(#awn)'/><path d='M${x0 + 6} 592${`q${(x1 - x0 - 12) / 12} 14 ${(x1 - x0 - 12) / 6} 0`.repeat(6)}z' fill='${tone('#f2ead8')}'/>`;
    const sx = x0 < 800 ? x0 + 30 : x1 - 170, sy = 506, sign = `M${sx} ${sy}a18 18 0 1 0 36 0a18 18 0 1 0 -36 0M${sx + 12} ${sy}a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M${sx + 48} ${sy + 10}c6 -26 14 -26 12 0s10 -22 14 0s10 -22 14 0s10 -22 14 0`;
    s += on ? neon(sign, p.accent, 2.2) : `<path d='${sign}' fill='none' stroke='${p.accent}' stroke-width='3' opacity='.5'/>`;
    if (on) for (const x of [sx + 18, sx + 70, sx + 110]) shine(r, L, 'neon', x, sy, 50, p.accent);
    return s;
  };
  let track = `<rect y='88' width='100%' height='8' fill='${tone('#3a3e44')}'/><rect y='96' width='100%' height='26' fill='${tone('#2a2e33')}'/><path d='M0 96`;
  for (let x = 0; x < W; x += 40) track += `L${x + 20} 122L${x + 40} 96`;
  track += `' stroke='${tone('#1a1c20')}' stroke-width='3' fill='none'/>`;
  if (r() < .6) for (let x = between(r, -200, 100), k = 0; k < 6; x += 230, k++) { // a train passing on the L
    track += `<rect x='${i(x)}' y='40' width='220' height='48' rx='6' fill='${tone('#9aa0a6')}'/><rect x='${i(x)}' y='70' width='220' height='5' fill='${tone('#7a2a2a')}'/>`;
    for (let w = 14; w < 200; w += 34) track += `<rect x='${i(x + w)}' y='48' width='24' height='18' fill='${on ? warm : glass}'/>`;
  }
  for (const x of [between(r, 150, 190), between(r, 1410, 1450)]) track += `<rect x='${i(x)}' y='122' width='14' height='${ground - 122}' fill='${tone('#2a2e33')}'/><path d='M${i(x - 30)} 122L${i(x + 7)} 170L${i(x + 44)} 122' stroke='${tone('#2a2e33')}' stroke-width='6' fill='none'/>`;
  const lampX = r() < .5 ? between(r, 190, 215) : between(r, 1385, 1410); // a lamp post at the kerb
  const lamp = `<rect x='${i(lampX - 4)}' y='470' width='8' height='${ground - 470}' fill='${tone('#1a1c1e')}'/><path d='M${i(lampX - 14)} 470h28l-6 -30h-16z' fill='${on ? warm : tone('#2a2c2e')}' stroke='${tone('#1a1c1e')}' stroke-width='3'/><path d='M${i(lampX - 16)} 440h32l-16 -14z' fill='${tone('#1a1c1e')}'/>${on ? `<circle cx='${i(lampX)}' cy='456' r='90' fill='url(#lamp)'/>` : ''}`;
  if (on) shine(r, L, 'pulse', lampX, 456, 70, warm);
  const cx = r() < .5 ? between(r, 20, 60) : between(r, 1420, 1470); // a crate of records on the sidewalk
  let crate = '';
  for (let k = 0; k < 9; k++) crate += `<rect x='${i(cx + 6 + k * 11)}' y='${i(between(r, 806, 822))}' width='10' height='40' fill='${tone(['#e84a3a', '#2a9ad8', '#f2c53a', '#f2ead8', '#1a1a1a'][k % 5])}' stroke='#000' stroke-width='.6'/>`;
  crate += `<rect x='${i(cx)}' y='830' width='112' height='52' fill='${tone('#8a6a3a')}' stroke='${tone('#4a3418')}' stroke-width='3'/><path d='M${i(cx)} 848h112M${i(cx)} 866h112' stroke='${tone('#4a3418')}' stroke-width='2'/>${use('vinyl', cx + 150, 860, .9)}`;
  return place(r, d, 640, `${VINYL(p.accent)}${glow('lamp', warm, .5)}
    <pattern id='brick' width='40' height='20' patternUnits='userSpaceOnUse'><rect width='40' height='20' fill='${tone('#7a3e2a')}'/><path d='M0 1H40M0 11H40M1 0V10M21 10V20' stroke='${tone('#3e2216')}' stroke-width='1.6'/></pattern>
    <pattern id='awn' width='36' height='40' patternUnits='userSpaceOnUse'><rect width='18' height='40' fill='${tone(p.accent)}'/><rect x='18' width='18' height='40' fill='${tone('#f2ead8')}'/></pattern>`,
  `${city}${front(0, i(between(r, 230, 290)), i(between(r, 150, 220)))}${front(i(between(r, 1310, 1370)), W, i(between(r, 150, 220)))}
    <rect y='${ground}' width='100%' height='${H - ground}' fill='${tone('#5a5654')}'/><rect y='864' width='100%' height='36' fill='${tone('#26262a')}'/><path d='M0 864H${W}' stroke='${tone('#8a8682')}' stroke-width='4'/>
    ${track}${lamp}${crate}`);
}

function harbour(r, p, L, d) { // bass: Bristol harbourside under coloured terraces: the suspension bridge, cranes, a pirate-radio mast, a sound system on the quay
  const { tone, far, on } = shades(d), water = 650, quay = 805, warm = '#ffcf7a';
  const paint = ['#e89aa6', '#f2d27a', '#8cc0dc', '#b6d898', '#dcb4e0', '#f4efe0', '#f0a870'];
  const b0 = i(between(r, 70, 130)), b1 = i(between(r, 1470, 1530)), bm = (b0 + b1) / 2; // the bridge: towers, a cable dipping between, hangers, the deck
  let bridge = `<g fill='${far('#6a6e74')}'>${[b0, b1].map(x => `<path d='M${x - 22} 330V36h44V330zM${x - 10} 220v-50a10 10 0 0 1 20 0v50z' fill-rule='evenodd'/>`).join('')}<rect x='${b0}' y='164' width='${b1 - b0}' height='9'/></g><path d='M${b0} 40Q${bm} 260 ${b1} 40' fill='none' stroke='${far('#4a4e54')}' stroke-width='4'/><path d='`;
  for (let x = b0 + 30; x < b1; x += 34) { const t = (x - b0) / (b1 - b0); bridge += `M${x} ${i(40 + 2 * t * (1 - t) * 220)}V164`; }
  bridge += `' stroke='${far('#4a4e54')}' stroke-width='1.2'/>`;
  let hill = `<path d='M0 ${water}V230C120 250 250 380 360 ${water}z' fill='${tone('#3e5a34')}'/><path d='M${W} ${water}V250C1480 280 1340 400 1240 ${water}z' fill='${tone('#3e5a34')}'/>`;
  for (let k = 0; k < 5; k++) for (const side of [0, 1]) { // terrace rows stepping up the hill, pastel fronts, pitched roofs
    const y = water - 20 - k * 76, reach = 350 - k * 52;
    for (let x = 0; x < reach; x += between(r, 34, 46)) {
      const w = between(r, 30, 42), h = between(r, 38, 54), hx = side ? W - x - w : x, lit = on && r() < .45;
      hill += `<rect x='${i(hx)}' y='${i(y - h)}' width='${i(w)}' height='${i(h)}' fill='${tone(paint[Math.floor(r() * paint.length)])}'/><path d='M${i(hx - 2)} ${i(y - h)}l${i(w / 2 + 2)} -14l${i(w / 2 + 2)} 14z' fill='${tone('#4a4248')}'/>
        <rect x='${i(hx + w / 2 - 5)}' y='${i(y - h + 12)}' width='10' height='14' fill='${lit ? warm : tone('#2a3040')}'/>`;
      if (lit && r() < .25) shine(r, L, 'candle', hx + w / 2, y - h + 19, 26, warm);
    }
  }
  const mx = i(between(r, 40, 150)), my = i(between(r, 150, 210)); // the pirate-radio mast on the top roof, a light blinking at its tip
  const mast = `<path d='M${mx - 12} ${my + 120}L${mx} ${my}L${mx + 12} ${my + 120}M${mx - 9} ${my + 90}L${mx + 6} ${my + 60}L${mx - 5} ${my + 30}L${mx + 3} ${my + 10}M${mx - 16} ${my + 28}h32M${mx - 12} ${my + 56}h24' stroke='${tone('#1c1e22')}' stroke-width='3' fill='none'/><circle cx='${mx}' cy='${my - 2}' r='5' fill='${p.accent}'/>`;
  shine(r, L, 'pulse', mx, my - 2, on ? 26 : 14, p.accent);
  let cranes = '';
  for (let k = 0; k < 3; k++) { // harbour cranes on the far quay: a lattice leg, a cab, a jib reaching over the water
    const x = between(r, 1290, 1560), top = between(r, 380, 460), jib = between(r, 140, 220);
    cranes += `<g stroke='${far('#3a3e44')}' fill='none'><path d='M${i(x - 14)} ${quay}L${i(x)} ${i(top)}L${i(x + 14)} ${quay}M${i(x - 10)} ${i(quay - 60)}L${i(x + 8)} ${i(top + 120)}' stroke-width='5'/><path d='M${i(x)} ${i(top)}L${i(x - jib)} ${i(top - 60)}M${i(x)} ${i(top + 18)}L${i(x - jib)} ${i(top - 60)}' stroke-width='4'/></g><rect x='${i(x - 16)}' y='${i(top - 8)}' width='32' height='26' fill='${far('#a84a2a')}'/>`;
  }
  let sea = `<rect y='${water}' width='100%' height='${quay - water}' fill='url(#water)'/><path d='`;
  for (let k = 0; k < 40; k++) { const x = r() * W, y = between(r, water + 8, quay - 6); sea += `M${i(x)} ${i(y)}h${i(between(r, 20, 70))}`; }
  sea += `' stroke='${on ? warm : d.sun}' stroke-width='1.5' opacity='.3'/>`;
  const bx = between(r, 1330, 1370); // a narrowboat moored at the quay, its stern out past the desk
  sea += `<path d='M${i(bx)} ${quay - 34}h150l-12 26h-128z' fill='${tone('#1e4a3a')}'/><rect x='${i(bx + 24)}' y='${quay - 56}' width='96' height='22' fill='${tone('#a83a2a')}'/>${[0, 1, 2].map(k => `<rect x='${i(bx + 34 + k * 28)}' y='${quay - 50}' width='14' height='10' fill='${on ? warm : tone('#2a3040')}'/>`).join('')}`;
  const stack = (x, cols) => { // a sound system: speaker boxes with woofers, the surround in the accent
    let s = '';
    for (let row = 0; row < 3; row++) for (let c = 0; c < cols; c++) {
      const bx = x + c * 74, by = 812 - row * 74;
      s += `<rect x='${bx}' y='${by}' width='70' height='70' rx='3' fill='${tone('#18191c')}' stroke='#000' stroke-width='2'/><circle cx='${bx + 35}' cy='${by + 35}' r='27' fill='${tone('#2a2c30')}' stroke='${p.accent}' stroke-width='2' stroke-opacity='${on ? .9 : .35}'/><circle cx='${bx + 35}' cy='${by + 35}' r='9' fill='${tone('#0c0c0e')}'/>`;
      if (on) shine(r, L, 'pulse', bx + 35, by + 35, 34, p.accent);
    }
    return s;
  };
  let rain = '';
  if (on || r() < .25) { rain = `<path d='`; for (let k = 0; k < 110; k++) rain += `M${i(r() * W)} ${i(r() * H)}l-8 28`; rain += `' stroke='#b8c4d4' stroke-width='1.2' opacity='.28'/>`; }
  return place(r, d, water, `<linearGradient id='water' x2='0' y2='1'><stop offset='0' stop-color='${tone('#3a5a6a')}'/><stop offset='1' stop-color='${tone('#12242e')}'/></linearGradient>`,
  `${bridge}${hill}${mast}${sea}${cranes}<rect y='${quay}' width='100%' height='${H - quay}' fill='${tone('#4a4844')}'/><path d='M0 ${quay}H${W}' stroke='${tone('#77736c')}' stroke-width='5'/>
    ${stack(8, 2)}${stack(1520, 1)}${rain}`);
}

function terrace(r, p, L, d) { // balearic: an Ibiza cliff terrace: whitewashed walls with arches, bougainvillea, a palm frond, the sea and Es Vedra, lanterns after dark
  const { tone, far, on } = shades(d), sea = 540, floor = 800, warm = '#ffc36a';
  const ix = i(between(r, 1180, 1300)); // Es Vedra: a steep rock island on the horizon
  let water = `<rect y='${sea}' width='100%' height='${floor - sea}' fill='url(#sea)'/><path d='M${ix - 150} ${sea}L${ix - 90} ${sea - 50}L${ix - 30} ${sea - 170}L${ix + 6} ${sea - 154}L${ix + 60} ${sea - 50}L${ix + 120} ${sea}z' fill='${far('#6a6470')}'/><path d='`;
  for (let k = 0; k < 46; k++) { const y = between(r, sea + 4, floor), w = 8 + (y - sea) * .25; water += `M${i(d.x + between(r, -1, 1) * w * 1.6)} ${i(y)}h${i(w)}`; } // glitter under the sun or moon
  water += `' stroke='${d.sun}' stroke-width='2' opacity='.55'/>`;
  for (let k = 0; k < 4; k++) { const x = r() < .5 ? between(r, 20, 180) : between(r, 1420, 1580), y = between(r, sea + 20, sea + 120); water += `<path d='M${i(x)} ${i(y)}v-34l20 34z' fill='${far('#f4f1ea')}'/>`; }
  const lanterns = [];
  const wall = (w, top) => { // one side, drawn at the left edge: a wall with an arched opening, its reveal, bougainvillea over the top
    const ax = i(between(r, 30, 50)), aw = w - ax - i(between(r, 34, 50)), ay = i(between(r, 330, 400)), rad = aw / 2;
    let s = `<path d='M0 ${top}H${w - 24}q24 0 24 24V${floor}H0zM${ax} ${floor - 70}V${ay}a${rad} ${rad} 0 0 1 ${aw} 0V${floor - 70}z' fill-rule='evenodd' fill='${tone('#f3efe4')}'/>
      <path d='M${ax} ${floor - 70}V${ay}a${rad} ${rad} 0 0 1 ${aw} 0' fill='none' stroke='${tone('#c9c2b4')}' stroke-width='9'/><rect x='${ax - 8}' y='${floor - 70}' width='${aw + 16}' height='10' fill='${tone('#d8d1c2')}'/>`;
    s += dots(r, 70, [w * .3, top - 30, w + 30, top + 90], tone('#2f5a2a'), 3, 7) + dots(r, 90, [w * .2, top - 26, w + 40, top + 70], tone('#d0308a'), 2.5, 6.5) + dots(r, 40, [w - 40, top + 40, w + 20, top + 260], tone('#e85aa8'), 2, 5.5);
    lanterns.push([ax + rad, ay - rad + 30]);
    return s;
  };
  const lw = i(between(r, 210, 250)), rw = i(between(r, 210, 250));
  const walls = `${wall(lw, i(between(r, 120, 200)))}<g transform='translate(${W} 0) scale(-1 1)'>${wall(rw, i(between(r, 120, 200)))}</g>`;
  lanterns[1][0] = W - lanterns[1][0];
  for (let k = 0; k < 3; k++) lanterns.push([k % 2 ? between(r, 1440, 1560) : between(r, 30, 160), 850]);
  let lamps = '';
  for (const [x, y] of lanterns) { // Moroccan lanterns, hanging in the arches and standing on the floor
    lamps += `${y < 800 ? `<path d='M${i(x)} ${i(y - 60)}V${i(y - 14)}' stroke='${tone('#2a2420')}' stroke-width='2'/>` : ''}<path d='M${i(x)} ${i(y - 18)}l12 10v18l-12 10l-12 -10v-18z' fill='${on ? warm : tone('#8a7a62')}' stroke='${tone('#3a2e22')}' stroke-width='2.5'/><path d='M${i(x - 6)} ${i(y - 22)}h12l-6 -6z' fill='${tone('#3a2e22')}'/>`;
    if (on) { lamps += `<circle cx='${i(x)}' cy='${i(y)}' r='60' fill='url(#lamp)'/>`; shine(r, L, 'candle', x, y, 70, warm); }
  }
  let tiles = `<rect y='${floor}' width='100%' height='${H - floor}' fill='${tone('#b4603a')}'/><path d='M0 ${floor + 26}H${W}M0 ${floor + 58}H${W}`;
  for (let x = -1600; x <= 3200; x += 120) tiles += `M${800 + (x - 800) * .3} ${floor}L${x} ${H}`;
  tiles += `' stroke='${tone('#7a3a20')}' stroke-width='2'/><rect y='${floor}' width='100%' height='6' fill='${tone('#e8e0d0')}'/>`;
  const fronds = r() < .5 ? palm(r, between(r, -40, 60), 1, tone('#2c5a32')) : palm(r, between(r, 1540, 1640), -1, tone('#2c5a32'));
  return place(r, d, sea, `${glow('lamp', warm, .45)}<linearGradient id='sea' x2='0' y2='1'><stop offset='0' stop-color='${tone('#3a8ac0')}'/><stop offset='1' stop-color='${tone('#0e3a5c')}'/></linearGradient>`,
  `${water}${walls}${tiles}${lamps}${fronds}
    ${dots(r, 18, [0, floor + 10, 220, H], p.accent, 2, 4)}${dots(r, 18, [1380, floor + 10, W, H], p.accent, 2, 4)}`);
}

function savanna(r, p, L, d) { // afro: an open-air stage on the savanna: a thatched canopy, acacias, red earth, djembes and baskets, string lights
  const { tone, far, on } = shades(d), horizon = 600, warm = '#ffc46a';
  let land = `<path d='M0 ${horizon}`;
  for (let x = 0; x <= W; x += 80) land += `L${x} ${i(horizon - between(r, 10, 60))}`;
  land += `L${W} ${horizon}z' fill='${far('#7a5244')}'/><rect y='${horizon}' width='100%' height='${H - horizon}' fill='url(#earth)'/>`;
  for (let k = 0; k < 10; k++) land += acacia(r, between(r, 0, W), horizon + 4, between(r, 50, 110), far('#3a2a22'));
  for (let k = 0; k < 4; k++) land += acacia(r, k % 2 ? between(r, 1440, 1600) : between(r, 0, 160), between(r, 760, 800), between(r, 260, 400), tone('#1c1410'));
  let grass = `<path d='`;
  for (let k = 0; k < 90; k++) { const x = r() * W, y = k < 40 ? between(r, horizon, horizon + 40) : between(r, 800, H); grass += `M${i(x)} ${i(y)}l-4 -14M${i(x)} ${i(y)}l2 -18M${i(x)} ${i(y)}l7 -12`; }
  grass += `' stroke='${tone('#8a7a3a')}' stroke-width='1.5'/>`;
  const thatch = w => { // the stage canopy in a top corner, drawn at the left: a sloped roof, a fringe of straw, a pole
    let s = `<path d='M0 0H${w}L${w + 70} 130H0z' fill='${tone('#9a7a3a')}'/><path d='`;
    for (let x = 0; x < w + 70; x += 7) s += `M${x} ${i(x > w ? 130 - (w + 70 - x) * .2 : 128)}l${i(between(r, -3, 3))} ${i(between(r, 8, 20))}`;
    return `${s}' stroke='${tone('#6a5020')}' stroke-width='2'/><rect x='${w - 6}' y='120' width='14' height='${780 - 120}' fill='${tone('#4a3018')}'/>${[150, 172, 740].map(y => `<rect x='${w - 7}' y='${y}' width='16' height='9' fill='${p.accent}'/>`).join('')}`; // painted bands on the pole
  };
  const lw = i(between(r, 120, 170)), rw = i(between(r, 120, 170));
  const canopy = `${thatch(lw)}<g transform='translate(${W} 0) scale(-1 1)'>${thatch(rw)}</g>`;
  let bulbs = ''; // string lights hung from pole to pole and along the canopy edge
  for (const [x0, x1, y0, sag] of [[lw, W - rw, 140, 150], [0, W, 36, 90]]) {
    bulbs += `<path d='M${x0} ${y0}Q${(x0 + x1) / 2} ${y0 + sag * 2} ${x1} ${y0}' fill='none' stroke='${tone('#1a1410')}' stroke-width='1.5'/>`;
    for (let t = .02, k = 0; t < 1; t += .025, k++) {
      const x = x0 + (x1 - x0) * t, y = y0 + 2 * t * (1 - t) * sag * 2, c = k % 2 ? p.accent : warm;
      bulbs += `<circle cx='${i(x)}' cy='${i(y + 5)}' r='4.5' fill='${on ? c : tone('#c8c0a8')}' opacity='${on ? 1 : .7}'/>`;
      if (on && k % 4 === 0) shine(r, L, k % 8 ? 'pulse' : 'firefly', x, y + 5, 22, c);
    }
  }
  let drums = '';
  for (let k = 0; k < 4; k++) drums += use('djembe', k % 2 ? between(r, 1440, 1560) : between(r, 40, 160), between(r, 780, 800), between(r, .9, 1.25));
  for (let k = 0; k < 4; k++) drums += use('basket', k % 2 ? between(r, 1400, 1570) : between(r, 30, 200), between(r, 850, 870), between(r, .8, 1.2));
  let fire = '';
  if (on) { // a fire in a bottom corner, embers rising
    const fx = r() < .5 ? between(r, 190, 230) : between(r, 1370, 1410);
    fire = `<circle cx='${i(fx)}' cy='850' r='120' fill='url(#fire)'/><path d='M${i(fx - 30)} 870l60 -12M${i(fx - 30)} 858l60 12' stroke='${tone('#3a2010')}' stroke-width='8'/><path d='M${i(fx - 18)} 862c-6 -30 14 -34 10 -60c14 18 22 30 16 60z' fill='#ff8a2a'/><path d='M${i(fx - 6)} 862c-2 -16 6 -20 6 -32c8 12 10 20 6 32z' fill='#ffe08a'/>`;
    for (let k = 0; k < 10; k++) shine(r, L, 'ember', fx + between(r, -50, 50), between(r, 700, 860), between(r, 3, 6), '#ff7a3a');
  }
  return place(r, d, horizon, `${DJEMBE(tone('#7a4a28'), tone('#e8d6a8'))}${BASKET(tone('#c8a060'), tone('#8a2a1a'))}${glow('fire', '#ff7a2a', .45)}
    <linearGradient id='earth' x2='0' y2='1'><stop offset='0' stop-color='${tone('#b0532c')}'/><stop offset='1' stop-color='${tone('#5c2414')}'/></linearGradient>`,
  `${land}${grass}${canopy}${bulbs}${drums}${fire}`);
}

function underpass(r, p, L, d) { // dubstep: a skate bowl under a concrete flyover: pillars with throw-ups, a drain, a sub stack, a wobble line, lasers after dark
  const { tone, far, on } = shades(d), horizon = 560, floor = 800, violet = '#a64dff', dim = c => mix(tone(c), '#05070c', .35);
  let city = '';
  for (let x = 120; x < 1480; x += between(r, 40, 90)) { const top = between(r, 380, 500); city += `<rect x='${i(x)}' y='${i(top)}' width='${i(between(r, 30, 80))}' height='${i(floor - top)}' fill='${far('#4a5262')}'/>`; }
  let deck = `<rect width='100%' height='118' fill='${dim('#5a5c5b')}'/><rect y='98' width='100%' height='20' fill='${dim('#3a3c3b')}'/><rect y='118' width='100%' height='90' fill='url(#under)'/>`;
  for (let x = between(r, 0, 100); x < W; x += 220) deck += `<rect x='${i(x)}' y='0' width='16' height='118' fill='${dim('#3a3c3b')}'/>`;
  const pillar = (x0, w) => `<rect x='${x0}' y='118' width='${w}' height='${floor - 118}' fill='${dim('#6e706e')}'/><rect x='${x0}' y='118' width='${w}' height='${floor - 118}' fill='#000' filter='url(#grime)' opacity='.5'/><path d='M${x0 - 16} 118h${w + 32}l-16 30h${-w}z' fill='${dim('#5a5c5b')}'/>`;
  const throwUp = (x, y, c, s) => `<g transform='translate(${i(x)} ${i(y)}) scale(${s.toFixed(2)}) rotate(${i(between(r, -10, 10))})'><path d='M0 0c-10 -40 30 -52 34 -12c8 -32 46 -24 34 8c16 10 2 36 -20 26c-10 18 -42 14 -40 -6c-22 0 -22 -24 -8 -16z' fill='${c}' stroke='#0a0a0a' stroke-width='4'/><path d='M4 -10c2 -14 12 -20 20 -12M42 -14c6 -6 14 -4 16 4' stroke='#fff' stroke-width='3' fill='none' opacity='.7'/></g>`;
  let walls = `${pillar(20, 120)}${pillar(1460, 120)}`;
  for (let k = 0; k < 4; k++) walls += throwUp(k % 2 ? between(r, 1470, 1510) : between(r, 30, 70), between(r, 300, 700), [p.accent, violet][k % 2], between(r, .9, 1.3));
  for (let k = 0; k < 4; k++) walls += scrawl(r, k % 2 ? between(r, 1470, 1520) : between(r, 26, 70), between(r, 200, 760), '#f4f1e8');
  walls += `<rect x='140' y='300' width='110' height='${floor - 300}' fill='url(#link)'/><rect x='246' y='290' width='6' height='${floor - 290}' fill='${dim('#7a7c7e')}'/>`;
  const px = i(between(r, 1430, 1446)); // a drain pipe down the right pillar, dripping into a puddle
  let drain = `<rect x='${px}' y='118' width='14' height='${floor - 160}' fill='${dim('#3a3e3c')}'/>${[260, 460, 660].map(y => `<rect x='${px - 3}' y='${y}' width='20' height='6' fill='${dim('#2a2c2c')}'/>`).join('')}<ellipse cx='${px + 7}' cy='${floor + 14}' rx='70' ry='9' fill='${on ? p.accent : d.top}' opacity='.25'/>`;
  for (let k = 0; k < 5; k++) drain += `<ellipse cx='${px + 7}' cy='${i(floor - 36 + k * 9)}' rx='1.6' ry='3' fill='#9ab0c0' opacity='.7'/>`;
  let subs = ''; // a sub stack in the bottom left: two by two boxes, each a big cone
  for (let row = 0; row < 2; row++) for (let c = 0; c < 2; c++) {
    const bx = 14 + c * 92, by = 818 - row * 92;
    subs += `<rect x='${bx}' y='${by}' width='88' height='88' rx='4' fill='${dim('#141516')}' stroke='#000' stroke-width='2'/><circle cx='${bx + 44}' cy='${by + 44}' r='36' fill='${dim('#26282a')}'/><circle cx='${bx + 44}' cy='${by + 44}' r='26' fill='none' stroke='${violet}' stroke-width='1.5' opacity='${on ? .8 : .3}'/><circle cx='${bx + 44}' cy='${by + 44}' r='11' fill='${dim('#0a0a0b')}'/>`;
    if (on) shine(r, L, 'pulse', bx + 44, by + 44, 40, violet);
  }
  const f1 = between(r, 9, 14), f2 = between(r, 90, 160);
  let wave = `M0 868`; // the bass on the floor of the bowl: a wobble that swells and falls
  for (let x = 0; x <= W; x += 6) wave += `L${x} ${i(868 + Math.sin(x / f1) * 16 * (.4 + .6 * Math.abs(Math.sin(x / f2))))}`;
  const bowl = `<rect y='${floor}' width='100%' height='${H - floor}' fill='url(#bowl)'/><path d='M0 ${floor}H${W}' stroke='${dim('#a0a2a0')}' stroke-width='6'/><path d='M0 846Q800 900 ${W} 846' stroke='${dim('#3a3c3b')}' stroke-width='2' fill='none'/>
    ${on ? neon(wave, p.accent, 1.6) : `<path d='${wave}' fill='none' stroke='${p.accent}' stroke-width='2' opacity='.6'/>`}`;
  if (on) for (const x of [80, 200, 1420, 1540]) shine(r, L, 'neon', x, 868, 40, p.accent);
  let lasers = '';
  if (on) { // lasers fanned from the right capital under the deck
    const sx = 1500, sy = 150;
    for (let k = 0; k < 6; k++) { const c = k % 2 ? violet : p.accent, ex = between(r, -40, 240), ey = between(r, 130, 460); lasers += neon(`M${sx} ${sy}L${i(ex)} ${i(ey)}`, c, 1.2); shine(r, L, 'neon', between(r, 40, 180), ey, 40, c); }
    shine(r, L, 'neon', sx, sy, 50, p.accent);
  }
  return place(r, d, horizon, `${mist('grime', '#000000', .012, .03, i(r() * 1e6), 1.4, -.15)}
    <linearGradient id='under' x2='0' y2='1'><stop offset='0' stop-color='#000' stop-opacity='.7'/><stop offset='1' stop-color='#000' stop-opacity='0'/></linearGradient>
    <linearGradient id='bowl' x2='0' y2='1'><stop offset='0' stop-color='${dim('#7a7c7a')}'/><stop offset='1' stop-color='${dim('#2a2c2b')}'/></linearGradient>
    <pattern id='link' width='14' height='14' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><path d='M0 0V14M0 0H14' stroke='${dim('#8a8c8e')}' stroke-width='1.4'/></pattern>`,
  `${city}<rect y='${floor - 10}' width='100%' height='10' fill='${far('#3a3c40')}'/>${walls}${drain}${deck}${lasers}${bowl}${subs}`);
}

// ----------------------------------------------------------------------------------------- ornaments
// 9-slice border images through kit.corners: a corner piece and an edge piece inside the 22 px rim.

const hexBolt = (x, y, s) => `<polygon points='${[0, 1, 2, 3, 4, 5].map(k => `${(x + s * Math.cos(k * Math.PI / 3 + Math.PI / 6)).toFixed(1)},${(y + s * Math.sin(k * Math.PI / 3 + Math.PI / 6)).toFixed(1)}`).join(' ')}' fill='#9a9c9e' stroke='#151617' stroke-width='.8'/><circle cx='${x}' cy='${y}' r='${(s * .35).toFixed(1)}' fill='#2a2b2c'/>`;
const bolted = p => corners( // techno: an angle iron bolted in each corner, a flat bar with bolts and a hazard strip on the edges
  `<path d='M2 2H22V8H8V22H2z' fill='#3e3f41' stroke='#76787a'/>${hexBolt(5, 5, 2.4)}${hexBolt(16, 5, 2)}${hexBolt(5, 16, 2)}`,
  `<rect x='26' y='3' width='68' height='7' fill='#333436' stroke='#5f6163'/>${hexBolt(32, 6.5, 2.4)}${hexBolt(88, 6.5, 2.4)}<rect x='44' y='12' width='32' height='5' fill='url(#hz)'/>`,
  '#4a4b4d', `<pattern id='hz' width='6' height='6' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><rect width='6' height='6' fill='#111'/><rect width='3' height='6' fill='${p.accent}'/></pattern>`);
const brass = p => corners( // house: a quarter-round brass plate with a screw, a record peeking from the edge between grooves
  `<path d='M2 2H22A20 20 0 0 1 2 22z' fill='#b8913c' stroke='#5a4418'/><path d='M16 2A14 14 0 0 1 2 16M11 2A9 9 0 0 1 2 11' fill='none' stroke='#5a4418' opacity='.6'/><circle cx='6' cy='6' r='2.4' fill='#d8b860' stroke='#5a4418' stroke-width='.6'/><path d='M4.5 7.5l3 -3' stroke='#5a4418'/>`,
  `<path d='M26 4H46M26 7H46M26 10H46M74 4H94M74 7H94M74 10H94' stroke='#0d0d0e' stroke-width='1.4'/><path d='M46 1A14 14 0 0 0 74 1z' fill='#0d0d0e'/><path d='M50 1A10 10 0 0 0 70 1M54 1A6 6 0 0 0 66 1' fill='none' stroke='#2c2c30' stroke-width='.7'/><path d='M56 1A4 4 0 0 0 64 1z' fill='${p.accent}'/>`, '#6a5020');
const cloth = p => corners( // bass: a speaker-cloth square with a metal cab corner, a patch cable along the edges, a strip of gaffer
  `<rect x='2' y='2' width='20' height='20' rx='2' fill='url(#m)' stroke='#4a4f5a'/><path d='M1 1H13L1 13z' fill='#8a8f98' stroke='#222'/><circle cx='4.5' cy='4.5' r='1.2' fill='#333'/>`,
  `<path d='M24 12C40 4 52 20 68 12S88 6 96 12' fill='none' stroke='#0c0c0e' stroke-width='3.5'/><path d='M24 11C40 3 52 19 68 11S88 5 96 11' fill='none' stroke='#3a3d44' stroke-width='1'/><rect x='54' y='8' width='12' height='9' fill='${p.accent}' opacity='.85'/>`,
  '#2a3552', `<pattern id='m' width='3' height='3' patternUnits='userSpaceOnUse'><rect width='3' height='3' fill='#1a1d24'/><rect width='1.5' height='1.5' fill='#3a3f4a'/></pattern>`);
const terracotta = p => corners( // balearic: a painted terracotta tile in each corner, a twisted rope along the edges
  `<rect x='2' y='2' width='20' height='20' fill='#b4603a' stroke='#6a3218'/><polygon points='12,4.5 19.5,12 12,19.5 4.5,12' fill='#efe4cc'/><circle cx='12' cy='12' r='3' fill='${p.accent}'/>`,
  [...Array(12)].map((_, k) => `<ellipse cx='${28 + k * 6}' cy='11' rx='4' ry='2.2' transform='rotate(-35 ${28 + k * 6} 11)' fill='#c8a878' stroke='#6a5030' stroke-width='.6'/>`).join(''), '#7a4a2a');
const carved = p => corners( // afro: a carved band of triangles in each corner, a string of beads along the edges
  `<path d='M2 22V2H22' fill='none' stroke='#3a2214' stroke-width='6'/><path d='M2 20L5 15L2 10L5 5L10 2L15 5L20 2' fill='none' stroke='#d9a441' stroke-width='1.4'/><polygon points='9,9 15,9 9,15' fill='#d9a441'/>`,
  `<path d='M26 9H94' stroke='#3a2214' stroke-width='1.2'/>${[...Array(9)].map((_, k) => `<circle cx='${30 + k * 8}' cy='9' r='3.2' fill='${[p.accent, '#d9a441', '#b8402a', '#f2e6cc'][k % 4]}' stroke='#1a0e08' stroke-width='.6'/>`).join('')}`, '#4c3126');
const hazard = p => corners( // dubstep: hazard chevrons in each corner, a laser line along the edges
  `<g clip-path='url(#k)'><rect x='2' y='2' width='20' height='20' fill='#111'/><path d='M-2 10L10 -2M-2 18L18 -2M-2 26L26 -2' stroke='${p.accent}' stroke-width='3'/></g><path d='M2 22V2H22' fill='none' stroke='#2a302c' stroke-width='1.5'/>`,
  neon('M30 12H90', p.accent, 1.4), '#26302a', `${blur(120, 120, 3)}<clipPath id='k'><path d='M2 2H22L2 22z'/></clipPath>`);

// ------------------------------------------------------------------------------------------- emblems
// A sigil watermarked into the output U, 160 x 160, in the label colour at low opacity, the theme name set under it.

const sigil = (body, p) => svg(160, 160, `<g fill='none' stroke='${p.label}' stroke-width='5' stroke-linecap='round' stroke-linejoin='round' opacity='.3' transform='translate(80 70)'>${body}</g>
  <text x='80' y='150' text-anchor='middle' font-family='Arial Narrow, Arial, sans-serif' font-weight='700' font-size='${Math.min(16, i(190 / p.label_name.length))}' letter-spacing='1.5' fill='${p.label}' opacity='.4'>${p.label_name.toUpperCase().replace(/&/g, '&amp;')}</text>`).replace(/&/g, '%26'); // %26: safe in an HTML attribute too
const SIGILS = {
  techno: p => sigil([...Array(16)].map((_, k) => `<rect x='${-53 + (k % 4) * 28}' y='${-53 + Math.floor(k / 4) * 28}' width='22' height='22' rx='3' ${k % 4 ? '' : `fill='${p.label}' fill-opacity='.5'`}/>`).join(''), p), // a 909 step grid, the kick on every beat
  house: p => sigil(`<circle r='56'/><circle r='44' stroke-width='2' opacity='.6'/><circle r='34' stroke-width='2' opacity='.6'/><circle r='18' fill='${p.label}' fill-opacity='.35'/><circle r='2'/><path d='M58 -58L28 -14l-8 4'/>`, p), // a record and a tone arm
  bass: p => sigil(`<rect x='-58' y='-58' width='116' height='116' rx='8'/><circle r='44'/><circle r='28' stroke-width='3'/><circle r='10' fill='${p.label}' fill-opacity='.4'/>${[[-48, -48], [48, -48], [-48, 48], [48, 48]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='2'/>`).join('')}`, p), // a bass bin and its woofer
  balearic: p => sigil(`<circle cy='-6' r='24' fill='${p.label}' fill-opacity='.3'/>${[...Array(12)].map((_, k) => { const a = k * Math.PI / 6, r0 = 34, r1 = k % 2 ? 46 : 56; return `<path d='M${i(Math.cos(a) * r0)} ${i(Math.sin(a) * r0 - 6)}L${i(Math.cos(a) * r1)} ${i(Math.sin(a) * r1 - 6)}'/>`; }).join('')}<path d='M-56 58q14 -10 28 0t28 0t28 0t28 0' stroke-width='3'/>`, p), // a sun over a wave
  afro: p => sigil(`<path d='M-34 -50C-34 -10 -10 2 -10 20L-20 58H20L10 20C10 2 34 -10 34 -50z'/><ellipse cy='-50' rx='34' ry='8' fill='${p.label}' fill-opacity='.3'/><path d='M-32 -44L-20 -14L-10 16L0 -14L10 16L20 -14L32 -44' stroke-width='2.5'/>`, p), // a djembe
  dubstep: p => sigil(`<circle r='56'/><circle r='38' stroke-width='3'/><path d='M-54 0${[...Array(28)].map((_, k) => `L${-54 + (k + 1) * 4} ${i(Math.sin((k + 1) * .9) * (6 + k * 1.2))}`).join('')}' stroke-width='3'/>`, p), // a speaker cone with a wobble through it
};

// ----------------------------------------------------------------------------------------- cap faces
// 44 x 36 in the cap colour through kit.faces; each draws its own grip, so the CSS grip line is off.

const FACES2 = {
  techno: p => faces(p, `<path d='M4 9H40M4 13H40M4 23H40M4 27H40' stroke='#000' stroke-width='2.2' opacity='.5'/><path d='M4 10.5H40M4 24.5H40' stroke='#fff' stroke-width='.8' opacity='.3'/><rect x='4' y='16.8' width='36' height='2.4' fill='${p.accent}'/>`),
  house: p => faces(p, `<pattern id='k' width='3' height='3' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><rect width='1.2' height='3' fill='#3a2a0a' opacity='.5'/></pattern><rect x='3' y='9' width='38' height='18' rx='2' fill='url(#k)'/><path d='M3 18H41' stroke='#1a1208' stroke-width='1.6'/><circle cx='22' cy='18' r='2.6' fill='${p.accent}'/>`),
  bass: p => faces(p, `<path d='M4 8H40M4 12H40M4 16H40M4 20H40M4 24H40M4 28H40' stroke='#000' stroke-width='1.6' opacity='.5'/><path d='M4 9.5H40M4 13.5H40M4 17.5H40M4 21.5H40M4 25.5H40' stroke='#fff' stroke-width='.6' opacity='.35'/><rect x='18' y='16' width='8' height='4' fill='${p.accent}'/>`),
  balearic: p => faces(p, `<path d='M4 14q4.5 -4 9 0t9 0t9 0t9 0M4 22q4.5 -4 9 0t9 0t9 0t9 0' fill='none' stroke='#2a4a5c' stroke-width='1.8' opacity='.6'/><path d='M4 15.2q4.5 -4 9 0t9 0t9 0t9 0' fill='none' stroke='#fff' stroke-width='.7' opacity='.6'/><circle cx='22' cy='7' r='2.4' fill='${p.accent}'/>`),
  afro: p => faces(p, `<path d='M2 22L6 14L10 22L14 14L18 22L22 14L26 22L30 14L34 22L38 14L42 22' fill='none' stroke='#3a2214' stroke-width='2.2' stroke-linejoin='round'/><path d='M2 11H42M2 25H42' stroke='#3a2214' stroke-width='1.2' opacity='.6'/><circle cx='5' cy='6' r='2' fill='${p.accent}'/><circle cx='39' cy='6' r='2' fill='${p.accent}'/><circle cx='5' cy='30' r='2' fill='${p.accent}'/><circle cx='39' cy='30' r='2' fill='${p.accent}'/>`),
  dubstep: p => faces(p, `<rect width='44' height='36' fill='#000' opacity='.35'/><path d='M3 18${[...Array(19)].map((_, k) => `L${3 + (k + 1) * 2} ${(18 + Math.sin((k + 1) * 1.1) * (2 + k * .35)).toFixed(1)}`).join('')}' fill='none' stroke='${p.accent}' stroke-width='1.6' stroke-linejoin='round'/><path d='M3 8H41M3 28H41' stroke='#000' stroke-width='1.4' opacity='.6'/>`),
};

// ------------------------------------------------------------------------------------------ textures
// Grey tiles, overlay-blended in CSS; the range is the grain strength.

const concrete = seed => relief(512, 512, { fx: .025, fy: .025, oct: 4, scale: 2, lo: .4, hi: .64, seed, // formwork tie holes and one seam
  more: `${[[64, 64], [320, 64], [64, 320], [320, 320]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='5' fill='#000' opacity='.3'/>`).join('')}<rect y='255' width='512' height='2' fill='#000' opacity='.18'/>` });
const rubber = seed => grain(64, 64, { fx: .7, fy: .7, oct: 1, lo: .45, hi: .55, seed });
const ridges = () => svg(64, 64, `<pattern id='g' width='8' height='8' patternUnits='userSpaceOnUse'><rect width='8' height='8' fill='#808080'/><rect width='8' height='3' fill='#9a9a9a'/><rect y='3' width='8' height='1.5' fill='#5a5a5a'/></pattern><rect width='64' height='64' fill='url(#g)'/>`);
const mesh = () => svg(64, 64, `<pattern id='m' width='4' height='4' patternUnits='userSpaceOnUse'><rect width='4' height='4' fill='#7a7a7a'/><rect width='2' height='2' fill='#9a9a9a'/><rect x='2' y='2' width='2' height='2' fill='#606060'/></pattern><rect width='64' height='64' fill='url(#m)'/>`);
const plaster = seed => relief(512, 512, { fx: .008, fy: .008, oct: 4, scale: 1.5, lo: .44, hi: .64, seed });
const seaGlass = seed => relief(64, 64, { fx: .12, fy: .12, oct: 2, scale: 1, lo: .42, hi: .66, shine: 18, seed });
const weave = seed => grain(128, 128, { fx: .6, fy: .06, oct: 2, lo: .42, hi: .6, seed, // raffia: a basket weave of two-strand cells
  more: `<pattern id='w' width='16' height='16' patternUnits='userSpaceOnUse'><path d='M0 2.5H8M0 5.5H8M10.5 0V8M13.5 0V8M2.5 8V16M5.5 8V16M8 10.5H16M8 13.5H16' stroke='#000' stroke-width='1.2' opacity='.25'/></pattern><rect width='128' height='128' fill='url(#w)'/>` });
const kente = r => { // stripe bands in greys with woven blocks
  let s = '';
  for (let k = 0; k < 8; k++) {
    s += `<rect x='${k * 32}' width='32' height='256' fill='${k % 2 ? '#6a6a6a' : '#959595'}'/>`;
    for (let y = i(between(r, 0, 16)); y < 256; y += 32) s += `<rect x='${k * 32 + 6}' y='${y}' width='20' height='${k % 2 ? 8 : 14}' fill='${k % 2 ? '#a0a0a0' : '#5a5a5a'}'/>`;
  }
  return svg(256, 256, s);
};
const carvedWood = seed => relief(64, 64, { fx: .1, fy: .02, oct: 3, scale: 4, lo: .28, hi: .74, seed });
const gunmetal = seed => relief(512, 512, { fx: .02, fy: .02, oct: 3, scale: 3, lo: .32, hi: .68, shine: 28, seed });
const wobbleGrip = () => svg(64, 64, `<rect width='64' height='64' fill='#808080'/><g fill='none' stroke-width='1.6'>${[...Array(8)].map((_, k) => `<path d='M0 ${k * 8 + 4}q8 -4 16 0t16 0t16 0t16 0' stroke='#555'/><path d='M0 ${k * 8 + 5.6}q8 -4 16 0t16 0t16 0t16 0' stroke='#aaa' stroke-width='.8'/>`).join('')}</g>`);

// --------------------------------------------------------------------------------------------- themes
// scene and lights from the stop's seed; tiles, ornament, emblem from the theme's own seed.

const SKINS = {
  techno: { scene: yard, tiles: (t, p) => ({ panel: concrete(i(t() * 1e6)), cap: rubber(i(t() * 1e6)), ornament: bolted(p), emblem: SIGILS.techno(p), chassis: diamondPlate(), pad: rubber(i(t() * 1e6)), plate: lcd() }) },
  house: { scene: block, tiles: (t, p) => ({ panel: oak(t, i(t() * 1e6)), cap: knurl(), ornament: brass(p), emblem: SIGILS.house(p), chassis: leather(t, i(t() * 1e6)), pad: parchment(t, i(t() * 1e6)), plate: gold(t, i(t() * 1e6)) }) },
  bass: { scene: harbour, tiles: (t, p) => ({ panel: tolex(t, i(t() * 1e6)), cap: ridges(), ornament: cloth(p), emblem: SIGILS.bass(p), chassis: mesh(), pad: leather(t, i(t() * 1e6)), plate: lcd() }) },
  balearic: { scene: terrace, tiles: (t, p) => ({ panel: plaster(i(t() * 1e6)), cap: seaGlass(i(t() * 1e6)), ornament: terracotta(p), emblem: SIGILS.balearic(p), chassis: plaster(i(t() * 1e6)), pad: parchment(t, i(t() * 1e6)), plate: seaGlass(i(t() * 1e6)) }) },
  afro: { scene: savanna, tiles: (t, p) => ({ panel: weave(i(t() * 1e6)), cap: carvedWood(i(t() * 1e6)), ornament: carved(p), emblem: SIGILS.afro(p), chassis: kente(t), pad: weave(i(t() * 1e6)), plate: carvedWood(i(t() * 1e6)) }) },
  dubstep: { scene: underpass, tiles: (t, p) => ({ panel: gunmetal(i(t() * 1e6)), cap: wobbleGrip(), ornament: hazard(p), emblem: SIGILS.dubstep(p), chassis: carbon(), pad: matte(t, i(t() * 1e6)), plate: lcd() }) },
};

// The asset set for a theme at a stop of the day (0..7, compose.js DAY), or null for an unknown theme.
export function skin2(theme, stop) {
  const s = SKINS[theme], p = PALETTES[theme];
  if (!s) return null;
  const lights = [];
  return { scene: s.scene(rng(hash(`${theme}:${stop}`)), p, lights, daylight(stop)), ...s.tiles(rng(hash(theme)), p), ...FACES2[theme](p), lights };
}
