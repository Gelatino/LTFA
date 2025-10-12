/* ---------- CSV → objects ---------- */
const CSV_URL = 'data.csv'; // put data.csv next to index.html

function parseCSV(text) {
    const rows = [];
    let i = 0,
        field = '',
        row = [],
        q = false;
    const pushF = () => { row.push(field);
        field = ''; };
    const pushR = () => { rows.push(row);
        row = []; };
    while (i < text.length) {
        const c = text[i];
        if (q) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"';
                    i++; } else { q = false; }
            } else { field += c; }
        } else {
            if (c === '"') { q = true; } else if (c === ',') { pushF(); } else if (c === '\n') { pushF();
                pushR(); } else if (c !== '\r') { field += c; }
        }
        i++;
    }
    if (field.length || row.length) { pushF();
        pushR(); }
    const header = rows[0].map(h => h.trim());
    return rows.slice(1).filter(r => r.some(v => (v || '').trim() !== '')).map(r => {
        const o = {};
        header.forEach((h, ix) => o[h] = (r[ix] || '').trim());
        return o;
    });
}

/* ---------- Helpers ---------- */
const imgFromCell = v => !v ? null : /^https?:\/\//i.test(v) ? v : `assets/img/${v}`;

/* ---------- Render blocks ---------- */
function renderBlockTo(host, films, blockIdOrKey, explicitTitle) {
  const hasStringKey = typeof blockIdOrKey === 'string';
  const key = hasStringKey ? blockIdOrKey.trim() : blockIdOrKey;

  if (key === null || key === undefined || (hasStringKey && key === '')) {
    host.innerHTML = '<div class="note">Block placeholder missing data-block or data-id.</div>';
    return;
  }

  // filter films for this block
  const norm = v => { const s = String(v ?? '').trim(); const n = parseInt(s,10); return { s, n: Number.isFinite(n)?n:null }; };
  const target = norm(key);
  const isAccepted = v => /^(1|true|yes|y)$/i.test(String(v||'').trim());
  const items = films
    .filter(f => isAccepted(f.Accepted ?? f.accepted))
    .filter(f => {
      const fk = norm(f.Block ?? f.block ?? (f.BlockId ?? f.blockId));
      return (target.n!==null && fk.n!==null) ? (fk.n===target.n) : (fk.s===target.s);
    });

  // header label priority: explicit data-title > CSV Time > CSV Block label/id
  const csvTime  = (items[0]?.Time ?? items[0]?.time ?? '').toString().trim();
  const csvLabel = (items[0]?.Block ?? items[0]?.block ?? key ?? '').toString().trim();
  const headerLabel = (explicitTitle && explicitTitle.length ? explicitTitle
                      : csvTime && csvTime.length ? csvTime
                      : csvLabel) || 'Program';

  const safeIdPart = headerLabel.replace(/\W+/g, '-');
  const isLoop = /loop/i.test(headerLabel);

  host.classList.add('card', 'card-block');
  if (!host.id) host.id = `card-block-${safeIdPart}`;
  host.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'block';

  const header = document.createElement('header');
  header.className = 'block-head' + (isLoop ? ' is-loop' : '');

  const timeEl = document.createElement('div');
  timeEl.className = 'block-time';
  timeEl.setAttribute('data-slot', 'time');
  timeEl.textContent = headerLabel;  // ← shows TIME/label
  header.appendChild(timeEl);
  wrap.appendChild(header);

  const frame = document.createElement('div');
  frame.className = 'frame';
  const list = document.createElement('div');
  list.className = 'film-list';
  list.id = `films-block-${safeIdPart}`;
  frame.appendChild(list);
  wrap.appendChild(frame);
  host.appendChild(wrap);

  if (typeof renderBlock === 'function') {
    renderBlock(list.id, items, timeEl);
    return;
  }

  if (items.length === 0) {
    list.innerHTML = `<div class="film"><div class="film-meta"><div class="film-title">No accepted films in this block.</div></div></div>`;
    return;
  }

  items.forEach(f => {
    const art = document.createElement('article');
    art.className = 'film';
    art.innerHTML = `
      <div class="film-meta">
        <div class="film-title">${f.Name || 'Untitled'}</div>
        <div class="film-sub">
          ${(f.Director || '')}${f.Runtime ? (' · ' + String(f.Runtime).replace(/\.0$/,'') + '’') : ''}
        </div>
      </div>`;
    list.appendChild(art);
  });
}

/* ---------- Blink (hard swap) ---------- */
function startBlink(openId, closedId) {
    const open = document.getElementById(openId);
    const closed = document.getElementById(closedId);
    if (!open || !closed) return;

    function once(closedMs = 160) {
        open.style.display = 'none';
        closed.style.display = 'block';
        setTimeout(() => { open.style.display = 'block';
            closed.style.display = 'none'; }, closedMs);
    }
    (function loop() {
        const next = Math.floor(2400 + Math.random() * 3600);
        setTimeout(() => { once(150 + Math.floor(Math.random() * 80));
            loop(); }, next);
    })();
}



/* ---------- Init ---------- */



// --- Modal helpers ---
const FilmModal = {
    el: null,
    ui: {}
};

function setupFilmModal() {
    FilmModal.el = document.getElementById('filmModal');
    if (!FilmModal.el) return;
    FilmModal.ui = {
        card: FilmModal.el.querySelector('.modal-card'),
        close: FilmModal.el.querySelector('.modal-close'),
        media: FilmModal.el.querySelector('.modal-media'),
        title: FilmModal.el.querySelector('.modal-title'),
        meta: FilmModal.el.querySelector('.modal-meta'),
        sin: FilmModal.el.querySelector('.modal-sinopsis'),
        link: FilmModal.el.querySelector('.modal-trailer'),
        backdrop: FilmModal.el.querySelector('.modal-backdrop')
    };

    const close = () => closeFilmModal();
    FilmModal.ui.close.addEventListener('click', close);
    FilmModal.ui.backdrop.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

function openFilmModal(f) {
    console.log('opening')
    if (!FilmModal.el) return;
    // title
    FilmModal.ui.title.textContent = f.Name || 'Untitled';

    // meta (Director · Country · Runtime)
    const bits = [];
    if (f.Director) bits.push(`Director: ${f.Director}`);
    if (f.Country) bits.push(`Country: ${f.Country}`);
    if (f.Runtime) bits.push(`Runtime: ${String(f.Runtime).replace(/\.0$/,'')}’`);
    FilmModal.ui.meta.textContent = bits.join(' · ');

    // sinopsis
    FilmModal.ui.sin.textContent = f.Sinopsis || '';

    // trailer link
    if (f.Trailer) {
        FilmModal.ui.link.href = f.Trailer;
        FilmModal.ui.link.hidden = false;
    } else {
        FilmModal.ui.link.removeAttribute('href');
        FilmModal.ui.link.hidden = true;
    }

    // poster/cover (use your existing `image` column)
    const bgURL = imgFromCell(f.image);
    if (bgURL) {
        FilmModal.ui.media.style.backgroundImage = `url("${bgURL}")`;
        FilmModal.ui.media.hidden = false;
    } else {
        FilmModal.ui.media.hidden = true;
    }

    FilmModal.el.classList.add('show');
    FilmModal.el.setAttribute('aria-hidden', 'false');

    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open'); // document.documentElement is <html>
}

function closeFilmModal() {
    if (!FilmModal.el) return;
    FilmModal.el.classList.remove('show');
    FilmModal.el.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
}
// --- end modal helpers ---

function calendarChooser() {
  const btn = document.getElementById('addCal');
  const sheet = document.getElementById('calSheet');
  if (!btn || !sheet) return;

  // Event details
  const tz = 'Europe/Berlin';
  const title = 'LTFA — Screening Day';
  const eventLocation = 'Ackerstrasse 9, 10115 Berlin';
  const details = 'Films, music, conversation, and drinks.';

  // 25 Oct 2025, 17:30–22:00 Berlin (UTC+2)
  const startUTC = '20251025T153000Z';
  const endUTC   = '20251025T200000Z';
  const enc = encodeURIComponent;

  // Links
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${enc(title)}&dates=${startUTC}/${endUTC}` +
    `&details=${enc(details)}&location=${enc(eventLocation)}&ctz=${enc(tz)}`;

  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent` +
    `&subject=${enc(title)}&startdt=2025-10-25T17:30:00+02:00&enddt=2025-10-25T22:00:00+02:00` +
    `&body=${enc(details)}&location=${enc(eventLocation)}`;

  // Apple via webcal://
  const icsHttp = new URL('/assets/ltfa.ics', window.location.origin);
  icsHttp.port = ''; // remove :8080 etc.
  const appleWebcal = icsHttp.href.replace(/^https?:/, 'webcal:');
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const apple = isLocal ? 'webcal://ltfa.miaumiau.mov/assets/ltfa.ics' : appleWebcal;

  const openCal = kind => {
    const href = kind === 'apple' ? apple : kind === 'google' ? gcal : outlook;
    if (kind === 'apple') {
      window.location.href = href; // iOS: navigate directly
    } else {
      window.open(href, '_blank', 'noopener');
    }
  };

  // Reorder choices by platform
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  if (isIOS) {
    const b = sheet.querySelector('[data-cal="apple"]'); if (b) sheet.prepend(b);
  } else if (isAndroid) {
    const b = sheet.querySelector('[data-cal="google"]'); if (b) sheet.prepend(b);
  }

  const toggle = show => { sheet.hidden = !show; };

  btn.addEventListener('click', e => {
    e.preventDefault(); // since btn is an <a>
    toggle(sheet.hidden);
  });

  sheet.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.classList.contains('cancel')) return toggle(false);
    const kind = t.getAttribute('data-cal');
    if (kind) openCal(kind);
    toggle(false);
  });

  document.addEventListener('click', e => {
    if (sheet.hidden) return;
    if (!e.target.closest('.cal-wrap') && !e.target.closest('.cal-sheet')) toggle(false);
  });
}




function initGetTickets() {
    const btn = document.querySelector('.btn-ical.btn-pink');
    if (!btn) return;
    btn.addEventListener('click', () => {
        window.open('https://buytickets.at/miaumiau/1896252', '_blank', 'noopener');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initGetTickets();
});


function buildDotNav() {
  const sections = ensureSectionIds();
  const nav = ensureDotNav();
  nav.innerHTML = '';

  sections.forEach((sec, i) => {
    const a = document.createElement('a');
    a.href = `#${sec.id}`;
    a.className = 'dot' + (i === 0 ? ' active' : '');

    const label =
      sec.dataset.ref?.replace(/[-_]/g, ' ')
      || sec.dataset.title
      || sec.dataset.block
      || (sec.dataset.id ? `Block ${sec.dataset.id}` : `Section ${i + 1}`);

    a.setAttribute('aria-label', label);
    nav.appendChild(a);
  });
}
function getLayoutFromHTML() {
  return Array.from(document.querySelectorAll('#cards [data-type]')).map(el => ({
    type: el.dataset.type,
    id: el.dataset.id ? Number(el.dataset.id) : null,
    blockKey: el.dataset.block ? String(el.dataset.block).trim() : null,
    title: el.dataset.title ? String(el.dataset.title).trim() : null,   // <—
    ref: el.dataset.ref || null,
    el
  }));
}

function renderSection(ref, host) {
  const src = document.getElementById(`section-${ref}`);
  host.innerHTML = '';
  host.innerHTML = src ? src.innerHTML : `<div class="note">Missing section: ${ref}</div>`;
}

const isAccepted = v => /^(1|true|yes|y)$/i.test(String(v||'').trim());
const getBlockId = f => {
  const raw = (f.BlockId ?? f.blockId ?? f.Block ?? f.block ?? '').toString();
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
};

function normalizeBlockKey(v) {
  const s = String(v ?? '').trim();
  const n = parseInt(s, 10);
  return { s, n: Number.isFinite(n) ? n : null };
}

function renderBlockTo(host, films, blockIdOrKey, explicitTitle) {
  const hasStringKey = typeof blockIdOrKey === 'string';
  const key = hasStringKey ? blockIdOrKey.trim() : blockIdOrKey;
  if (key === null || key === undefined || (hasStringKey && key === '')) {
    host.innerHTML = '<div class="note">Block placeholder missing data-block or data-id.</div>';
    return;
  }

  // match films to this block (accepts numeric or string keys)
  const norm = v => { const s = String(v ?? '').trim(); const n = parseInt(s,10); return { s, n: Number.isFinite(n)?n:null }; };
  const target = norm(key);
  const isAccepted = v => /^(1|true|yes|y)$/i.test(String(v||'').trim());
  const items = films
    .filter(f => isAccepted(f.Accepted ?? f.accepted))
    .filter(f => {
      const fk = norm(f.Block ?? f.block ?? (f.BlockId ?? f.blockId));
      return (target.n !== null && fk.n !== null) ? (fk.n === target.n) : (fk.s === target.s);
    });

  // ---- header label: data-title > CSV Time > CSV Block/Id
  const csvTime  = (items[0]?.Time ?? items[0]?.time ?? items[0]?.TIME ?? '').toString().trim();
  const csvLabel = (items[0]?.Block ?? items[0]?.block ?? key ?? '').toString().trim();
  const headerLabel = (explicitTitle && explicitTitle.length ? explicitTitle
                      : csvTime && csvTime.length ? csvTime
                      : csvLabel) || 'Program';

  const safeIdPart = headerLabel.replace(/\W+/g, '-');
  const isLoop = /loop/i.test(headerLabel);

  host.classList.add('card', 'card-block');
  if (!host.id) host.id = `card-block-${safeIdPart}`;
  host.innerHTML = '';

  const wrap = document.createElement('div'); wrap.className = 'block';

  const header = document.createElement('header');
  header.className = 'block-head' + (isLoop ? ' is-loop' : '');
  const timeEl = document.createElement('div');
  timeEl.className = 'block-time';
  timeEl.setAttribute('data-slot', 'time');
  timeEl.textContent = headerLabel;
  header.appendChild(timeEl);
  wrap.appendChild(header);

  const frame = document.createElement('div'); frame.className = 'frame';
  const list = document.createElement('div'); list.className = 'film-list';
  list.id = `films-block-${safeIdPart}`;
  frame.appendChild(list);
  wrap.appendChild(frame);
  host.appendChild(wrap);

  // if you have a custom renderer, keep using it
  if (typeof renderBlock === 'function') {
    renderBlock(list.id, items, timeEl);
    return;
  }

  // ---- fallback renderer WITH IMAGES + click-to-open
  if (items.length === 0) {
    list.innerHTML = `<div class="film"><div class="film-meta"><div class="film-title">No accepted films in this block.</div></div></div>`;
    return;
  }
  items.forEach(f => {
    const art = document.createElement('article');
    art.className = 'film';
    art.addEventListener('click', () => { if (f && f.Name) openFilmModal(f); });

    const bgURL = imgFromCell(f.image);
    if (bgURL) {
      const bg = document.createElement('div');
      bg.className = 'bg';
      bg.style.backgroundImage = `url("${bgURL}")`;
      art.appendChild(bg);
    }

    const meta = document.createElement('div');
    meta.className = 'film-meta';

    const left = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'film-title';
    title.textContent = f.Name || 'Untitled';

    const sub = document.createElement('div');
    sub.className = 'film-sub';
    const runtime = f.Runtime ? (' · ' + String(f.Runtime).replace(/\.0$/,'') + '’') : '';
    sub.textContent = (f.Director || '') + runtime;

    left.appendChild(title);
    left.appendChild(sub);

    const right = document.createElement('div'); // empty (no trailer button)
    meta.append(left, right);

    art.appendChild(meta);
    list.appendChild(art);
  });
}

// fix in initDots()
function initDots() {
  const dots = [...document.querySelectorAll('.dotnav .dot')];
  const sections = [...document.querySelectorAll('.card')];

  const byId = id => dots.find(d => d.getAttribute('href') === `#${id}`);

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting && e.intersectionRatio > 0.5) {
        dots.forEach(d => d.classList.remove('active'));
        const dot = byId(e.target.id);
        if (dot) dot.classList.add('active');
      }
    });
  }, { threshold: [0.51] });

  sections.forEach(s => io.observe(s));

  dots.forEach(d => d.addEventListener('click', e => {
    e.preventDefault();
    const id = d.getAttribute('href').slice(1);
    document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
  }));

  document.addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const idx = sections.findIndex(s => byId(s.id)?.classList.contains('active'));
    const next = e.key === 'ArrowDown' ? Math.min(idx + 1, sections.length - 1) : Math.max(idx - 1, 0);
    sections[next].scrollIntoView({ behavior: 'smooth' });
  });
}


function ensureSectionIds() {
  const secs = [...document.querySelectorAll('#cards [data-type]')];
  secs.forEach((s, i) => {
    if (!s.id) s.id = `card-${i + 1}`;   // give each section a stable id
    s.classList.add('card');             // make sure they have .card for scroll logic
  });
  return secs;
}

function ensureDotNav() {
  let nav = document.querySelector('.dotnav');
  if (!nav) {
    nav = document.createElement('nav');
    nav.className = 'dotnav';
    nav.setAttribute('aria-label', 'Section navigation');
    document.body.appendChild(nav); // or append to your header if you prefer
  }
  return nav;
}

function buildDotNav() {
  const sections = ensureSectionIds();
  const nav = ensureDotNav();
  nav.innerHTML = '';

  sections.forEach((sec, i) => {
    const a = document.createElement('a');
    a.href = `#${sec.id}`;
    a.className = 'dot' + (i === 0 ? ' active' : '');

    // Prefer explicit HTML ref; otherwise use data-block (CSV label) or Block N
    const label =
      sec.dataset.ref?.replace(/[-_]/g, ' ')
      || sec.dataset.block
      || (sec.dataset.id ? `Block ${sec.dataset.id}` : `Section ${i + 1}`);

    a.setAttribute('aria-label', label);
    nav.appendChild(a);
  });
}

// single init (keep this one; delete the earlier one)
async function init() {
  try {
    const res = await fetch('data.csv');
    const text = await res.text();

    const films = parseCSV(text).filter(f => String(f.Block ?? '').trim() !== '');


const layout = getLayoutFromHTML();
for (const item of layout) {
  if (item.type === 'section') renderSection(item.ref, item.el);
  else if (item.type === 'block') renderBlockTo(item.el, films, item.blockKey ?? item.id, item.title);
}

    buildDotNav();
    calendarChooser();
  } catch (err) {
    console.error('data.csv load error', err);
    const first = document.querySelector('#cards [data-type]') || document.body;
    first.innerHTML = '<div class="note">Could not load data.csv</div>';
  }

  setupFilmModal?.();
  startBlink?.('vaseOpen_desktop', 'vaseClosed_desktop');
  startBlink?.('vaseOpen_mobile',  'vaseClosed_mobile');
  startBlink?.('vaseOpen_hang',    'vaseClosed_hang');
  initDots?.();
}

init();