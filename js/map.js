// TrailMap — canvas renderer for the Lonesome Dove chart.
// Albers equal-area conic projection (so the parallels curve like an 1870s survey),
// parchment underlay, hand-wobbled ink linework, two views: 'map' and 'journeys'.

const D2R = Math.PI / 180;
const R_MILES = 3959;

// — projection: Albers, standard parallels 29.5°/45.5°, origin 37°N 100°W —
const PHI1 = 29.5 * D2R, PHI2 = 45.5 * D2R, PHI0 = 37 * D2R, LAM0 = -100 * D2R;
const N_ = (Math.sin(PHI1) + Math.sin(PHI2)) / 2;
const C_ = Math.cos(PHI1) ** 2 + 2 * N_ * Math.sin(PHI1);
const RHO0 = Math.sqrt(C_ - 2 * N_ * Math.sin(PHI0)) / N_;

export function proj(lon, lat) {
  const rho = Math.sqrt(C_ - 2 * N_ * Math.sin(lat * D2R)) / N_;
  const th = N_ * (lon * D2R - LAM0);
  return [R_MILES * rho * Math.sin(th), -R_MILES * (RHO0 - rho * Math.cos(th))];
}

export function invProj(X, Y) {
  const a = X / R_MILES, b = RHO0 + Y / R_MILES;
  const rho = Math.hypot(a, b);
  const th = Math.atan2(a, b);
  return [(LAM0 + th / N_) / D2R, Math.asin((C_ - rho * rho * N_ * N_) / (2 * N_)) / D2R];
}

// Chaikin corner-cutting: rounds polyline corners so simplified geometry stays smooth at deep zoom
function chaikin(pts, rounds = 2) {
  for (let k = 0; k < rounds; k++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
               [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

// deterministic hash noise for hand-drawn wobble
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function wobblePath(pts, amp = 2.2, freq = 1) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const a = i === 0 || i === pts.length - 1 ? 0 : amp;
    out.push([
      x + (hash(i * freq + x * 0.013) - 0.5) * 2 * a,
      y + (hash(i * freq + y * 0.017 + 99) - 0.5) * 2 * a,
    ]);
  }
  return out;
}

// Catmull-Rom spline through control points; each ctrl = {x,y,t}; returns samples {x,y,t}
function spline(ctrl, sub = 14) {
  if (ctrl.length < 2) return ctrl.slice();
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let j = 0; j < sub; j++) {
      const u = j / sub, u2 = u * u, u3 = u2 * u;
      out.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3),
        t: p1.t + (p2.t - p1.t) * u,
      });
    }
  }
  const last = ctrl[ctrl.length - 1];
  out.push({ x: last.x, y: last.y, t: last.t });
  return out;
}

const TERRITORY_LABELS = [
  { name: 'T E X A S', lon: -99.7, lat: 31.0, size: 2.1 },
  { name: 'INDIAN TERRITORY', lon: -97.1, lat: 35.1, size: 1.25 },
  { name: 'KANSAS', lon: -98.2, lat: 38.55, size: 1.35 },
  { name: 'NEBRASKA', lon: -99.8, lat: 41.55, size: 1.35 },
  { name: 'COLORADO', lon: -105.6, lat: 39.1, size: 1.1 },
  { name: 'NEW MEXICO TERR.', lon: -106.1, lat: 34.0, size: 1.0 },
  { name: 'WYOMING TERR.', lon: -107.6, lat: 42.9, size: 1.2 },
  { name: 'MONTANA TERR.', lon: -109.7, lat: 46.9, size: 1.35 },
  { name: 'DAKOTA TERR.', lon: -100.4, lat: 44.6, size: 1.2 },
  { name: 'ARKANSAS', lon: -92.4, lat: 34.0, size: 1.0 },
  { name: 'MISSOURI', lon: -92.7, lat: 38.4, size: 1.0 },
  { name: 'M E X I C O', lon: -101.6, lat: 26.1, size: 1.5 },
  { name: 'Llano Estacado', lon: -102.7, lat: 33.6, size: 0.78, italic: true },
  { name: 'Gulf of Mexico', lon: -94.6, lat: 27.2, size: 1.05, italic: true },
  { name: 'BRITISH POSSESSIONS', lon: -106.5, lat: 49.65, size: 0.85 },
];

const RIVER_LABELS = {
  'Rio Grande': { at: 0.42 }, 'Nueces': { at: 0.5 }, 'Brazos': { at: 0.45 },
  'Colorado': { at: 0.55 }, 'Red': { at: 0.42, text: 'Red River' }, 'Canadian': { at: 0.45 },
  'Arkansas': { at: 0.52 }, 'Pecos': { at: 0.45 }, 'Republican': { at: 0.5 },
  'North Platte': { at: 0.35 }, 'Platte': { at: 0.5 }, 'Niobrara': { at: 0.5 },
  'Powder': { at: 0.45 }, 'Yellowstone': { at: 0.55 }, 'Missouri': { at: 0.28 },
  'Milk': { at: 0.5, text: 'Milk River' }, 'Cimarron': { at: 0.5 }, 'Smoky Hill': { at: 0.5 },
};
const RIVER_W = { 'Missouri': 2.1, 'Rio Grande': 1.9, 'Arkansas': 1.6, 'Red': 1.6, 'Canadian': 1.4, 'Yellowstone': 1.6, 'Platte': 1.5, 'North Platte': 1.4, 'Pecos': 1.2, 'Brazos': 1.3, 'Colorado': 1.3 };

// hand-placed mountain chains for old-survey-map texture: [lon, lat] polylines
const MOUNTAINS = [
  { name: 'Front Range', pts: [[-105.8, 40.6], [-105.5, 39.6], [-105.2, 38.7], [-105.3, 37.9]] },
  { name: 'Sangre de Cristo', pts: [[-105.5, 37.4], [-105.3, 36.5], [-105.0, 35.8]] },
  { name: 'Laramie Range', pts: [[-105.7, 42.7], [-105.4, 42.0], [-105.1, 41.4]] },
  { name: 'Bighorns', pts: [[-107.6, 44.9], [-107.2, 44.3], [-106.9, 43.8]] },
  { name: 'Wind River', pts: [[-109.9, 43.6], [-109.2, 43.0], [-108.7, 42.6]] },
  { name: 'Absaroka', pts: [[-110.6, 45.6], [-109.9, 45.2], [-109.2, 44.9]] },
  { name: 'MT Rockies', pts: [[-112.3, 48.9], [-112.0, 47.9], [-111.4, 47.0], [-110.9, 46.3]] },
  { name: 'Black Hills', pts: [[-103.9, 44.4], [-103.5, 43.9]] },
  { name: 'Wichita Mtns', pts: [[-98.9, 34.8], [-98.5, 34.7]] },
  { name: 'Davis Mtns', pts: [[-104.4, 30.8], [-103.9, 30.5]] },
];

const RIDER_TAGS = {
  drive: 'the outfit', rescue: 'Gus & Lorie', jake: 'Jake', blueduck: 'Blue Duck',
  july: 'July', elmira: 'Elmira', return: 'Call',
};

const MAJOR_LOCS = new Set(['lonesome-dove', 'san-antonio', 'fort-worth', 'fort-smith', 'red-river-crossing',
  'canadian-camp', 'hanging-ground', 'ogallala', 'claras-ranch', 'deets-grave', 'miles-city',
  'milk-river-ranch', 'santa-rosa', 'guadalupe-grove']);

// anchors only, for very short viewports (landscape phones) where full labeling piles up
const TOP_LOCS = new Set(['lonesome-dove', 'san-antonio', 'red-river-crossing', 'ogallala',
  'miles-city', 'milk-river-ranch']);

const INK = '#2b2218', SEPIA = '#6b5232', RIVER_C = '#5d7a80', OX = '#7d2a1d';
const FRAME_BOT = 78; // the timebar overlays the canvas bottom; keep the frame above it

export class TrailMap {
  constructor(canvas, geo, data) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.geo = geo;
    this.data = data;
    this.mode = 'map';
    this.view = { cx: 0, cy: 0, k: 1 };
    this.kFit = 1;
    this.hover = null;
    this.selectedLoc = null;
    this.time = Infinity;            // journeys scrub time
    this.visible = new Set(data.journeys.map(j => j.id));
    this.fly = null;
    this.introStart = 0;
    this.onHover = () => {};
    this.onClick = () => {};

    this._prepGeometry();
    this._bindEvents();
  }

  _prepGeometry() {
    const P = ([lon, lat]) => proj(lon, lat);
    // shared-topology border polylines: each boundary drawn exactly once
    this.borders = this.geo.borders.map(line => wobblePath(chaikin(line.map(P)), 0.3));
    this.rivers = this.geo.rivers.map(r => ({
      name: r.name,
      w: RIVER_W[r.name] || 1.0,
      lines: r.lines.map(l => wobblePath(chaikin(l.map(P)), 0.35)),
    }));
    // river label anchors along the longest line; long rivers get several so one is usually in view
    for (const r of this.rivers) {
      const spec = RIVER_LABELS[r.name];
      if (!spec) continue;
      let best = r.lines[0];
      for (const l of r.lines) if (l.length > best.length) best = l;
      if (!best || best.length < 2) continue;
      const total = r.lines.reduce((a, l) => a + l.length, 0);
      // primary anchor first: when labels collide on screen, the canonical spot wins
      const ats = total > 90 ? [spec.at, 0.15, 0.85] : total > 45 ? [spec.at, 0.8] : [spec.at];
      r.labels = ats.map(at => {
        const i = Math.max(1, Math.min(best.length - 1, Math.floor(best.length * at)));
        const [x1, y1] = best[i - 1], [x2, y2] = best[i];
        let ang = Math.atan2(y2 - y1, x2 - x1);
        if (ang > Math.PI / 2) ang -= Math.PI;
        if (ang < -Math.PI / 2) ang += Math.PI;
        return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, ang, text: spec.text || r.name };
      });
    }
    this.locs = this.data.locations.map(L => {
      const [x, y] = proj(L.lon, L.lat);
      return { ...L, x, y, major: MAJOR_LOCS.has(L.id) };
    });
    this.locById = Object.fromEntries(this.locs.map(l => [l.id, l]));
    this.journeys = this.data.journeys.map(j => {
      const ctrl = j.waypoints.map(w => { const [x, y] = proj(w.lon, w.lat); return { x, y, t: w.t, label: w.label, eventId: w.eventId }; });
      let samples = spline(ctrl, 16);
      samples = samples.map((s, i) => ({
        ...s,
        x: s.x + (hash(i * 0.7 + s.x * 0.011) - 0.5) * 3.4,
        y: s.y + (hash(i * 0.7 + s.y * 0.013 + 7) - 0.5) * 3.4,
      }));
      let acc = 0;
      for (let i = 0; i < samples.length; i++) {
        if (i) acc += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
        samples[i].d = acc; // cumulative trail miles (projection units are miles)
      }
      return { ...j, ctrl, samples, t0: ctrl[0].t, t1: ctrl[ctrl.length - 1].t };
    });
    this.drive = this.journeys.find(j => j.id === 'drive');
    this.terr = TERRITORY_LABELS.map(t => { const [x, y] = proj(t.lon, t.lat); return { ...t, x, y }; });

    // coastal arcs (TX + LA gulf shore) for old-chart water lines
    this.coast = [];
    const coastal = (name, lon, lat) =>
      (name === 'Texas' && lat < 29.95 && lon > -97.9) ||
      (name === 'Louisiana' && lat < 30.15);
    for (const s of this.geo.states) {
      if (s.name !== 'Texas' && s.name !== 'Louisiana') continue;
      for (const rings of s.polys) {
        const ring = rings[0];
        let run = [];
        for (const [lon, lat] of ring) {
          if (coastal(s.name, lon, lat)) run.push(proj(lon, lat));
          else { if (run.length >= 3) this.coast.push(chaikin(run)); run = []; }
        }
        if (run.length >= 3) this.coast.push(chaikin(run));
      }
    }

    // mountain glyph positions: walk each chain, drop a peak every ~24 miles with jitter
    this.peaks = [];
    for (const m of MOUNTAINS) {
      const pp = m.pts.map(([lo, la]) => proj(lo, la));
      for (let i = 0; i < pp.length - 1; i++) {
        const [x1, y1] = pp[i], [x2, y2] = pp[i + 1];
        const d = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.max(1, Math.round(d / 24));
        for (let s = 0; s < steps; s++) {
          const u = s / steps;
          const seed = x1 * 0.07 + s * 13.7 + i;
          // perpendicular jitter so chains read as massifs, not bead-strings
          const dx = x2 - x1, dy = y2 - y1;
          const nx = -dy / (d || 1), ny = dx / (d || 1);
          const off = (hash(seed) - 0.5) * 22;
          this.peaks.push({
            x: x1 + dx * u + nx * off,
            y: y1 + dy * u + ny * off,
            s: 0.75 + hash(seed + 5) * 0.6,
          });
        }
      }
    }
  }

  // ————— view & coordinates —————

  resize() {
    // cap backing resolution: 3x phone DPR makes pan repaints crawl, 2x is visually identical here
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._makeParchment();
    // keep the reference zoom honest after window resizes (thresholds, clamps, label scales)
    if (this.locs) this.kFit = this._fitView().k;
  }

  _fitView() {
    // bounds of all journeys + locations, padded
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const eat = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const l of this.locs) eat(l.x, l.y);
    for (const j of this.journeys) for (const s of j.ctrl) eat(s.x, s.y);
    const padL = 60, padR = 60, padT = 56, padB = 130;
    const k = Math.min((this.w - padL - padR) / (x1 - x0), (this.h - padT - padB) / (y1 - y0));
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 - (padB - padT) / 2 / k, k };
  }

  fitBounds() {
    const v = this._fitView();
    this.kFit = v.k;
    this.view = v;
  }

  flyHome() {
    const v = this._fitView();
    this.kFit = v.k;
    this.inertia = null;
    this.zoomTarget = null;
    this.fly = { t0: performance.now(), dur: 850, from: { ...this.view }, to: v };
  }

  toScreen(x, y) { return [(x - this.view.cx) * this.view.k + this.w / 2, (y - this.view.cy) * this.view.k + this.h / 2]; }
  toWorld(sx, sy) { return [(sx - this.w / 2) / this.view.k + this.view.cx, (sy - this.h / 2) / this.view.k + this.view.cy]; }

  flyToLoc(loc, opts = {}) {
    const L = typeof loc === 'string' ? this.locById[loc] : loc;
    if (!L) return;
    const kT = opts.k || Math.max(this.view.k, this.kFit * 3.2);
    // panel open: on desktop it sits right (land the point left-of-center);
    // on phones it's a bottom sheet (land the point in the upper map area)
    const phone = window.innerWidth <= 700;
    const offX = (opts.panelOpen && !phone ? -190 : 0) / kT;
    const offY = (opts.panelOpen && phone ? this.h * 0.24 : 0) / kT;
    // duration scales with on-screen distance: short hops feel crisp, long rides feel like travel
    const distPx = Math.hypot(L.x - offX - this.view.cx, L.y + offY - this.view.cy) * Math.min(this.view.k, kT);
    const zoomLeg = 240 * Math.abs(Math.log2(kT / this.view.k));
    const dur = opts.dur || Math.max(380, Math.min(1400, 300 + distPx * 0.6 + zoomLeg));
    this.zoomTarget = null;
    this.inertia = null;
    this.fly = {
      t0: performance.now(), dur,
      from: { ...this.view },
      to: { cx: L.x - offX, cy: L.y + offY, k: kT },
    };
  }

  headPos(jid, t) {
    const j = this.journeys.find(x => x.id === jid);
    if (!j) return null;
    const s = j.samples;
    if (t <= s[0].t) return s[0];
    for (let i = 1; i < s.length; i++) {
      if (s[i].t >= t) {
        const a = s[i - 1], b = s[i];
        const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
        return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
      }
    }
    return s[s.length - 1];
  }

  distanceAt(jid, t) {
    const j = this.journeys.find(x => x.id === jid);
    if (!j) return 0;
    const s = j.samples;
    if (t <= s[0].t) return 0;
    for (let i = 1; i < s.length; i++) {
      if (s[i].t >= t) {
        const a = s[i - 1], b = s[i];
        const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
        return a.d + (b.d - a.d) * u;
      }
    }
    return s[s.length - 1].d;
  }

  exportPNG(scale = 2.5) {
    // re-render the whole chart into an offscreen canvas at poster resolution
    const c = document.createElement('canvas');
    c.width = Math.round(this.w * scale);
    c.height = Math.round(this.h * scale);
    const octx = this.ctx;
    this.ctx = c.getContext('2d');
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.render(performance.now());
    // the chartmaker's imprint, as on any period sheet
    const x = this.ctx;
    x.font = '10px "IM Fell English SC", serif';
    x.textAlign = 'center'; x.textBaseline = 'bottom';
    x.fillStyle = SEPIA; x.globalAlpha = 0.7;
    x.fillText('drawn from the novel by Larry McMurtry · uva uvam vivendo varia fit',
      this.w / 2, this.h - FRAME_BOT - 42);

    // map poster: the cartouche is DOM in the live view, so print one
    if (this.mode === 'map') {
      const types = [['town', 'Town'], ['ranch', 'Ranch'], ['crossing', 'Crossing'], ['grave', 'Grave'], ['landmark', 'Landmark']];
      const bx = 30, rowH = 18, pad = 12;
      const bw = 226, bh = pad * 2 + 58 + types.length * rowH;
      const by = this.h - FRAME_BOT - 30 - bh;
      x.globalAlpha = 0.88;
      x.fillStyle = '#efe2bc';
      x.fillRect(bx, by, bw, bh);
      x.globalAlpha = 0.9; x.strokeStyle = INK; x.lineWidth = 1.2;
      x.strokeRect(bx, by, bw, bh);
      x.strokeRect(bx + 3, by + 3, bw - 6, bh - 6);
      x.fillStyle = INK; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = '13px "IM Fell English SC", serif';
      x.fillText('THE TERRITORY TRAVERSED', bx + bw / 2, by + pad + 6);
      x.font = 'italic 10.5px "IM Fell English", serif';
      x.fillStyle = SEPIA;
      x.fillText("in Larry McMurtry's Lonesome Dove", bx + bw / 2, by + pad + 22);
      x.font = '10px "IM Fell English SC", serif';
      x.fillStyle = OX;
      x.fillText('UVA UVAM VIVENDO VARIA FIT', bx + bw / 2, by + pad + 38);
      x.textAlign = 'left';
      x.font = '11px "IM Fell English SC", serif';
      types.forEach(([type, label], i) => {
        const ry = by + pad + 58 + i * rowH;
        x.strokeStyle = INK; x.fillStyle = INK; x.lineWidth = 1.3; x.globalAlpha = 0.9;
        this._glyph(x, type, bx + pad + 8, ry, 0.95);
        x.fillText(label, bx + pad + 26, ry);
      });
    }

    // journeys poster: a printed key, or the trails are just colored string
    if (this.mode === 'journeys') {
      const shown = this.journeys.filter(j => this.visible.has(j.id));
      if (shown.length) {
        const bx = 30, rowH = 19, pad = 12;
        const bw = 218, bh = pad * 2 + 22 + shown.length * rowH;
        const by = this.h - FRAME_BOT - 30 - bh;
        x.globalAlpha = 0.88;
        x.fillStyle = '#efe2bc';
        x.fillRect(bx, by, bw, bh);
        x.globalAlpha = 0.9; x.strokeStyle = INK; x.lineWidth = 1.2;
        x.strokeRect(bx, by, bw, bh);
        x.strokeRect(bx + 3, by + 3, bw - 6, bh - 6);
        x.fillStyle = INK; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.font = '12px "IM Fell English SC", serif';
        x.fillText('THE RIDERS', bx + bw / 2, by + pad + 4);
        x.textAlign = 'left';
        x.font = '11px "IM Fell English SC", serif';
        shown.forEach((j, i) => {
          const ry = by + pad + 22 + i * rowH;
          x.fillStyle = j.color;
          x.fillRect(bx + pad, ry - 2.5, 22, 5);
          x.fillStyle = INK;
          x.fillText(j.name, bx + pad + 30, ry);
        });
      }
    }
    this.ctx = octx;
    return c;
  }

  zoomBy(factor) {
    const k = Math.max(this.kFit * 0.55, Math.min(this.kFit * 45, this.view.k * factor));
    this.fly = { t0: performance.now(), dur: 340, from: { ...this.view }, to: { cx: this.view.cx, cy: this.view.cy, k } };
  }

  setMode(m) { if (this.mode !== m) this.modeChangedAt = performance.now(); this.mode = m; }
  setSelected(locId) { this.selectedLoc = locId; }
  setTime(t) { this.time = t; }
  setVisible(id, on) { on ? this.visible.add(id) : this.visible.delete(id); }

  startIntro() { this.introStart = performance.now(); }

  // ————— parchment underlay —————

  _makeParchment() {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(this.w * 0.5, this.h * 0.42, 60, this.w * 0.5, this.h * 0.5, Math.max(this.w, this.h) * 0.75);
    g.addColorStop(0, '#ead9b0');
    g.addColorStop(0.55, '#e0cb97');
    g.addColorStop(0.85, '#cfb277');
    g.addColorStop(1, '#b8954f');
    x.fillStyle = g;
    x.fillRect(0, 0, this.w, this.h);

    // fibrous noise tile
    const tile = document.createElement('canvas');
    tile.width = tile.height = 192;
    const tx = tile.getContext('2d');
    const img = tx.createImageData(192, 192);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 120 + hash(i * 0.61803) * 120; // seeded: same paper every load, diffable renders
      img.data[i] = v; img.data[i + 1] = v * 0.92; img.data[i + 2] = v * 0.74;
      img.data[i + 3] = 26;
    }
    tx.putImageData(img, 0, 0);
    x.globalAlpha = 0.55;
    for (let yy = 0; yy < this.h; yy += 192) for (let xx = 0; xx < this.w; xx += 192) x.drawImage(tile, xx, yy);
    x.globalAlpha = 1;

    // stains
    for (let i = 0; i < 9; i++) {
      const sx = hash(i * 3 + 1) * this.w, sy = hash(i * 7 + 2) * this.h;
      const r = 40 + hash(i * 11) * 150;
      const sg = x.createRadialGradient(sx, sy, r * 0.2, sx, sy, r);
      const tone = i % 3 === 0 ? '139,104,51' : '160,124,66';
      sg.addColorStop(0, `rgba(${tone},${0.05 + hash(i) * 0.07})`);
      sg.addColorStop(0.8, `rgba(${tone},${0.03})`);
      sg.addColorStop(1, 'rgba(139,104,51,0)');
      x.fillStyle = sg;
      x.beginPath(); x.arc(sx, sy, r, 0, 7); x.fill();
    }
    // burned edges
    const edge = (x0, y0, x1, y1) => {
      const eg = x.createLinearGradient(x0, y0, x1, y1);
      eg.addColorStop(0, 'rgba(58,38,14,.5)');
      eg.addColorStop(0.4, 'rgba(58,38,14,.12)');
      eg.addColorStop(1, 'rgba(58,38,14,0)');
      x.fillStyle = eg; x.fillRect(0, 0, this.w, this.h);
    };
    edge(0, 0, 70, 0); edge(this.w, 0, this.w - 70, 0); edge(0, 0, 0, 60); edge(0, this.h, 0, this.h - 60);
    this.parchment = c;
  }

  // ————— render —————

  render(now = performance.now()) {
    const ctx = this.ctx;
    if (!this.parchment) return;
    const dt = Math.min(50, now - (this._lastNow || now));
    this._lastNow = now;

    if (this.zoomTarget) {
      const zt = this.zoomTarget;
      const [wx, wy] = this.toWorld(zt.sx, zt.sy);
      const ease = this.reducedMotion ? 1 : 1 - Math.exp(-dt / 80);
      this.view.k = Math.exp(Math.log(this.view.k) + (Math.log(zt.k) - Math.log(this.view.k)) * ease);
      this.view.cx = wx - (zt.sx - this.w / 2) / this.view.k;
      this.view.cy = wy - (zt.sy - this.h / 2) / this.view.k;
      if (Math.abs(Math.log(zt.k / this.view.k)) < 0.002) this.zoomTarget = null;
    }

    if (this.inertia) {
      this.view.cx -= this.inertia.vx * dt / this.view.k;
      this.view.cy -= this.inertia.vy * dt / this.view.k;
      const decay = Math.exp(-dt / 280);
      this.inertia.vx *= decay; this.inertia.vy *= decay;
      if (Math.hypot(this.inertia.vx, this.inertia.vy) < 0.01) this.inertia = null;
    }

    if (this.fly) {
      const u = this.reducedMotion ? 1 : Math.min(1, (now - this.fly.t0) / this.fly.dur);
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      const f = this.fly.from, t = this.fly.to;
      this.view.cx = f.cx + (t.cx - f.cx) * e;
      this.view.cy = f.cy + (t.cy - f.cy) * e;
      this.view.k = Math.exp(Math.log(f.k) + (Math.log(t.k) - Math.log(f.k)) * e);
      if (u >= 1) this.fly = null;
    }

    ctx.clearRect(0, 0, this.w, this.h);
    ctx.drawImage(this.parchment, 0, 0);

    // hand-tint wash: dust in the south giving way to grass in the north
    {
      const [, yS] = this.toScreen(...proj(-100, 25.5));
      const [, yN] = this.toScreen(...proj(-100, 49.5));
      const g = ctx.createLinearGradient(0, yN, 0, yS);
      g.addColorStop(0, 'rgba(96, 126, 76, 0.075)');
      g.addColorStop(0.55, 'rgba(140, 120, 60, 0.03)');
      g.addColorStop(1, 'rgba(168, 112, 48, 0.07)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    this.hits = [];
    this._tagBoxes = [];
    this._drawGraticule(ctx);
    this._drawCoastWater(ctx);
    this._drawStates(ctx);
    this._drawMountains(ctx);
    this._drawRivers(ctx);
    this._drawBorderHachures(ctx);
    this._drawTerritoryLabels(ctx);

    const introU = this.introStart ? Math.min(1, (now - this.introStart) / 2600) : 1;
    const introE = 1 - Math.pow(1 - introU, 3);

    const modeFade = this.modeChangedAt ? Math.min(1, (now - this.modeChangedAt) / 450) : 1;
    if (this.mode === 'map') {
      this._drawJourney(ctx, this.drive, { progress: introE, fade: modeFade });
      this._drawLocations(ctx, now, introE * modeFade);
    } else {
      // trails sweep on over the first beat of the view
      const sweepU = this.modeChangedAt && !this.reducedMotion ? Math.min(1, (now - this.modeChangedAt) / 1100) : 1;
      const sweep = 1 - Math.pow(1 - sweepU, 3);
      this._drawLocations(ctx, now, modeFade, true);
      for (const j of this.journeys) {
        if (!this.visible.has(j.id)) continue;
        this._drawJourney(ctx, j, { clipT: this.time, head: sweep >= 1, labels: sweep >= 1, fade: modeFade, progress: sweep });
      }
    }

    this._drawFrame(ctx);
    this._drawCompass(ctx);
    this._drawScalebar(ctx);
  }


  _drawGraticule(ctx) {
    ctx.save();
    ctx.strokeStyle = SEPIA; ctx.globalAlpha = 0.13; ctx.lineWidth = 0.7;
    for (let lon = -118; lon <= -86; lon += 2) {
      ctx.beginPath();
      for (let lat = 23; lat <= 51.6; lat += 0.5) {
        const [x, y] = this.toScreen(...proj(lon, lat));
        lat === 23 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let lat = 24; lat <= 50; lat += 2) {
      ctx.beginPath();
      for (let lon = -118.5; lon <= -86; lon += 0.5) {
        const [x, y] = this.toScreen(...proj(lon, lat));
        lon === -118.5 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // degree labels along the frame, via inverse projection (works at any zoom)
    ctx.font = '9.5px "IM Fell English SC", serif';
    ctx.fillStyle = SEPIA; ctx.globalAlpha = 0.55;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const yEdge = this.h - FRAME_BOT - 26;
    let prevLon = invProj(...this.toWorld(38, yEdge))[0];
    for (let x = 40; x < this.w - 40; x += 3) {
      const lon = invProj(...this.toWorld(x, yEdge))[0];
      if (Math.floor(prevLon / 2) !== Math.floor(lon / 2)) {
        const g = Math.max(Math.ceil(Math.min(prevLon, lon) / 2) * 2, -180);
        if (g >= -130 && g <= -80) ctx.fillText(`${-g}°`, x, yEdge);
      }
      prevLon = lon;
    }
    ctx.textAlign = 'left';
    let prevLat = invProj(...this.toWorld(26, 58))[1];
    for (let y = 60; y < this.h - FRAME_BOT - 40; y += 3) {
      const lat = invProj(...this.toWorld(26, y))[1];
      if (Math.floor(prevLat / 2) !== Math.floor(lat / 2)) {
        const g = Math.ceil(Math.min(prevLat, lat) / 2) * 2;
        if (g >= 20 && g <= 54) ctx.fillText(`${g}°`, 18, y);
      }
      prevLat = lat;
    }
    ctx.restore();
  }

  _path(ctx, pts) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = this.toScreen(pts[i][0], pts[i][1]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
  }

  _drawStates(ctx) {
    ctx.save();
    ctx.strokeStyle = SEPIA; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    ctx.setLineDash([7, 4, 2, 4]);
    for (const line of this.borders) { this._path(ctx, line); ctx.stroke(); }
    ctx.restore();
  }

  _drawCoastWater(ctx) {
    // solid shoreline with receding ripple lines, like an 1870s coast chart
    if (!this.coast.length) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = SEPIA; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.2;
    for (const run of this.coast) {
      ctx.beginPath();
      for (let i = 0; i < run.length; i++) {
        const [x, y] = this.toScreen(run[i][0], run[i][1]);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = RIVER_C;
    for (let ring = 1; ring <= 4; ring++) {
      const off = ring * 9; // miles seaward (SE)
      ctx.globalAlpha = 0.34 - ring * 0.065;
      ctx.lineWidth = 0.9;
      for (const run of this.coast) {
        ctx.beginPath();
        for (let i = 0; i < run.length; i++) {
          const [x, y] = this.toScreen(run[i][0] + off * 0.55, run[i][1] + off * 0.85);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _drawMountains(ctx) {
    ctx.save();
    const sz = Math.max(4.2, Math.min(10, 5.8 * Math.sqrt(this.view.k / this.kFit)));
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    for (const p of this.peaks) {
      const [x, y] = this.toScreen(p.x, p.y);
      if (x < -15 || x > this.w + 15 || y < -15 || y > this.h + 15) continue;
      const s = sz * p.s;
      // caret peak
      ctx.strokeStyle = SEPIA; ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.lineTo(x, y - s * 1.15);
      ctx.lineTo(x + s, y);
      ctx.stroke();
      // shaded east face — the classic engraver's trick
      ctx.fillStyle = SEPIA; ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.moveTo(x, y - s * 1.15);
      ctx.lineTo(x + s, y);
      ctx.lineTo(x + s * 0.25, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  _drawRivers(ctx) {
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const r of this.rivers) {
      ctx.strokeStyle = RIVER_C;
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = Math.max(0.8, r.w * Math.sqrt(this.view.k / this.kFit));
      for (const l of r.lines) { this._path(ctx, l); ctx.stroke(); }
    }
    // labels, decluttered: a river never repeats within 280px, and labels never overlap each other
    const show = this.view.k > this.kFit * 0.9;
    if (show) {
      ctx.font = `italic ${Math.min(13, 10.5 * Math.sqrt(this.view.k / this.kFit))}px "IM Fell English", serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const placed = [];
      for (const r of this.rivers) {
        for (const lab of r.labels || []) {
          const [x, y] = this.toScreen(lab.x, lab.y);
          if (x < -50 || x > this.w + 50 || y < -20 || y > this.h + 20) continue;
          const w = ctx.measureText(lab.text).width;
          const clash = placed.some(p =>
            (p.river === r.name && Math.hypot(x - p.x, y - p.y) < 280) ||
            (p.river !== r.name && Math.abs(y - p.y) < 16 && Math.abs(x - p.x) < (w + p.w) / 2 + 12));
          if (clash) continue;
          placed.push({ x, y, w, river: r.name });
          ctx.save();
          ctx.translate(x, y); ctx.rotate(lab.ang);
          ctx.globalAlpha = 0.78;
          ctx.strokeStyle = '#e3d0a0'; ctx.lineWidth = 3; ctx.strokeText(lab.text, 0, -2);
          ctx.fillStyle = '#41606a'; ctx.fillText(lab.text, 0, -2);
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }

  _drawBorderHachures(ctx) {
    // hachure ticks south of the Rio Grande (MEXICO) — old-map boundary shading
    const rio = this.rivers.find(r => r.name === 'Rio Grande');
    if (!rio) return;
    ctx.save();
    ctx.strokeStyle = SEPIA; ctx.globalAlpha = 0.35; ctx.lineWidth = 0.8;
    for (const line of rio.lines) {
      for (let i = 2; i < line.length - 2; i += 2) {
        const [x1, y1] = this.toScreen(line[i][0], line[i][1]);
        const [x2, y2] = this.toScreen(line[i + 1][0], line[i + 1][1]);
        if (x1 < -20 || x1 > this.w + 20 || y1 < -20 || y1 > this.h + 20) continue;
        const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
        // south-east normal
        const nx = -dy / d, ny = dx / d;
        const sgn = ny > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + nx * 6 * sgn, y1 + ny * 6 * sgn);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _drawTerritoryLabels(ctx) {
    if (this.h < 430 && this.view.k < this.kFit * 1.6) return; // landscape phones: too little room
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const base = 15 * Math.pow(this.view.k / this.kFit, 0.55);
    for (const t of this.terr) {
      const [x, y] = this.toScreen(t.x, t.y);
      if (x < -240 || x > this.w + 240 || y < -60 || y > this.h + 60) continue;
      const size = Math.min(54, base * t.size);
      ctx.font = `${t.italic ? 'italic ' : ''}${size}px "${t.italic ? 'IM Fell English' : 'IM Fell English SC'}", serif`;
      try { ctx.letterSpacing = `${size * 0.34}px`; } catch (_) {}
      ctx.globalAlpha = t.italic ? 0.5 : 0.34;
      ctx.fillStyle = SEPIA;
      ctx.fillText(t.name, x, y);
    }
    try { ctx.letterSpacing = '0px'; } catch (_) {}
    ctx.restore();
  }

  // ————— journeys —————

  _drawJourney(ctx, j, opts = {}) {
    const { clipT = Infinity, progress = 1, head = false, labels = false, fade = 1 } = opts;
    let pts = j.samples;
    if (clipT < j.t1) {
      pts = [];
      for (let i = 0; i < j.samples.length; i++) {
        const s = j.samples[i];
        if (s.t <= clipT) pts.push(s);
        else {
          const prev = j.samples[i - 1];
          if (prev && s.t > prev.t) {
            const u = (clipT - prev.t) / (s.t - prev.t);
            pts.push({ x: prev.x + (s.x - prev.x) * u, y: prev.y + (s.y - prev.y) * u, t: clipT });
          }
          break;
        }
      }
    }
    if (progress < 1) {
      // fractional cut so the intro draw glides instead of stepping sample-by-sample
      const fi = Math.max(1, (pts.length - 1) * progress);
      const n = Math.floor(fi), frac = fi - n;
      const cut = pts.slice(0, n + 1);
      if (frac > 0 && n < pts.length - 1) {
        const a = pts[n], b = pts[n + 1];
        cut.push({ x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac, t: a.t });
      }
      pts = cut;
    }
    if (pts.length < 2) return;

    const hovered = (this.hover && this.hover.kind === 'journey' && this.hover.j.id === j.id)
      || this.highlightJourney === j.id;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    const screen = pts.map(p => this.toScreen(p.x, p.y));
    const trace = () => {
      ctx.beginPath();
      for (let i = 0; i < screen.length; i++) i === 0 ? ctx.moveTo(screen[i][0], screen[i][1]) : ctx.lineTo(screen[i][0], screen[i][1]);
    };

    const kk = Math.min(3, Math.sqrt(this.view.k / this.kFit));
    if (j.style === 'drive') {
      trace();
      ctx.strokeStyle = j.color; ctx.globalAlpha = 0.25 * fade; ctx.lineWidth = 7 * kk; ctx.stroke();
      ctx.globalAlpha = 0.92 * fade; ctx.lineWidth = 2.6 * kk; ctx.stroke();
      // irregular darker overlay — ink pooling where the pen pressed
      ctx.setLineDash([14 * kk, 23 * kk]); ctx.lineDashOffset = 9;
      ctx.globalAlpha = 0.18 * fade; ctx.lineWidth = 3.8 * kk; ctx.stroke();
      ctx.setLineDash([]);
    } else if (j.style === 'drift') {
      trace();
      ctx.setLineDash([9 * kk, 6 * kk]);
      ctx.strokeStyle = j.color; ctx.globalAlpha = 0.85 * fade; ctx.lineWidth = 1.9 * kk; ctx.stroke();
    } else if (j.style === 'sinister') {
      trace();
      ctx.setLineDash([2.2 * kk, 6.5 * kk]);
      ctx.strokeStyle = j.color; ctx.globalAlpha = 0.8 * fade; ctx.lineWidth = 2.4 * kk; ctx.stroke();
    } else {
      trace();
      ctx.strokeStyle = j.color; ctx.globalAlpha = 0.88 * fade; ctx.lineWidth = 1.9 * kk; ctx.stroke();
    }
    if (hovered) { ctx.setLineDash([]); ctx.globalAlpha = 0.3 * fade; ctx.lineWidth = 9 * kk; ctx.stroke(); }
    ctx.setLineDash([]);

    // direction chevrons
    if (this.mode === 'journeys' || j.id === 'drive') {
      ctx.globalAlpha = 0.55 * fade; ctx.fillStyle = j.color;
      let acc = 0;
      for (let i = 1; i < screen.length; i++) {
        const [x1, y1] = screen[i - 1], [x2, y2] = screen[i];
        const d = Math.hypot(x2 - x1, y2 - y1); acc += d;
        if (acc > 110) {
          acc = 0;
          const a = Math.atan2(y2 - y1, x2 - x1);
          ctx.save(); ctx.translate(x2, y2); ctx.rotate(a);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-6.5, -3.4); ctx.lineTo(-6.5, 3.4); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
    }

    // waypoint event labels (journeys view)
    if (labels) {
      ctx.font = '12px "IM Fell English SC", serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      for (const c of j.ctrl) {
        if (c.t > clipT || (!c.label && !c.eventId)) continue;
        const [x, y] = this.toScreen(c.x, c.y);
        if (x < -40 || x > this.w + 40 || y < -40 || y > this.h + 40) continue;
        ctx.globalAlpha = 0.95 * fade; ctx.fillStyle = j.color;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
        if (c.label && this.view.k > this.kFit * 1.45) {
          // dodge other waypoint labels and rider tags
          const tw = ctx.measureText(c.label).width;
          const boxes = this._tagBoxes || (this._tagBoxes = []);
          const clash = ty => boxes.some(o => x + 7 < o.x + o.w && x + 7 + tw > o.x && ty - 8 < o.y + 8 && ty + 8 > o.y - 8);
          let ly = y - 1, guard = 0;
          while (clash(ly) && guard++ < 5) ly += 14;
          boxes.push({ x: x + 7, w: tw, y: ly });
          ctx.globalAlpha = 0.85 * fade;
          ctx.strokeStyle = '#e3d0a0'; ctx.lineWidth = 3; ctx.strokeText(c.label, x + 7, ly);
          ctx.fillStyle = INK; ctx.fillText(c.label, x + 7, ly);
        }
        if (c.eventId) this.hits.push({ x, y, r: 9, obj: { kind: 'event', eventId: c.eventId, journey: j } });
      }
    }

    // moving head with rider tag
    if (head && clipT < j.t1 && clipT >= j.t0) {
      const hp = screen[screen.length - 1];
      ctx.globalAlpha = 1 * fade;
      ctx.beginPath(); ctx.arc(hp[0], hp[1], 5.5, 0, 7);
      ctx.fillStyle = j.color; ctx.fill();
      ctx.strokeStyle = '#efe2bc'; ctx.lineWidth = 1.6; ctx.stroke();
      const tag = (this.h < 430 && this.view.k < this.kFit * 1.6) ? null : RIDER_TAGS[j.id];
      if (tag) {
        ctx.font = 'italic 12px "IM Fell English", serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        // stack tags downward when riders converge on the same place
        const tw = ctx.measureText(tag).width;
        let ty = hp[1] - 8;
        const tags = this._tagBoxes || (this._tagBoxes = []);
        const clash = b => tags.some(o => hp[0] + 10 < o.x + o.w && hp[0] + 10 + tw > o.x && b - 8 < o.y + 8 && b + 8 > o.y - 8);
        let guard = 0;
        while (clash(ty) && guard++ < 6) ty += 15;
        tags.push({ x: hp[0] + 10, w: tw, y: ty });
        ctx.strokeStyle = '#e3d0a0'; ctx.lineWidth = 3; ctx.strokeText(tag, hp[0] + 10, ty);
        ctx.fillStyle = j.color; ctx.fillText(tag, hp[0] + 10, ty);
      }
      this.hits.push({ x: hp[0], y: hp[1], r: 12, obj: { kind: 'journey', j } });

      // the two blue pigs, a few days behind the herd, the whole way to Montana
      if (j.id === 'drive' && this.view.k > this.kFit * 1.6 && clipT > j.t0 + 0.2) {
        const pw = this.headPos('drive', clipT - 0.13);
        if (pw) {
          const [px, py] = this.toScreen(pw.x, pw.y);
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#5a6a78';
          ctx.beginPath(); ctx.arc(px - 2.5, py + 2, 2.1, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(px + 2.5, py - 1, 2.1, 0, 7); ctx.fill();
          this.hits.push({ x: px, y: py, r: 9, obj: { kind: 'pigs' } });
        }
      }
    }

    // whole-trail hit segments (sparse)
    for (let i = 0; i < screen.length - 1; i += 4) {
      this.hits.push({ seg: [screen[i], screen[Math.min(i + 4, screen.length - 1)]], r: 7, obj: { kind: 'journey', j } });
    }
    ctx.restore();
  }

  // ————— locations —————

  _glyph(ctx, type, x, y, s) {
    ctx.beginPath();
    switch (type) {
      case 'town':
        ctx.arc(x, y, 4.6 * s, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 1.7 * s, 0, 7); ctx.fill();
        break;
      case 'ranch':
        ctx.beginPath();
        ctx.moveTo(x - 4 * s, y + 3.5 * s); ctx.lineTo(x - 4 * s, y - 1 * s); ctx.lineTo(x, y - 4.5 * s);
        ctx.lineTo(x + 4 * s, y - 1 * s); ctx.lineTo(x + 4 * s, y + 3.5 * s); ctx.closePath(); ctx.stroke();
        break;
      case 'crossing':
        ctx.moveTo(x - 4 * s, y - 4 * s); ctx.lineTo(x + 4 * s, y + 4 * s);
        ctx.moveTo(x + 4 * s, y - 4 * s); ctx.lineTo(x - 4 * s, y + 4 * s); ctx.stroke();
        break;
      case 'grave':
        ctx.moveTo(x, y - 5 * s); ctx.lineTo(x, y + 4.5 * s);
        ctx.moveTo(x - 3.4 * s, y - 1.8 * s); ctx.lineTo(x + 3.4 * s, y - 1.8 * s); ctx.stroke();
        break;
      case 'river':
        for (let i = -1; i <= 1; i++) {
          ctx.moveTo(x - 4 * s, y + i * 3 * s);
          ctx.quadraticCurveTo(x - 1.5 * s, y + i * 3 * s - 2.5 * s, x + 0.5 * s, y + i * 3 * s);
          ctx.quadraticCurveTo(x + 2.5 * s, y + i * 3 * s + 2.5 * s, x + 4 * s, y + i * 3 * s);
        }
        ctx.stroke();
        break;
      default: // landmark
        ctx.moveTo(x, y - 4.4 * s); ctx.lineTo(x + 4 * s, y); ctx.lineTo(x, y + 4.4 * s); ctx.lineTo(x - 4 * s, y); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 1.1 * s, 0, 7); ctx.fill();
    }
  }

  _drawLocations(ctx, now, introE = 1, faded = false) {
    ctx.save();
    // minors fade in across a zoom band instead of popping at a threshold
    const minorA = Math.max(0, Math.min(1, (this.view.k / this.kFit - 1.35) / 0.45));
    const zoomed = minorA > 0.02;
    const shortViewport = this.h < 430 && this.view.k < this.kFit * 1.6;
    const list = this.locs.filter(l => (shortViewport ? TOP_LOCS.has(l.id) : l.major) || zoomed)
      .sort((a, b) => (b.major ? 1 : 0) - (a.major ? 1 : 0)); // majors claim label space first
    const boxes = [];
    const collides = b => boxes.some(o => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
    ctx.lineWidth = 1.5;
    list.forEach((l, idx) => {
      const [x, y] = this.toScreen(l.x, l.y);
      if (x < -60 || x > this.w + 60 || y < -40 || y > this.h + 40) return;
      const isSel = this.selectedLoc === l.id;
      const isHov = this.hover && this.hover.kind === 'loc' && this.hover.loc.id === l.id;
      let a = faded ? 0.34 * introE : Math.max(0, Math.min(1, introE * list.length * 1.4 - idx * 0.55));
      if (!l.major) a *= minorA;
      if (a <= 0) return;

      // strip-hover preview ring
      if (this.previewLoc === l.id && !faded) {
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = OX; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.stroke();
        ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.arc(x, y, 14.5, 0, 7); ctx.stroke();
        ctx.lineWidth = 1.5;
      }

      // selected pulse
      if (isSel && !faded) {
        const u = ((now / 1400) % 1);
        ctx.globalAlpha = (1 - u) * 0.55;
        ctx.strokeStyle = OX; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 7 + u * 20, 0, 7); ctx.stroke();
        ctx.lineWidth = 1.5;
      }

      ctx.globalAlpha = a * (isHov || isSel ? 1 : 0.88);
      ctx.strokeStyle = isSel ? OX : INK;
      ctx.fillStyle = isSel ? OX : INK;
      this._glyph(ctx, l.type, x, y, isHov || isSel ? 1.25 : 1);

      // label, dodging neighbors (right → left → below → above; minors yield, majors insist)
      const showLabel = l.major || zoomed || isHov || isSel;
      if (showLabel && !faded) {
        const size = l.major ? 13 : 11.5;
        ctx.font = `${size}px "IM Fell English SC", serif`;
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(l.name).width;
        const cands = [
          { tx: x + 9, ty: y - 4 }, { tx: x - 9 - tw, ty: y - 4 },
          { tx: x + 8, ty: y + 11 }, { tx: x - 8 - tw, ty: y + 11 },
        ];
        let pos = null;
        for (const c of cands) {
          const b = { x: c.tx - 2, y: c.ty - size * 0.62, w: tw + 4, h: size * 1.25 };
          if (!collides(b)) { pos = c; boxes.push(b); break; }
        }
        if (!pos && (l.major || isHov || isSel)) {
          pos = cands[0];
          boxes.push({ x: pos.tx - 2, y: pos.ty - size * 0.62, w: tw + 4, h: size * 1.25 });
        }
        if (pos) {
          ctx.textAlign = 'left';
          ctx.globalAlpha = a;
          ctx.strokeStyle = '#e3d0a0'; ctx.lineWidth = 3.2; ctx.strokeText(l.name, pos.tx, pos.ty);
          ctx.fillStyle = INK; ctx.fillText(l.name, pos.tx, pos.ty);
          ctx.lineWidth = 1.5;
        }
      }
      this.hits.push({ x, y, r: 11, obj: { kind: 'loc', loc: l } });
    });
    ctx.restore();
  }

  // ————— chrome: frame, compass, scale —————

  _drawFrame(ctx) {
    const hb = this.h - FRAME_BOT;
    ctx.save();
    ctx.strokeStyle = INK; ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2.4; ctx.strokeRect(7, 7, this.w - 14, hb - 14);
    ctx.lineWidth = 0.9; ctx.strokeRect(13.5, 13.5, this.w - 27, hb - 27);
    // graduation ticks between the rules
    ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
    for (let x = 40; x < this.w - 20; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 7); ctx.lineTo(x, 13.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, hb - 7); ctx.lineTo(x, hb - 13.5); ctx.stroke();
    }
    for (let y = 40; y < hb - 20; y += 30) {
      ctx.beginPath(); ctx.moveTo(7, y); ctx.lineTo(13.5, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this.w - 7, y); ctx.lineTo(this.w - 13.5, y); ctx.stroke();
    }
    ctx.restore();
  }

  _drawCompass(ctx) {
    const cx = this.w - 74, cy = 86, r = 34;
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = INK; ctx.fillStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r - 5, 0, 7); ctx.globalAlpha = 0.4; ctx.stroke();
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r1 = i % 4 === 0 ? r - 5 : r - 9;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
      ctx.stroke();
    }
    // 8-point star
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const len = i % 2 === 0 ? r - 8 : r * 0.42;
      const a1 = a - 0.16, a2 = a + 0.16;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a1) * len * 0.28, cy + Math.sin(a1) * len * 0.28);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      ctx.lineTo(cx + Math.cos(a2) * len * 0.28, cy + Math.sin(a2) * len * 0.28);
      ctx.closePath();
      i % 2 === 0 ? ctx.fill() : (ctx.globalAlpha = 0.45, ctx.fill(), ctx.globalAlpha = 0.8);
    }
    ctx.fillStyle = OX;
    ctx.beginPath();
    ctx.moveTo(cx, cy - (r - 8)); ctx.lineTo(cx + 4, cy - 6); ctx.lineTo(cx - 4, cy - 6); ctx.closePath(); ctx.fill();
    ctx.font = '14px "IM Fell English SC", serif';
    ctx.textAlign = 'center'; ctx.fillStyle = INK;
    ctx.fillText('N', cx, cy - r - 7);
    ctx.restore();
  }

  _drawScalebar(ctx) {
    const targetPx = 130;
    const miles = targetPx / this.view.k;
    const nice = [10, 25, 50, 100, 200, 300, 500, 800];
    let m = nice[0];
    for (const n of nice) if (Math.abs(n - miles) < Math.abs(m - miles)) m = n;
    const px = m * this.view.k;
    const x = this.w - 30 - px, y = this.h - FRAME_BOT - 36;
    ctx.save();
    ctx.globalAlpha = 0.85; ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + px, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + px, y - 4); ctx.lineTo(x + px, y + 4); ctx.stroke();
    // alternating fill
    ctx.fillRect(x, y - 2, px / 4, 2);
    ctx.fillRect(x + px / 2, y - 2, px / 4, 2);
    ctx.font = '11px "IM Fell English SC", serif'; ctx.textAlign = 'center';
    ctx.fillText(`${m} miles`, x + px / 2, y - 8);
    ctx.restore();
  }

  // ————— interaction —————

  _bindEvents() {
    const cv = this.canvas;
    let dragging = false, moved = 0, lx = 0, ly = 0;
    let samples = [];
    const pointers = new Map();
    let pinchD = 0;

    cv.addEventListener('pointerdown', e => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      if (pointers.size === 2) {
        // enter pinch: suspend drag, remember finger spacing
        dragging = false;
        const [a, b] = [...pointers.values()];
        pinchD = Math.hypot(a.x - b.x, a.y - b.y);
        this.fly = null; this.inertia = null;
        moved = 99;
        return;
      }
      dragging = true; moved = 0; lx = e.clientX; ly = e.clientY;
      samples = [];
      cv.classList.add('dragging');
      this.fly = null;
      this.inertia = null;
      this.zoomTarget = null;
      this.userPanned = true;
    });
    cv.addEventListener('pointermove', e => {
      const rect = cv.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        // pinch zoom about the midpoint
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
        const [wx, wy] = this.toWorld(mx, my);
        const f = d / (pinchD || d);
        pinchD = d;
        this.view.k = Math.max(this.kFit * 0.55, Math.min(this.kFit * 45, this.view.k * f));
        this.view.cx = wx - (mx - this.w / 2) / this.view.k;
        this.view.cy = wy - (my - this.h / 2) / this.view.k;
        return;
      }
      if (dragging) {
        const dx = e.clientX - lx, dy = e.clientY - ly;
        moved += Math.abs(dx) + Math.abs(dy);
        this.view.cx -= dx / this.view.k;
        this.view.cy -= dy / this.view.k;
        lx = e.clientX; ly = e.clientY;
        samples.push({ t: performance.now(), dx, dy });
        if (samples.length > 6) samples.shift();
      } else {
        const hit = this._hitTest(sx, sy);
        const changed = JSON.stringify(this._hitKey(hit)) !== JSON.stringify(this._hitKey(this.hover));
        this.hover = hit;
        cv.classList.toggle('pointing', !!hit);
        if (changed) this.onHover(hit, sx, sy);
        else if (hit) this.onHover(hit, sx, sy);
      }
    });
    cv.addEventListener('pointerup', e => {
      pointers.delete(e.pointerId);
      if (pointers.size >= 1) { dragging = false; return; }
      dragging = false;
      cv.classList.remove('dragging');
      if (moved < 5) {
        const rect = cv.getBoundingClientRect();
        const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
        const hit = this._hitTest(sx, sy);
        // touch double-tap on open map = zoom in (mirrors desktop double-click)
        const tnow = performance.now();
        if (e.pointerType === 'touch' && !hit && this._lastTap
            && tnow - this._lastTap.t < 320 && Math.hypot(sx - this._lastTap.x, sy - this._lastTap.y) < 32) {
          const [wx, wy] = this.toWorld(sx, sy);
          this.fly = { t0: tnow, dur: 450, from: { ...this.view },
            to: { cx: wx, cy: wy, k: Math.min(this.kFit * 45, this.view.k * 1.9) } };
          this._lastTap = null;
          return;
        }
        this._lastTap = { t: tnow, x: sx, y: sy };
        this.onClick(hit);
      } else {
        // launch inertia from recent drag velocity
        const now = performance.now();
        const recent = samples.filter(s => now - s.t < 120);
        if (recent.length >= 2) {
          const dt = now - recent[0].t || 1;
          const vx = recent.reduce((a, s) => a + s.dx, 0) / dt;
          const vy = recent.reduce((a, s) => a + s.dy, 0) / dt;
          if (Math.hypot(vx, vy) > 0.08) this.inertia = { vx, vy };
        }
      }
    });
    cv.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); dragging = false; cv.classList.remove('dragging'); });
    cv.addEventListener('pointerleave', () => { this.hover = null; this.onHover(null, 0, 0); });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const f = Math.exp(-e.deltaY * 0.0014);
      const base = this.zoomTarget ? this.zoomTarget.k : this.view.k;
      // ease toward the target in render() so discrete wheel steps feel fluid
      this.zoomTarget = {
        k: Math.max(this.kFit * 0.55, Math.min(this.kFit * 45, base * f)),
        sx, sy,
      };
      this.fly = null;
      this.inertia = null;
      this.userPanned = true;
    }, { passive: false });
    cv.addEventListener('dblclick', e => {
      const rect = cv.getBoundingClientRect();
      const [wx, wy] = this.toWorld(e.clientX - rect.left, e.clientY - rect.top);
      this.fly = { t0: performance.now(), dur: 500, from: { ...this.view }, to: { cx: wx, cy: wy, k: Math.min(this.kFit * 45, this.view.k * 1.9) } };
    });
  }

  _hitKey(h) {
    if (!h) return null;
    if (h.kind === 'loc') return ['loc', h.loc.id];
    if (h.kind === 'journey') return ['j', h.j.id];
    if (h.kind === 'event') return ['e', h.eventId];
    if (h.kind === 'compass') return ['compass'];
    if (h.kind === 'pigs') return ['pigs'];
    return null;
  }

  _hitTest(sx, sy) {
    if (!this.hits) return null;
    if (Math.hypot(sx - (this.w - 74), sy - 86) < 36) return { kind: 'compass' };
    let best = null, bestD = 1e9;
    // point hits first (markers beat trails)
    for (const h of this.hits) {
      if (h.seg) continue;
      const d = Math.hypot(sx - h.x, sy - h.y);
      if (d < h.r && d < bestD) { best = h.obj; bestD = d; }
    }
    if (best) return best;
    for (const h of this.hits) {
      if (!h.seg) continue;
      const [[x1, y1], [x2, y2]] = h.seg;
      const L2 = (x2 - x1) ** 2 + (y2 - y1) ** 2 || 1;
      let u = ((sx - x1) * (x2 - x1) + (sy - y1) * (y2 - y1)) / L2;
      u = Math.max(0, Math.min(1, u));
      const d = Math.hypot(sx - (x1 + u * (x2 - x1)), sy - (y1 + u * (y2 - y1)));
      if (d < h.r && d < bestD) { best = h.obj; bestD = d; }
    }
    return best;
  }
}
