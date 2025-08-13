(() => {
  const canvas = document.getElementById('sakura');
  const ctx = canvas.getContext('2d');
  const state = { w: 0, h: 0, dpr: Math.max(1, Math.min(2, window.devicePixelRatio || 1)) };
  function resize(){
    state.w = Math.floor(window.innerWidth);
    state.h = Math.floor(window.innerHeight);
    canvas.width = Math.floor(state.w * state.dpr);
    canvas.height = Math.floor(state.h * state.dpr);
    canvas.style.width = state.w + 'px';
    canvas.style.height = state.h + 'px';
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  const countEl = document.getElementById('count');
  const countVal = document.getElementById('countVal');
  const windEl = document.getElementById('wind');
  const windVal = document.getElementById('windVal');
  const gustEl = document.getElementById('gust');
  const gustVal = document.getElementById('gustVal');

  let targetCount = +countEl.value;
  countEl.addEventListener('input', () => { countVal.textContent = countEl.value; targetCount = +countEl.value; });
  windEl.addEventListener('input', () => { windVal.textContent = (+windEl.value).toFixed(1); config.wind = +windEl.value;});
  gustEl.addEventListener('input', () => { gustVal.textContent = (+gustEl.value).toFixed(1); config.gustiness = +gustEl.value;});
  document.getElementById('shuffle').addEventListener('click', () => { windSeed = Math.random() * 1000; });

  const config = {
    baseFall: 24,
    wind: 1.0,
    gustiness: 0.8,
    swayFreq: [0.6, 1.6],
    spin: [0.3, 1.2],
    size: [8, 26],
    spawnPadding: 40,
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  let windSeed = Math.random() * 1000;
  function windAt(t){
    const slow = Math.sin(t * 0.07 + windSeed) * 0.6;
    const medium = Math.sin(t * 0.23 + windSeed * 1.7) * 0.4;
    const base = (slow + medium) * config.gustiness;
    return (config.wind + base);
  }

  function drawPetalPath(ctx, r){
    ctx.beginPath();
    ctx.moveTo(0, -r*0.2);
    ctx.bezierCurveTo(r*0.8, -r*0.9, r*0.9, r*0.3, 0, r);
    ctx.bezierCurveTo(-r*0.9, r*0.3, -r*0.8, -r*0.9, 0, -r*0.2);
    ctx.closePath();
  }
  const petalCache = new Map();
  function getPetalTexture(size){
    const key = Math.round(size);
    if (petalCache.has(key)) return petalCache.get(key);
    const off = document.createElement('canvas');
    const pad = 2 + key;
    off.width = off.height = (key*3 + pad*2);
    const octx = off.getContext('2d');
    octx.translate(off.width/2, off.height/2);
    const grad = octx.createRadialGradient(0, key*0.2, key*0.2, 0, 0, key*1.2);
    grad.addColorStop(0.00, '#ffe1ef');
    grad.addColorStop(0.45, '#ffc1dc');
    grad.addColorStop(1.00, '#ff8dbf');
    octx.shadowColor = 'rgba(0,0,0,0.25)';
    octx.shadowBlur = key*0.35;
    octx.shadowOffsetY = key*0.15;
    octx.fillStyle = grad;
    drawPetalPath(octx, key);
    octx.fill();
    petalCache.set(key, off);
    return off;
  }
  class Petal{
    constructor(){ this.reset(true); }
    reset(initial=false){
      const r = rand(config.size[0], config.size[1]);
      this.size = r;
      this.z = rand(0.4, 1.6);
      this.x = rand(-config.spawnPadding, state.w + config.spawnPadding);
      this.y = initial ? rand(-state.h, state.h) : -config.spawnPadding - rand(0, state.h*0.3);
      this.sway = rand(config.swayFreq[0], config.swayFreq[1]) * (Math.random()>0.5?1:-1);
      this.spin = rand(config.spin[0], config.spin[1]) * (Math.random()>0.5?1:-1);
      this.angle = rand(0, Math.PI*2);
      this.life = 0;
      this.opacity = rand(0.55, 0.95) * (1/this.z);
    }
    update(dt, t){
      this.life += dt;
      const w = windAt(t) * (0.8 + 0.4/this.z);
      const fall = (config.baseFall * (0.8 + 0.6/this.z)) * (0.6 + this.size/28);
      const swayOffset = Math.sin(this.life * this.sway * 2*Math.PI) * (6 + this.size*0.6);
      this.x += (w * 30 + swayOffset*0.02) * dt;
      this.y += fall * dt;
      this.angle += this.spin * dt;
      if (this.y - this.size > state.h + config.spawnPadding || this.x < -config.spawnPadding - 100 || this.x > state.w + config.spawnPadding + 100){
        this.reset(false);
      }
    }
    draw(ctx){
      const tex = getPetalTexture(this.size);
      const scale = 0.9 + Math.sin(this.angle*1.7) * 0.12;
      const w = tex.width * 0.35 * scale;
      const h = tex.height * 0.35 * scale;
      ctx.globalAlpha = Math.max(0, Math.min(1, this.opacity));
      ctx.drawImage(tex, this.x - w/2, this.y - h/2, w, h);
      ctx.globalAlpha = 1;
    }
  }

  let petals = [];
  function ensureCount(){
    const diff = targetCount - petals.length;
    if (diff > 0){ for (let i=0; i<Math.min(diff, 10); i++) petals.push(new Petal()); }
    else if (diff < 0){ petals.splice(0, Math.min(-diff, 10)); }
  }

  const addBurst = (x, y) => {
    for (let i=0;i<12;i++){
      const p = new Petal();
      p.x = x + rand(-30, 30);
      p.y = y + rand(-10, 10);
      p.life = rand(0, 1);
      petals.push(p);
    }
  };

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    addBurst(e.clientX - rect.left, e.clientY - rect.top);
    targetCount = Math.min(800, targetCount + 10);
    countEl.value = String(targetCount);
    countVal.textContent = countEl.value;
  });

  const stars = Array.from({length: 80}, () => ({
    x: Math.random(), y: Math.random(), r: Math.random()*1.2 + 0.2, p: Math.random()*Math.PI*2
  }));
  function starfield(ctx, now){
    const t = now/1000;
    for (const s of stars){
      const x = s.x * state.w;
      const y = s.y * state.h * 0.8;
      const twinkle = 0.6 + Math.sin(t*1.3 + s.p)*0.4;
      ctx.globalAlpha = 0.25 * twinkle;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI*2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  let last = performance.now();
  function loop(now){
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ensureCount();
    ctx.clearRect(0, 0, state.w, state.h);
    starfield(ctx, now);
    const t = now/1000;
    for (let i=0; i<petals.length; i++){
      petals[i].update(dt, t);
    }
    petals.sort((a,b) => a.z - b.z);
    for (let i=0; i<petals.length; i++){
      petals[i].draw(ctx);
    }
    requestAnimationFrame(loop);
  }
  loop(performance.now());
})();

document.addEventListener("DOMContentLoaded", function () {
    const cards = document.querySelectorAll(".card");

    cards.forEach((card, index) => {
        setTimeout(() => {
            card.classList.add("show");
        }, index * 1000); 
    });
});


