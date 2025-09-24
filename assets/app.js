function slug(s){return String(s||'').toLowerCase().trim().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');}
function groupBy(arr, key){const m=new Map(); for(const it of arr){const k=it[key]||'Unassigned'; if(!m.has(k)) m.set(k,[]); m.get(k).push(it);} return Array.from(m.entries()).map(([k,v])=>({key:k,items:v}));}
function pick(row){
  const get=(cands)=>{for(const c of cands){for(const k in row){if(slug(k)===slug(c)) return row[k];}} return '';}
  return {
    block: get(['BLOCK','Block','block']),
    title: get(['title','name','film_title']),
    director: get(['director','by']),
    runtime: get(['runtime','duration']),
    genre: get(['genre','type']),
    country: get(['country','origin']),
    year: get(['year']),
    time: get(['time','start','start_time']),
    image: get(['image','img','poster','file','filename','picture','photo']),
    link: get(['trailer','link','url','website']),
    music: get(['music','music_by','dj'])
  };
}
function initials(name){
  const parts = String(name||'').trim().split(/\s+/).slice(0,2);
  return parts.map(p=>p[0]||'').join('').toUpperCase() || '–';
}
function showError(msg){
  console.error(msg);
  const e = document.querySelector('.err');
  e.textContent = msg;
  e.classList.add('show');
}

function startBlob() {
  console.log("startBlob called");
  const canvas = document.getElementById('bg-blob');
  const ctx = canvas.getContext('2d');
  console.log("Canvas size:", canvas.width, canvas.height);
  
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    console.log("Canvas set to:", canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();
  
  let t = 0;
  function animate() {
    ctx.fillStyle = "rgba(0, 200, 255, 0.5)";
    ctx.fill();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const cx = canvas.width / 2 + Math.sin(t * 0.5) * 150;
    const cy = canvas.height / 2 + Math.cos(t * 0.7) * 100;
    const r = 200 + Math.sin(t * 0.3) * 40; // radius pulses
    
    ctx.beginPath();
    for (let i = 0; i < Math.PI * 2; i += 0.05) {
      const offset = Math.sin(i * 3 + t) * 20;
      const x = cx + (r + offset) * Math.cos(i);
      const y = cy + (r + offset) * Math.sin(i);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    
    // gradient fill to look watery
    const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    grad.addColorStop(0, "#669bbc"); // blue center
    grad.addColorStop(1, "rgba(255,255,255,0)"); // fade out
    ctx.fillStyle = grad;
    ctx.fill();
    
    t += 0.01;
    requestAnimationFrame(animate);
  }
  animate();
}

async function boot(){
  try{
    const res = await fetch('data.csv', {cache: 'no-store'});
    if(!res.ok) throw new Error('Failed to load data.csv: ' + res.status + ' ' + res.statusText);
    const text = await res.text();
    const parsed = Papa.parse(text, {header:true, skipEmptyLines:true});
    if (parsed.errors && parsed.errors.length){
      console.warn('CSV parse warnings:', parsed.errors.slice(0,3));
    }
    let rows = parsed.data.map(pick);

    const groups = groupBy(rows, 'block');
    const anchor = document.querySelector('#hangout');
    groups.forEach((g,i) => {
      const panel = document.createElement('section');
      panel.className = 'panel';
      panel.id = 'block-' + (i + 1);  
      const music = (g.items.map(x=>x.music).filter(Boolean)[0]) || '';
      panel.innerHTML = `
        <div class="block-head">
          <h2 class="block-title">BLOCK ${i+1}${g.key ? ' — ' + g.key : ''}</h2>
          ${music ? `<div class="block-music">music by ${music}</div>` : ''}
        </div>
        <div class="films"></div>
      `;
      const films = panel.querySelector('.films');
      g.items.forEach(d => {
          const el = document.createElement('div');
          el.className = 'film';
          const src = d.image ? "assets/img/" + d.image : "";
          const img = src
            ? '<img src="' + src + '" alt="">'
            : '<div class="ph">' + initials(d.title) + '</div>';
          el.innerHTML = `
            <div class="thumb">${img}</div>
            <div class="film-title">${d.title || 'Untitled'}</div>
            <div class="film-meta">${d.director || ''}</div>
            ${d.time ? '<div class="film-time">' + d.time + '</div>' : ''}
          `;
          films.appendChild(el);
        });
      document.getElementById('wrap').insertBefore(panel, anchor);
    });
    setupDotNav();
  }catch(err){
    showError('Error: ' + (err && err.message ? err.message : String(err)));
  }
}
document.addEventListener('DOMContentLoaded', boot);
document.addEventListener('DOMContentLoaded', startBlob);
let dotObserver;

function setupDotNav() {
  const scroller = document.querySelector('.wrap');      // <-- the scroll container
  const nav = document.getElementById('dotnav') || (() => {
    const el = document.createElement('div');
    el.id = 'dotnav';
    el.className = 'dotnav';
    document.body.appendChild(el);
    return el;
  })();

  const panels = Array.from(document.querySelectorAll('.panel'));
  nav.innerHTML = '';

  panels.forEach(panel => {
    if (!panel.id) panel.id = 'panel-' + (nav.childElementCount + 1);
    const btn = document.createElement('button');
    btn.addEventListener('click', () => {
      // scroll inside the .wrap container
      scroller.scrollTo({ top: panel.offsetTop, behavior: 'smooth' });
    });
    nav.appendChild(btn);
  });

  if (dotObserver) dotObserver.disconnect();
  const dots = nav.querySelectorAll('button');

  dotObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const idx = panels.indexOf(entry.target);
      dots.forEach(d => d.classList.remove('active'));
      if (idx >= 0) dots[idx].classList.add('active');
    });
  }, {
    root: scroller,        // <-- key change
    threshold: 0.6,
    rootMargin: '0px 0px -10% 0px'
  });

  panels.forEach(p => dotObserver.observe(p));
}
document.addEventListener('DOMContentLoaded', setupDotNav);
