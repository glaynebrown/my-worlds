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
const fxPlay = (el, frames, opts) => el.animate(frames, { fill: 'forwards', ...opts }).finished.catch(() => {});

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
const CURTAINS = '<div class="cur-panel cur-l"></div><div class="cur-panel cur-r"></div><div class="cur-top"></div>';

async function curtainsOpen(tile, href) {
  fxPush(tile);
  const ov = fxLayer('curtains', CURTAINS, href);
  const l = $('.cur-l', ov), r = $('.cur-r', ov), top = $('.cur-top', ov);
  // The valance drops and the curtains swing shut over the doors…
  fxPlay(top, [{ transform: 'translateY(-110%)' }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
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
  await fxPlay(top, [{ transform: 'none' }, { transform: 'translateY(-110%)' }], { duration: 380, easing: 'ease-in' });
  ov.done();
}

async function curtainsExit() {
  const ov = fxLayer('curtains', CURTAINS, '#/');
  const l = $('.cur-l', ov), r = $('.cur-r', ov), top = $('.cur-top', ov);
  const shut = { duration: 750, easing: 'cubic-bezier(.5,0,.3,1)' };
  fxPlay(top, [{ transform: 'translateY(-110%)' }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
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
