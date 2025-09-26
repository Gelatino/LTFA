/* ---------- CSV → objects ---------- */
const CSV_URL = 'data.csv'; // put data.csv next to index.html

function parseCSV(text){
  const rows = [];
  let i=0, field='', row=[], q=false;
  const pushF=()=>{ row.push(field); field=''; };
  const pushR=()=>{ rows.push(row); row=[]; };
  while(i<text.length){
    const c=text[i];
    if(q){
      if(c === '"'){
        if(text[i+1] === '"'){ field+='"'; i++; }
        else { q=false; }
      } else { field+=c; }
    } else {
      if(c === '"'){ q=true; }
      else if(c === ','){ pushF(); }
      else if(c === '\n'){ pushF(); pushR(); }
      else if(c !== '\r'){ field+=c; }
    }
    i++;
  }
  if(field.length || row.length){ pushF(); pushR(); }
  const header = rows[0].map(h=>h.trim());
  return rows.slice(1).filter(r=>r.some(v=>(v||'').trim()!=='')).map(r=>{
    const o={}; header.forEach((h,ix)=> o[h]= (r[ix]||'').trim() ); return o;
  });
}

/* ---------- Helpers ---------- */
const imgFromCell = v => !v ? null : /^https?:\/\//i.test(v) ? v : `assets/img/${v}`;

/* ---------- Render blocks ---------- */
function renderBlock(containerId, films, timeEl){
  const list = document.getElementById(containerId);
  if(!list) return;

  // set time label from Block value of first film (or leave default)
  if(timeEl && films[0] && films[0].Block) timeEl.textContent = films[0].Block;

  list.style.gridTemplateRows = `repeat(${Math.max(films.length,1)}, 1fr)`;
  list.innerHTML = '';

  (films.length ? films : [{Name:'No films in this block'}]).forEach(f=>{
    const art = document.createElement('article');
    art.className = 'film';

    // >>> open modal when clicking this film
    art.addEventListener('click', ()=> {
      if(f && f.Name) openFilmModal(f);
    });

    const bgURL = imgFromCell(f.image);
    if(bgURL){
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
    const runtime = f.Runtime ? ` · ${String(f.Runtime).replace(/\.0$/,'')}’` : '';
    sub.textContent = `${f.Director || ''}${runtime}`;

    left.appendChild(title);
    left.appendChild(sub);

  // right column now stays empty — no trailer link
  const right = document.createElement('div');

    meta.append(left, right);
    art.appendChild(meta);
    list.appendChild(art);
  });
}

/* ---------- Blink (hard swap) ---------- */
function startBlink(openId, closedId){
  const open = document.getElementById(openId);
  const closed = document.getElementById(closedId);
  if(!open || !closed) return;
  function once(closedMs=160){
    open.style.display='none'; closed.style.display='block';
    setTimeout(()=>{ open.style.display='block'; closed.style.display='none'; }, closedMs);
  }
  (function loop(){
    const next = Math.floor(2400 + Math.random()*3600);
    setTimeout(()=>{ once(150 + Math.floor(Math.random()*80)); loop(); }, next);
  })();
}

/* ---------- Dotnav ---------- */
function initDots(){
  const dots = [...document.querySelectorAll('.dotnav .dot')];
  const sections = [...document.querySelectorAll('.card')];

  const byId = id => dots.find(d=> d.getAttribute('href') === `#${id}`);

  const io = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting && e.intersectionRatio > 0.5){
        dots.forEach(d=>d.classList.remove('active'));
        const dot = byId(e.target.id);
        if(dot) dot.classList.add('active');
      }
    });
  }, { threshold: [0.51] });

  sections.forEach(s=> io.observe(s));

  // smooth scroll
  dots.forEach(d=> d.addEventListener('click', e=>{
    e.preventDefault();
    const id = d.getAttribute('href').slice(1);
    document.getElementById(id).scrollIntoView({ behavior:'smooth' });
  }));

  // keyboard arrows
  document.addEventListener('keydown', e=>{
    if(e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const idx = sections.findIndex(s => byId(s.id)?.classList.contains('active'));
    const next = e.key === 'ArrowDown' ? Math.min(idx+1, sections.length-1)
                                       : Math.max(idx-1, 0);
    sections[next].scrollIntoView({ behavior:'smooth' });
  });
}

/* ---------- Init ---------- */
async function init(){
  // CSV
  try{
    const res = await fetch('data.csv');
    const text = await res.text();
    const films = parseCSV(text);

    // group by Block (label) and keep order
    const byBlock = {};
    films.forEach(f => {
      const k = (f.Block || 'Block').trim();
      (byBlock[k] ||= []).push(f);
    });
    const blocks = Object.keys(byBlock);

    // Fill card 2 and 3 with first two blocks
    renderBlock('films-1', byBlock[blocks[0]] || [], document.querySelector('[data-slot="time-1"]'));
    renderBlock('films-2', byBlock[blocks[1]] || [], document.querySelector('[data-slot="time-2"]'));
  }catch(err){
    console.error('data.csv load error', err);
    document.getElementById('films-1').innerHTML =
      '<div class="film"><div class="film-meta"><div class="film-title">Could not load data.csv</div></div></div>';
  }

  setupFilmModal();

  // Blink vases
  startBlink('vaseOpen_desktop', 'vaseClosed_desktop');
  startBlink('vaseOpen_mobile',  'vaseClosed_mobile');
  startBlink('vaseOpen_hang',    'vaseClosed_hang');

  // Dots
  initDots();
}

init();


(function(){
  const btn = document.getElementById('addToCalendar');
  if(!btn) return;

  btn.addEventListener('click', () => {
    // Event: SATURDAY, OCT. 25, 2025 — 14:00–22:00 (Berlin)
    const ICS = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LTFA//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:ltfa-20251025@ltfa',
      `DTSTAMP:${toStamp(new Date())}`,
      'DTSTART;TZID=Europe/Berlin:20251025T140000',
      'DTEND;TZID=Europe/Berlin:20251025T220000',
      'SUMMARY:LTFA — Screening Day',
      'LOCATION:Ackerstrasse 9, 10115 Berlin',
      'DESCRIPTION:Films, music, conversation, and drinks.',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder',
      'TRIGGER:-P2D',             // 2 days before start
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ICS], {type:'text/calendar;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'LTFA-2025-10-25.ics';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  });

  function toStamp(d){
    const pad = n => String(n).padStart(2,'0');
    return (
      d.getUTCFullYear() +
      pad(d.getUTCMonth()+1) +
      pad(d.getUTCDate()) + 'T' +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) + 'Z'
    );
  }
})();


// --- Modal helpers ---
const FilmModal = {
  el: null,
  ui: {}
};
function setupFilmModal(){
  FilmModal.el = document.getElementById('filmModal');
  if(!FilmModal.el) return;
  FilmModal.ui = {
    card:   FilmModal.el.querySelector('.modal-card'),
    close:  FilmModal.el.querySelector('.modal-close'),
    media:  FilmModal.el.querySelector('.modal-media'),
    title:  FilmModal.el.querySelector('.modal-title'),
    meta:   FilmModal.el.querySelector('.modal-meta'),
    sin:    FilmModal.el.querySelector('.modal-sinopsis'),
    link:   FilmModal.el.querySelector('.modal-trailer'),
    backdrop: FilmModal.el.querySelector('.modal-backdrop')
  };

  const close = ()=> closeFilmModal();
  FilmModal.ui.close.addEventListener('click', close);
  FilmModal.ui.backdrop.addEventListener('click', close);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') close(); });
}

function openFilmModal(f){
  if(!FilmModal.el) return;
  // title
  FilmModal.ui.title.textContent = f.Name || 'Untitled';

  // meta (Director · Country · Runtime)
  const bits = [];
  if(f.Director) bits.push(`Director: ${f.Director}`);
  if(f.Country)  bits.push(`Country: ${f.Country}`);
  if(f.Runtime)  bits.push(`Runtime: ${String(f.Runtime).replace(/\.0$/,'')}’`);
  FilmModal.ui.meta.textContent = bits.join(' · ');

  // sinopsis
  FilmModal.ui.sin.textContent = f.Sinopsis || '';

  // trailer link
  if(f.Trailer){
    FilmModal.ui.link.href = f.Trailer;
    FilmModal.ui.link.hidden = false;
  } else {
    FilmModal.ui.link.removeAttribute('href');
    FilmModal.ui.link.hidden = true;
  }

  // poster/cover (use your existing `image` column)
  const bgURL = imgFromCell(f.image);
  if(bgURL){
    FilmModal.ui.media.style.backgroundImage = `url("${bgURL}")`;
    FilmModal.ui.media.hidden = false;
  } else {
    FilmModal.ui.media.hidden = true;
  }

  FilmModal.el.classList.add('show');
  FilmModal.el.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closeFilmModal(){
  if(!FilmModal.el) return;
  FilmModal.el.classList.remove('show');
  FilmModal.el.setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open');
}
// --- end modal helpers ---