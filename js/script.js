// ===== animasi muncul saat di-scroll =====
// jeda bertahap supaya kartu munculnya gantian
document.querySelectorAll('.art-strip, .food-strip, .timeline').forEach(group => {
  group.querySelectorAll('.reveal').forEach((item, i) => {
    item.style.setProperty('--d', `${(i % 4) * 90}ms`);
  });
});

const revealObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('show');
    obs.unobserve(entry.target);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(item => revealObserver.observe(item));


// ===== hero =====
const hero = document.querySelector('.hero');
if (hero) initHero(hero);

function initHero(hero) {
  // judul dipecah per kata supaya muncul satu-satu
  const title = hero.querySelector('.hero-title');
  title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
  splitWords(title);

  // teks berjalan digandakan supaya looping-nya nyambung
  const track = hero.querySelector('.hero-marquee .track');
  track.innerHTML += track.innerHTML;

  // kalau animasi dimatikan di perangkat, cukup sampai sini
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const compass = hero.querySelector('.compass');
  const needle = hero.querySelector('.needle');
  const state = { tx: 0, ty: 0, x: 0, y: 0, angle: 0, targetAngle: 0, lastMove: 0 };

  // gerakan kursor: parallax, cahaya, dan jarum kompas
  hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;

    state.tx = nx * 2 - 1;
    state.ty = ny * 2 - 1;
    hero.style.setProperty('--mx', `${nx * 100}%`);
    hero.style.setProperty('--my', `${ny * 100}%`);

    const c = compass.getBoundingClientRect();
    const cx = c.left + c.width / 2;
    const cy = c.top + c.height / 2;
    state.targetAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90;
    state.lastMove = performance.now();
  });

  hero.addEventListener('pointerleave', () => {
    state.tx = 0;
    state.ty = 0;
  });

  // klik di hero = muncul riak
  hero.addEventListener('pointerdown', e => {
    if (e.target.closest('a, button')) return;

    const r = hero.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.left = `${e.clientX - r.left}px`;
    ripple.style.top = `${e.clientY - r.top}px`;
    hero.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });

  // parallax saat scroll
  let scrollTicking = false;
  window.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      hero.style.setProperty('--sy', Math.min(window.scrollY, window.innerHeight));
      scrollTicking = false;
    });
  }, { passive: true });


  // --- partikel emas di canvas ---
  const canvas = hero.querySelector('.hero-particles');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dots = [];

  const makeDot = initial => ({
    x: Math.random() * W,
    y: initial ? Math.random() * H : H + 10,
    r: Math.random() * 1.8 + 0.4,
    vy: Math.random() * 0.35 + 0.1,
    vx: (Math.random() - 0.5) * 0.15,
    a: Math.random() * 0.5 + 0.2,
    ph: Math.random() * Math.PI * 2
  });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = Array.from({ length: W < 700 ? 28 : 60 }, () => makeDot(true));
  }

  resize();
  window.addEventListener('resize', resize);

  // animasi berhenti kalau hero tidak kelihatan
  let visible = true;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(hero);

  function loop(now) {
    requestAnimationFrame(loop);
    if (!visible) return;

    // parallax dibuat halus
    state.x += (state.tx - state.x) * 0.06;
    state.y += (state.ty - state.y) * 0.06;
    hero.style.setProperty('--px', state.x.toFixed(3));
    hero.style.setProperty('--py', state.y.toFixed(3));

    // jarum kompas: ikut kursor, kalau diam goyang sendiri
    const idle = now - state.lastMove > 2500;
    const target = idle ? Math.sin(now / 900) * 25 : state.targetAngle;
    const diff = ((target - state.angle + 540) % 360) - 180;
    state.angle += diff * 0.08;
    needle.setAttribute('transform', `rotate(${state.angle.toFixed(2)} 32 32)`);

    // gambar partikel
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#e6c877';
    dots.forEach((d, i) => {
      d.y -= d.vy;
      d.x += d.vx + Math.sin(now / 1500 + d.ph) * 0.12 + state.x * 0.2;

      // keluar layar → ganti dengan partikel baru dari bawah
      if (d.y < -10 || d.x < -10 || d.x > W + 10) dots[i] = makeDot(false);

      ctx.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(now / 700 + d.ph));
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  requestAnimationFrame(loop);
}


// memecah teks jadi per kata, tiap kata dibungkus .w > span
// (tag di dalamnya seperti <em> tetap dipertahankan)
function splitWords(el) {
  let index = 0;

  const walk = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
        return;
      }
      if (child.nodeType !== Node.TEXT_NODE) return;

      const frag = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.append(' ');
          return;
        }

        const mask = document.createElement('span');
        mask.className = 'w';
        const inner = document.createElement('span');
        inner.textContent = part;
        inner.style.setProperty('--i', index++);
        mask.append(inner);
        frag.append(mask);
      });
      child.replaceWith(frag);
    });
  };

  walk(el);
}