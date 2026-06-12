import { TrailMap } from './map.js';

const $ = id => document.getElementById(id);

const MONTHS = ['March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August'];
function tToDate(t) {
  const i = Math.max(0, Math.min(17, Math.floor(t)));
  const year = i < 10 ? 1876 : 1877;
  return `${MONTHS[i]} ${year}`;
}

const TYPE_KICKER = {
  death: '✟ A Death on the Trail', violence: '⚔ Violence', romance: '❧ Matters of the Heart',
  milestone: '✦ The Story Turns', departure: '→ A Departure', arrival: '⌂ An Arrival', parting: '❦ A Parting',
};

async function loadJSON(path) { const r = await fetch(path); if (!r.ok) throw new Error(path); return r.json(); }

const state = {
  view: 'map',
  selectedEvent: null,
  playing: false,
  follow: false,
  autoTour: false,
  autoLast: 0,
  t: null,
};

function setAutoTour(on) {
  state.autoTour = on;
  state.autoLast = performance.now();
  const b = $('autoBtn');
  if (b) { b.classList.toggle('active', on); b.textContent = on ? '❚❚ auto' : '▶ auto'; }
}

let map, DATA;

async function boot() {
  const [chars, locs, events, journeys, states, rivers, borders] = await Promise.all([
    loadJSON('data/characters.json'), loadJSON('data/locations.json'),
    loadJSON('data/events.json'), loadJSON('data/journeys.json'),
    loadJSON('data/geo/states.json'), loadJSON('data/geo/rivers.json'),
    loadJSON('data/geo/borders.json'),
  ]);
  DATA = {
    characters: chars.characters,
    locations: locs.locations,
    events: events.events.slice().sort((a, b) => a.t - b.t),
    journeys: journeys.journeys,
    timeline: journeys.timeline,
    charById: Object.fromEntries(chars.characters.map(c => [c.id, c])),
    locById: Object.fromEntries(locs.locations.map(l => [l.id, l])),
    eventById: Object.fromEntries(events.events.map(e => [e.id, e])),
    jById: Object.fromEntries(journeys.journeys.map(j => [j.id, j])),
  };
  state.t = DATA.timeline.t1;

  await Promise.all([
    document.fonts.load('20px "Rye"'), document.fonts.load('16px "IM Fell English SC"'),
    document.fonts.load('16px "IM Fell English"'), document.fonts.load('16px "IM Fell DW Pica"'),
  ]).catch(() => {});

  map = new TrailMap($('map'), { states, rivers, borders }, DATA);
  map.reducedMotion = REDUCED_MOTION;
  window.__ldmap = map; // debugging / test hook
  map.resize();
  map.fitBounds();
  map.onHover = onHover;
  map.onClick = onClick;

  buildEventStrip();
  buildLegend();
  wireChrome();

  $('app').classList.remove('loading');
  if (!REDUCED_MOTION) map.startIntro();
  openFromHash();
  window.addEventListener('hashchange', openFromHash);

  // first-visit hint, dismissed by any meaningful interaction
  if (!localStorage.getItem('ld-seen') && !location.hash) {
    const toast = $('hintToast');
    setTimeout(() => { toast.hidden = false; }, 1800);
    const bye = () => {
      toast.classList.add('bye');
      localStorage.setItem('ld-seen', '1');
      setTimeout(() => { toast.hidden = true; }, 600);
      window.removeEventListener('pointerdown', bye, true);
    };
    window.addEventListener('pointerdown', bye, true);
    setTimeout(bye, 14000);
  } else {
    localStorage.setItem('ld-seen', '1');
  }

  let last = 0, lastViewKey = '';
  const loop = now => {
    const dtMs = Math.min(350, now - (last || now)); // cap only guards tab-switch jumps
    if (state.playing) {
      state.t = Math.min(DATA.timeline.t1, state.t + (dtMs / 1000) * 0.55);
      syncScrub();
      if (state.t >= DATA.timeline.t1) setPlaying(false);
    }
    if (state.follow) {
      if (map.userPanned) setFollow(false);     // the reader took the reins
      else if (!map.fly) {
        const p = map.headPos('drive', Math.min(state.t, DATA.timeline.t1 - 0.01));
        if (p) {
          const f = 1 - Math.exp(-dtMs / 240);  // frame-rate independent ease
          map.view.cx += (p.x - map.view.cx) * f;
          map.view.cy += (p.y - map.view.cy) * f;
        }
      }
    }
    if (state.autoTour && state.selectedEvent) {
      // deaths get a longer beat
      const cur = DATA.eventById[state.selectedEvent];
      const dwell = cur && cur.type === 'death' ? 9800 : 7000;
      if (now - state.autoLast > dwell) {
        const i = DATA.events.findIndex(e => e.id === state.selectedEvent);
        if (i < DATA.events.length - 1) { openEvent(DATA.events[i + 1].id); state.autoLast = now; }
        else setAutoTour(false);
      }
    }
    map.userPanned = false;
    last = now;
    // skip repainting when nothing on screen is moving — saves the laptop fan
    const animActive = state.playing || state.follow || map.fly || map.inertia || map.zoomTarget
      || map.selectedLoc
      || (map.introStart && now - map.introStart < 2800)
      || (map.modeChangedAt && now - map.modeChangedAt < 1700);
    const viewKey = [map.view.cx.toFixed(3), map.view.cy.toFixed(3), map.view.k.toFixed(5),
      map.mode, state.t.toFixed(3), JSON.stringify(map._hitKey(map.hover)),
      map.highlightJourney || '', map.previewLoc || '', [...map.visible].sort().join(','), map.w, map.h].join('|');
    if (animActive || viewKey !== lastViewKey) {
      map.render(now);
      lastViewKey = viewKey;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  new ResizeObserver(() => { map.resize(); map.render(); }).observe($('stage'));
}

// ————— tooltip —————

function onHover(hit, sx, sy) {
  const tt = $('tooltip');
  // reverse-link: hovering a site glows its diamonds on the chronology strip
  const peekLoc = hit && hit.kind === 'loc' ? hit.loc.id : null;
  document.querySelectorAll('.strip-tick').forEach(el => {
    const ev = DATA.eventById[el.dataset.event];
    el.classList.toggle('peek', !!peekLoc && ev && ev.loc === peekLoc);
  });
  if (!hit) { tt.hidden = true; return; }
  let html = '';
  if (hit.kind === 'loc') {
    const n = DATA.events.filter(e => e.loc === hit.loc.id).length;
    html = `<div class="tt-name">${hit.loc.name}</div>
            <div class="tt-kind">${hit.loc.type}${hit.loc.approx ? ' · site approximate' : ''}${n ? ` · ${n} event${n > 1 ? 's' : ''} — click to read` : ''}</div>`;
  } else if (hit.kind === 'journey') {
    html = `<div class="tt-name">${hit.j.name}</div><div class="tt-kind">${hit.j.subtitle}</div>`;
  } else if (hit.kind === 'event') {
    const ev = DATA.eventById[hit.eventId];
    html = `<div class="tt-name">${ev.title}</div><div class="tt-kind">${ev.date}</div>`;
  } else if (hit.kind === 'compass') {
    html = `<div class="tt-kind">show the whole territory</div>`;
  } else if (hit.kind === 'pigs') {
    html = `<div class="tt-name">The blue pigs</div><div class="tt-kind">walking every step of the way from Lonesome Dove. Nobody invited them.</div>`;
  }
  tt.innerHTML = html;
  tt.hidden = false;
  const stage = $('stage').getBoundingClientRect();
  tt.style.left = Math.min(sx + 16, stage.width - tt.offsetWidth - 12) + 'px';
  tt.style.top = Math.max(10, sy - tt.offsetHeight - 12) + 'px';
}

function onClick(hit) {
  if (!hit) return;
  if (hit.kind === 'loc') openLocation(hit.loc.id, true);
  else if (hit.kind === 'journey') openJourney(hit.j.id);
  else if (hit.kind === 'event') openEvent(hit.eventId, false);
  else if (hit.kind === 'compass') map.flyHome();
}

// ————— panel —————

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let closingAnim = null;

function showPanel() {
  if (closingAnim) { closingAnim.cancel(); closingAnim = null; }
  const wasOpen = !$('panel').hidden;
  $('panel').hidden = false;
  // card swaps replace the DOM under keyboard focus; re-anchor it on the panel
  if (document.activeElement === document.body) $('panel').focus({ preventScroll: true });
  $('app').classList.remove('mood-death'); // event cards re-add it for deaths
  if (wasOpen && !REDUCED_MOTION) {
    $('panelBody').animate(
      [{ opacity: 0.2, transform: 'translateY(7px)' }, { opacity: 1, transform: 'none' }],
      { duration: 230, easing: 'ease-out' });
  }
}
function closePanel() {
  const panel = $('panel');
  if (!panel.hidden && !REDUCED_MOTION) {
    // fade out, then hide (cancelled if a new card opens meanwhile)
    closingAnim = panel.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(14px)' }],
      { duration: 160, easing: 'ease-in' });
    closingAnim.onfinish = () => { panel.hidden = true; closingAnim = null; };
  } else {
    panel.hidden = true;
  }
  state.selectedEvent = null;
  setAutoTour(false);
  map.setSelected(null);
  $('tourBtn').classList.remove('tour-active');
  $('app').classList.remove('mood-death');
  setHash('');
  markStrip();
}

const BASE_TITLE = 'Lonesome Dove — The Trail from Texas to Montana';
function setHash(h, title) {
  history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
  document.title = title ? `${title} · Lonesome Dove` : BASE_TITLE;
}

function openFromHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return;
  const [kind, id] = h.split('/');
  if (kind === 'event' && DATA.eventById[id]) { if (state.view !== 'map') setView('map'); openEvent(id); }
  else if (kind === 'place' && DATA.locById[id]) { if (state.view !== 'map') setView('map'); openLocation(id, true); }
  else if (kind === 'rider' && DATA.charById[id]) openCharacter(id);
  else if (kind === 'journey' && DATA.jById[id]) { if (state.view !== 'journeys') setView('journeys'); openJourney(id); }
  else if (kind === 'journeys') setView('journeys');
  else if (kind === 'cast') openCast();
  else if (kind === 'about') openAbout();
}

function charChip(id) {
  const c = DATA.charById[id];
  if (!c) return '';
  return `<button class="chip" data-char="${id}"><span class="swatch" style="background:${c.color}"></span>${c.name}</button>`;
}

function makeActivatable(el) {
  // non-button interactive elements get keyboard parity
  if (el.tagName === 'BUTTON' || el.tagName === 'A') return;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.onkeydown = e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
  };
}

function wireBody() {
  const body = $('panelBody');
  body.querySelectorAll('[data-char]').forEach(el => { el.onclick = () => openCharacter(el.dataset.char); makeActivatable(el); });
  body.querySelectorAll('[data-loc]').forEach(el => { el.onclick = e => { e.preventDefault(); openLocation(el.dataset.loc, true); }; makeActivatable(el); });
  body.querySelectorAll('[data-event]').forEach(el => { el.onclick = () => openEvent(el.dataset.event); makeActivatable(el); });
  body.querySelectorAll('[data-journey]').forEach(el => { el.onclick = () => openJourney(el.dataset.journey); makeActivatable(el); });
}

function openEvent(id, fromStrip = true) {
  const ev = DATA.eventById[id];
  if (!ev) return;
  state.selectedEvent = id;
  if (state.autoTour) state.autoLast = performance.now(); // manual nav resets the auto clock
  const loc = DATA.locById[ev.loc];
  const idx = DATA.events.indexOf(ev);

  $('panelNav').hidden = false;
  $('panelNavLabel').textContent = `${idx + 1} of ${DATA.events.length} · ${ev.date.replace('circa ', 'c. ')}`;
  $('prevEvent').disabled = idx === 0;
  $('nextEvent').disabled = idx === DATA.events.length - 1;

  $('panelBody').innerHTML = `
    <div class="pb-kicker">${TYPE_KICKER[ev.type] || ev.type} · ${ev.date}</div>
    <div class="pb-title">${ev.title}</div>
    <div class="pb-where">at <a href="#" data-loc="${loc.id}">${loc.name}</a></div>
    <hr class="pb-rule">
    <p class="pb-text">${ev.text}</p>
    ${ev.quote ? `<div class="pb-quote">${ev.quote}</div>` : ''}
    <div class="pb-label">PERSONS CONCERNED</div>
    <div class="pb-chips">${ev.chars.map(charChip).join('')}</div>
    ${loc.approx ? '<div class="pb-approx">Site approximate — the novel names only the region.</div>' : ''}
    ${idx < DATA.events.length - 1 ? `<div class="pb-next" data-event="${DATA.events[idx + 1].id}">
      Next on the trail — ${DATA.events[idx + 1].title} ⟶</div>` : ''}`;
  wireBody();
  showPanel();
  map.setSelected(loc.id);
  map.flyToLoc(loc.id, { panelOpen: true, k: Math.max(map.view.k, map.kFit * 3.4) });
  $('app').classList.toggle('mood-death', ev.type === 'death');
  setHash('event/' + id, ev.title);
  markStrip();
  $('panelBody').scrollTop = 0;
}

function openLocation(id, fly = false) {
  const loc = DATA.locById[id];
  const here = DATA.events.filter(e => e.loc === id);
  $('panelNav').hidden = true;
  state.selectedEvent = null;
  $('panelBody').innerHTML = `
    <div class="pb-kicker">${loc.type}${loc.fictional ? ' · a place of the novel' : ''}</div>
    <div class="pb-title">${loc.name}</div>
    <hr class="pb-rule">
    <p class="pb-text">${loc.blurb}</p>
    ${here.length ? `<div class="pb-label">WHAT HAPPENED HERE</div>
      <ul class="pb-eventlist">${here.map(e =>
        `<li data-event="${e.id}"><span class="ev-date">${e.date.replace('circa ', 'c. ')}</span><span>${e.title}</span></li>`).join('')}</ul>` : ''}
    ${loc.approx ? '<div class="pb-approx">Site approximate — the novel names only the region.</div>' : ''}`;
  wireBody();
  showPanel();
  map.setSelected(id);
  if (fly) map.flyToLoc(id, { panelOpen: true });
  setHash('place/' + id, loc.name);
  markStrip();
  $('panelBody').scrollTop = 0;
}

function openCharacter(id) {
  const c = DATA.charById[id];
  const evs = DATA.events.filter(e => e.chars.includes(id));
  const js = (c.journeys || []).map(jid => DATA.jById[jid]).filter(Boolean);
  $('panelNav').hidden = true;
  state.selectedEvent = null;
  $('panelBody').innerHTML = `
    <div class="pb-kicker">${c.tier === 'main' ? 'Principal of the novel' : 'Of the company'}</div>
    <div class="pb-title">${c.name}</div>
    ${c.aka ? `<div class="pb-where">called “${c.aka}”</div>` : ''}
    <hr class="pb-rule">
    <p class="pb-text">${c.role}</p>
    <div class="pb-label">FATE</div>
    <p class="pb-fate">${c.fate}</p>
    ${js.length ? `<div class="pb-label">RIDES WITH</div>
      <div class="pb-chips">${js.map(j =>
        `<button class="chip" data-journey="${j.id}"><span class="swatch" style="background:${j.color}"></span>${j.name}</button>`).join('')}</div>` : ''}
    ${evs.length ? `<div class="pb-label">APPEARS IN</div>
      <ul class="pb-eventlist">${evs.map(e =>
        `<li data-event="${e.id}"><span class="ev-date">${e.date.replace('circa ', 'c. ')}</span><span>${e.title}</span></li>`).join('')}</ul>` : ''}`;
  wireBody();
  showPanel();
  setHash('rider/' + id, c.name);
}

function openCast() {
  const firstWords = s => s.split('.')[0] + '.';
  const group = tier => DATA.characters.filter(c => c.tier === tier).map(c => `
    <li data-char="${c.id}">
      <span class="cast-dot" style="background:${c.color}"></span>
      <span><span class="cast-name">${c.name}</span><br><span class="cast-role">${firstWords(c.role)}</span></span>
    </li>`).join('');
  $('panelNav').hidden = true;
  state.selectedEvent = null;
  $('panelBody').innerHTML = `
    <div class="pb-kicker">The company of the novel</div>
    <div class="pb-title">Dramatis Personæ</div>
    <hr class="pb-rule">
    <div class="pb-label">THE PRINCIPALS</div>
    <ul class="pb-castlist">${group('main')}</ul>
    <div class="pb-label">OF THE COMPANY</div>
    <ul class="pb-castlist">${group('support')}</ul>`;
  wireBody();
  showPanel();
  setHash('cast', 'Dramatis Personæ');
}

function openAbout() {
  $('panelNav').hidden = true;
  state.selectedEvent = null;
  $('panelBody').innerHTML = `
    <div class="pb-kicker">A colophon</div>
    <div class="pb-title">About This Chart</div>
    <hr class="pb-rule">
    <div class="pb-quote">What they dreamed, we live, and what they lived, we dream. — T. K. Whipple</div>
    <p class="pb-text">This is a reader's map of <em>Lonesome Dove</em>, Larry McMurtry's 1985 novel of the last
      great cattle drive — the Hat Creek outfit's journey from the Rio Grande to the Milk River, and every
      journey that crosses it.</p>
    <p class="pb-text">McMurtry never gives a date and keeps some geography deliberately loose. Convention places
      the drive in 1876–77, and every date here is marked <em>circa</em>. Real towns and rivers sit at their true
      coordinates (rivers and borders are traced from Natural Earth survey data); fictional places — Lonesome Dove
      itself, Clara's ranch, the hanging ground — are placed by the book's internal geography and flagged
      <em>approximate</em>. Territory names are as they stood in 1876.</p>
    <p class="pb-text">The chart is drawn live in your browser on a single canvas: an Albers conic projection, so
      the parallels curve the way they do on the survey maps of the period; hand-wobbled linework; engraver's
      mountains. The chronology, the company, and all seven trails are built from a hand-compiled dataset of the
      novel — ${DATA.events.length} events, ${DATA.characters.length} riders, ${DATA.locations.length} places.</p>
    <div class="pb-quote">Uva uvam vivendo varia fit — the grape changes when it lives beside other grapes.</div>
    <div class="pb-label">SHORTCUTS</div>
    <p class="pb-text" style="font-size:13.5px">Drag to pan, scroll or pinch to zoom, double-click to dive.
      Arrow keys pan the chart; <b>Home</b> shows the whole territory; with a story card open, ← and → step
      through the chronology. Every card has a shareable address in the URL.</p>
    <div class="pb-label">SOURCES</div>
    <p class="pb-text" style="font-size:13.5px">Larry McMurtry, <em>Lonesome Dove</em> (Simon &amp; Schuster, 1985).
      Rivers and borders from Natural Earth; town coordinates from the historical record.
      Conjectural sites follow the geography of the text.</p>
    <div class="pb-approx">A passion project, drawn with affection for the book. All quotations are brief excerpts,
      quoted in commentary.</div>`;
  wireBody();
  showPanel();
  setHash('about', 'About This Chart');
}

function openJourney(id) {
  if (state.view !== 'journeys') setView('journeys');
  map.setVisible(id, true);
  const legItem = document.querySelector(`.leg-item[data-j="${id}"]`);
  if (legItem) legItem.classList.remove('off');
  const j = DATA.jById[id];
  const moments = j.waypoints.filter(w => w.eventId);
  $('panelNav').hidden = true;
  state.selectedEvent = null;
  $('panelBody').innerHTML = `
    <div class="pb-kicker">A journey · <span style="color:${j.color}">▬▬</span></div>
    <div class="pb-title">${j.name}</div>
    <div class="pb-where">${j.subtitle}</div>
    <hr class="pb-rule">
    <p class="pb-text">${j.blurb}</p>
    <div class="pb-label">THE RIDERS</div>
    <div class="pb-chips">${j.chars.map(charChip).join('')}</div>
    ${moments.length ? `<div class="pb-label">MOMENTS ALONG THE WAY</div>
      <ul class="pb-eventlist">${moments.map(w => {
        const e = DATA.eventById[w.eventId];
        return `<li data-event="${e.id}"><span class="ev-date">${e.date.replace('circa ', 'c. ')}</span><span>${e.title}</span></li>`;
      }).join('')}</ul>` : ''}`;
  wireBody();
  showPanel();
  setHash('journey/' + id, j.name);
}

// ————— event strip (map view) —————

function buildEventStrip() {
  const track = $('stripTrack');
  track.innerHTML = '<div class="strip-axis"></div>';
  const t0 = -1, t1 = DATA.timeline.t1 + 0.4;
  const W = () => track.clientWidth;

  const place = () => {
    const w = W();
    if (!w) return;
    track.querySelectorAll('.strip-tick,.strip-year,.strip-month,.strip-spacer').forEach(el => el.remove());
    // raw positions, then relax to a min gap; phones keep finger-sized gaps and scroll instead
    const phone = window.innerWidth <= 700;
    const xs = DATA.events.map(e => ((Math.max(e.t, t0 + 0.4) - t0) / (t1 - t0)) * Math.max(w, phone ? 26 * DATA.events.length : 0));
    const minGap = phone ? 26 : Math.min(20, w / DATA.events.length);
    for (let i = 1; i < xs.length; i++) xs[i] = Math.max(xs[i], xs[i - 1] + minGap);
    const over = xs[xs.length - 1] - (w - 8);
    if (over > 0 && !phone) for (let i = 0; i < xs.length; i++) xs[i] -= over * (i / (xs.length - 1));
    if (phone) {
      const spacer = document.createElement('div');
      spacer.className = 'strip-spacer';
      spacer.style.cssText = `width:${xs[xs.length - 1] + 40}px;height:1px`;
      track.appendChild(spacer);
      const axis = track.querySelector('.strip-axis');
      if (axis) { axis.style.right = 'auto'; axis.style.width = (xs[xs.length - 1] + 40) + 'px'; }
    }

    // faint month ticks along the axis
    for (let m = 0; m <= 16; m++) {
      const s = document.createElement('span');
      s.className = 'strip-month';
      s.style.left = ((m - t0) / (t1 - t0)) * w + 'px';
      track.appendChild(s);
    }
    const animate = !document.body.dataset.stripShown && !REDUCED_MOTION;
    DATA.events.forEach((e, i) => {
      const b = document.createElement('button');
      b.className = 'strip-tick' + (e.type === 'death' ? ' death' : '') + (animate ? ' tick-in' : '');
      if (animate) b.style.animationDelay = `${600 + i * 45}ms`;
      b.dataset.event = e.id;
      b.style.left = xs[i] + 'px';
      const epitaph = e.type === 'death' && e.quote
        ? `<br><i>“${e.quote.length > 64 ? e.quote.slice(0, 62) + '…' : e.quote}”</i>` : '';
      b.innerHTML = `<span class="tick-tip">${e.title} · ${e.date.replace('circa ', 'c. ')}${epitaph}</span>`;
      b.onclick = () => openEvent(e.id);
      b.onmouseenter = () => { map.previewLoc = e.loc; };
      b.onmouseleave = () => { map.previewLoc = null; };
      track.appendChild(b);
    });
    for (const [yr, t] of [['1875', t0 + 0.4], ['· 1876 ·', 1.2], ['· 1877 ·', 10.8]]) {
      const s = document.createElement('span');
      s.className = 'strip-year';
      s.style.left = ((t - t0) / (t1 - t0)) * w + 'px';
      s.textContent = yr;
      track.appendChild(s);
    }
    document.body.dataset.stripShown = '1';
    markStrip();
  };
  place();
  new ResizeObserver(place).observe(track);
}

function markStrip() {
  const selIdx = DATA.events.findIndex(e => e.id === state.selectedEvent);
  document.querySelectorAll('.strip-tick').forEach((el, i) => {
    el.classList.toggle('sel', el.dataset.event === state.selectedEvent);
    el.classList.toggle('past', selIdx >= 0 && i < selIdx);
  });
  // phone: keep the selected diamond in view on the scrolling strip
  if (selIdx >= 0 && window.innerWidth <= 700) {
    const sel = document.querySelector('.strip-tick.sel');
    if (sel) sel.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

// ————— legend (journeys view) —————

function buildLegend() {
  const span = j => {
    const w = j.waypoints;
    return `${tToDate(w[0].t).replace(' 18', ' ’')} – ${tToDate(w[w.length - 1].t).replace(' 18', ' ’')}`;
  };
  const list = $('legendList');
  list.innerHTML = DATA.journeys.map(j => `
    <div class="leg-item" data-j="${j.id}">
      <span class="leg-swatch" style="background:${j.color}"></span>
      <span><span class="leg-name">${j.name}</span><br>
        <span class="leg-sub2">${j.subtitle}</span><br>
        <span class="leg-dates">${span(j)}</span></span>
    </div>`).join('');
  list.querySelectorAll('.leg-item').forEach(el => {
    el.onclick = e => {
      if (e.shiftKey) { openJourney(el.dataset.j); return; }
      const id = el.dataset.j;
      const on = el.classList.toggle('off');
      map.setVisible(id, !on);
    };
    el.ondblclick = () => {
      // solo this trail (or restore all if already solo)
      const items = [...list.querySelectorAll('.leg-item')];
      const others = items.filter(x => x !== el);
      const isSolo = !el.classList.contains('off') && others.every(x => x.classList.contains('off'));
      items.forEach(x => {
        const on = isSolo || x === el;
        x.classList.toggle('off', !on);
        map.setVisible(x.dataset.j, on);
      });
    };
    el.onmouseenter = () => { map.highlightJourney = el.dataset.j; };
    el.onmouseleave = () => { map.highlightJourney = null; };
    el.onfocus = () => { map.highlightJourney = el.dataset.j; };
    el.onblur = () => { map.highlightJourney = null; };
    el.title = 'Click to show/hide · double-click to view alone · shift-click for the story';
    makeActivatable(el);
  });
  $('legendHead').onclick = () => $('legend').classList.toggle('collapsed');
}

// ————— scrubber —————

function syncScrub() {
  const { t0, t1 } = DATA.timeline;
  $('scrub').value = Math.round(((state.t - t0) / (t1 - t0)) * 1000);
  $('scrubDate').textContent = tToDate(state.t);
  updateScrubNow();
  map.setTime(state.t);
}

function updateScrubNow() {
  let latest = null;
  for (const e of DATA.events) {
    if (e.t < 0) continue;
    if (e.t <= state.t) latest = e; else break;
  }
  $('scrubNow').textContent = latest ? `❧ ${latest.title} · ${latest.date.replace('circa ', '')}` : '❧ the outfit gathers in Lonesome Dove';
  const mi = map.distanceAt('drive', state.t);
  $('scrubMiles').textContent = mi > 5 ? `≈ ${Math.round(mi / 10) * 10} mi up the trail` : '';
}

function setPlaying(on) {
  state.playing = on;
  $('playBtn').textContent = on ? '❚❚' : '▶';
  if (on && state.t >= DATA.timeline.t1 - 0.01) state.t = DATA.timeline.t0;
}

function setFollow(on) {
  state.follow = on;
  $('followBtn').classList.toggle('active', on);
  if (on) {
    const p = map.headPos('drive', state.t);
    if (p) map.fly = {
      t0: performance.now(), dur: 800,
      from: { ...map.view },
      to: { cx: p.x, cy: p.y, k: Math.max(map.view.k, map.kFit * 2.6) },
    };
  }
}

// ————— chrome wiring —————

function setView(v) {
  state.view = v;
  $('app').classList.remove('view-map', 'view-journeys');
  $('app').classList.add('view-' + v);
  document.querySelectorAll('.vt-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $('legend').hidden = v !== 'journeys';
  $('scrubBar').hidden = v !== 'journeys';
  $('eventStrip').style.display = v === 'map' ? '' : 'none';
  map.setMode(v);
  map.highlightJourney = null;
  map.previewLoc = null;
  closePanel();
  map.fitBounds();
  setFollow(false);
  setPlaying(false);
  if (v === 'journeys') {
    state.t = DATA.timeline.t1;
    syncScrub();
    $('legend').classList.toggle('collapsed', window.innerWidth < 900);
  }
}

function wireChrome() {
  document.querySelectorAll('.vt-btn').forEach(b => b.onclick = () => setView(b.dataset.view));
  $('resetBtn').onclick = () => { map.flyHome(); closePanel(); };
  $('castBtn').onclick = openCast;
  $('aboutLink').onclick = e => { e.preventDefault(); openAbout(); };
  $('posterBtn').onclick = () => {
    map.exportPNG(2.5).toBlob(blob => {
      const a = document.createElement('a');
      a.download = 'lonesome-dove-chart.png';
      a.href = URL.createObjectURL(blob);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    }, 'image/png');
  };
  $('panelClose').onclick = closePanel;

  $('tourBtn').onclick = () => {
    if (state.view !== 'map') setView('map');
    $('tourBtn').classList.add('tour-active');
    openEvent(DATA.events[1].id); // start at Jake's homecoming, skip backstory
    if (map.fly) { map.fly.dur = 1700; } // a slower, cinematic first dive to the border
  };
  $('autoBtn').onclick = () => setAutoTour(!state.autoTour);
  $('prevEvent').onclick = () => {
    const i = DATA.events.findIndex(e => e.id === state.selectedEvent);
    if (i > 0) openEvent(DATA.events[i - 1].id);
  };
  $('nextEvent').onclick = () => {
    const i = DATA.events.findIndex(e => e.id === state.selectedEvent);
    if (i < DATA.events.length - 1) openEvent(DATA.events[i + 1].id);
  };

  $('scrub').oninput = e => {
    const { t0, t1 } = DATA.timeline;
    state.t = t0 + (t1 - t0) * (+e.target.value / 1000);
    setPlaying(false);
    $('scrubDate').textContent = tToDate(state.t);
    updateScrubNow();
    map.setTime(state.t);
  };
  $('playBtn').onclick = () => setPlaying(!state.playing);
  $('followBtn').onclick = () => setFollow(!state.follow);

  $('zoomIn').onclick = () => map.zoomBy(1.55);
  $('zoomOut').onclick = () => map.zoomBy(1 / 1.55);
  $('zoomFit').onclick = () => map.fitBounds();

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePanel();
    if (state.selectedEvent && e.key === 'ArrowRight') $('nextEvent').click();
    if (state.selectedEvent && e.key === 'ArrowLeft') $('prevEvent').click();
    if (e.key === ' ' && state.view === 'journeys'
        && !e.target.closest('input, button, a, [role="button"]')) {
      e.preventDefault();
      setPlaying(!state.playing);
    }
    if (e.key === '+' || e.key === '=') map.zoomBy(1.4);
    if (e.key === '-') map.zoomBy(1 / 1.4);
    if (e.key === '?') openAbout();
    if (e.key === 'Home') { e.preventDefault(); map.flyHome(); }
    // with no card open, arrows glide the chart (short flights; key-repeat chains smoothly)
    if (!state.selectedEvent && e.key.startsWith('Arrow') && e.target.tagName !== 'INPUT') {
      const d = 110 / map.view.k;
      const to = { cx: map.fly ? map.fly.to.cx : map.view.cx, cy: map.fly ? map.fly.to.cy : map.view.cy, k: map.view.k };
      if (e.key === 'ArrowLeft') to.cx -= d;
      else if (e.key === 'ArrowRight') to.cx += d;
      else if (e.key === 'ArrowUp') to.cy -= d;
      else if (e.key === 'ArrowDown') to.cy += d;
      else return;
      e.preventDefault();
      map.inertia = null;
      map.fly = { t0: performance.now(), dur: 160, from: { ...map.view }, to };
    }
  });
}

boot().catch(err => {
  console.error(err);
  document.querySelector('.veil-text').textContent = 'The map could not be drawn — ' + err.message;
});
