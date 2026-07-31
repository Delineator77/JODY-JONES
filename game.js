/* =============================================================================
   GAUNTLET — Neon Arena FPS
   A single-file, zero-external-asset first person shooter built in Three.js.
   Every mesh, texture, sound and effect is generated in code.
   Built with the Gauntlet Loop method: split -> build -> blind critic -> repeat.
   ============================================================================= */
(function () {
  'use strict';

  const THREE = window.THREE;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------------ DOM refs
  const $ = (id) => document.getElementById(id);
  const dom = {
    loading: $('loading'), start: $('start'), startBtn: $('startBtn'),
    pause: $('pause'), resumeBtn: $('resumeBtn'),
    gameover: $('gameover'), retryBtn: $('retryBtn'),
    goWave: $('goWave'), goScore: $('goScore'), goKills: $('goKills'),
    healthFill: $('healthFill'), healthNum: $('healthNum'),
    ammoMag: $('ammoMag'), ammoReserve: $('ammoReserve'), reloadHint: $('reloadHint'),
    waveNum: $('waveNum'), scoreNum: $('scoreNum'), enemyLeftNum: $('enemyLeftNum'),
    killfeed: $('killfeed'), popups: $('popups'), crosshair: $('crosshair'),
    hitmarker: $('hitmarker'), banner: $('banner'), bannerBig: $('bannerBig'),
    bannerSub: $('bannerSub'), vignette: $('vignette'), dmgDirs: $('dmgDirs'),
  };

  /* =========================================================================
     AUDIO — fully procedural via WebAudio (no sound files)
     ========================================================================= */
  const Audio = (function () {
    let ctx = null, master = null, reverb = null, ambientGain = null, started = false;
    function init() {
      if (ctx) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      // simple algorithmic reverb impulse
      reverb = ctx.createConvolver();
      const len = ctx.sampleRate * 1.1, buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
      reverb.buffer = buf;
      const rg = ctx.createGain(); rg.gain.value = 0.22; reverb.connect(rg); rg.connect(master);
      reverb._send = rg;
    }
    function noiseBuf(dur) {
      const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b;
    }
    function env(g, t0, a, peak, d, sus) { g.gain.cancelScheduledValues(t0); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t0 + a + d); }
    function tone(freq, t0, dur, type, gain, glideTo) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
      if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
      env(g, t0, 0.005, gain, dur); o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.05);
    }
    const A = {
      resume() { init(); if (ctx.state === 'suspended') ctx.resume(); if (!started) { started = true; A.ambient(); } },
      shoot() {
        if (!ctx) return; const t = ctx.currentTime;
        // punchy layered gunshot: noise crack + body thump + transient click
        const src = ctx.createBufferSource(); src.buffer = noiseBuf(0.18);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.7;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
        const g = ctx.createGain(); env(g, t, 0.001, 0.7, 0.14);
        src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(master); g.connect(reverb);
        src.start(t); src.stop(t + 0.2);
        // low body
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.09);
        env(og, t, 0.001, 0.5, 0.1); o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.14);
        tone(2400, t, 0.03, 'square', 0.12);
      },
      dryFire() { if (!ctx) return; const t = ctx.currentTime; tone(900, t, 0.03, 'square', 0.08); tone(500, t + 0.01, 0.03, 'square', 0.06); },
      reload() {
        if (!ctx) return; const t = ctx.currentTime;
        tone(320, t, 0.05, 'square', 0.12);
        tone(180, t + 0.28, 0.06, 'square', 0.14, 120);
        tone(700, t + 0.62, 0.04, 'square', 0.12);
      },
      hit(crit) { if (!ctx) return; const t = ctx.currentTime; tone(crit ? 1400 : 900, t, 0.05, 'square', 0.14, crit ? 700 : 500); },
      enemyDie() {
        if (!ctx) return; const t = ctx.currentTime;
        const src = ctx.createBufferSource(); src.buffer = noiseBuf(0.4);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2000, t); lp.frequency.exponentialRampToValueAtTime(120, t + 0.35);
        const g = ctx.createGain(); env(g, t, 0.002, 0.5, 0.36); src.connect(lp); lp.connect(g); g.connect(master); g.connect(reverb);
        src.start(t); src.stop(t + 0.42); tone(160, t, 0.3, 'sawtooth', 0.2, 40);
      },
      hurt() {
        if (!ctx) return; const t = ctx.currentTime; tone(90, t, 0.22, 'sawtooth', 0.32, 50);
        const src = ctx.createBufferSource(); src.buffer = noiseBuf(0.2); const g = ctx.createGain(); env(g, t, 0.002, 0.2, 0.18); src.connect(g); g.connect(master); src.start(t); src.stop(t + 0.22);
      },
      step() { if (!ctx) return; const t = ctx.currentTime; const src = ctx.createBufferSource(); src.buffer = noiseBuf(0.05); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; const g = ctx.createGain(); env(g, t, 0.002, 0.08, 0.05); src.connect(lp); lp.connect(g); g.connect(master); src.start(t); src.stop(t + 0.07); },
      waveStart() { if (!ctx) return; const t = ctx.currentTime; tone(300, t, 0.5, 'sawtooth', 0.16, 600); tone(450, t + 0.08, 0.5, 'sine', 0.12, 900); },
      enemyShoot() { if (!ctx) return; const t = ctx.currentTime; tone(600, t, 0.14, 'sawtooth', 0.14, 160); },
      ui() { if (!ctx) return; const t = ctx.currentTime; tone(660, t, 0.05, 'square', 0.1); },
      ambient() {
        if (!ctx) return; const t = ctx.currentTime;
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
        o1.type = 'sawtooth'; o1.frequency.value = 42; o2.type = 'sine'; o2.frequency.value = 63;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
        g.gain.value = 0.08; o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
        o1.start(t); o2.start(t); ambientGain = g;
        // slow pulsing
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 0.03; lfo.connect(lg); lg.connect(g.gain); lfo.start(t);
      },
    };
    return A;
  })();

  /* =========================================================================
     RENDERER / SCENE / CAMERA / POST
     ========================================================================= */
  const container = $('game');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);
  scene.fog = new THREE.FogExp2(0x070b14, 0.028);

  const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.05, 400);
  const BASE_FOV = 78, ADS_FOV = 55;
  scene.add(camera);

  // Post: bloom for that neon AAA glow
  const composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.55, 0.9);
  composer.addPass(bloom);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloom.setSize(window.innerWidth, window.innerHeight);
  });

  /* =========================================================================
     PROCEDURAL TEXTURES (canvas)
     ========================================================================= */
  function makeCanvas(s) { const c = document.createElement('canvas'); c.width = c.height = s; return c; }
  function floorTexture() {
    const s = 512, c = makeCanvas(s), x = c.getContext('2d');
    x.fillStyle = '#0c1018'; x.fillRect(0, 0, s, s);
    // panel grid
    const cell = 128;
    for (let i = 0; i < s; i += cell) for (let j = 0; j < s; j += cell) {
      const shade = 12 + Math.floor(Math.random() * 10);
      x.fillStyle = `rgb(${shade},${shade + 4},${shade + 10})`;
      x.fillRect(i + 2, j + 2, cell - 4, cell - 4);
    }
    // grime speckle
    for (let i = 0; i < 5000; i++) { const a = Math.random() * 0.06; x.fillStyle = `rgba(0,0,0,${a})`; x.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
    // seam glow lines
    x.strokeStyle = 'rgba(40,120,150,0.25)'; x.lineWidth = 2;
    for (let i = 0; i <= s; i += cell) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, s); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(s, i); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 14); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t;
  }
  function floorRough() {
    const s = 256, c = makeCanvas(s), x = c.getContext('2d');
    x.fillStyle = '#888'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 8000; i++) { const v = 120 + Math.floor(Math.random() * 135); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 14); return t;
  }
  function wallTexture(tint) {
    const s = 512, c = makeCanvas(s), x = c.getContext('2d');
    x.fillStyle = '#0a0e16'; x.fillRect(0, 0, s, s);
    for (let j = 0; j < s; j += 64) for (let i = 0; i < s; i += 128) {
      const sh = 14 + Math.floor(Math.random() * 12);
      x.fillStyle = `rgb(${sh},${sh + 3},${sh + 8})`; x.fillRect(i + 3, j + 3, 128 - 6, 64 - 6);
      // rivets
      x.fillStyle = 'rgba(0,0,0,.4)';
      x.beginPath(); x.arc(i + 12, j + 12, 2, 0, TAU); x.fill();
      x.beginPath(); x.arc(i + 128 - 12, j + 12, 2, 0, TAU); x.fill();
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; return t;
  }
  function softDot() {
    const s = 64, c = makeCanvas(s), x = c.getContext('2d');
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  }
  const TEX = { floor: floorTexture(), floorRough: floorRough(), wall: wallTexture(), dot: softDot() };

  /* =========================================================================
     WORLD
     ========================================================================= */
  const ARENA = 30;              // half-extent
  const colliders = [];          // {min:{x,z}, max:{x,z}} AABBs for cover
  const neonLights = [];

  function buildWorld() {
    // Floor
    const floorMat = new THREE.MeshStandardMaterial({ map: TEX.floor, roughnessMap: TEX.floorRough, roughness: 0.85, metalness: 0.35, color: 0xffffff });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    // Perimeter walls
    const wallMat = new THREE.MeshStandardMaterial({ map: TEX.wall, roughness: 0.7, metalness: 0.5, color: 0xffffff });
    const wallH = 9, th = 1.2;
    const wallDefs = [
      [0, wallH / 2, -ARENA, ARENA * 2, wallH, th], [0, wallH / 2, ARENA, ARENA * 2, wallH, th],
      [-ARENA, wallH / 2, 0, th, wallH, ARENA * 2], [ARENA, wallH / 2, 0, th, wallH, ARENA * 2],
    ];
    wallDefs.forEach(d => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(d[3], d[4], d[5]), wallMat);
      m.position.set(d[0], d[1], d[2]); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    });

    // Neon strips along walls (emissive -> bloom) + colored point lights
    const stripGeo = new THREE.BoxGeometry(ARENA * 2 - 2, 0.18, 0.18);
    const neonColors = [0x37e6ff, 0xff2d95, 0x37e6ff, 0xff2d95];
    const stripSpots = [
      [0, 5.5, -ARENA + 0.7, 0], [0, 5.5, ARENA - 0.7, 0],
      [-ARENA + 0.7, 5.5, 0, Math.PI / 2], [ARENA - 0.7, 5.5, 0, Math.PI / 2],
    ];
    stripSpots.forEach((s, i) => {
      const col = neonColors[i];
      const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.8, roughness: 0.4 });
      const strip = new THREE.Mesh(stripGeo, mat); strip.position.set(s[0], s[1], s[2]); strip.rotation.y = s[3]; scene.add(strip);
      const pl = new THREE.PointLight(col, 0.8, 40, 2); pl.position.set(s[0], s[1] - 1, s[2]); scene.add(pl); neonLights.push(pl);
    });

    // Corner pylons with glowing tops
    [[-ARENA + 2, -ARENA + 2], [ARENA - 2, -ARENA + 2], [-ARENA + 2, ARENA - 2], [ARENA - 2, ARENA - 2]].forEach((p, i) => {
      const pyl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, wallH, 8), wallMat);
      pyl.position.set(p[0], wallH / 2, p[1]); pyl.castShadow = true; scene.add(pyl);
      const col = i % 2 ? 0xff2d95 : 0x37e6ff;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 8), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.2 }));
      cap.position.set(p[0], wallH, p[1]); scene.add(cap);
      const pl = new THREE.PointLight(col, 1.1, 26, 2); pl.position.set(p[0], wallH - 1, p[1]); scene.add(pl); neonLights.push(pl);
    });

    // Cover crates / barriers (procedural placement, keep center clear)
    const crateMat = new THREE.MeshStandardMaterial({ map: TEX.wall, color: 0x556070, roughness: 0.6, metalness: 0.6 });
    const covers = [
      [-8, 0, 6, 3.5, 2.4], [9, 0, -4, 3, 3], [4, 0, 10, 4, 1.6], [-11, 0, -9, 2.5, 2.5],
      [12, 0, 8, 2.2, 4], [-4, 0, -12, 5, 1.4], [0, 0, -6, 1.8, 1.8], [-14, 0, 4, 2, 3.4],
      [14, 0, -12, 3, 2], [7, 0, -13, 2.4, 2.4],
    ];
    covers.forEach(c => {
      const [cx, , cz, w, h] = c;
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), crateMat);
      box.position.set(cx, h / 2, cz); box.castShadow = true; box.receiveShadow = true; scene.add(box);
      // edge trim glow
      const trimCol = Math.random() > 0.5 ? 0x37e6ff : 0xffb020;
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.12, w * 0.96), new THREE.MeshStandardMaterial({ color: trimCol, emissive: trimCol, emissiveIntensity: 2.2 }));
      trim.position.set(cx, h, cz); scene.add(trim);
      colliders.push({ min: { x: cx - w / 2, z: cz - w / 2 }, max: { x: cx + w / 2, z: cz + w / 2 }, r: Math.max(w, h) });
    });

    // Skydome gradient
    const skyGeo = new THREE.SphereGeometry(200, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(0x0a1226) }, bot: { value: new THREE.Color(0x05070d) } },
      vertexShader: 'varying vec3 vp; void main(){ vp=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec3 vp; uniform vec3 top; uniform vec3 bot; void main(){ float h=clamp((normalize(vp).y+0.15)/1.0,0.0,1.0); gl_FragColor=vec4(mix(bot,top,h),1.0);}',
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Stars
    const starGeo = new THREE.BufferGeometry(); const sc = 500, sp = new Float32Array(sc * 3);
    for (let i = 0; i < sc; i++) { const v = new THREE.Vector3().setFromSphericalCoords(180, rand(0.1, Math.PI * 0.5), rand(0, TAU)); sp[i * 3] = v.x; sp[i * 3 + 1] = Math.abs(v.y) + 20; sp[i * 3 + 2] = v.z; }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fc7ff, size: 0.7, sizeAttenuation: true, transparent: true, opacity: 0.8, map: TEX.dot, depthWrite: false })));

    // Lights
    const hemi = new THREE.HemisphereLight(0x2a3a60, 0x0a0d12, 0.7); scene.add(hemi);
    const moon = new THREE.DirectionalLight(0xbcd2ff, 1.4); moon.position.set(-24, 40, 18); moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048); moon.shadow.camera.near = 1; moon.shadow.camera.far = 140;
    moon.shadow.camera.left = -ARENA - 6; moon.shadow.camera.right = ARENA + 6; moon.shadow.camera.top = ARENA + 6; moon.shadow.camera.bottom = -ARENA - 6;
    moon.shadow.bias = -0.0006; scene.add(moon);
    // Fill
    const fill = new THREE.DirectionalLight(0x2a3a66, 0.35); fill.position.set(20, 18, -20); scene.add(fill);
  }

  /* =========================================================================
     PARTICLES — GPU points, CPU integrated (sparks, energy, debris, smoke)
     ========================================================================= */
  const Particles = (function () {
    const MAX = 900;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3), siz = new Float32Array(MAX), alp = new Float32Array(MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTex: { value: TEX.dot } },
      vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
        varying vec3 vC; varying float vA;
        void main(){ vC=aColor; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0);
        gl_PointSize=aSize*(320.0/max(-mv.z,0.1)); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uTex; varying vec3 vC; varying float vA;
        void main(){ vec4 t=texture2D(uTex,gl_PointCoord); gl_FragColor=vec4(vC*vA,1.0)*t.a; }`,
    });
    const points = new THREE.Points(geo, mat); points.frustumCulled = false; scene.add(points);
    const vel = new Float32Array(MAX * 3), life = new Float32Array(MAX), maxlife = new Float32Array(MAX), grav = new Float32Array(MAX), sz0 = new Float32Array(MAX);
    let head = 0;
    function spawn(x, y, z, vx, vy, vz, color, size, lifeS, gravity) {
      const i = head; head = (head + 1) % MAX;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
      col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b;
      sz0[i] = size; siz[i] = size; alp[i] = 1; life[i] = lifeS; maxlife[i] = lifeS; grav[i] = gravity;
    }
    const _c = new THREE.Color();
    function burst(p, n, opt) {
      opt = opt || {};
      for (let k = 0; k < n; k++) {
        const spd = rand(opt.spdMin || 2, opt.spdMax || 9);
        const dir = new THREE.Vector3(rand(-1, 1), rand(opt.upMin != null ? opt.upMin : -0.3, 1), rand(-1, 1)).normalize();
        _c.set(opt.color != null ? opt.color : 0xffaa33);
        if (opt.colorJitter) _c.offsetHSL(rand(-0.05, 0.05), 0, rand(-0.1, 0.1));
        spawn(p.x, p.y, p.z, dir.x * spd, dir.y * spd + (opt.upBias || 0), dir.z * spd, _c, rand(opt.sizeMin || 0.5, opt.sizeMax || 1.6), rand(opt.lifeMin || 0.3, opt.lifeMax || 0.8), opt.grav != null ? opt.grav : 14);
      }
    }
    function update(dt) {
      for (let i = 0; i < MAX; i++) {
        if (life[i] <= 0) { if (alp[i] !== 0) { alp[i] = 0; siz[i] = 0; } continue; }
        life[i] -= dt;
        const t = Math.max(life[i], 0) / maxlife[i];
        vel[i * 3 + 1] -= grav[i] * dt;
        // drag
        const d = 1 - Math.min(dt * 2.5, 0.9);
        vel[i * 3] *= d; vel[i * 3 + 2] *= d;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0.05) { pos[i * 3 + 1] = 0.05; vel[i * 3 + 1] *= -0.35; vel[i * 3] *= 0.6; vel[i * 3 + 2] *= 0.6; }
        alp[i] = t; siz[i] = sz0[i] * (0.2 + 0.8 * t);
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aColor.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true; geo.attributes.aAlpha.needsUpdate = true;
    }
    return { spawn, burst, update };
  })();

  /* =========================================================================
     TRACERS + IMPACT FLASHES (pooled)
     ========================================================================= */
  const Tracers = (function () {
    const POOL = 20; const items = [];
    const geo = new THREE.CylinderGeometry(0.02, 0.02, 1, 5, 1, true);
    geo.translate(0, 0.5, 0); geo.rotateX(Math.PI / 2); // now along +Z from origin
    const mat = new THREE.MeshBasicMaterial({ color: 0x9ff6ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < POOL; i++) { const m = new THREE.Mesh(geo, mat.clone()); m.visible = false; scene.add(m); items.push({ m, life: 0 }); }
    let h = 0;
    const _d = new THREE.Vector3();
    function fire(from, to) {
      const it = items[h]; h = (h + 1) % POOL;
      _d.subVectors(to, from); const len = _d.length();
      it.m.position.copy(from); it.m.lookAt(to); it.m.scale.set(1, 1, len); it.m.visible = true; it.m.material.opacity = 0.95; it.life = 0.06;
    }
    function update(dt) { for (const it of items) { if (it.life > 0) { it.life -= dt; it.m.material.opacity = Math.max(0, it.life / 0.06) * 0.95; if (it.life <= 0) it.m.visible = false; } } }
    return { fire, update };
  })();

  const Flashes = (function () {
    const POOL = 8; const items = [];
    for (let i = 0; i < POOL; i++) { const l = new THREE.PointLight(0xffffff, 0, 12, 2); scene.add(l); items.push({ l, life: 0, max: 0 }); }
    let h = 0;
    function pop(pos, color, intensity, dur) { const it = items[h]; h = (h + 1) % POOL; it.l.position.copy(pos); it.l.color.set(color); it.l.intensity = intensity; it.life = dur; it.max = dur; }
    function update(dt) { for (const it of items) { if (it.life > 0) { it.life -= dt; it.l.intensity = Math.max(0, it.life / it.max) * it.l.intensity; if (it.life <= 0) it.l.intensity = 0; } } }
    return { pop, update };
  })();

  /* =========================================================================
     WEAPON (viewmodel + firing)
     ========================================================================= */
  const Weapon = (function () {
    const group = new THREE.Group();
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.45, metalness: 0.85 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x37e6ff, emissive: 0x37e6ff, emissiveIntensity: 1.0, roughness: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0d1015, roughness: 0.6, metalness: 0.6 });

    function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); group.add(m); return m; }
    // receiver / body
    box(0.14, 0.16, 0.72, gunMat, 0, 0, -0.1);
    // top rail
    box(0.06, 0.05, 0.5, darkMat, 0, 0.10, -0.05);
    // barrel
    const barrel = box(0.055, 0.055, 0.5, darkMat, 0, 0.02, -0.55); barrel.geometry = new THREE.CylinderGeometry(0.028, 0.032, 0.5, 10); barrel.rotation.x = Math.PI / 2;
    // muzzle
    const muzzleTip = box(0.07, 0.07, 0.1, darkMat, 0, 0.02, -0.82);
    // magazine
    const mag = box(0.11, 0.28, 0.14, gunMat, 0, -0.2, 0.02); mag.rotation.x = 0.16;
    // grip
    const grip = box(0.1, 0.24, 0.12, gunMat, 0, -0.18, 0.2); grip.rotation.x = -0.35;
    // stock
    box(0.1, 0.13, 0.24, gunMat, 0, -0.02, 0.34);
    // sight
    box(0.02, 0.09, 0.02, accentMat, 0, 0.14, -0.28);
    box(0.02, 0.09, 0.02, accentMat, 0, 0.14, 0.1);
    // side accent strips (glow)
    box(0.012, 0.05, 0.4, accentMat, 0.075, 0, -0.05);
    box(0.012, 0.05, 0.4, accentMat, -0.075, 0, -0.05);
    // ammo indicator
    const ammoLED = box(0.03, 0.03, 0.03, accentMat, 0.08, 0.05, 0.15);

    // muzzle marker
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.02, -0.9); group.add(muzzle);

    // muzzle flash (additive planes)
    const flashMat = new THREE.MeshBasicMaterial({ map: TEX.dot, color: 0xffd27f, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
    const flash = new THREE.Group();
    const fp1 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), flashMat); flash.add(fp1);
    const fp2 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.18), flashMat); flash.add(fp2);
    const fp3 = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.9), flashMat); flash.add(fp3);
    flash.position.copy(muzzle.position); group.add(flash);

    group.position.set(0.24, -0.24, -0.5);
    group.rotation.y = 0.03;
    group.scale.setScalar(0.82);
    camera.add(group);

    // state
    const rest = new THREE.Vector3(0.24, -0.24, -0.5);
    let recoil = 0, flashT = 0, sway = new THREE.Vector2(), bobT = 0;
    const st = {
      magSize: 30, mag: 30, reserve: 120, fireRate: 0.092, cooldown: 0, reloadTime: 1.35, reloading: 0,
      damage: 26, spread: 0.008, ads: false,
    };

    const _mw = new THREE.Vector3();
    function muzzleWorld() { return muzzle.getWorldPosition(_mw); }

    function tryFire() {
      if (st.reloading > 0 || st.cooldown > 0 || paused || !running) return false;
      if (st.mag <= 0) { Audio.dryFire(); st.cooldown = 0.18; return false; }
      st.mag--; st.cooldown = st.fireRate; recoil = Math.min(recoil + 1, 3.2); flashT = 0.05;
      Audio.shoot(); flash.rotation.z = rand(0, TAU);
      Flashes.pop(muzzleWorld(), 0xffcf8a, 6, 0.06);
      updateAmmoHUD();
      Game.doHitscan(st.damage, st.ads ? st.spread * 0.35 : st.spread);
      Game.addShake(st.ads ? 0.05 : 0.11);
      Game.crosshairKick();
      return true;
    }
    function reload() {
      if (st.reloading > 0 || st.mag === st.magSize || st.reserve <= 0) return;
      st.reloading = st.reloadTime; Audio.reload(); dom.reloadHint.style.opacity = 0;
    }
    function finishReload() {
      const need = st.magSize - st.mag, take = Math.min(need, st.reserve);
      st.mag += take; st.reserve -= take; updateAmmoHUD();
    }
    function update(dt, moving, speed) {
      if (st.cooldown > 0) st.cooldown -= dt;
      if (st.reloading > 0) { st.reloading -= dt; if (st.reloading <= 0) finishReload(); }
      // auto fire while held
      if (input.firing && st.mag > 0) tryFire();
      if (input.firing && st.mag <= 0 && st.reloading <= 0) reload();

      recoil = lerp(recoil, 0, dt * 12);
      flashT = Math.max(0, flashT - dt);
      flashMat.opacity = flashT > 0 ? rand(0.7, 1) : 0;
      const fs = flashT > 0 ? rand(0.8, 1.3) : 0.001; flash.scale.set(fs, fs, fs);

      // sway from mouse + bob from movement
      sway.x = lerp(sway.x, clamp(-input.look.x * 0.02, -0.05, 0.05), dt * 8);
      sway.y = lerp(sway.y, clamp(input.look.y * 0.02, -0.05, 0.05), dt * 8);
      bobT += dt * speed * 1.4;
      const bobX = moving ? Math.cos(bobT) * 0.012 : 0;
      const bobY = moving ? Math.abs(Math.sin(bobT)) * 0.015 : 0;

      // ADS target
      const adsPos = st.ads ? new THREE.Vector3(0.0, -0.135, -0.30) : rest;
      const target = adsPos.clone();
      target.x += sway.x + bobX; target.y += sway.y - bobY; target.z += recoil * 0.06;
      group.position.lerp(target, dt * (st.ads ? 16 : 12));
      group.rotation.x = lerp(group.rotation.x, -recoil * 0.05 + (st.ads ? 0 : 0), dt * 12);

      // fov
      const targetFov = st.ads ? ADS_FOV : BASE_FOV;
      camera.fov = lerp(camera.fov, targetFov, dt * 12); camera.updateProjectionMatrix();

      ammoLED.material = st.mag > 0 ? accentMat : darkMat;
    }
    function setADS(v) { st.ads = v; }
    function refill() { st.mag = st.magSize; st.reserve = Math.min(st.reserve + 60, 240); updateAmmoHUD(); }
    function reset() { st.mag = st.magSize; st.reserve = 120; st.reloading = 0; st.cooldown = 0; updateAmmoHUD(); }
    function updateAmmoHUD() {
      dom.ammoMag.textContent = st.mag; dom.ammoReserve.textContent = '/ ' + st.reserve;
      dom.ammoMag.classList.toggle('empty', st.mag === 0);
      dom.reloadHint.style.opacity = (st.mag === 0 && st.reserve > 0 && st.reloading <= 0) ? 1 : 0;
    }
    return { group, muzzleWorld, tryFire, reload, update, setADS, refill, reset, st, updateAmmoHUD };
  })();

  /* =========================================================================
     ENEMIES
     ========================================================================= */
  const enemyGeoCache = {};
  function buildEnemyMesh(type) {
    const g = new THREE.Group();
    const spec = type;
    const bodyMat = new THREE.MeshStandardMaterial({ color: spec.body, roughness: 0.5, metalness: 0.7 });
    const coreMat = new THREE.MeshStandardMaterial({ color: spec.core, emissive: spec.core, emissiveIntensity: 3.0, roughness: 0.3 });
    // torso
    const torso = new THREE.Mesh(new THREE.IcosahedronGeometry(spec.size * 0.5, 0), bodyMat);
    torso.castShadow = true; g.add(torso);
    // shoulders / armor shell
    const shell = new THREE.Mesh(new THREE.OctahedronGeometry(spec.size * 0.62, 0), new THREE.MeshStandardMaterial({ color: spec.body, roughness: 0.4, metalness: 0.9, transparent: true, opacity: 0.9 }));
    shell.scale.y = 0.7; g.add(shell);
    // glowing core / eye
    const core = new THREE.Mesh(new THREE.SphereGeometry(spec.size * 0.22, 12, 12), coreMat);
    core.position.set(0, spec.size * 0.05, spec.size * 0.4); g.add(core);
    // spikes
    const spikeMat = coreMat;
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(spec.size * 0.08, spec.size * 0.5, 5), spikeMat);
      const a = (i / 4) * TAU; s.position.set(Math.cos(a) * spec.size * 0.4, spec.size * 0.35, Math.sin(a) * spec.size * 0.4);
      s.rotation.z = Math.cos(a) * 0.5; s.rotation.x = Math.sin(a) * 0.5; g.add(s);
    }
    // legs (simple prongs)
    const legMat = bodyMat;
    const legs = [];
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * spec.size, 0.02 * spec.size, spec.size * 0.7, 5), legMat);
      const a = (i / 3) * TAU; leg.position.set(Math.cos(a) * spec.size * 0.25, -spec.size * 0.45, Math.sin(a) * spec.size * 0.25);
      leg.castShadow = true; g.add(leg); legs.push(leg);
    }
    // point light at core
    const light = new THREE.PointLight(spec.core, 0.9, 8, 2); light.position.copy(core.position); g.add(light);
    g.userData = { torso, shell, core, coreMat, bodyMat, light, legs };
    return g;
  }

  const ENEMY_TYPES = {
    drone: { key: 'drone', body: 0x171b22, core: 0xff3a1f, size: 1.15, hp: 40, speed: 4.2, dmg: 9, score: 100, melee: 1.7, radius: 0.75 },
    brute: { key: 'brute', body: 0x1a1420, core: 0xb026ff, size: 1.9, hp: 130, speed: 2.4, dmg: 20, score: 260, melee: 2.3, radius: 1.15 },
    spitter: { key: 'spitter', body: 0x101d18, core: 0x2effa6, size: 1.25, hp: 60, speed: 3.0, dmg: 12, score: 200, melee: 1.9, radius: 0.8, ranged: true, range: 22, projSpeed: 16, fireCd: 2.2 },
  };

  const Enemies = (function () {
    const pool = []; const active = [];
    // health bar sprite material
    function makeBar() {
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: 0x220000, transparent: true, opacity: 0.7, depthTest: false }));
      const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: 0xff4d4d, depthTest: false }));
      fg.position.z = 0.001; const grp = new THREE.Group(); grp.add(bg); grp.add(fg); grp.renderOrder = 999; grp.visible = false;
      return { grp, fg };
    }
    function obtain(spec) {
      let e = pool.find(p => !p.alive && p.spec.key === spec.key);
      if (!e) {
        const mesh = buildEnemyMesh(spec);
        const hitbox = new THREE.Mesh(new THREE.CylinderGeometry(spec.radius, spec.radius, spec.size * 1.4, 6), new THREE.MeshBasicMaterial({ visible: false }));
        mesh.add(hitbox);
        const bar = makeBar(); mesh.add(bar.grp); bar.grp.position.y = spec.size * 0.9;
        e = { mesh, hitbox, bar, spec, alive: false };
        hitbox.userData.enemy = e;
        pool.push(e);
      }
      return e;
    }
    const _v = new THREE.Vector3(), _sep = new THREE.Vector3(), _toP = new THREE.Vector3();
    function spawn(spec, pos) {
      const e = obtain(spec);
      e.spec = spec; e.hp = spec.hp; e.maxhp = spec.hp; e.alive = true; e.hitT = 0; e.attackCd = 0; e.fireCd = rand(0.5, spec.fireCd || 2);
      e.vy = 0; e.grounded = false; e.spawnT = 0.6; e.phase = rand(0, TAU);
      e.mesh.position.set(pos.x, spec.size * 0.6, pos.z);
      e.mesh.scale.set(0.01, 0.01, 0.01);
      e.mesh.visible = true; e.bar.grp.visible = false;
      e.mesh.userData.coreMat.emissiveIntensity = 3.0;
      if (!e.mesh.parent) scene.add(e.mesh);
      active.push(e);
      // spawn portal FX
      Particles.burst({ x: pos.x, y: 0.5, z: pos.z }, 26, { color: spec.core, spdMin: 3, spdMax: 10, upBias: 3, grav: 6, sizeMin: 0.6, sizeMax: 1.4, lifeMin: 0.4, lifeMax: 0.9 });
      Flashes.pop(new THREE.Vector3(pos.x, 1, pos.z), spec.core, 4, 0.4);
      return e;
    }
    function damage(e, dmg, crit) {
      if (!e.alive) return;
      e.hp -= dmg; e.hitT = 0.12;
      e.bar.grp.visible = true; e.bar.fg.scale.x = clamp(e.hp / e.maxhp, 0, 1);
      e.bar.fg.position.x = -0.6 * (1 - clamp(e.hp / e.maxhp, 0, 1));
      if (e.hp <= 0) kill(e);
    }
    function kill(e) {
      e.alive = false; e.mesh.visible = false;
      const p = e.mesh.position;
      Particles.burst({ x: p.x, y: p.y, z: p.z }, 40, { color: e.spec.core, spdMin: 4, spdMax: 14, sizeMin: 0.7, sizeMax: 1.8, lifeMin: 0.5, lifeMax: 1.1, grav: 12, colorJitter: true });
      Particles.burst({ x: p.x, y: p.y, z: p.z }, 18, { color: 0x222228, spdMin: 2, spdMax: 8, sizeMin: 0.5, sizeMax: 1.2, lifeMin: 0.6, lifeMax: 1.2, grav: 18 });
      Flashes.pop(p.clone(), e.spec.core, 8, 0.25);
      Audio.enemyDie();
      Game.onKill(e.spec, p);
      const idx = active.indexOf(e); if (idx >= 0) active.splice(idx, 1);
    }
    function updateBar(e) {
      e.bar.grp.quaternion.copy(camera.quaternion);
    }
    function update(dt, playerPos) {
      for (let i = active.length - 1; i >= 0; i--) {
        const e = active[i]; if (!e.alive) continue;
        const ud = e.mesh.userData; const sp = e.spec;
        // spawn scale-in
        if (e.spawnT > 0) { e.spawnT -= dt; const s = clamp(1 - e.spawnT / 0.6, 0, 1); e.mesh.scale.setScalar(s); }
        e.phase += dt;
        // hit flash
        if (e.hitT > 0) { e.hitT -= dt; ud.coreMat.emissiveIntensity = 3 + 12 * (e.hitT / 0.12); ud.bodyMat.emissive = new THREE.Color(0xffffff); ud.bodyMat.emissiveIntensity = 0.8 * (e.hitT / 0.12); }
        else { ud.bodyMat.emissiveIntensity = 0; }
        // movement toward player
        _toP.set(playerPos.x - e.mesh.position.x, 0, playerPos.z - e.mesh.position.z);
        const dist = _toP.length(); _toP.normalize();
        // separation
        _sep.set(0, 0, 0);
        for (let j = 0; j < active.length; j++) { if (j === i) continue; const o = active[j]; if (!o.alive) continue; const dx = e.mesh.position.x - o.mesh.position.x, dz = e.mesh.position.z - o.mesh.position.z; const d2 = dx * dx + dz * dz; if (d2 < 4 && d2 > 0.0001) { const d = Math.sqrt(d2); _sep.x += dx / d / d; _sep.z += dz / d / d; } }
        let vx = _toP.x * sp.speed + _sep.x * 2.2;
        let vz = _toP.z * sp.speed + _sep.z * 2.2;
        const attackRange = sp.ranged ? sp.melee : sp.melee;
        const stop = sp.ranged ? (dist < sp.range * 0.6) : (dist < sp.melee);
        if (!stop && e.spawnT <= 0) {
          e.mesh.position.x += vx * dt; e.mesh.position.z += vz * dt;
        }
        // keep in arena / avoid cover
        resolveEntity(e.mesh.position, sp.radius);
        // face player (+ bob)
        const desiredY = Math.atan2(_toP.x, _toP.z);
        e.mesh.rotation.y = lerp(e.mesh.rotation.y, desiredY, dt * 6);
        e.mesh.position.y = sp.size * 0.6 + Math.sin(e.phase * 3) * 0.08;
        ud.core.rotation.y += dt * 2; ud.shell.rotation.y -= dt * 1.2;
        updateBar(e);
        // attacks
        if (sp.ranged) {
          e.fireCd -= dt;
          if (dist < sp.range && e.fireCd <= 0 && e.spawnT <= 0) {
            e.fireCd = sp.fireCd; Projectiles.fire(e.mesh.position, playerPos, sp.projSpeed, sp.dmg, sp.core); Audio.enemyShoot();
          }
        }
        if (dist < sp.melee + 0.4) {
          e.attackCd -= dt;
          if (e.attackCd <= 0) { e.attackCd = 1.0; Game.damagePlayer(sp.dmg, e.mesh.position); }
        } else e.attackCd = Math.max(0, e.attackCd - dt);
      }
    }
    function clearAll() { for (const e of active.slice()) { e.alive = false; e.mesh.visible = false; } active.length = 0; }
    return { spawn, update, damage, active, clearAll };
  })();

  /* =========================================================================
     ENEMY PROJECTILES
     ========================================================================= */
  const Projectiles = (function () {
    const POOL = 40; const items = [];
    const geo = new THREE.SphereGeometry(0.18, 8, 8);
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x2effa6, emissive: 0x2effa6, emissiveIntensity: 3 });
      const m = new THREE.Mesh(geo, mat); m.visible = false; scene.add(m);
      items.push({ m, vel: new THREE.Vector3(), life: 0, dmg: 0 });
    }
    let h = 0; const _d = new THREE.Vector3();
    function fire(from, toPos, speed, dmg, color) {
      const it = items[h]; h = (h + 1) % POOL;
      it.m.material.color.set(color); it.m.material.emissive.set(color);
      it.m.position.set(from.x, from.y, from.z);
      _d.set(toPos.x - from.x, (toPos.y + 0.4) - from.y, toPos.z - from.z).normalize();
      it.vel.copy(_d).multiplyScalar(speed); it.life = 4; it.dmg = dmg; it.m.visible = true;
    }
    function update(dt, playerPos) {
      for (const it of items) {
        if (it.life <= 0) continue; it.life -= dt;
        it.m.position.addScaledVector(it.vel, dt);
        it.m.rotation.x += dt * 6; it.m.rotation.y += dt * 5;
        const dx = it.m.position.x - playerPos.x, dy = it.m.position.y - playerPos.y, dz = it.m.position.z - playerPos.z;
        if (dx * dx + dy * dy + dz * dz < 0.6) { Game.damagePlayer(it.dmg, it.m.position); it.life = 0; it.m.visible = false; Particles.burst(it.m.position, 12, { color: 0x2effa6, spdMin: 2, spdMax: 6, lifeMin: 0.2, lifeMax: 0.5, sizeMin: 0.4, sizeMax: 1 }); continue; }
        if (it.m.position.y < 0.1 || Math.abs(it.m.position.x) > ARENA || Math.abs(it.m.position.z) > ARENA || it.life <= 0) { it.life = 0; it.m.visible = false; }
      }
    }
    function clearAll() { for (const it of items) { it.life = 0; it.m.visible = false; } }
    return { fire, update, clearAll };
  })();

  /* =========================================================================
     COLLISION HELPERS
     ========================================================================= */
  function resolveEntity(pos, radius) {
    const lim = ARENA - radius - 0.6;
    pos.x = clamp(pos.x, -lim, lim); pos.z = clamp(pos.z, -lim, lim);
    for (const c of colliders) {
      const nx = clamp(pos.x, c.min.x, c.max.x), nz = clamp(pos.z, c.min.z, c.max.z);
      const dx = pos.x - nx, dz = pos.z - nz; const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 0.0001) { const d = Math.sqrt(d2); const push = (radius - d); pos.x += (dx / d) * push; pos.z += (dz / d) * push; }
        else { // center inside: push out nearest edge
          const left = pos.x - c.min.x, right = c.max.x - pos.x, up = pos.z - c.min.z, down = c.max.z - pos.z;
          const m = Math.min(left, right, up, down);
          if (m === left) pos.x = c.min.x - radius; else if (m === right) pos.x = c.max.x + radius;
          else if (m === up) pos.z = c.min.z - radius; else pos.z = c.max.z + radius;
        }
      }
    }
  }

  /* =========================================================================
     INPUT
     ========================================================================= */
  const input = { keys: {}, look: new THREE.Vector2(), firing: false, locked: false };
  const player = {
    pos: new THREE.Vector3(0, 1.7, 14), vel: new THREE.Vector3(), yaw: Math.PI, pitch: 0,
    onGround: true, height: 1.7, radius: 0.4, health: 100, maxHealth: 100, regenT: 0, alive: true, stepT: 0,
  };

  function onMouseMove(e) {
    if (!input.locked) return;
    const s = 0.0022;
    player.yaw -= e.movementX * s; player.pitch -= e.movementY * s;
    player.pitch = clamp(player.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
    input.look.x = e.movementX; input.look.y = e.movementY;
  }
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mousedown', (e) => {
    if (!running || paused) return;
    if (e.button === 0) { input.firing = true; if (!input.locked) requestLock(); }
    if (e.button === 2) { input.firing = false; Weapon.setADS(true); }
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.firing = false;
    if (e.button === 2) Weapon.setADS(false);
  });
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', (e) => {
    input.keys[e.code] = true;
    if (e.code === 'KeyR') Weapon.reload();
    if (e.code === 'Escape') { if (running && !paused) doPause(); }
  });
  document.addEventListener('keyup', (e) => { input.keys[e.code] = false; });

  function requestLock() { renderer.domElement.requestPointerLock && renderer.domElement.requestPointerLock(); }
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === renderer.domElement;
    if (!input.locked && running && !paused) doPause();
  });

  /* =========================================================================
     GAME STATE / WAVES / HUD
     ========================================================================= */
  let running = false, paused = false;
  let shake = 0, shakeV = new THREE.Vector3();
  const Game = (function () {
    let wave = 0, score = 0, kills = 0, spawnQueue = [], spawnTimer = 0, intermission = 0, aliveTarget = 0, crosshairSpread = 8;

    function startGame() {
      running = true; paused = false;
      wave = 0; score = 0; kills = 0; spawnQueue = []; intermission = 0; aliveTarget = 0;
      player.pos.set(0, 1.7, 18); player.vel.set(0, 0, 0); player.yaw = 0; player.pitch = 0;
      player.health = 100; player.alive = true; player.regenT = 0;
      Enemies.clearAll(); Projectiles.clearAll(); Weapon.reset();
      updateHealthHUD(); dom.scoreNum.textContent = '0';
      nextWave();
      hideAll(); requestLock();
      Audio.resume();
    }
    function nextWave() {
      wave++; dom.waveNum.textContent = wave;
      const count = 3 + Math.floor(wave * 1.7);
      spawnQueue = [];
      for (let i = 0; i < count; i++) {
        let spec = ENEMY_TYPES.drone;
        const r = Math.random();
        if (wave >= 3 && r < 0.22) spec = ENEMY_TYPES.brute;
        else if (wave >= 2 && r < 0.5) spec = ENEMY_TYPES.spitter;
        // scale hp/speed with wave
        spec = Object.assign({}, spec);
        spec.hp = Math.round(spec.hp * (1 + (wave - 1) * 0.14));
        spec.speed = spec.speed * (1 + (wave - 1) * 0.03);
        spawnQueue.push(spec);
      }
      aliveTarget = count; spawnTimer = 0;
      banner('Wave ' + wave, wave % 5 === 0 ? 'Elite Surge' : 'Hostiles Inbound');
      Audio.waveStart();
      updateEnemyLeft();
    }
    function updateEnemyLeft() { dom.enemyLeftNum.textContent = Enemies.active.length + spawnQueue.length; }

    function spawnPos() {
      // spawn near a random wall edge, away from player
      for (let tries = 0; tries < 12; tries++) {
        const edge = randInt(0, 3); let x, z;
        const m = ARENA - 3;
        if (edge === 0) { x = rand(-m, m); z = -m; } else if (edge === 1) { x = rand(-m, m); z = m; }
        else if (edge === 2) { x = -m; z = rand(-m, m); } else { x = m; z = rand(-m, m); }
        const dx = x - player.pos.x, dz = z - player.pos.z;
        if (dx * dx + dz * dz > 100) return { x, z };
      }
      return { x: rand(-20, 20), z: -ARENA + 3 };
    }

    function update(dt) {
      // spawns
      if (spawnQueue.length > 0) {
        spawnTimer -= dt;
        if (spawnTimer <= 0 && Enemies.active.length < 22) {
          const spec = spawnQueue.shift(); Enemies.spawn(spec, spawnPos());
          spawnTimer = rand(0.35, 0.8); updateEnemyLeft();
        }
      }
      // wave clear
      if (running && spawnQueue.length === 0 && Enemies.active.length === 0 && intermission <= 0) {
        intermission = 3.2; banner('Wave Cleared', 'Systems recharging'); Weapon.refill();
        player.health = Math.min(player.maxHealth, player.health + 25); updateHealthHUD();
      }
      if (intermission > 0) { intermission -= dt; if (intermission <= 0) nextWave(); }

      updateEnemyLeft();
      // crosshair spread relax
      crosshairSpread = lerp(crosshairSpread, 8 + player.vel.length() * 1.2, dt * 8);
      applyCrosshair();
    }

    const _ray = new THREE.Raycaster(); const _dir = new THREE.Vector3(); const _hitboxes = [];
    function doHitscan(dmg, spread) {
      _dir.set(0, 0, -1).applyQuaternion(camera.quaternion);
      // apply spread
      _dir.x += rand(-spread, spread); _dir.y += rand(-spread, spread); _dir.z += rand(-spread, spread); _dir.normalize();
      _ray.set(camera.getWorldPosition(new THREE.Vector3()), _dir); _ray.far = 120;
      _hitboxes.length = 0; for (const e of Enemies.active) if (e.alive) _hitboxes.push(e.hitbox);
      const hits = _ray.intersectObjects(_hitboxes, false);
      const muzzle = Weapon.muzzleWorld().clone();
      if (hits.length) {
        const hit = hits[0]; const e = hit.object.userData.enemy;
        // headshot if upper portion
        const localY = hit.point.y - e.mesh.position.y;
        const crit = localY > e.spec.size * 0.35;
        const finalDmg = crit ? dmg * 2 : dmg;
        Enemies.damage(e, finalDmg, crit);
        Tracers.fire(muzzle, hit.point);
        Particles.burst(hit.point, crit ? 16 : 10, { color: e.spec.core, spdMin: 3, spdMax: 9, sizeMin: 0.4, sizeMax: 1.1, lifeMin: 0.2, lifeMax: 0.5, grav: 8, upBias: 1 });
        Flashes.pop(hit.point, e.spec.core, 3, 0.08);
        Audio.hit(crit); hitmarker(crit);
        if (crit) popup(hit.point, 'CRIT', 0xffb020);
      } else {
        // trace to a far point along the ray
        const end = _ray.ray.at(60, new THREE.Vector3());
        Tracers.fire(muzzle, end);
      }
    }

    function onKill(spec, pos) {
      kills++; const gained = spec.score;
      score += gained; dom.scoreNum.textContent = score.toLocaleString();
      addKillFeed(spec, false); popup(pos, '+' + gained, 0x37e6ff);
      addShake(0.08);
    }
    function damagePlayer(dmg, fromPos) {
      if (!player.alive) return;
      player.health -= dmg; player.regenT = 0;
      Audio.hurt(); addShake(0.18 + dmg * 0.006); flashDamage(dmg); damageDir(fromPos);
      updateHealthHUD();
      if (player.health <= 0) { player.health = 0; updateHealthHUD(); die(); }
    }
    function die() {
      player.alive = false; running = false; input.firing = false;
      document.exitPointerLock && document.exitPointerLock();
      dom.goWave.textContent = wave; dom.goScore.textContent = score.toLocaleString(); dom.goKills.textContent = kills;
      setTimeout(() => { dom.gameover.classList.remove('hidden'); }, 700);
    }
    function addShake(a) { shake = Math.min(shake + a, 0.8); }
    function crosshairKick() { crosshairSpread = Math.min(crosshairSpread + 10, 34); }
    function applyCrosshair() {
      const s = crosshairSpread; const c = dom.crosshair;
      c.querySelector('.t').style.transform = `translateX(-1px) translateY(${-s}px)`;
      c.querySelector('.b').style.transform = `translateX(-1px) translateY(${s}px)`;
      c.querySelector('.l').style.transform = `translateY(-1px) translateX(${-s}px)`;
      c.querySelector('.r').style.transform = `translateY(-1px) translateX(${s}px)`;
    }
    return { startGame, update, doHitscan, onKill, damagePlayer, addShake, crosshairKick, nextWave,
      get score() { return score; }, get wave() { return wave; }, get kills() { return kills; } };
  })();

  // HUD helpers
  function updateHealthHUD() {
    const pct = clamp(player.health / player.maxHealth, 0, 1) * 100;
    dom.healthFill.style.width = pct + '%'; dom.healthNum.textContent = Math.ceil(player.health);
    dom.healthFill.classList.toggle('low', player.health < 35);
  }
  function banner(big, sub) {
    dom.bannerBig.textContent = big; dom.bannerSub.textContent = sub;
    dom.banner.style.transition = 'none'; dom.banner.style.opacity = '1'; dom.banner.style.transform = 'translateY(0)';
    // eslint-disable-next-line
    void dom.banner.offsetWidth;
    dom.banner.style.transition = 'opacity 1.4s ease 0.8s';
    dom.banner.style.opacity = '0';
  }
  function addKillFeed(spec, crit) {
    const d = document.createElement('div'); d.className = crit ? 'crit' : '';
    d.textContent = '⌁ ' + (spec.key === 'brute' ? 'BRUTE' : spec.key === 'spitter' ? 'SPITTER' : 'DRONE') + ' terminated';
    dom.killfeed.appendChild(d); setTimeout(() => d.remove(), 2600);
    while (dom.killfeed.children.length > 5) dom.killfeed.removeChild(dom.killfeed.firstChild);
  }
  const _pv = new THREE.Vector3();
  function popup(worldPos, text, color) {
    _pv.copy(worldPos).project(camera);
    if (_pv.z > 1) return;
    const x = (_pv.x * 0.5 + 0.5) * window.innerWidth, y = (-_pv.y * 0.5 + 0.5) * window.innerHeight;
    const d = document.createElement('div'); d.textContent = text; d.style.left = x + 'px'; d.style.top = y + 'px';
    d.style.color = '#' + new THREE.Color(color).getHexString(); dom.popups.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  }
  let hmT = 0;
  function hitmarker(crit) { dom.hitmarker.classList.toggle('kill', crit); dom.hitmarker.style.opacity = '1'; hmT = 0.14; }
  function flashDamage(dmg) {
    const a = clamp(dmg / 30, 0.2, 0.9);
    dom.vignette.style.transition = 'none'; dom.vignette.style.boxShadow = `inset 0 0 200px 50px rgba(255,20,20,${a})`;
    void dom.vignette.offsetWidth; dom.vignette.style.transition = 'box-shadow 0.4s ease'; dom.vignette.style.boxShadow = 'inset 0 0 200px 40px rgba(255,20,20,0)';
  }
  const _df = new THREE.Vector3();
  function damageDir(fromPos) {
    _df.subVectors(fromPos, player.pos); const ang = Math.atan2(_df.x, -_df.z) - player.yaw;
    // (visual arc omitted in baseline; vignette conveys damage)
  }
  function lowHealthPulse(t) {
    if (player.health < 35 && player.alive) {
      const a = (0.25 + 0.2 * Math.sin(t * 6)) * (1 - player.health / 35);
      dom.vignette.style.transition = 'none';
      dom.vignette.style.boxShadow = `inset 0 0 200px 40px rgba(255,20,20,${a})`;
    }
  }

  /* =========================================================================
     PLAYER MOVEMENT
     ========================================================================= */
  const _forward = new THREE.Vector3(), _right = new THREE.Vector3(), _wish = new THREE.Vector3();
  function updatePlayer(dt) {
    if (!player.alive) return;
    // orientation from yaw/pitch
    camera.rotation.set(0, 0, 0);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;

    _forward.set(Math.sin(player.yaw), 0, Math.cos(player.yaw)); // note: -z forward handled below
    // In THREE, forward is -z. Build movement basis:
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    let ix = 0, iz = 0;
    if (input.keys['KeyW']) iz += 1; if (input.keys['KeyS']) iz -= 1;
    if (input.keys['KeyD']) ix += 1; if (input.keys['KeyA']) ix -= 1;
    _wish.set(fx * iz + rx * ix, 0, fz * iz + rz * ix);
    if (_wish.lengthSq() > 0) _wish.normalize();
    const sprint = input.keys['ShiftLeft'] || input.keys['ShiftRight'];
    const speed = (Weapon.st.ads ? 4.0 : (sprint ? 9.2 : 6.3));
    const accel = player.onGround ? 60 : 12;
    player.vel.x = lerp(player.vel.x, _wish.x * speed, clamp(accel * dt, 0, 1));
    player.vel.z = lerp(player.vel.z, _wish.z * speed, clamp(accel * dt, 0, 1));

    // jump / gravity
    if ((input.keys['Space']) && player.onGround) { player.vel.y = 7.4; player.onGround = false; }
    player.vel.y -= 22 * dt;

    player.pos.x += player.vel.x * dt; player.pos.z += player.vel.z * dt; player.pos.y += player.vel.y * dt;
    if (player.pos.y <= player.height) { player.pos.y = player.height; player.vel.y = 0; player.onGround = true; }
    resolveEntity(player.pos, player.radius);

    // footsteps
    const horiz = Math.hypot(player.vel.x, player.vel.z);
    if (player.onGround && horiz > 1.5) { player.stepT -= dt; if (player.stepT <= 0) { Audio.step(); player.stepT = sprint ? 0.32 : 0.42; } }

    // head bob
    const bob = player.onGround && horiz > 1 ? Math.sin(performance.now() * 0.008 * (sprint ? 1.4 : 1)) * 0.035 : 0;
    camera.position.copy(player.pos); camera.position.y += bob;

    // shake
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 2.2);
      const a = shake * 0.5;
      shakeV.set(rand(-a, a), rand(-a, a), 0);
      camera.position.add(shakeV);
      camera.rotation.z = rand(-a, a) * 0.15;
    } else camera.rotation.z = 0;

    // health regen
    player.regenT += dt;
    if (player.regenT > 4 && player.health < player.maxHealth && player.alive) {
      player.health = Math.min(player.maxHealth, player.health + 14 * dt); updateHealthHUD();
    }
    return { moving: horiz > 1, speed: horiz };
  }

  /* =========================================================================
     MAIN LOOP
     ========================================================================= */
  let last = performance.now(); const clock = { t: 0 };
  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now(); let dt = (now - last) / 1000; last = now;
    dt = Math.min(dt, 0.05); clock.t += dt;

    // pulse neon lights subtly
    for (let i = 0; i < neonLights.length; i++) neonLights[i].intensity = 0.7 + 0.25 * Math.sin(clock.t * 2 + i);

    if (running && !paused) {
      const mv = updatePlayer(dt) || { moving: false, speed: 0 };
      Weapon.update(dt, mv.moving, Math.max(mv.speed, 3));
      Enemies.update(dt, player.pos);
      Projectiles.update(dt, player.pos);
      Game.update(dt);
      lowHealthPulse(clock.t);
    } else {
      // idle camera when in menu
      camera.position.copy(player.pos);
      camera.rotation.order = 'YXZ'; camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
    }

    Particles.update(dt); Tracers.update(dt); Flashes.update(dt);
    if (hmT > 0) { hmT -= dt; if (hmT <= 0) dom.hitmarker.style.opacity = '0'; }

    composer.render();
  }

  /* =========================================================================
     UI WIRING
     ========================================================================= */
  function hideAll() { dom.start.classList.add('hidden'); dom.pause.classList.add('hidden'); dom.gameover.classList.add('hidden'); }
  function doPause() { paused = true; document.exitPointerLock && document.exitPointerLock(); dom.pause.classList.remove('hidden'); }
  function doResume() { dom.pause.classList.add('hidden'); paused = false; requestLock(); last = performance.now(); }

  dom.startBtn.addEventListener('click', () => { Audio.resume(); Game.startGame(); });
  dom.resumeBtn.addEventListener('click', () => { Audio.ui(); doResume(); });
  dom.retryBtn.addEventListener('click', () => { Audio.resume(); Game.startGame(); });

  /* =========================================================================
     BOOT
     ========================================================================= */
  buildWorld();
  // preview camera pose for menu
  player.pos.set(0, 1.7, 18); player.yaw = 0; player.pitch = -0.03;
  camera.position.copy(player.pos);
  Weapon.updateAmmoHUD();
  dom.loading.classList.add('hidden');
  dom.start.classList.remove('hidden');
  loop();

  // expose a tiny hook for automated screenshots / critics
  window.__GAUNTLET = {
    autostart() { Game.startGame(); },
    state() { return { running, paused, wave: Game.wave, score: Game.score, enemies: Enemies.active.length, health: player.health }; },
    spawnWaveNow() { Game.nextWave(); },
    look(dyaw, dpitch) { player.yaw += dyaw; player.pitch = clamp(player.pitch + dpitch, -1.5, 1.5); },
    setPitch(p) { player.pitch = clamp(p, -1.5, 1.5); },
    // Aim at the nearest hostile — lets automated screenshots frame real combat.
    aimNearest() {
      let best = null, bd = 1e9;
      for (const e of Enemies.active) { if (!e.alive) continue; const dx = e.mesh.position.x - player.pos.x, dz = e.mesh.position.z - player.pos.z; const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = e; } }
      if (!best) return false;
      const dx = best.mesh.position.x - player.pos.x, dy = best.mesh.position.y - player.pos.y, dz = best.mesh.position.z - player.pos.z;
      player.yaw = Math.atan2(-dx, -dz); player.pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -1.5, 1.5);
      return true;
    },
    fireOnce() { Weapon.tryFire(); },
  };
})();
