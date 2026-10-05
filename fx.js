/* Opening a world, and going back to the doors (Worlds gear → Accessories).

   settings.openFx: 'curtains' (the default) | 'vhs' | 'tv' | 'bars' | 'none'
   settings.vhsStatic: VHS starts with static (off = straight to the blue PLAY screen)
   settings.exitFx: an effect on "‹ Worlds" too (on unless turned off). Curtains
     close; the TV, VHS and color bars all switch off like an old TV.

   Tapping skips any of them. Phones set to reduce motion go straight in. */

const FX = [['curtains', 'Theater curtains'], ['vhs', 'VHS tape'], ['tv', 'Old TV'], ['bars', 'Color bars'], ['none', 'None']];
const fxOf = () => {
  const s = state.settings || {};
  return { open: FX.some(([k]) => k === s.openFx) ? s.openFx : 'curtains', vhsStatic: !!s.vhsStatic, exit: s.exitFx !== false };
};
const fxStill = () => matchMedia('(prefers-reduced-motion: reduce)').matches || !Element.prototype.animate;
const fxWait = ms => new Promise(r => setTimeout(r, ms));
// Resolves when the animation ends, or soon after it should have (a phone that
// pauses animations in the background never leaves an effect stuck).
const fxPlay = (el, frames, opts) => Promise.race([el.animate(frames, { fill: 'forwards', ...opts }).finished.catch(() => {}), fxWait((opts.duration || 0) + 250)]);

// The full-screen layer an effect plays on. ov.go() changes the page (once);
// a tap goes there right away and clears the effect.
function fxLayer(cls, html, href) {
  const ov = document.createElement('div');
  ov.className = `fx ${cls}`;
  ov.innerHTML = html;
  ov.go = () => { if (!ov.went) { ov.went = true; location.hash = href; } };
  ov.live = () => ov.isConnected;
  ov.done = () => { ov.remove(); $('#view').getAnimations().forEach(a => a.cancel()); };
  ov.addEventListener('click', () => { ov.go(); ov.done(); });
  document.body.appendChild(ov);
  return ov;
}

// The door pushes in a little as you tap it.
const fxPush = tile => fxPlay(tile, [{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(.94) translateY(6px)', filter: 'brightness(.7)' }],
  { duration: 220, easing: 'ease-in' });

function openWorldFx(tile) {
  const href = `#/w/${tile.dataset.world}`;
  if ($('.fx')) return;
  const fx = fxOf();
  if (fx.open === 'none' || fxStill()) { location.hash = href; return; }
  ({ curtains: curtainsOpen, vhs: vhsOpen, tv: tvOpen, bars: barsOpen })[fx.open](tile, href, fx);
}

// "‹ Worlds" from inside a world plays the exit effect before going home.
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a.back[href="#/"]');
  if (!a || parseHash()[0] !== 'w' || $('.fx')) return;
  const fx = fxOf();
  if (!fx.exit || fx.open === 'none' || fxStill()) return;
  e.preventDefault();
  (fx.open === 'curtains' ? curtainsExit : tvOff)();
}, true);

// ---------- theater curtains ----------
// Deep burgundy velvet drawn fresh each time (so the folds are never quite the
// same): two main curtains, draped swags across the top, and a tied-back drape
// at each edge. Swags and side drapes come in first and lift away last.
const VELVET = { deep: '#2a0306', dark: '#45070d', mid: '#650c15', light: '#78111a', shine: '#8c1a23' };

// Uneven vertical folds as gradient stops across 0–100%.
function velvetStops(folds) {
  const out = [];
  let x = 0;
  const widths = Array.from({ length: folds }, () => .6 + Math.random() * .8);
  const sum = widths.reduce((a, b) => a + b, 0);
  widths.forEach(w => {
    const f = (w / sum) * 100, top = Math.random() < .3 ? VELVET.shine : VELVET.light;
    out.push([x, VELVET.deep], [x + f * .18, VELVET.dark], [x + f * .42, VELVET.mid], [x + f * .62, top], [x + f * .84, VELVET.mid]);
    x += f;
  });
  out.push([100, VELVET.deep]);
  return out.map(([o, c]) => `<stop offset="${Math.min(o, 100).toFixed(2)}%" stop-color="${c}"/>`).join('');
}
const fxId = () => 'v' + Math.random().toString(36).slice(2, 8);

function curtainPanel(cls) {
  const id = fxId();
  return `<div class="cur-panel ${cls}"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="${id}">${velvetStops(4 + Math.floor(Math.random() * 2))}</linearGradient></defs>
    <rect width="100" height="100" fill="url(#${id})"/></svg></div>`;
}

// Draped swags across the top: a gathered band, then 2–3 swags that dip in the middle.
function curtainSwags(W) {
  const H = 96, n = W < 520 ? 2 : 3, sw = W / n, id = fxId();
  let swags = '';
  for (let i = 0; i < n; i++) {
    const x0 = i * sw - 14, x1 = (i + 1) * sw + 14, mx = (x0 + x1) / 2, d = 70 + Math.random() * 10, cid = `${id}c${i}`;
    const edge = `M${x0},0 H${x1} V20 Q${mx},${2 * d - 20} ${x0},20 Z`;
    let lines = '';
    for (let j = 1; j <= 5; j++) {
      const y = 20 - j * 2.5, dip = d - (6 - j) * 10;
      const path = `M${x0 + j * 6},${y} Q${mx},${2 * dip - y} ${x1 - j * 6},${y}`;
      lines += `<path d="${path}" fill="none" stroke="${VELVET.shine}" stroke-opacity=".16" stroke-width="6"/><path d="${path}" transform="translate(0 4)" fill="none" stroke="#000" stroke-opacity=".26" stroke-width="3"/>`;
    }
    swags += `<clipPath id="${cid}"><path d="${edge}"/></clipPath><g clip-path="url(#${cid})"><path d="${edge}" fill="url(#${id}g)"/>${lines}</g>
      <path d="M${x0},20 Q${mx},${2 * d - 20} ${x1},20" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="2"/>`;
  }
  let knots = '';
  for (let i = 1; i < n; i++) knots += `<ellipse cx="${i * sw}" cy="18" rx="13" ry="20" fill="url(#${id}k)"/>`;
  return `<svg class="cur-swags" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${VELVET.deep}"/><stop offset=".45" stop-color="${VELVET.mid}"/><stop offset=".8" stop-color="${VELVET.light}"/><stop offset="1" stop-color="${VELVET.dark}"/></linearGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${VELVET.deep}"/><stop offset=".6" stop-color="${VELVET.dark}"/><stop offset="1" stop-color="${VELVET.mid}"/></linearGradient>
      <radialGradient id="${id}k"><stop offset="0" stop-color="${VELVET.deep}"/><stop offset="1" stop-color="${VELVET.deep}" stop-opacity="0"/></radialGradient>
    </defs><rect width="${W}" height="22" fill="url(#${id}b)"/>${swags}${knots}</svg>`;
}

// A narrow drape at the edge, cinched with a dark tie a little below the middle.
function curtainSide(cls, W, Hs) {
  const w = Math.round(Math.min(120, Math.max(50, W * .15))), tx = w * .36, ty = Hs * .58, id = fxId();
  const shape = `M0,0 H${w} C${w * .95},${Hs * .26} ${w * .62},${Hs * .5} ${tx},${ty} C${w * .6},${Hs * .66} ${w * .88},${Hs * .86} ${w},${Hs} H0 Z`;
  let lines = '';
  for (let k = 1; k <= 4; k++) {
    const xt = (w * k) / 5, xm = (tx * k) / 5, xb = (w * k) / 5;
    const path = `M${xt},0 C${xt},${Hs * .3} ${xm + 2},${ty * .8} ${xm},${ty} C${xm},${ty + Hs * .12} ${xb},${Hs * .8} ${xb},${Hs}`;
    lines += `<path d="${path}" fill="none" stroke="${VELVET.shine}" stroke-opacity=".14" stroke-width="6"/><path d="${path}" transform="translate(3 0)" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="3"/>`;
  }
  return `<div class="cur-side ${cls}" style="width:${w}px"><svg width="${w}" height="${Hs}" viewBox="0 0 ${w} ${Hs}" aria-hidden="true"><defs>
      <linearGradient id="${id}">${velvetStops(4)}</linearGradient><clipPath id="${id}c"><path d="${shape}"/></clipPath></defs>
    <g clip-path="url(#${id}c)"><path d="${shape}" fill="url(#${id})"/>${lines}</g>
    <rect x="-4" y="${ty - 6}" width="${tx + 10}" height="12" rx="6" fill="#1a0204"/><rect x="-4" y="${ty - 5}" width="${tx + 8}" height="3" rx="1.5" fill="#5a1a1e" opacity=".7"/>
    <path d="M${tx + 4},${ty + 5} q3,14 -1,26" fill="none" stroke="#1a0204" stroke-width="3" stroke-linecap="round"/><circle cx="${tx + 3}" cy="${ty + 32}" r="4" fill="#1a0204"/>
  </svg></div>`;
}

const curtainsHtml = () => curtainPanel('cur-l') + curtainPanel('cur-r') + curtainSide('cur-side-l', innerWidth, innerHeight) + curtainSide('cur-side-r', innerWidth, innerHeight)
  + `<div class="cur-top">${curtainSwags(innerWidth)}</div>`;

// The swags drop and the side drapes come in (or the reverse, on the way out).
function curtainFrame(ov, show, duration) {
  const opts = { duration, easing: show ? 'ease-out' : 'ease-in' };
  const off = { top: 'translateY(-110%)', sl: 'translateX(-105%)', sr: 'translateX(105%)' };
  const kf = k => (show ? [{ transform: off[k] }, { transform: 'none' }] : [{ transform: 'none' }, { transform: off[k] }]);
  fxPlay($('.cur-side-l', ov), kf('sl'), opts);
  fxPlay($('.cur-side-r', ov), kf('sr'), opts);
  return fxPlay($('.cur-top', ov), kf('top'), opts);
}

async function curtainsOpen(tile, href) {
  fxPush(tile);
  const ov = fxLayer('curtains', curtainsHtml(), href);
  const l = $('.cur-l', ov), r = $('.cur-r', ov);
  // The swags drop and the curtains swing shut over the doors…
  curtainFrame(ov, true, 320);
  fxPlay(l, [{ transform: 'translateX(-101%)' }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.5,0,.3,1)' });
  await fxPlay(r, [{ transform: 'translateX(101%)' }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.5,0,.3,1)' });
  await fxWait(160);
  if (!ov.live()) return;
  // …and part on the world.
  ov.go();
  await fxWait(60);
  const part = { duration: 1150, easing: 'cubic-bezier(.55,0,.25,1)' };
  fxPlay(l, [{ transform: 'none' }, { transform: 'translateX(-60%) scaleX(.75)', offset: .55 }, { transform: 'translateX(-101%) scaleX(.6)' }], part);
  fxPlay(r, [{ transform: 'none' }, { transform: 'translateX(60%) scaleX(.75)', offset: .55 }, { transform: 'translateX(101%) scaleX(.6)' }], part);
  await fxWait(800);
  await curtainFrame(ov, false, 420);
  ov.done();
}

async function curtainsExit() {
  const ov = fxLayer('curtains', curtainsHtml(), '#/');
  const l = $('.cur-l', ov), r = $('.cur-r', ov);
  const shut = { duration: 750, easing: 'cubic-bezier(.5,0,.3,1)' };
  curtainFrame(ov, true, 320);
  fxPlay(l, [{ transform: 'translateX(-101%) scaleX(.6)' }, { transform: 'none' }], shut);
  await fxPlay(r, [{ transform: 'translateX(101%) scaleX(.6)' }, { transform: 'none' }], shut);
  await fxWait(200);
  if (!ov.live()) return;
  ov.go();
  await fxPlay(ov, [{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-out' });
  ov.done();
}

// ---------- old TV: power on / power off ----------
const TV = '<div class="tv-half tv-top"></div><div class="tv-half tv-bot"></div><div class="tv-line"></div>';

async function tvOpen(tile, href) {
  await fxPush(tile);
  const ov = fxLayer('tv', TV, href);
  const line = $('.tv-line', ov);
  await fxWait(140);
  if (!ov.live()) return;
  // A bright dot, stretching into a line…
  await fxPlay(line, [{ opacity: 0, transform: 'translate(-50%, -50%) scale(.2)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }], { duration: 140, easing: 'ease-out' });
  await fxPlay(line, [{ width: '6px' }, { width: '100vw' }], { duration: 220, easing: 'cubic-bezier(.3,0,.2,1)' });
  if (!ov.live()) return;
  // …that opens up into the picture.
  ov.go();
  await fxWait(40);
  const mid = `50% ${window.scrollY + innerHeight / 2}px`;
  $('#view').animate([
    { transform: 'scaleY(.02)', transformOrigin: mid, filter: 'brightness(3) contrast(1.3)' },
    { transform: 'scaleY(1.03)', transformOrigin: mid, filter: 'brightness(1.6) contrast(1.15)', offset: .6 },
    { transform: 'none', transformOrigin: mid, filter: 'none' },
  ], { duration: 520, easing: 'ease-out' });
  fxPlay(line, [{ opacity: 1, height: '2px' }, { opacity: 0, height: '30vh' }], { duration: 300, easing: 'ease-out' });
  fxPlay($('.tv-top', ov), [{ transform: 'none' }, { transform: 'translateY(-101%)' }], { duration: 380, easing: 'cubic-bezier(.2,.7,.3,1)' });
  await fxPlay($('.tv-bot', ov), [{ transform: 'none' }, { transform: 'translateY(101%)' }], { duration: 380, easing: 'cubic-bezier(.2,.7,.3,1)' });
  await fxWait(160);
  ov.done();
}

async function tvOff() {
  const ov = fxLayer('tv tv-off', TV, '#/');
  const line = $('.tv-line', ov), view = $('#view');
  const mid = `50% ${window.scrollY + innerHeight / 2}px`;
  // The picture squeezes to a bright line…
  fxPlay(view, [
    { transform: 'none', transformOrigin: mid, filter: 'none' },
    { transform: 'scaleY(.02)', transformOrigin: mid, filter: 'brightness(3) contrast(1.3)' },
  ], { duration: 280, easing: 'cubic-bezier(.6,0,.9,.5)' });
  fxPlay($('.tv-top', ov), [{ transform: 'translateY(-101%)' }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.6,0,.9,.5)' });
  await fxPlay($('.tv-bot', ov), [{ transform: 'translateY(101%)' }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.6,0,.9,.5)' });
  if (!ov.live()) return;
  // …the line shrinks to a dot, and the dot fades out.
  line.style.opacity = 1;
  await fxPlay(line, [{ width: '100vw' }, { width: '6px' }], { duration: 230, easing: 'cubic-bezier(.6,0,.8,.6)' });
  await fxPlay(line, [{ opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%, -50%) scale(.2)' }], { duration: 380, easing: 'ease-in' });
  await fxWait(160);
  if (!ov.live()) return;
  ov.go();
  view.getAnimations().forEach(a => a.cancel());
  await fxPlay(ov, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-out' });
  ov.done();
}

// ---------- color bars (the old test pattern) ----------
const BARS = `<div class="bars-top">${['#f2f2f2', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff'].map(c => `<i style="background:${c}"></i>`).join('')}</div>
  <div class="bars-mid">${['#0000ff', '#111', '#ff00ff', '#111', '#00e5e5', '#111', '#f2f2f2'].map(c => `<i style="background:${c}"></i>`).join('')}</div>
  <div class="bars-bot"><i style="background:#001b44"></i><i style="background:#fff"></i><i style="background:#2e0055"></i><i class="wide" style="background:#000"></i></div>
  <div class="vhs-lines"></div>`;

async function barsOpen(tile, href) {
  await fxPush(tile);
  const ov = fxLayer('bars', BARS, href);
  // A faint flicker while the pattern holds.
  fxPlay(ov, [{ filter: 'brightness(1)' }, { filter: 'brightness(.92)' }, { filter: 'brightness(1.04)' }, { filter: 'brightness(.96)' }, { filter: 'brightness(1)' }],
    { duration: 1050, easing: 'steps(8, end)' });
  await fxWait(1050);
  if (!ov.live()) return;
  ov.go();
  await fxPlay(ov, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'steps(3, end)' });
  ov.done();
}

// ---------- VHS tape ----------
// The door pushes in like a tape going into the VCR, the screen comes up (static
// first, if that's switched on) with ▶ PLAY in the corner, and the world comes up
// with scanlines, a rolling tracking bar and a little wobble before it settles.
async function vhsOpen(tile, href, fx) {
  await fxPush(tile);
  const ov = fxLayer(`vhs${fx.vhsStatic ? '' : ' vhs-blue'}`,
    '<canvas width="120" height="210"></canvas><div class="vhs-lines"></div><div class="vhs-bar"></div><div class="vhs-osd">▶ PLAY</div><div class="vhs-time">SP&nbsp;&nbsp;0:00:00</div>', href);
  let noise = fx.vhsStatic;
  if (noise) {
    const cv = $('canvas', ov), g = cv.getContext('2d'), img = g.createImageData(cv.width, cv.height);
    const snow = () => {
      if (!noise || !ov.live()) return;
      for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255 | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      g.putImageData(img, 0, 0);
      requestAnimationFrame(snow);
    };
    snow();
  }
  await fxWait(fx.vhsStatic ? 620 : 750);
  if (!ov.live()) return;
  ov.go();
  noise = false;
  ov.classList.add('vhs-on');
  $('#view').animate([
    { transform: 'translateX(-3px) skewX(-1deg)', filter: 'contrast(1.25) saturate(1.5) hue-rotate(-8deg) blur(.6px)' },
    { transform: 'translateX(2px)', filter: 'contrast(1.15) saturate(1.3) blur(.3px)', offset: .3 },
    { transform: 'translateX(-1px)', filter: 'contrast(1.05) saturate(1.1)', offset: .65 },
    { transform: 'none', filter: 'none' },
  ], { duration: 900, easing: 'steps(9, end)' });
  await fxPlay(ov, [{ opacity: 1 }, { opacity: 1, offset: .55 }, { opacity: 0 }], { duration: 1100 });
  ov.done();
}

// ---------- the Accessories pop-up part ----------
function fxFields() {
  const fx = fxOf();
  return `<div class="field fx-field"><span class="field-label">Opening a world</span>
      <div class="chips bot-chips" id="dfx">${FX.map(([k, l]) => `<button type="button" class="chip${k === fx.open ? ' on' : ''}" data-k="${k}">${l}</button>`).join('')}</div></div>
    <label class="switch ribbon-switch" id="dstatic-row" ${fx.open === 'vhs' ? '' : 'hidden'}><input type="checkbox" id="dstatic" ${fx.vhsStatic ? 'checked' : ''}><span class="track"></span><span>Start with static</span></label>
    <label class="switch ribbon-switch" id="dexit-row" ${fx.open === 'none' ? 'hidden' : ''}><input type="checkbox" id="dexit" ${fx.exit ? 'checked' : ''}><span class="track"></span><span>Exit effect when going back to the doors</span></label>`;
}
function wireFxFields(root) {
  $('#dfx', root).onclick = e => {
    const c = e.target.closest('[data-k]');
    if (!c) return;
    $$('#dfx .chip', root).forEach(x => x.classList.toggle('on', x === c));
    $('#dstatic-row', root).hidden = c.dataset.k !== 'vhs';
    $('#dexit-row', root).hidden = c.dataset.k === 'none';
  };
}
function saveFxFields(root) {
  const cur = fxOf();
  const next = { open: $('#dfx .chip.on', root).dataset.k, vhsStatic: $('#dstatic', root).checked, exit: $('#dexit', root).checked };
  const patch = {};
  if (next.open !== cur.open || !state.settings.openFx) patch.openFx = next.open;
  if (next.vhsStatic !== cur.vhsStatic) patch.vhsStatic = next.vhsStatic;
  if (next.exit !== cur.exit) patch.exitFx = next.exit;
  if (!Object.keys(patch).length) return;
  Object.assign(state.settings, patch);
  DB.saveSettings(patch).catch(e => toast(friendlyError(e), true));
}
