/* =============================================================================
   JODY JONES — CANYON RIVER SHOOTOUT
   A first-person cinematic space in the "CCC" graphic-novel look:
   cel-shaded broad color masses, navy ink outlines, midnight-blue lower canyon
   burning to amber cliff-tops, a stylized rushing river, and outlaws peeking
   from cover across the water. Environment-first: systems stay deliberately thin.
   All geometry, textures, and sound are generated in code — no external assets.
   ============================================================================= */
(function () {
  const THREE = window.THREE;
  const $ = (id) => document.getElementById(id);
  const dom = {
    stage: $('stage'), loading: $('loading'), title: $('title'), startBtn: $('startBtn'),
    hud: $('hud'), rounds: $('rounds'), reloadTag: $('reloadTag'), nerveFill: $('nerveFill'),
    hitflash: $('hitflash'), steerHint: $('steerHint'),
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  // Seeded RNG so the canyon is a FIXED, art-directed layout (not a new random one per load).
  let _seed = 1337 >>> 0;
  function srand() {
    _seed = (_seed + 0x6D2B79F5) | 0;
    let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rnd = (a, b) => a + srand() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));

  /* ----- palette — locked to the CCC art bible (docs/ART_BIBLE.md) --------- */
  const COL = {
    ink: 0x0b1120,
    deep: 0x0e1626, indigo: 0x14203a, steel: 0x2a3d63,
    vermillion: 0xb04a29, vermillionHi: 0xd76a2f,
    amber: 0xe89440, amberHi: 0xf4b45e, ivory: 0xecdfc4, olive: 0x555c37,
    rockShadow: 0x162238, rockMid: 0x9c4a2c, rockWarm: 0xc85f30, rockWet: 0x101a2e,
    sand: 0x6a4d30, sandLit: 0x9a6a38,
    muzzle: 0xffb163,
    waterDeep: 0x0f1c34, waterLit: 0x24456f, waterSun: 0xf0993e, foam: 0xd8e2ec,
    skin: 0x9a6a45, cloth: 0x172038, clothDust: 0x3a3a48,
    hat: 0x0c1020, leather: 0x3a2416,
    reed: 0x101828, wood: 0x2a1c12,
    skyLow: 0xe89a52, skyMid: 0x8a5a55, skyHigh: 0x141f38,
  };

  /* =========================================================================
     TIME OF DAY — the two canonical looks from the reference art, as swappable
     tokens. Add ?night to the URL (or TOD.set('night')) for the silver-moon version.
     ========================================================================= */
  const TOD_PRESETS = {
    dusk: {
      key: 0xffc287, keyIntensity: 1.95, keyPos: [-46, 92, 40],
      skyFill: 0x41608f, ground: 0x0e1728, hemi: 0.78,
      ambient: 0x22355e, ambientI: 0.46,
      fill: 0x5a7dc0, fillI: 0.34, bounce: 0x2c4a76, bounceI: 0.22,
      fog: 0x33344f, fogDensity: 0.0115,
      sky: [0xe89a52, 0x8a5a55, 0x141f38],
      river: 0xf0993e,
      grade: { shadow: 0x1b2a4e, light: 0xffd7a2, tint: 0.34, sat: 1.24 },
      mist: [0xe0925a, 0xc07c58, 0x74849f, 0x4a5c85], mistI: 1.0,
      bloom: 0.35,
    },
    night: {
      // Moonlight: a cold, hard key. Everything reads midnight navy except the
      // silver river reflection and whatever the gunfire lights.
      key: 0xb3ccf5, keyIntensity: 1.5, keyPos: [-40, 96, 30],
      skyFill: 0x2b4a86, ground: 0x070b14, hemi: 0.52,
      ambient: 0x18274f, ambientI: 0.42,
      fill: 0x3f5f9c, fillI: 0.20, bounce: 0x1c3157, bounceI: 0.16,
      fog: 0x16203a, fogDensity: 0.0095,
      sky: [0x40567f, 0x22304f, 0x080d1c],
      river: 0xcfe0f5,
      grade: { shadow: 0x101d3c, light: 0xcadcf6, tint: 0.42, sat: 1.10 },
      mist: [0x50699c, 0x44578a, 0x36466e, 0x27334f], mistI: 0.85,
      bloom: 0.5,
    },
  };
  const TOD_NAME = location.search.indexOf('night') >= 0 ? 'night' : 'dusk';
  const TOD = TOD_PRESETS[TOD_NAME];

  /* =========================================================================
     RENDERER / SCENE / CAMERA
     ========================================================================= */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  // Flat graphic color: no sRGB output curve + no tonemapping => authored hex renders as-is.
  // (This build predates ColorManagement, so sRGB output would lift/desaturate the flats.)
  renderer.outputEncoding = THREE.LinearEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  // Real shadows: the single biggest cue that objects sit IN the world rather than on it.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  dom.stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(TOD.sky[2]);
  scene.fog = new THREE.FogExp2(TOD.fog, TOD.fogDensity);   // aerial perspective

  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 900);
  const CAM_BASE = new THREE.Vector3(0, 1.9, 8.0);   // standing behind the boulder, looking over it
  camera.position.copy(CAM_BASE);

  const composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), TOD.bloom, 0.7, 0.82);
  if (location.search.indexOf('nobloom') >= 0) bloom.strength = 0;
  composer.addPass(bloom);

  // ILLUSTRATION GRADE — the step that turns a realistic render into a rendered
  // illustration. Real lighting/shadow does the sculpting; this quantises luminance into
  // paint-like bands, pushes shadows toward midnight navy and lights toward burnt
  // vermillion/ivory, and lifts saturation. Palette per docs/ART_BIBLE.md.
  const gradePass = new THREE.ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uBands: { value: 7.0 },        // luminance steps (lower = flatter//more graphic)
      uMix: { value: 0.72 },         // how strongly to posterize
      uSat: { value: TOD.grade.sat },
      uShadowTint: { value: new THREE.Color(TOD.grade.shadow) },
      uLightTint: { value: new THREE.Color(TOD.grade.light) },
      uTint: { value: TOD.grade.tint },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:
      'uniform sampler2D tDiffuse; uniform float uBands; uniform float uMix; uniform float uSat;\n' +
      'uniform vec3 uShadowTint; uniform vec3 uLightTint; uniform float uTint; varying vec2 vUv;\n' +
      'float lum(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }\n' +
      'void main(){\n' +
      '  vec3 c = texture2D(tDiffuse, vUv).rgb;\n' +
      '  float l = max(lum(c), 1e-4);\n' +
      '  // quantise luminance but keep chroma — flat paint masses, hue preserved\n' +
      '  float q = floor(l * uBands + 0.5) / uBands;\n' +
      '  vec3 post = c * (q / l);\n' +
      '  c = mix(c, post, uMix);\n' +
      '  // duotone push: shadows to navy, lights to warm — the CCC separation\n' +
      '  float t = smoothstep(0.06, 0.72, lum(c));\n' +
      '  vec3 tinted = c * mix(uShadowTint * 2.6, uLightTint, t);\n' +
      '  c = mix(c, tinted, uTint);\n' +
      '  // saturation lift so the palette reads as ink-and-paint, not photography\n' +
      '  c = clamp(mix(vec3(lum(c)), c, uSat), 0.0, 1.0);\n' +
      '  gl_FragColor = vec4(c, 1.0);\n' +
      '}',
  });
  composer.addPass(gradePass);

  // Full-screen INK pass — Sobel edge detect on the rendered frame draws navy comic
  // outlines at every silhouette + color boundary. This is what sells the graphic-novel look.
  const inkPass = new THREE.ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uRes: { value: new THREE.Vector2(innerWidth, innerHeight) },
      uStrength: { value: 0.80 }, uThreshold: { value: 0.30 },
      uInk: { value: new THREE.Color(0x0a1020) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:
      'uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uStrength; uniform float uThreshold; uniform vec3 uInk; varying vec2 vUv;\n' +
      'float lum(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }\n' +
      'void main(){\n' +
      '  vec2 px = 1.0/uRes;\n' +
      '  float tl=lum(texture2D(tDiffuse,vUv+px*vec2(-1.,-1.)).rgb), t=lum(texture2D(tDiffuse,vUv+px*vec2(0.,-1.)).rgb), tr=lum(texture2D(tDiffuse,vUv+px*vec2(1.,-1.)).rgb);\n' +
      '  float l=lum(texture2D(tDiffuse,vUv+px*vec2(-1.,0.)).rgb), r=lum(texture2D(tDiffuse,vUv+px*vec2(1.,0.)).rgb);\n' +
      '  float bl=lum(texture2D(tDiffuse,vUv+px*vec2(-1.,1.)).rgb), bm=lum(texture2D(tDiffuse,vUv+px*vec2(0.,1.)).rgb), br=lum(texture2D(tDiffuse,vUv+px*vec2(1.,1.)).rgb);\n' +
      '  float gx = -tl -2.0*l -bl + tr + 2.0*r + br;\n' +
      '  float gy = -tl -2.0*t -tr + bl + 2.0*bm + br;\n' +
      '  float mag = sqrt(gx*gx + gy*gy);\n' +
      '  float edge = smoothstep(uThreshold, uThreshold+0.45, mag);\n' +
      '  vec4 base = texture2D(tDiffuse, vUv);\n' +
      '  // never draw ink INSIDE a glow (muzzle flashes, sun glints) — a soft radial\n' +
      '  // otherwise picks up a dark Sobel ring and reads as a dirty disc.\n' +
      '  edge *= 1.0 - smoothstep(0.50, 0.86, lum(base.rgb));\n' +
      '  gl_FragColor = vec4(mix(base.rgb, uInk, edge*uStrength), base.a);\n' +
      '}',
  });
  composer.addPass(inkPass);

  /* =========================================================================
     CEL-SHADING HELPERS  (toon ramp, toon material, ink outline)
     ========================================================================= */
  function toonRamp(levels) {
    // Explicit lightness stops → punchy comic bands (deep shadow, mid, light).
    const c = document.createElement('canvas'); c.width = levels.length; c.height = 1;
    const ctx = c.getContext('2d');
    for (let i = 0; i < levels.length; i++) { ctx.fillStyle = 'rgb(' + levels[i] + ',' + levels[i] + ',' + levels[i] + ')'; ctx.fillRect(i, 0, 1, 1); }
    const t = new THREE.CanvasTexture(c);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return t;
  }
  const RAMP = toonRamp([46, 120, 205, 255]);   // hero objects
  const RAMP_SOFT = toonRamp([70, 150, 255]);   // terrain
  const RAMP_METAL = toonRamp([40, 95, 150, 195]); // dark metal — never blows to white
  function toonMetal(color, opts) { return new THREE.MeshToonMaterial(Object.assign({ color: color, gradientMap: RAMP_METAL }, opts || {})); }

  // Lit, shadow-capable surfaces. The illustrated read comes from the palette + the
  // posterize/ink post passes, NOT from flattening the lighting itself.
  function toon(color, opts) {
    const o = Object.assign({ color: color, roughness: 0.95, metalness: 0.0 }, opts || {});
    delete o.gradientMap;
    return new THREE.MeshStandardMaterial(o);
  }
  function toonSoft(color, opts) {
    const o = Object.assign({ color: color, roughness: 1.0, metalness: 0.0 }, opts || {});
    delete o.gradientMap;
    return new THREE.MeshStandardMaterial(o);
  }
  // Mark a mesh (and children) as participating in shadows.
  function shad(m, cast, receive) {
    m.traverse((o) => { if (o.isMesh) { o.castShadow = cast !== false; o.receiveShadow = receive !== false; } });
    return m;
  }

  // Clip-space inverted-hull ink outline — uniform screen-width navy line.
  const inkMats = [];
  function inkMaterial(px, color) {
    const m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color == null ? COL.ink : color) }, uThick: { value: px }, uAspect: { value: innerWidth / innerHeight } },
      vertexShader:
        'uniform float uThick; uniform float uAspect;\n' +
        'void main(){\n' +
        '  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position,1.0);\n' +
        '  vec3 cn = normalize((projectionMatrix * vec4(normalMatrix * normal, 0.0)).xyz);\n' +
        '  vec2 off = cn.xy; off.x /= uAspect;\n' +
        '  clip.xy += off * uThick * clip.w;\n' +
        '  gl_Position = clip;\n' +
        '}',
      fragmentShader: 'uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor,1.0); }',
      side: THREE.BackSide, fog: false,
    });
    inkMats.push(m);
    return m;
  }
  // Attach an ink shell around a mesh (or group of meshes sharing geometry).
  function ink(mesh, px) {
    const shell = new THREE.Mesh(mesh.geometry, inkMaterial(px == null ? 0.0045 : px));
    shell.renderOrder = (mesh.renderOrder || 0) - 1;
    mesh.add(shell);
    return mesh;
  }

  /* =========================================================================
     PROCEDURAL TEXTURES (subtle — CCC keeps surfaces broad, not noisy)
     ========================================================================= */
  function softDot(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, inner); g.addColorStop(0.5, outer); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  // Hard-edged comic star-burst muzzle flash (a soft glow reads as a dirty disc and
  // picks up ink rings; the illustrated look wants crisp spikes).
  function burstTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); const cx = 64, cy = 64;
    function star(spikes, rOuter, rInner, fill, rot) {
      x.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const a = rot + (i * Math.PI) / spikes;
        const r = i % 2 === 0 ? rOuter : rInner;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.closePath(); x.fillStyle = fill; x.fill();
    }
    star(7, 62, 20, '#e8842a', 0.15);          // outer amber spikes
    star(7, 44, 15, '#f4b45e', 0.15);          // mid
    star(6, 26, 11, '#fff0cf', 0.5);           // ivory hot core
    return new THREE.CanvasTexture(c);
  }
  // --- Procedural normal map from a height function (gives rock real relief) ---
  function normalMapFrom(size, heightFn, strength, repeat) {
    const H = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) H[y * size + x] = heightFn(x / size, y / size);
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size);
    const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    return t;
  }
  function vnoise(x, y) {   // cheap value noise (seeded, deterministic)
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const h = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
  }
  function fbm(x, y, oct) {
    let s = 0, a = 0.5, fx = x, fy = y;
    for (let k = 0; k < (oct || 4); k++) { s += a * vnoise(fx, fy); fx *= 2.03; fy *= 2.01; a *= 0.5; }
    return s;
  }
  // 3D value noise — needed so rock displacement is a function of DIRECTION, which keeps
  // duplicated vertices (Icosahedron is non-indexed) in agreement instead of tearing.
  function vnoise3(x, y, z) {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
    const fx = x - i, fy = y - j, fz = z - k;
    const h = (a, b, c) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(h(i, j, k), h(i + 1, j, k), u), l(h(i, j + 1, k), h(i + 1, j + 1, k), u), v),
      l(l(h(i, j, k + 1), h(i + 1, j, k + 1), u), l(h(i, j + 1, k + 1), h(i + 1, j + 1, k + 1), u), v), w);
  }
  function fbm3(x, y, z, oct) {
    let s = 0, a = 0.5, m = 1;
    for (let n = 0; n < (oct || 4); n++) { s += a * vnoise3(x * m, y * m, z * m); m *= 2.02; a *= 0.5; }
    return s;
  }

  const TEX = {
    // Sedimentary strata: strong horizontal bedding lines + grain between them.
    // Mostly isotropic rock blotching. Box faces map UVs in different orientations, so a
    // strongly directional pattern reads as wood grain on half the faces.
    rockNormal: normalMapFrom(256, (u, v) => {
      const warp = fbm(u * 1.5, v * 1.5, 4) * 2.4;
      const bedding = (Math.sin(v * 6 + warp) * 0.5 + 0.5) * 0.55;    // broad sedimentary bedding
      return bedding + fbm(u * 2.5, v * 2.5, 5) * 1.15 + fbm(u * 8, v * 8, 4) * 0.28;
    }, 9, [1, 1]),
    // Coarser, blockier relief for boulders and banks.
    stoneNormal: normalMapFrom(256, (u, v) =>
      fbm(u * 7, v * 7, 5) * 1.0 + fbm(u * 24, v * 24, 4) * 0.35, 20, [2, 2]),
    flash: burstTexture(),
    smoke: softDot('rgba(120,130,150,0.5)', 'rgba(70,80,110,0.22)'),
    splash: softDot('rgba(220,232,244,0.95)', 'rgba(150,180,210,0.35)'),
    glow: softDot('rgba(255,190,110,0.9)', 'rgba(255,120,40,0.3)'),
  };

  /* =========================================================================
     ROCK / BOULDER GEOMETRY  (chunky faceted masses)
     ========================================================================= */
  // Fractured river boulder. Displacement is a deterministic function of the vertex
  // DIRECTION (not per-vertex random), so the duplicated verts of a non-indexed
  // icosahedron stay welded — random jitter tore them into glass shards.
  function rockGeo(radius, squashY, jitter, seed) {
    const g = new THREE.IcosahedronGeometry(radius, 3);
    const p = g.attributes.position;
    const s = seed == null ? rnd(0, 40) : seed;
    const v = new THREE.Vector3();
    const amt = jitter == null ? 0.28 : jitter;
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i));
      const d = v.clone().normalize();
      // big lumpy masses + medium bevels, then quantised into flat fracture planes
      let n = fbm3(d.x * 1.5 + s, d.y * 1.5 + s, d.z * 1.5 + s, 3) - 0.5;
      n += (fbm3(d.x * 3.6 + s, d.y * 3.6 + s, d.z * 3.6 + s, 3) - 0.5) * 0.5;
      const facets = 5;
      n = Math.round(n * facets) / facets;                 // hard planes, like cleaved stone
      n += (fbm3(d.x * 9 + s, d.y * 9 + s, d.z * 9 + s, 2) - 0.5) * 0.12;  // slight surface break-up
      const scale = 1 + n * amt * 2.4;
      v.multiplyScalar(scale);
      v.y *= squashY;
      v.y = Math.max(v.y, -radius * squashY * 0.62);       // flatten the buried underside
      p.setXYZ(i, v.x, v.y, v.z);
    }
    p.needsUpdate = true; g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
  function makeRock(radius, mat, opts) {
    opts = opts || {};
    const geo = rockGeo(radius, opts.squashY == null ? 0.7 : opts.squashY, opts.jitter == null ? 0.28 : opts.jitter);
    const m = new THREE.Mesh(geo, mat);
    m.material.flatShading = true;
    if (m.material.isMeshStandardMaterial && !m.material.normalMap) {
      m.material.normalMap = TEX.stoneNormal; m.material.normalScale = new THREE.Vector2(0.28, 0.28);
    }
    m.material.needsUpdate = true;
    m.castShadow = true; m.receiveShadow = true;
    if (opts.ink !== false) ink(m, opts.ink || 0.004);
    return m;
  }

  /* =========================================================================
     LIGHTING  — cool shadow world, one low warm sun for rim + cliff glow
     ========================================================================= */
  // Kept deliberately low-sum: lit toon surfaces must not exceed 1.0 or the authored
  // flat colors clip toward white and the graphic palette is lost.
  const hemi = new THREE.HemisphereLight(TOD.skyFill, TOD.ground, TOD.hemi); scene.add(hemi);
  scene.add(new THREE.AmbientLight(TOD.ambient, TOD.ambientI));
  // The one warm key: low and raking from upstream-left, so it throws long shadows
  // ACROSS the far bank toward the viewer.
  const sun = new THREE.DirectionalLight(TOD.key, TOD.keyIntensity);
  sun.position.set(TOD.keyPos[0], TOD.keyPos[1], TOD.keyPos[2]);  // high, clears the canyon rim
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -70; sc.right = 70; sc.top = 56; sc.bottom = -30; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0016; sun.shadow.normalBias = 0.045;
  sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  sun.target.position.set(4, 4, -24);
  // SHADOW FLAG: an occluder parked behind the camera (never in frame) that blocks the
  // key from the near bank only. Per the brief, Jody is down in the canyon's shadow while
  // the far wall still burns — one directional light can't do both, so we flag it.
  (function shadowFlag() {
    const f = new THREE.Mesh(new THREE.BoxGeometry(78, 3, 34), new THREE.MeshBasicMaterial());
    f.position.set(-16, 30, 30);      // behind the camera (camera sits at z = +8)
    f.castShadow = true; f.receiveShadow = false;
    f.material.colorWrite = false; f.renderOrder = -999;
    scene.add(f);
  })();
  const coolFill = new THREE.DirectionalLight(TOD.fill, TOD.fillI); // sky fill from above
  coolFill.position.set(14, 26, 22); scene.add(coolFill);
  const bounce = new THREE.DirectionalLight(TOD.bounce, TOD.bounceI);  // river bounce
  bounce.position.set(0, -6, 12); scene.add(bounce);

  /* =========================================================================
     CANYON WALLS  — enormous, vertex-colored indigo→amber, narrow sky
     ========================================================================= */

  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // Canyon wall color as a function of absolute world height + how sunlit the column is.
  // Navy shadow at the floor → burnt-vermillion sunlit faces → amber/ivory blazing tops.
  // worldY: absolute height (drives navy -> vermillion). topY: this column's own summit,
  // so the amber/ivory sun blaze is a NARROW rim on the highest rock rather than a
  // huge white mass (which read as pale slivers on edge-on walls).
  // ALBEDO ONLY — the rock's own sandstone colour. Shadow/warmth is produced by the
  // lighting rig (warm key + blue sky fill), not baked in here; baking it made every
  // surface go black once real lighting multiplied on top.
  const ALB_DEEP = new THREE.Color(0x6f3a22);   // damp lower sandstone
  const ALB_MID = new THREE.Color(0x9c5330);    // burnt vermillion body
  const ALB_HI = new THREE.Color(0xbe7442);     // sun-bleached upper rock
  function cliffColor(worldY, lit, topY) {
    const h = clamp(worldY / 60, 0, 1);
    const c = ALB_DEEP.clone().lerp(ALB_MID, smoothstep(0.02, 0.42, h));
    c.lerp(ALB_HI, smoothstep(0.45, 0.95, h) * 0.9);
    if (topY != null) {
      const fromTop = topY - worldY;
      c.lerp(ALB_HI, smoothstep(10, 1, fromTop) * 0.35);      // weathered summits
    }
    // per-column mineral variation so neighbouring columns don't read as one flat mass
    return c.multiplyScalar(0.82 + 0.30 * lit);
  }
  // A canyon wall built from faceted vertical COLUMNS (columnar sandstone) — each a flat
  // color mass with hard edges to its neighbours, jagged tops biting into the sky strip.
  function buildCliff(width, height, cols, origin, dir, depthAmt, opts) {
    opts = opts || {};
    const group = new THREE.Group();
    const colW = width / cols;
    for (let i = 0; i < cols; i++) {
      const cx = -width / 2 + (i + 0.5) * colW;
      const w = colW * rnd(1.10, 1.34);   // always overlap the neighbour — a gap shows sky as a bright sliver
      const prof = opts.profile ? opts.profile(i / (cols - 1)) : 1;
      const h = height * prof * (0.6 + 0.4 * (0.5 + 0.5 * Math.sin(i * 1.7) + 0.28 * Math.sin(i * 0.6 + 1.1)));
      const d = rnd(0.9, depthAmt);
      const lit = clamp(0.5 + 0.5 * Math.sin(i * 0.7 + 1.0) + 0.22 * Math.sin(i * 2.9) + (opts.warm || 0), 0, 1);
      const geo = new THREE.BoxGeometry(w, h, d, 1, 4, 1);
      const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
      for (let k = 0; k < pos.count; k++) {
        const wy = origin.y + h / 2 + pos.getY(k);   // absolute world height of this vertex
        c.copy(cliffColor(wy, lit, origin.y + h));
        colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      // LIT now (was unlit): the baked vertex colors act as albedo and real light +
      // shadow does the sculpting, which is what gives the rock volume.
      // Scale UVs to WORLD size so texel density is uniform. Box faces are 0..1 regardless
      // of their real dimensions, which stretched the rock texture into vertical scratches
      // on tall columns.
      const uv = geo.attributes.uv;
      const TEXEL = 17.0;  // world units per texture tile (big rock forms, not pebbles)
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (w / TEXEL), uv.getY(k) * (h / TEXEL));
      uv.needsUpdate = true;
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.97, metalness: 0.0, flatShading: true,
        normalMap: TEX.rockNormal, normalScale: new THREE.Vector2(0.34, 0.34), fog: true,
      }));
      m.position.set(cx, h / 2, rnd(-0.5, 0.5) * depthAmt);
      m.frustumCulled = false;
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
    }
    group.position.copy(origin); group.rotation.y = dir;
    return group;
  }
  const FLOOR = -2.4;   // canyon floor / waterline height
  const cliffs = new THREE.Group();
  // Far wall closing the canyon behind the enemies — capped so a warm sky strip reads above.
  cliffs.add(buildCliff(210, 30, 40, new THREE.Vector3(0, FLOOR, -34), 0, 5));
  // Side walls: brought in so they rise on the left/right BEHIND the far bank, leaving a
  // central sky gap (the canyon opening) — the gang-on-the-bank composition.
  cliffs.add(buildCliff(150, 58, 17, new THREE.Vector3(-44, FLOOR, -4), Math.PI / 2 + 0.05, 12, { warm: 0.5 }));   // left wall catches the sun
  cliffs.add(buildCliff(150, 58, 17, new THREE.Vector3(44, FLOOR, -4), -Math.PI / 2 - 0.05, 12, { warm: -0.15 })); // right wall shadowed
  scene.add(cliffs);

  /* ----- Sky strip -------------------------------------------------------- */
  (function sky() {
    const g = new THREE.SphereGeometry(600, 20, 14);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, fog: false, depthWrite: false,
      uniforms: {
        cLow: { value: new THREE.Color(TOD.sky[0]) }, cMid: { value: new THREE.Color(TOD.sky[1]) }, cHigh: { value: new THREE.Color(TOD.sky[2]) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'varying vec3 vP; uniform vec3 cLow; uniform vec3 cMid; uniform vec3 cHigh;\n' +
        'void main(){ float h = clamp(normalize(vP).y*0.5+0.5, 0.0, 1.0);\n' +
        '  vec3 c = mix(cLow, cMid, smoothstep(0.32,0.55,h)); c = mix(c, cHigh, smoothstep(0.55,0.9,h));\n' +
        '  gl_FragColor = vec4(c,1.0);}',
    });
    const skyMesh = new THREE.Mesh(g, m); skyMesh.renderOrder = -1;
    if (!location.search.includes('nosky')) scene.add(skyMesh);
  })();

  /* ----- Stylized cel clouds (big, simple, ivory-topped / navy-bellied) ---- */
  const clouds = [];
  (function makeClouds() {
    function cloudTexture(warm) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128;
      const x = c.getContext('2d');
      const lumps = [[64, 84, 34], [104, 66, 44], [150, 62, 48], [196, 82, 38], [128, 92, 46], [92, 96, 32], [172, 94, 34]];
      // ivory body
      x.fillStyle = warm ? '#f0d9b0' : '#e7dcc4';
      for (const [cx, cy, r] of lumps) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
      // navy underbelly shading, clipped to the cloud shape
      x.globalCompositeOperation = 'source-atop';
      const g = x.createLinearGradient(0, 46, 0, 122);
      g.addColorStop(0, 'rgba(231,220,196,0)'); g.addColorStop(1, 'rgba(20,32,58,0.6)');
      x.fillStyle = g; x.fillRect(0, 0, 256, 128);
      const t = new THREE.CanvasTexture(c); return t;
    }
    const texWarm = cloudTexture(true), texCool = cloudTexture(false);
    const specs = [
      [-46, 26, -95, 42, texWarm, 0.95], [10, 34, -110, 54, texCool, 0.85],
      [52, 24, -90, 38, texWarm, 0.9], [-14, 20, -78, 30, texCool, 0.8], [34, 40, -120, 48, texCool, 0.75],
    ];
    for (const s of specs) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: s[4], transparent: true, opacity: s[5], depthWrite: false, fog: false }));
      spr.position.set(s[0], s[1], s[2]); spr.scale.set(s[3] * 1.9, s[3], 1);
      spr.userData = { vx: rnd(0.15, 0.4) };
      scene.add(spr); clouds.push(spr);
    }
  })();

  /* =========================================================================
     RIVER  — stylized cel water shader (broad masses, amber sun band, foam)
     ========================================================================= */
  const riverUniforms = { uTime: { value: 0 }, uSun: { value: new THREE.Color(TOD.river) } };
  (function river() {
    const g = new THREE.PlaneGeometry(200, 15, 120, 24);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, riverUniforms]),
      vertexShader:
        'uniform float uTime; varying vec2 vP; varying float vWave;\n' +
        '#include <fog_pars_vertex>\n' +
        'void main(){ vec3 pos = position; vP = position.xz;\n' +
        '  float w = sin(pos.x*1.6 + uTime*3.0)*0.045 + sin(pos.z*2.3 - uTime*2.0)*0.03 + sin(pos.x*5.0 + uTime*5.0)*0.02;\n' +
        '  pos.y += w; vWave = w;\n' +
        '  vec4 mvPosition = modelViewMatrix * vec4(pos,1.0); gl_Position = projectionMatrix * mvPosition;\n' +
        '  #include <fog_vertex>\n' +
        '}',
      fragmentShader:
        'uniform float uTime; uniform vec3 uSun; varying vec2 vP; varying float vWave;\n' +
        '#include <fog_pars_fragment>\n' +
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1)))*43758.5453); }\n' +
        'float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);\n' +
        '  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }\n' +
        'float fbm(vec2 p){ float s=0.0,a=0.5; for(int k=0;k<4;k++){ s+=a*vnoise(p); p*=2.02; a*=0.5;} return s; }\n' +
        'void main(){\n' +
        '  vec2 flow = vec2(uTime*1.4, uTime*0.25);\n' +
        '  float n = fbm(vP*vec2(0.9,1.7) - flow);\n' +
        '  float band = floor(n*4.0)/4.0;\n' +               // posterized broad masses
        '  vec3 deep = vec3(0.030,0.058,0.125);\n' +   // midnight navy channel
        '  vec3 lit  = vec3(0.085,0.165,0.285);\n' +   // lit ripple
        '  vec3 col = mix(deep, lit, band*0.85 + 0.15);\n' +
        '  float f = fbm(vP*vec2(2.3,4.0) - flow*2.2);\n' +
        '  float caps = smoothstep(0.60,0.82,f);\n' +
        '  // SIGNATURE: a defined reflection streak running toward the viewer\n' +
        '  float streakX = sin(vP.y*0.30 + 0.6)*2.4 + sin(vP.y*0.85)*0.9;\n' +
        '  float streak = smoothstep(5.5, 0.0, abs(vP.x - streakX));\n' +
        '  // amber reflection — deliberately capped below clipping so it never blows to white\n' +
        '  vec3 sunCol = uSun * 0.82;\n' +
        '  col = mix(col, sunCol, streak*0.78);\n' +
        '  // foam caps — a touch brighter only inside the reflection\n' +
        '  col = mix(col, mix(vec3(0.42,0.47,0.55), sunCol, 0.55), caps*(0.18 + 0.42*streak));\n' +
        '  // shimmering specular along the streak\n' +
        '  float glint = pow(max(0.0, sin(vP.x*2.2 + vP.y*1.5 - uTime*5.0)*0.5+0.5), 6.0);\n' +
        '  col += sunCol * glint * streak * 0.22;\n' +
        '  col = min(col, vec3(0.94));\n' +
        '  gl_FragColor = vec4(col, 1.0);\n' +
        '  #include <fog_fragment>\n' +
        '}',
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(0, 0.02, -1.5);  // spans between the banks
    scene.add(mesh);
  })();

  // Dark waterline strip / wet shelf to seat the banks graphically.
  (function waterline() {
    const g = new THREE.PlaneGeometry(200, 3); g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: COL.rockWet, transparent: true, opacity: 0.5, fog: true });
    const near = new THREE.Mesh(g, m); near.position.set(0, 0.05, 4.2); scene.add(near);
  })();

  /* =========================================================================
     BANKS + COVER ROCKS + REEDS + DRIFTWOOD
     ========================================================================= */
  const world = new THREE.Group(); scene.add(world);

  function bank(zCenter, zDepth, color, y) {
    const g = new THREE.PlaneGeometry(200, zDepth, 60, 8); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, (y || 0) + Math.sin(x * 0.4) * 0.12 + Math.sin(x * 1.7 + z) * 0.06 + Math.max(0, -z) * 0.05);
    }
    p.needsUpdate = true; g.computeVertexNormals();
    const m = toonSoft(color, { flatShading: true, normalMap: TEX.stoneNormal, normalScale: new THREE.Vector2(0.3, 0.3) });
    const mesh = new THREE.Mesh(g, m); mesh.position.z = zCenter;
    mesh.receiveShadow = true; world.add(mesh);
    return mesh;
  }
  // Near bank (player side) — cool wet gravel; Far bank (enemies) — sandstone shelves.
  bank(7.8, 2.6, COL.rockShadow, 0.0);   // just the near water's edge
  bank(-12, 12, COL.sand, 0.2);

  // Far-bank elevated shelves (give gunslingers different heights)
  function shelf(x, z, w, d, h, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, toon(color, { flatShading: true }));
    m.position.set(x, h / 2, z); ink(m, 0.0035); shad(m); world.add(m); return m;
  }
  // Low far-bank rises the outlaws stand on — NOT tall blocks (the walls are the height).
  shelf(-15, -13, 14, 7, 0.8, COL.sand);
  shelf(10, -15, 16, 8, 1.3, COL.rockMid);
  shelf(1, -18, 13, 7, 1.0, COL.sand);

  // Scatter cover rocks along both banks + in the river.
  const riverRocks = [];
  function scatterRocks() {
    const nearSpots = [[-9, 4.4, 1.1], [7, 4.0, 1.0], [-3, 3.4, 0.8], [12, 5.0, 1.3]];
    for (const s of nearSpots) {
      const r = makeRock(s[2], toon(0x101a2c, { flatShading: true, roughness: 0.6 }), { squashY: 0.62 });
      r.position.set(s[0], s[2] * 0.4, s[1]); world.add(r);
    }
    // river boulders
    for (let i = 0; i < 9; i++) {
      const rr = rnd(0.4, 1.1);
      const r = makeRock(rr, toon(0x14203a, { flatShading: true, roughness: 0.55 }), { squashY: 0.5 });
      r.position.set(rnd(-24, 24), rr * 0.18, rnd(-6, 2)); world.add(r); riverRocks.push(r);
    }
    // far-bank cover boulders
    const farSpots = [[-18, -8, 1.3], [-8, -9, 1.1], [2, -9.5, 1.2], [13, -9, 1.4], [21, -10, 1.2]];
    for (const s of farSpots) {
      const r = makeRock(s[2], toon(COL.rockMid, { flatShading: true }), { squashY: 0.75 });
      r.position.set(s[0], s[2] * 0.5, s[1]); world.add(r);
    }
  }
  scatterRocks();

  // Contact shadows. The river is a custom ShaderMaterial so it cannot receive the
  // shadow map; without these the boulders look pasted onto the surface. A soft dark
  // ellipse laid just above the waterline grounds them.
  (function contactShadows() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(4,10,26,0.85)'); g.addColorStop(0.55, 'rgba(5,12,30,0.45)');
    g.addColorStop(1, 'rgba(5,12,30,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true });
    for (const r of riverRocks) {
      const rad = (r.geometry.boundingSphere ? r.geometry.boundingSphere.radius : 1) * 1.9;
      const q = new THREE.Mesh(new THREE.PlaneGeometry(rad, rad * 0.72), mat);
      q.rotation.x = -Math.PI / 2;
      q.position.set(r.position.x + 0.12, 0.055, r.position.z + 0.18);
      q.renderOrder = 2;
      world.add(q);
    }
  })();

  // Break up the far bank's straight waterline with rubble, so it stops reading as a slab.
  (function bankRubble() {
    for (let i = 0; i < 22; i++) {
      const rr = rnd(0.30, 0.95);
      const m = makeRock(rr, toon(i % 3 === 0 ? 0x7d4527 : 0x8f5330, { flatShading: true }), { squashY: 0.55 });
      m.position.set(rnd(-30, 30), rnd(0.05, 0.35), rnd(-8.4, -6.2));
      m.rotation.y = rnd(0, 6.28);
      world.add(m);
    }
    // a few larger blocks sitting proud of the bank edge
    for (let i = 0; i < 7; i++) {
      const rr = rnd(0.9, 1.7);
      const m = makeRock(rr, toon(0x8a4d2c, { flatShading: true }), { squashY: 0.7 });
      m.position.set(rnd(-28, 28), rnd(0.3, 0.9), rnd(-10.5, -8.5));
      m.rotation.y = rnd(0, 6.28);
      world.add(m);
    }
  })();

  // Reeds (thin swaying quads) along the near bank
  const reeds = [];
  (function makeReeds() {
    const rmat = toonSoft(COL.reed, { side: THREE.DoubleSide, transparent: true });
    // small backlit grass clumps along the near bank edges — never blocking the view
    for (let i = 0; i < 26; i++) {
      const h = rnd(0.28, 0.6);
      const g = new THREE.PlaneGeometry(0.05, h, 1, 3);
      g.translate(0, h / 2, 0);
      const m = new THREE.Mesh(g, rmat);
      const side = i % 2 ? 1 : -1;
      m.position.set(side * rnd(3.5, 16), 0.05, rnd(2.6, 4.4));
      m.rotation.y = rnd(0, Math.PI);
      m.userData.h = h; m.userData.phase = rnd(0, 6.28);
      world.add(m); reeds.push(m);
    }
  })();

  // A little driftwood
  (function driftwood() {
    for (let i = 0; i < 4; i++) {
      const g = new THREE.CylinderGeometry(0.08, 0.11, rnd(1.4, 2.6), 6);
      const m = new THREE.Mesh(g, toon(COL.wood, { flatShading: true }));
      m.rotation.z = Math.PI / 2; m.rotation.y = rnd(0, Math.PI);
      m.position.set(rnd(-18, 18), 0.14, rnd(2.5, 5.5)); ink(m, 0.003); world.add(m);
    }
  })();

  /* ----- Foreground cover boulder (the player's rock) --------------------- */
  (function foregroundBoulder() {
    const grp = new THREE.Group();
    const main = makeRock(3.4, toon(0x0e1626, { flatShading: true, roughness: 0.62 }), { squashY: 0.8, jitter: 0.34, ink: 0.0055 });
    main.position.set(-0.4, 0.2, 0); grp.add(main);
    const side = makeRock(2.1, toon(0x121b2c, { flatShading: true, roughness: 0.62 }), { squashY: 0.75, jitter: 0.32, ink: 0.005 });
    side.position.set(2.6, -0.2, 0.6); grp.add(side);
    const small = makeRock(1.4, toon(0x0c1422, { flatShading: true, roughness: 0.6 }), { squashY: 0.7, ink: 0.004 });
    small.position.set(-3.0, -0.4, 0.7); grp.add(small);
    grp.position.set(-2.4, -1.7, 6.6);   // foreground cover lip, bottom-left
    shad(grp);
    scene.add(grp);
    window.__boulder = main;
  })();

  /* =========================================================================
     COLT VIEWMODEL  (Jody's hand + revolver at bottom of frame)
     ========================================================================= */
  const Colt = (function () {
    const grp = new THREE.Group();
    // Viewmodel uses UNLIT color with per-face shading baked into vertex colors: it sits
    // inches from the lens where stacked scene lights blow it out, and baking gives exact
    // control of the plane separation (production rule: "use color to define planes").
    const VM_LIGHT = new THREE.Vector3(-0.45, 0.78, 0.44).normalize();
    function bakeFaces(geo, hex) {
      const g = geo.index ? geo.toNonIndexed() : geo;
      const pos = g.attributes.position, n = g.attributes.normal;
      const base = new THREE.Color(hex), col = new THREE.Color();
      const arr = new Float32Array(pos.count * 3);
      const nv = new THREE.Vector3();
      for (let i = 0; i < pos.count; i += 3) {
        nv.set(n.getX(i), n.getY(i), n.getZ(i));            // flat faces: normal is constant per tri
        const d = nv.dot(VM_LIGHT);
        // three hard bands — cel, not a gradient
        const band = d > 0.45 ? 1.10 : (d > -0.05 ? 0.97 : 0.82);
        col.copy(base).multiplyScalar(band);
        for (let k = 0; k < 3; k++) { arr[(i + k) * 3] = col.r; arr[(i + k) * 3 + 1] = col.g; arr[(i + k) * 3 + 2] = col.b; }
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      return g;
    }
    const VM_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.45, fog: true });
    // `flat(hex)` now returns a tag object; geometry gets baked at mesh-build time.
    const flat = (hex) => ({ __bake: hex });
    const steel = flat(0x28323f);
    const steelDark = flat(0x18202c);
    const steelInk = 0.006;
    const wood = flat(0x6b3d1c);
    const glove = flat(0x5a4029);
    const cuff = flat(0x1b2440);
    function box(w, h, d, mat, x, y, z, rx, ry, rz) {
      const m = new THREE.Mesh(bakeFaces(new THREE.BoxGeometry(w, h, d), mat.__bake), VM_MAT);
      m.position.set(x, y, z); if (rx) m.rotation.x = rx; if (ry) m.rotation.y = ry; if (rz) m.rotation.z = rz;
      grp.add(m); return m;
    }
    const poncho = flat(0x5d6539);
    function cyl(rt, rb, h, seg, mat, x, y, z, rx, rz) {
      const m = new THREE.Mesh(bakeFaces(new THREE.CylinderGeometry(rt, rb, h, seg), mat.__bake), VM_MAT);
      m.position.set(x, y, z); if (rx != null) m.rotation.x = rx; if (rz) m.rotation.z = rz;
      grp.add(m); return m;
    }
    // --- Colt Peacemaker, barrel forward (-z) ---
    const barrel = cyl(0.036, 0.038, 0.66, 10, steel, 0, 0.035, -0.40, Math.PI / 2); ink(barrel, steelInk);
    cyl(0.020, 0.020, 0.44, 8, steelDark, 0, -0.012, -0.34, Math.PI / 2);  // ejector rod housing
    const cylinder = cyl(0.072, 0.072, 0.19, 12, steel, 0, 0.012, -0.02, Math.PI / 2); ink(cylinder, steelInk);
    const frame = box(0.088, 0.135, 0.30, steel, 0, 0.005, 0.06); ink(frame, steelInk);
    box(0.026, 0.045, 0.05, steel, 0, 0.10, 0.20);                          // hammer spur
    box(0.016, 0.026, 0.02, steel, 0, 0.085, -0.70);                        // front sight
    // trigger guard + trigger
    const guard = new THREE.Mesh(bakeFaces(new THREE.TorusGeometry(0.055, 0.012, 6, 10, Math.PI * 1.15), steelDark.__bake), VM_MAT);
    guard.rotation.y = Math.PI / 2; guard.rotation.z = -0.35; guard.position.set(0, -0.085, 0.10); grp.add(guard);
    box(0.014, 0.05, 0.016, steel, 0, -0.055, 0.10);
    // grip: angled back, walnut, with a steel backstrap
    const grip = box(0.078, 0.27, 0.115, wood, 0, -0.20, 0.235, 0.42); ink(grip, steelInk);
    box(0.086, 0.10, 0.13, steelDark, 0, -0.075, 0.185, 0.42);              // frame/grip strap
    // --- Jody's gloved hand on the grip ---
    const palm = box(0.115, 0.175, 0.155, glove, 0.005, -0.165, 0.245, 0.42); ink(palm, 0.005);
    box(0.125, 0.055, 0.10, glove, 0.0, -0.055, 0.145, 0.15);               // fingers curling to trigger
    box(0.125, 0.048, 0.085, glove, 0.0, -0.105, 0.135, 0.15);
    box(0.062, 0.075, 0.10, glove, -0.055, -0.075, 0.215, 0.30);            // thumb along the frame
    // --- forearm: dark navy shirt sleeve under the olive poncho, with fringe ---
    const wrist = box(0.155, 0.155, 0.14, glove, 0.02, -0.245, 0.335, 0.45); ink(wrist, 0.005);
    const sleeve = box(0.175, 0.175, 0.30, cuff, 0.045, -0.335, 0.50, 0.45); ink(sleeve, 0.005);
    const cape = box(0.30, 0.26, 0.34, poncho, 0.075, -0.44, 0.72, 0.45); ink(cape, 0.005);
    for (let i = 0; i < 5; i++) {                                            // poncho fringe
      box(0.022, 0.10, 0.022, poncho, -0.03 + i * 0.045, -0.575, 0.60 + i * 0.012, 0.45);
    }

    // muzzle flash + smoke anchor
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.40, 0.40), new THREE.MeshBasicMaterial({ map: TEX.flash, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    flash.position.set(0, 0.035, -0.76); grp.add(flash);
    const flashPt = new THREE.PointLight(0xffb060, 0, 7); flashPt.position.set(0, 0.2, -1); grp.add(flashPt);

    grp.position.set(0.235, -0.175, -0.52);
    grp.rotation.y = -0.17; grp.rotation.z = 0.05; grp.rotation.x = 0.05;
    grp.scale.setScalar(0.74);
    camera.add(grp); scene.add(camera);

    let recoil = 0, flashT = 0, sway = new THREE.Vector2(), bob = 0;
    const homePos = grp.position.clone();
    return {
      group: grp,
      fireFX() { recoil = 1; flashT = 1; flash.material.rotation = rnd(0, 6.28); flashPt.intensity = 6; },
      update(dt, lookVel, moving) {
        recoil = lerp(recoil, 0, dt * 10);
        flashT = Math.max(0, flashT - dt * 6);
        flash.material.opacity = flashT;
        flash.scale.setScalar(1 + (1 - flashT) * 0.6);
        flashPt.intensity = flashT * 6;
        // sway from look, gentle idle bob
        bob += dt * 1.2;
        sway.x = lerp(sway.x, clamp(-lookVel.x * 0.02, -0.05, 0.05), dt * 6);
        sway.y = lerp(sway.y, clamp(lookVel.y * 0.02, -0.05, 0.05), dt * 6);
        grp.position.x = homePos.x + sway.x + Math.sin(bob) * 0.006;
        grp.position.y = homePos.y + sway.y + Math.cos(bob * 0.9) * 0.006 - recoil * 0.05;
        grp.position.z = homePos.z + recoil * 0.14;
        grp.rotation.x = -recoil * 0.5 + tremor.x;
        grp.rotation.z = tremor.y;
      },
      setADS(on) { /* reserved */ },
    };
  })();
  const tremor = new THREE.Vector2();

  /* =========================================================================
     ENEMIES  — outlaws that peek briefly from cover (movement-first visibility)
     ========================================================================= */
  // An outlaw built silhouette-first: wide hat brim, coat shoulders flaring to a skirt,
  // legs apart, rifle up across the body. Bold simple masses per the production rules.
  function makeOutlaw(color, scarfCol) {
    const g = new THREE.Group();
    const cloth = toon(color, { flatShading: true });
    const dark = toon(COL.cloth, { flatShading: true });
    const skin = toon(COL.skin, { flatShading: true });
    const hat = toon(COL.hat, { flatShading: true });
    const scarf = toon(scarfCol == null ? COL.olive : scarfCol, { flatShading: true });
    const steel = toonMetal(0x252a35, { flatShading: true });
    const wood = toon(0x4a2c14, { flatShading: true });
    function b(w, h, d, mat, x, y, z, rz) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); if (rz) m.rotation.z = rz; g.add(m); return m;
    }
    // legs (planted apart — reads as a stance even in silhouette)
    b(0.17, 0.52, 0.19, dark, -0.14, 0.26, 0);
    b(0.17, 0.52, 0.19, dark, 0.15, 0.26, 0);
    b(0.21, 0.10, 0.26, dark, -0.14, 0.05, 0.03);                     // boots
    b(0.21, 0.10, 0.26, dark, 0.15, 0.05, 0.03);
    // coat skirt flares below the belt — the western silhouette
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.42, 0.44, 7), cloth);
    skirt.position.set(0, 0.70, 0); g.add(skirt);
    b(0.60, 0.10, 0.34, dark, 0, 0.90, 0);                            // gunbelt
    // torso: broad shoulders tapering down
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.56, 7), cloth);
    torso.position.set(0, 1.22, 0); g.add(torso);
    b(0.66, 0.14, 0.32, cloth, 0, 1.44, 0);                           // shoulder yoke
    b(0.26, 0.12, 0.28, scarf, 0, 1.53, 0.02);                        // neck scarf
    // head + the hat (biggest identity read)
    const head = b(0.23, 0.25, 0.23, skin, 0, 1.68, 0);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.045, 9), hat);
    brim.position.set(0, 1.79, 0.01); g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.24, 8), hat);
    crown.position.set(0, 1.92, 0); g.add(crown);
    // arms up holding the rifle
    b(0.15, 0.44, 0.15, cloth, -0.36, 1.20, 0.10, 0.35);
    b(0.15, 0.40, 0.15, cloth, 0.36, 1.24, 0.14, -0.30);
    // rifle held across, angled toward the player
    const rifle = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.25, 6), steel);
    barrel.rotation.z = Math.PI / 2; rifle.add(barrel);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.11, 0.075), wood);
    stock.position.set(0.60, -0.04, 0); rifle.add(stock);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.06), steel);
    lever.position.set(0.30, -0.08, 0); rifle.add(lever);
    rifle.position.set(-0.05, 1.30, 0.22); rifle.rotation.y = -0.12; rifle.rotation.z = 0.10;
    g.add(rifle);
    // muzzle flash at the barrel tip
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({ map: TEX.flash, color: COL.muzzle, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    flash.position.set(-0.70, 1.36, 0.28); g.add(flash);
    const fpt = new THREE.PointLight(0xffb060, 0, 5.5); fpt.position.set(-0.85, 1.38, 0.4); g.add(fpt);
    g.userData = { flash, fpt, rifle };
    shad(g);
    return g;
  }
  const Enemies = (function () {
    const list = [];
    // seat each outlaw behind a far-bank cover point at a chosen height
    const seats = [
      { x: -17, y: 0.2, z: -9, hide: -1.9, color: 0x3a2a44, scarf: 0x6a3a2a },
      { x: -7.5, y: 0.4, z: -10, hide: -2.0, color: 0x2c2438, scarf: 0x555c37 },
      { x: 3, y: 1.3, z: -11, hide: -2.0, color: 0x40302a, scarf: 0x7a4a2a }, // on a shelf, higher
      { x: 12.5, y: 0.5, z: -10, hide: -2.0, color: 0x2a3040, scarf: 0x555c37 },
      { x: 20, y: 0.3, z: -11, hide: -1.9, color: 0x352838, scarf: 0x6a3a2a },
    ];
    for (const s of seats) {
      const o = makeOutlaw(s.color, s.scarf);
      o.position.set(s.x, s.y + s.hide, s.z);
      o.userData.seatY = s.y; o.userData.hideY = s.y + s.hide;
      o.userData.state = 'down'; o.userData.t = rnd(1.5, 5); o.userData.up = 0;
      o.userData.alive = true;
      scene.add(o); list.push(o);
    }
    function update(dt) {
      for (const o of list) {
        const u = o.userData;
        if (SHOT) {   // screenshot mode: hold everyone up so the art can be judged
          u.up = Math.min(1, u.up + dt * 3); o.position.y = lerp(u.hideY, u.seatY, u.up);
          o.rotation.y = Math.atan2(camera.position.x - o.position.x, camera.position.z - o.position.z);
          continue;
        }
        if (!u.alive) { // sink and stay
          u.up = lerp(u.up, 0, dt * 6); o.position.y = lerp(u.hideY, u.seatY, u.up); continue;
        }
        u.t -= dt;
        if (u.state === 'down' && u.t <= 0) { u.state = 'rising'; }
        if (u.state === 'rising') {
          u.up = lerp(u.up, 1, dt * 7);
          if (u.up > 0.96) { u.state = 'up'; u.t = rnd(0.7, 1.6); u.fired = false; }
        } else if (u.state === 'up') {
          u.t -= dt;
          if (!u.fired && u.t < rnd(0.2, 0.5)) { fire(o); u.fired = true; }
          if (u.t <= 0) u.state = 'sinking';
        } else if (u.state === 'sinking') {
          u.up = lerp(u.up, 0, dt * 8);
          if (u.up < 0.05) { u.state = 'down'; u.t = rnd(1.5, 4.5); }
        }
        o.position.y = lerp(u.hideY, u.seatY, u.up);
        // face the player, subtle
        o.rotation.y = Math.atan2(camera.position.x - o.position.x, camera.position.z - o.position.z);
        // flash decay
        const f = o.userData.flash;
        if (f.material.opacity > 0) { f.material.opacity = Math.max(0, f.material.opacity - dt * 5); o.userData.fpt.intensity = f.material.opacity * 1.8; }
      }
    }
    function fire(o) {
      o.userData.flash.material.opacity = 1; o.userData.flash.material.rotation = rnd(0, 6.28);
      o.userData.fpt.intensity = 1.8;
      Audio.enemyShot(o.position);
      Puffs.spawn(o.position.x - 0.8, o.position.y + 1.35, o.position.z + 0.3, 0x9aa7c0, 2);
      // a near-miss on the player: chip the boulder + whistle + nerve hit
      if (Math.random() < 0.6) NearMiss.trigger();
    }
    function raycastHit(ray) {
      let best = null, bd = 1e9;
      for (const o of list) {
        if (!o.userData.alive || o.userData.up < 0.4) continue;
        const box = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(o.position.x, o.position.y + 1.15, o.position.z), new THREE.Vector3(1.0, 2.1, 0.7));
        const hit = ray.ray.intersectBox(box, new THREE.Vector3());
        if (hit) { const d = hit.distanceTo(ray.ray.origin); if (d < bd) { bd = d; best = o; } }
      }
      return best;
    }
    function down(o) {
      o.userData.alive = false; o.userData.state = 'dead';
      Audio.hitBody(); Puffs.spawn(o.position.x, o.position.y + 0.7, o.position.z, 0x6a5540, 6);
    }
    return { list, update, raycastHit, down };
  })();

  /* ----- Harlan Crow — distant, still, the environmental threat ----------- */
  const Crow = (function () {
    const g = new THREE.Group();
    const duster = toon(0x14161f, { flatShading: true });
    const hat = toon(0x090a10, { flatShading: true });
    function b(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; }
    // HARLAN CROW — the environmental threat. Read as a monolith: heavy shoulders, a
    // duster falling to the boots, a wide flat brim, and that long Sharps. He barely moves.
    const boots = toon(0x0b0c12, { flatShading: true });
    // long duster: near-floor-length, flaring slightly
    const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.92, 1.85, 9), duster);
    coat.position.set(0, 0.92, 0); g.add(coat);
    const coatSplit = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.95, 0.94), boots);
    coatSplit.position.set(0, 0.55, 0.02); g.add(coatSplit);        // centre seam of the coat
    b(0.30, 0.42, 0.34, boots, -0.26, 0.20, 0.03);                  // boots below the hem
    b(0.30, 0.42, 0.34, boots, 0.26, 0.20, 0.03);
    // heavy torso + shoulder yoke (the mass that makes him read as huge)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.60, 0.55, 0.86, 9), duster);
    torso.position.set(0, 2.16, 0); g.add(torso);
    b(1.42, 0.26, 0.56, duster, 0, 2.50, 0);                        // shoulders
    b(1.02, 0.20, 0.50, duster, 0, 2.62, 0);                        // coat collar up
    // arms hanging heavy
    b(0.26, 0.92, 0.28, duster, -0.66, 2.02, 0.02);
    b(0.26, 0.92, 0.28, duster, 0.66, 2.02, 0.02);
    const head = b(0.38, 0.40, 0.36, toon(0x6e4a34, { flatShading: true }), 0, 2.86, 0);
    b(0.42, 0.16, 0.40, toon(0x2a2018, { flatShading: true }), 0, 2.70, 0.02);   // beard/jaw shadow
    // hat: wide flat brim + tall crown with a band — his signature shape
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.86, 0.07, 12), hat);
    brim.position.set(0, 3.06, 0.01); g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.36, 0.40, 10), hat);
    crown.position.set(0, 3.28, 0); g.add(crown);
    b(0.76, 0.07, 0.76, toon(0x24262f, { flatShading: true }), 0, 3.11, 0);      // hat band
    // long Sharps rifle, butt on the ground, barrel angled across him
    const sharps = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 2.5, 8), toon(0x22252e, { flatShading: true }));
    bar.rotation.z = 0.30; sharps.add(bar);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.17, 0.12), toon(0x3a2413, { flatShading: true }));
    st.position.set(-0.42, -1.28, 0); st.rotation.z = 0.30; sharps.add(st);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 8), toon(0x1a1c24, { flatShading: true }));
    scope.rotation.z = 0.30; scope.position.set(0.10, 0.30, 0.13); sharps.add(scope);
    sharps.position.set(0.80, 1.55, 0.24); g.add(sharps);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xffca7a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    glow.position.set(1.25, 2.75, 0.45); g.add(glow);
    const pt = new THREE.PointLight(0xffc070, 0, 14); pt.position.set(1.3, 2.8, 0.7); g.add(pt);
    g.position.set(-7.5, 1.05, -23.5); g.scale.setScalar(1.12);
    shad(g);
    scene.add(g);

    let t = rnd(6, 10), state = 'watch', charge = 0;
    function update(dt) {
      // faint idle: duster shift
      g.rotation.y = -0.15 + Math.sin(clock * 0.4) * 0.03;
      if (state === 'watch') { t -= dt; if (t <= 0) { state = 'charge'; charge = 0; } }
      else if (state === 'charge') {
        charge += dt; glow.material.opacity = Math.min(1, charge / 1.4) * (0.6 + 0.4 * Math.sin(clock * 20));
        pt.intensity = Math.min(1, charge / 1.4) * 6;
        if (charge >= 1.5) { boom(); state = 'watch'; t = rnd(9, 15); glow.material.opacity = 0; pt.intensity = 0; }
      }
    }
    function boom() {
      glow.material.opacity = 1; pt.intensity = 14;
      Audio.sharps(g.position);
      // a rock beside Jody explodes
      NearMiss.trigger(true);
      setTimeout(() => { pt.intensity = 0; glow.material.opacity = 0; }, 120);
    }
    return { group: g, update };
  })();

  /* =========================================================================
     ATMOSPHERE  — drifting smoke, high dust, birds, falling stones
     ========================================================================= */
  const Puffs = (function () {
    const items = [];
    const mat = new THREE.SpriteMaterial({ map: TEX.smoke, color: 0x8f9bb4, transparent: true, opacity: 0, depthWrite: false, fog: true });
    function spawn(x, y, z, color, n) {
      for (let i = 0; i < (n || 3); i++) {
        const s = new THREE.Sprite(mat.clone());
        s.material.color = new THREE.Color(color || 0x8f9bb4);
        s.position.set(x + rnd(-0.3, 0.3), y + rnd(-0.2, 0.2), z + rnd(-0.3, 0.3));
        const sc = rnd(0.5, 1.4); s.scale.setScalar(sc);
        s.material.opacity = rnd(0.35, 0.6);
        s.userData = { vy: rnd(0.05, 0.22), vx: rnd(-0.04, 0.20), grow: rnd(0.22, 0.55), life: rnd(11, 20), age: 0 };
        scene.add(s); items.push(s);
      }
    }
    function update(dt) {
      for (let i = items.length - 1; i >= 0; i--) {
        const s = items[i], u = s.userData; u.age += dt;
        s.position.y += u.vy * dt; s.position.x += u.vx * dt;
        s.scale.addScalar(u.grow * dt);
        s.material.opacity = Math.max(0, s.material.opacity - dt * 0.028);
        if (u.age > u.life || s.material.opacity <= 0.01) { scene.remove(s); items.splice(i, 1); }
      }
    }
    return { spawn, update, count: () => items.length };
  })();

  // Ambient drifting haze that collects over the river as the fight goes on
  const haze = [];
  (function ambientHaze() {
    const mat = new THREE.SpriteMaterial({ map: TEX.smoke, color: 0x2a3556, transparent: true, opacity: 0.0, depthWrite: false, fog: true });
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(mat.clone());
      s.position.set(rnd(-30, 30), rnd(1, 6), rnd(-14, 2));
      s.scale.setScalar(rnd(6, 14)); s.material.opacity = rnd(0.04, 0.1);
      s.userData = { vx: rnd(0.05, 0.2), ph: rnd(0, 6.28) };
      scene.add(s); haze.push(s);
    }
  })();

  /* ----- AERIAL DEPTH: horizontal mist sheets between the picture planes ---------
     Illustrations get their depth from stacked, separated layers rather than uniform
     fog. These low sheets sit at fixed depths so the far bank, the mid river and the
     foreground cover each read as a distinct plane. --------------------------------- */
  const mistBands = [];
  (function mistLayers() {
    const c = document.createElement('canvas'); c.width = 8; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0.0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 8, 128);
    const tex = new THREE.CanvasTexture(c);
    // [z, y, height, width, colour, opacity]
    const layers = [
      [-31, 0.3, 7.0, 160, TOD.mist[0], 0.52 * TOD.mistI],   // haze hugging the far bank
      [-23, 0.1, 5.4, 150, TOD.mist[1], 0.40 * TOD.mistI],
      [-13, 0.0, 3.8, 140, TOD.mist[2], 0.30 * TOD.mistI],   // mid-river mist
      [-4, -0.1, 2.6, 130, TOD.mist[3], 0.22 * TOD.mistI],
    ];
    for (const L of layers) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(L[3], L[2]),
        new THREE.MeshBasicMaterial({ map: tex, color: L[4], transparent: true, opacity: L[5], depthWrite: false, fog: false }));
      m.position.set(0, L[1] + L[2] / 2, L[0]);
      m.renderOrder = 3;
      m.userData = { base: L[5], ph: rnd(0, 6.28) };
      scene.add(m); mistBands.push(m);
    }
  })();

  // Birds circling far overhead (tiny dark V's)
  const birds = [];
  (function makeBirds() {
    const mat = new THREE.MeshBasicMaterial({ color: 0x0b1024, fog: true });
    for (let i = 0; i < 6; i++) {
      const shape = new THREE.Shape();
      shape.moveTo(-0.5, 0); shape.lineTo(0, 0.12); shape.lineTo(0.5, 0); shape.lineTo(0, 0.04); shape.lineTo(-0.5, 0);
      const g = new THREE.ShapeGeometry(shape);
      const m = new THREE.Mesh(g, mat);
      m.rotation.x = -Math.PI / 2;
      m.userData = { r: rnd(20, 40), a: rnd(0, 6.28), sp: rnd(0.05, 0.12), y: rnd(40, 60), cx: rnd(-10, 10), cz: rnd(-25, -10) };
      m.scale.setScalar(rnd(1.2, 2.4));
      scene.add(m); birds.push(m);
    }
  })();

  // Occasional small stones falling from the cliffs
  const stones = [];
  function dropStone() {
    const g = new THREE.SphereGeometry(rnd(0.06, 0.14), 5, 4);
    const m = new THREE.Mesh(g, toon(COL.rockMid, { flatShading: true }));
    m.position.set(rnd(-30, 30), rnd(20, 40), rnd(-28, -14));
    m.userData = { vy: 0 }; scene.add(m); stones.push(m);
  }
  let stoneTimer = 3;

  /* =========================================================================
     IMPACTS  — near-miss chip on the boulder, water splashes
     ========================================================================= */
  const NearMiss = {
    trigger(heavy) {
      // choose a point on the foreground rock near the player
      const x = rnd(-2.2, 2.2), y = rnd(-0.4, 1.2), z = 4.8;
      Puffs.spawn(x, y, z, 0x9a8a72, heavy ? 8 : 4);
      Audio.chip(heavy);
      shake += heavy ? 0.6 : 0.22;
      nerve = clamp(nerve - (heavy ? 0.16 : 0.05), 0.08, 1);
      flashHit(heavy ? 0.5 : 0.22);
      if (window.__boulder) window.__boulder.material.color.offsetHSL(0, 0, -0.002);
    },
  };
  const Splashes = (function () {
    const items = [];
    function spawn(x, z) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.splash, color: 0xdfeaf4, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.position.set(x, 0.15, z); s.scale.setScalar(0.3); s.userData = { vy: rnd(1.2, 2.2), age: 0 };
      scene.add(s); items.push(s); Audio.splash();
    }
    function update(dt) {
      for (let i = items.length - 1; i >= 0; i--) {
        const s = items[i], u = s.userData; u.age += dt;
        s.position.y += (u.vy - u.age * 3) * dt; s.scale.addScalar(dt * 1.2);
        s.material.opacity -= dt * 1.6;
        if (s.material.opacity <= 0) { scene.remove(s); items.splice(i, 1); }
      }
    }
    return { spawn, update };
  })();

  /* =========================================================================
     AUDIO  — procedural river, wind, revolver echo, Sharps, splashes, chips
     ========================================================================= */
  const Audio = (function () {
    let ctx = null, master, bus, riverGain, windGain, started = false;
    function noiseBuffer(sec) {
      const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
      const d = b.getChannelData(0); let last = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; d[i] = (last + 0.02 * w) / 1.02; last = d[i]; d[i] *= 3.2; }
      return b;
    }
    function ensure() {
      if (ctx) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      // canyon echo bus
      const delay = ctx.createDelay(); delay.delayTime.value = 0.26;
      const fb = ctx.createGain(); fb.gain.value = 0.45;
      const echoLP = ctx.createBiquadFilter(); echoLP.type = 'lowpass'; echoLP.frequency.value = 1800;
      delay.connect(echoLP); echoLP.connect(fb); fb.connect(delay);
      const echoGain = ctx.createGain(); echoGain.gain.value = 0.5; delay.connect(echoGain); echoGain.connect(master);
      bus = { dry: master, echo: delay };
    }
    function startBeds() {
      if (started) return; ensure(); started = true;
      // river bed
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(3); src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
      riverGain = ctx.createGain(); riverGain.gain.value = 0.16;
      src.connect(hp); hp.connect(lp); lp.connect(riverGain); riverGain.connect(master); src.start();
      // wind
      const w = ctx.createBufferSource(); w.buffer = noiseBuffer(4); w.loop = true;
      const wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 380;
      windGain = ctx.createGain(); windGain.gain.value = 0.06;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08; const lg = ctx.createGain(); lg.gain.value = 0.04;
      lfo.connect(lg); lg.connect(windGain.gain); lfo.start();
      w.connect(wlp); wlp.connect(windGain); windGain.connect(master); w.start();
    }
    function pan(x) { const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (p) p.pan.value = clamp(x / 30, -1, 1); return p; }
    function shotNoise(dur, lpFreq, gainv, toEcho) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.5);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lpFreq;
      const g = ctx.createGain();
      const now = ctx.currentTime;
      g.gain.setValueAtTime(gainv, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      src.connect(lp); lp.connect(g); g.connect(master);
      if (toEcho) g.connect(bus.echo);
      src.start(now); src.stop(now + dur + 0.05);
    }
    function tone(freq, dur, type, gainv) {
      const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
      const g = ctx.createGain(); const now = ctx.currentTime;
      g.gain.setValueAtTime(gainv, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      o.connect(g); g.connect(master); o.start(now); o.stop(now + dur + 0.02);
    }
    return {
      resume() { ensure(); if (ctx.state === 'suspended') ctx.resume(); startBeds(); },
      colt() { if (!ctx) return; shotNoise(0.5, 2600, 1.1, true); tone(180, 0.12, 'square', 0.5); tone(90, 0.2, 'sine', 0.4); },
      enemyShot() { if (!ctx) return; shotNoise(0.4, 2000, 0.5, true); },
      sharps() { if (!ctx) return; shotNoise(0.9, 1400, 1.4, true); tone(70, 0.4, 'sine', 0.7); tone(120, 0.2, 'square', 0.4); },
      splash() { if (!ctx) return; shotNoise(0.18, 5000, 0.3, false); },
      chip(heavy) { if (!ctx) return; shotNoise(0.1, 7000, heavy ? 0.5 : 0.28, false); tone(rnd(1400, 2200), 0.08, 'sine', 0.12); },
      hitBody() { if (!ctx) return; shotNoise(0.12, 800, 0.4, false); },
      dry() { if (!ctx) return; tone(1200, 0.03, 'square', 0.08); },
    };
  })();

  /* =========================================================================
     INPUT  (aim / fire / reload) + pointer-lock-free steer fallback
     ========================================================================= */
  const SHOT = location.search.indexOf('shot') >= 0;   // freeze look at authored defaults for screenshots
  const player = { yaw: 0, pitch: -0.155, locked: false, lockBlocked: false, steer: new THREE.Vector2(), lookVel: new THREE.Vector2() };
  const YAW_LIMIT = 0.72, PITCH_LO = -0.34, PITCH_HI = 0.42;   // you're pinned in cover
  let ammo = 6, reloading = false, running = false;
  let nerve = 1, shake = 0;

  function onMove(e) {
    if (SHOT) return;
    if (player.locked) {
      const s = 0.0022;
      player.yaw = clamp(player.yaw - e.movementX * s, -YAW_LIMIT, YAW_LIMIT);
      player.pitch = clamp(player.pitch - e.movementY * s, PITCH_LO, PITCH_HI);
      player.lookVel.set(e.movementX, e.movementY);
    } else if (player.lockBlocked && running) {
      const nx = (e.clientX / innerWidth) * 2 - 1, ny = (e.clientY / innerHeight) * 2 - 1;
      const dz = 0.1;
      player.steer.x = Math.abs(nx) < dz ? 0 : (nx - Math.sign(nx) * dz) / (1 - dz);
      player.steer.y = Math.abs(ny) < dz ? 0 : (ny - Math.sign(ny) * dz) / (1 - dz);
    }
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mousedown', (e) => { if (!running) return; if (e.button === 0) { fire(); if (!player.locked && !player.lockBlocked) requestLock(); } });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') reload();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') player.steady = true;
    if (e.code === 'KeyA') player.yaw = clamp(player.yaw + 0.05, -YAW_LIMIT, YAW_LIMIT);
    if (e.code === 'KeyD') player.yaw = clamp(player.yaw - 0.05, -YAW_LIMIT, YAW_LIMIT);
    if (e.code === 'KeyW') player.pitch = clamp(player.pitch + 0.04, PITCH_LO, PITCH_HI);
    if (e.code === 'KeyS') player.pitch = clamp(player.pitch - 0.04, PITCH_LO, PITCH_HI);
  });
  document.addEventListener('keyup', (e) => { if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') player.steady = false; });

  function requestLock() {
    if (SHOT || player.lockBlocked) return;
    if (!renderer.domElement.requestPointerLock) { steerMode(); return; }
    try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(steerMode); } catch (_) { steerMode(); return; }
    setTimeout(() => { if (!player.locked && !player.lockBlocked) steerMode(); }, 450);
  }
  function steerMode() { if (player.lockBlocked) return; player.lockBlocked = true; dom.steerHint.classList.remove('hidden'); }
  document.addEventListener('pointerlockchange', () => {
    player.locked = document.pointerLockElement === renderer.domElement;
    if (player.locked) player.lockBlocked = false;
  });

  function fire() {
    if (!running || reloading) return;
    if (ammo <= 0) { Audio.dry(); dom.reloadTag.classList.add('show'); return; }
    ammo--; updateRounds();
    Colt.fireFX(); Audio.colt();
    (function muzzleSmoke() {
      const d = new THREE.Vector3(); camera.getWorldDirection(d);
      const o = camera.position.clone().addScaledVector(d, 1.5).add(new THREE.Vector3(0.25, -0.25, 0));
      Puffs.spawn(o.x, o.y, o.z, 0x93a2bd, 3);
    })();
    shake += 0.18; tremor.set(rnd(-0.02, 0.02), rnd(-0.02, 0.02));
    // ray from camera center
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hit = Enemies.raycastHit(ray);
    if (hit) Enemies.down(hit);
    else {
      // splash if the shot lands in the river band
      const t = -ray.ray.origin.y / ray.ray.direction.y;
      if (t > 0) { const px = ray.ray.origin.x + ray.ray.direction.x * t, pz = ray.ray.origin.z + ray.ray.direction.z * t;
        if (pz < 3 && pz > -7 && Math.abs(px) < 40) Splashes.spawn(px, pz); }
    }
    if (ammo === 0) dom.reloadTag.classList.add('show');
  }
  function reload() {
    if (!running || reloading || ammo === 6) return;
    reloading = true; dom.reloadTag.classList.remove('show');
    let n = 0; const iv = setInterval(() => {
      n++; ammo = Math.min(6, ammo + 1); updateRounds(); Audio.chip(false);
      if (ammo >= 6 || n >= 6) { clearInterval(iv); reloading = false; }
    }, 130);
  }
  function updateRounds() {
    const rs = dom.rounds.querySelectorAll('.r');
    rs.forEach((r, i) => r.classList.toggle('spent', i >= ammo));
  }
  (function buildRounds() {
    for (let i = 0; i < 6; i++) { const s = document.createElement('span'); s.className = 'r'; dom.rounds.insertBefore(s, dom.rounds.firstChild); }
  })();

  function flashHit(a) {
    dom.hitflash.style.transition = 'none';
    dom.hitflash.style.background = 'radial-gradient(circle at 50% 55%, rgba(178,59,46,' + (a * 0.5) + '), rgba(120,20,15,' + (a * 0.35) + '))';
    requestAnimationFrame(() => { dom.hitflash.style.transition = 'background .5s ease'; dom.hitflash.style.background = 'radial-gradient(circle at 50% 55%, rgba(178,59,46,0), rgba(120,20,15,0))'; });
  }

  /* =========================================================================
     RESIZE
     ========================================================================= */
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
    bloom.setSize(innerWidth, innerHeight);
    inkPass.uniforms.uRes.value.set(innerWidth, innerHeight);
    for (const m of inkMats) m.uniforms.uAspect.value = innerWidth / innerHeight;
  });

  /* =========================================================================
     LOOP
     ========================================================================= */
  let last = performance.now(), clock = 0;
  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now(); let dt = Math.min((now - last) / 1000, 0.05); last = now; clock += dt;

    riverUniforms.uTime.value = clock;

    // steer look
    if (!SHOT && player.lockBlocked && (player.steer.x || player.steer.y)) {
      player.yaw = clamp(player.yaw - player.steer.x * 1.4 * dt, -YAW_LIMIT, YAW_LIMIT);
      player.pitch = clamp(player.pitch - player.steer.y * 1.0 * dt, PITCH_LO, PITCH_HI);
      player.lookVel.set(player.steer.x * 40, player.steer.y * 40);
    }

    // camera orientation + breathing + shake + tremor from low nerve
    const breathe = Math.sin(clock * 1.1) * 0.004;
    const trem = (1 - nerve) * 0.02;
    shake = Math.max(0, shake - dt * 1.4);
    const sx = (Math.random() - 0.5) * shake * 0.06, sy = (Math.random() - 0.5) * shake * 0.06;
    camera.position.copy(CAM_BASE);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = player.yaw + sx + Math.sin(clock * 7) * trem;
    camera.rotation.x = player.pitch + sy + breathe + Math.cos(clock * 6) * trem;
    player.lookVel.multiplyScalar(0.85);

    if (running) {
      Colt.update(dt, player.lookVel, false);
      Enemies.update(dt);
      Crow.update(dt);
    }
    Puffs.update(dt); Splashes.update(dt);

    // reeds sway
    for (const r of reeds) { r.rotation.z = Math.sin(clock * 1.6 + r.userData.phase) * 0.18; }
    // haze drift
    for (const h of haze) { h.position.x += h.userData.vx * dt; if (h.position.x > 34) h.position.x = -34; h.material.opacity = Math.min(0.14, h.material.opacity + dt * 0.001); }
    for (const m of mistBands) { const u = m.userData; m.material.opacity = u.base * (0.82 + 0.18 * Math.sin(clock * 0.25 + u.ph)); }
    // clouds drift slowly across the sky strip
    for (const c of clouds) { c.position.x += c.userData.vx * dt; if (c.position.x > 70) c.position.x = -70; }
    // birds circle
    for (const b of birds) { const u = b.userData; u.a += u.sp * dt; b.position.set(u.cx + Math.cos(u.a) * u.r, u.y, u.cz + Math.sin(u.a) * u.r); b.rotation.z = -u.a; }
    // stones
    stoneTimer -= dt; if (stoneTimer <= 0 && stones.length < 5) { dropStone(); stoneTimer = rnd(2.5, 6); }
    for (let i = stones.length - 1; i >= 0; i--) { const s = stones[i]; s.userData.vy += 9.8 * dt; s.position.y -= s.userData.vy * dt; if (s.position.y < 0.2) { scene.remove(s); stones.splice(i, 1); } }
    // steadier aim while holding Shift
    if (player.steady) { tremor.multiplyScalar(0.9); }

    // nerve slowly recovers
    nerve = clamp(nerve + dt * 0.02, 0.08, 1);
    dom.nerveFill.style.transform = 'scaleX(' + nerve + ')';

    composer.render();
  }

  /* =========================================================================
     BOOT
     ========================================================================= */
  function boot() {
    dom.loading.classList.add('hidden');
    dom.title.classList.remove('hidden');
    frame();
  }
  dom.startBtn.addEventListener('click', () => {
    Audio.resume();
    dom.title.classList.add('hidden');
    dom.hud.classList.remove('hidden');
    document.body.classList.add('aiming');
    running = true;
    requestLock();
  });

  // debug hook for headless smoke tests
  window.__dbg = { yaw: () => player.yaw, pitch: () => player.pitch, ammo: () => ammo, puffs: () => Puffs.count(), enemies: () => Enemies.list.length };
  window.__fire = () => fire();
  window.__reload = () => { ammo = 6; updateRounds(); };
  window.__enemyFire = () => { for (const o of Enemies.list) { o.userData.flash.material.opacity = 1; o.userData.fpt.intensity = 1.8; } };
  window.__three = { scene, camera, THREE, cliffs };
  window.__probe = function () {
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = ray.intersectObjects(scene.children, true).slice(0, 4).map(h => ({
      d: +h.distance.toFixed(1), y: +h.point.y.toFixed(1), z: +h.point.z.toFixed(1),
      t: h.object.material && h.object.material.type,
    }));
    return { camDir: [+dir.x.toFixed(2), +dir.y.toFixed(2), +dir.z.toFixed(2)], hits, children: scene.children.length };
  };

  boot();
})();
