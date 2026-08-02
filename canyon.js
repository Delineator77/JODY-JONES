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
    healthFill: $('healthFill'), hostilesNum: $('hostilesNum'), hostilesTotal: $('hostilesTotal'),
    hitmarker: $('hitmarker'), dmgDir: $('dmgDir'),
    deathScreen: $('deathScreen'), retryBtn: $('retryBtn'),
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
      key: 0xffc287, keyIntensity: 1.72, keyPos: [-46, 92, 40],
      skyFill: 0x41608f, ground: 0x0e1728, hemi: 0.78,
      ambient: 0x22355e, ambientI: 0.46,
      fill: 0x5a7dc0, fillI: 0.34, bounce: 0x2c4a76, bounceI: 0.22,
      fog: 0x33344f, fogDensity: 0.0115,
      sky: [0xe89a52, 0x8a5a55, 0x141f38],
      river: 0xf0993e, rockTint: 0xffffff, rim: 0xff9c4a, rimStrength: 1.15, waterDeep: 0x0c1424, waterLit: 0x142038,
      grade: { shadow: 0x1b2a4e, light: 0xffd7a2, tint: 0.34, sat: 1.24 },
      mist: [0x7a5a4c, 0x5f4a48, 0x47536e, 0x333f5c], mistI: 1.0,
      bloom: 0.22,
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
      river: 0xcfe0f5, rockTint: 0x7d93d6, rim: 0x9fc4f5, rimStrength: 0.95, waterDeep: 0x0a1220, waterLit: 0x101c32,
      grade: { shadow: 0x101d3c, light: 0xcadcf6, tint: 0.42, sat: 1.10 },
      mist: [0x3d4d74, 0x344263, 0x293450, 0x1e2840], mistI: 0.85,
      bloom: 0.5,
    },
  };
  TOD_PRESETS.day = {
    // From the daylight wall sheets: brilliant blue sky, orange faces, mauve shadows.
    key: 0xffd39a, keyIntensity: 1.5, keyPos: [-30, 120, 55],
    skyFill: 0x7fa8d8, ground: 0x2a2438, hemi: 0.9,
    ambient: 0x3a4a72, ambientI: 0.42,
    fill: 0x88a8d8, fillI: 0.3, bounce: 0x54628c, bounceI: 0.25,
    fog: 0x6a7ba0, fogDensity: 0.006,
    sky: [0x7fb0dd, 0x4489cc, 0x1e63b0],
    river: 0xbfe0f2, rockTint: 0xffffff, rim: 0xffd9a0, rimStrength: 0.7, waterDeep: 0x1c3450, waterLit: 0x2c4a68,
    grade: { shadow: 0x3b3560, light: 0xffd9a8, tint: 0.3, sat: 1.42 },
    mist: [0x8a7a88, 0x7a6f88, 0x6a7a9c, 0x5a6a8c], mistI: 0.5,
    bloom: 0.25,
  };
  const TOD_NAME = location.search.indexOf('night') >= 0 ? 'night'
    : location.search.indexOf('day') >= 0 ? 'day' : 'dusk';
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
      uBands: { value: 6.0 },        // luminance steps (lower = flatter//more graphic)
      uMix: { value: 0.80 },         // how strongly to posterize
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
      '  // lift crushed blacks to Midnight Navy #14203a — shadow mass must be navy, not mud\n' +
      '  float dk = 1.0 - smoothstep(0.0, 0.30, lum(c));\n' +
      '  c += vec3(0.055,0.088,0.168) * dk * 0.42;\n' +
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
      uStrength: { value: 0.97 }, uThreshold: { value: 0.11 },
      uInk: { value: new THREE.Color(0x0a1020) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:
      'uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uStrength; uniform float uThreshold; uniform vec3 uInk; varying vec2 vUv;\n' +
      'float lum(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }\n' +
      'void main(){\n' +
      '  vec2 px = 1.4/uRes;\n' +
      '  float tl=lum(texture2D(tDiffuse,vUv+px*vec2(-1.,-1.)).rgb), t=lum(texture2D(tDiffuse,vUv+px*vec2(0.,-1.)).rgb), tr=lum(texture2D(tDiffuse,vUv+px*vec2(1.,-1.)).rgb);\n' +
      '  float l=lum(texture2D(tDiffuse,vUv+px*vec2(-1.,0.)).rgb), r=lum(texture2D(tDiffuse,vUv+px*vec2(1.,0.)).rgb);\n' +
      '  float bl=lum(texture2D(tDiffuse,vUv+px*vec2(-1.,1.)).rgb), bm=lum(texture2D(tDiffuse,vUv+px*vec2(0.,1.)).rgb), br=lum(texture2D(tDiffuse,vUv+px*vec2(1.,1.)).rgb);\n' +
      '  float gx = -tl -2.0*l -bl + tr + 2.0*r + br;\n' +
      '  float gy = -tl -2.0*t -tr + bl + 2.0*bm + br;\n' +
      '  float mag = sqrt(gx*gx + gy*gy);\n' +
      '  float edge = smoothstep(uThreshold, uThreshold+0.22, mag);\n' +
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

  /* --- WARM RIM LIGHT -------------------------------------------------------
     In the reference illustrations every form carries a bright warm edge where it
     turns away from the key. That single cue does more than any texture to make a
     render read as drawn. Injected into MeshStandardMaterial via onBeforeCompile:
     a fresnel edge term, gated so it only fires on the side facing the key light,
     and hard-stepped so it reads as a painted stroke rather than a soft glow. --- */
  const RIM = {
    color: new THREE.Color(TOD.rim || 0xffb066),
    dir: new THREE.Vector3(),        // world-space direction TO the key light
    strength: TOD.rimStrength == null ? 0.85 : TOD.rimStrength,
  };
  const rimMaterials = [];
  function addRim(mat, mul) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRimColor = { value: RIM.color };
      sh.uniforms.uRimDir = { value: RIM.dir };
      sh.uniforms.uRimAmt = { value: RIM.strength * (mul == null ? 1 : mul) };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRimNW; varying vec3 vRimVV; varying vec3 vRimNV;')
        .replace('#include <project_vertex>',
          '#include <project_vertex>\n vRimNW = normalize(mat3(modelMatrix) * objectNormal);\n vRimNV = normalize(normalMatrix * objectNormal);\n vRimVV = normalize(-mvPosition.xyz);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor; uniform vec3 uRimDir; uniform float uRimAmt;\nvarying vec3 vRimNW; varying vec3 vRimVV; varying vec3 vRimNV;')
        .replace('#include <dithering_fragment>',
          '#include <dithering_fragment>\n' +
          ' float fres = 1.0 - clamp(dot(normalize(vRimNV), normalize(vRimVV)), 0.0, 1.0);\n' +
          ' float edge = smoothstep(0.58, 0.93, fres);\n' +          // hard-stepped: a stroke, not a glow
          ' float facing = smoothstep(-0.15, 0.55, dot(normalize(vRimNW), uRimDir));\n' +
          ' gl_FragColor.rgb += uRimColor * edge * facing * uRimAmt;');
    };
    mat.customProgramCacheKey = () => 'rim';
    rimMaterials.push(mat);
    return mat;
  }

  // Lit, shadow-capable surfaces. The illustrated read comes from the palette, the rim,
  // and the posterize/ink post passes — NOT from flattening the lighting itself.
  function toon(color, opts) {
    const o = Object.assign({ color: color, roughness: 0.95, metalness: 0.0 }, opts || {});
    delete o.gradientMap;
    return addRim(new THREE.MeshStandardMaterial(o));
  }
  function toonSoft(color, opts) {
    const o = Object.assign({ color: color, roughness: 1.0, metalness: 0.0 }, opts || {});
    delete o.gradientMap;
    return addRim(new THREE.MeshStandardMaterial(o), 0.5);
  }
  // Mark a mesh (and children) as participating in shadows.
  function shad(m, cast, receive) {
    m.traverse((o) => { if (o.isMesh) { o.castShadow = cast !== false; o.receiveShadow = receive !== false; } });
    return m;
  }

  // Clip-space inverted-hull ink outline — uniform screen-width navy line.
  const inkMats = [];
  const flashLights = [];   // transient muzzle/glow lights, culled from shading while dark
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
  function rockGeo(radius, squashY, jitter, seed, detail) {
    const g = new THREE.IcosahedronGeometry(radius, detail == null ? 2 : detail);
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
    const geo = rockGeo(radius, opts.squashY == null ? 0.7 : opts.squashY, opts.jitter == null ? 0.28 : opts.jitter, undefined, opts.detail);
    const m = new THREE.Mesh(geo, mat);
    m.material.flatShading = true;
    m.material.needsUpdate = true;
    m.castShadow = true; m.receiveShadow = true;
    if (opts.ink) ink(m, opts.ink);
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
  sun.shadow.mapSize.set(1024, 1024);
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
  const ALB_COOL = new THREE.Color(0x4b3a5e);   // shaded rock body — the sheets' mauve-purple
  function cliffColor(worldY, lit, topY) {
    const h = clamp(worldY / 60, 0, 1);
    const c = ALB_DEEP.clone().lerp(ALB_MID, smoothstep(0.02, 0.42, h));
    c.lerp(ALB_HI, smoothstep(0.45, 0.95, h) * 0.9);
    // The wall BODY must sit in cool shadow so it cannot out-saturate the gunfire; only
    // the top rim burns. Without this the whole background is the warmest thing in frame.
    if (topY != null) {
      const fromTop = topY - worldY;
      const rim = smoothstep(9, 1.5, fromTop);
      c.lerp(ALB_COOL, (1 - rim) * 0.62);                     // body cooled + desaturated
      c.lerp(ALB_HI, rim * 0.55);                             // burning rim on the summit
    } else {
      c.lerp(ALB_COOL, 0.5);
    }
    // per-column mineral variation so neighbouring columns don't read as one flat mass
    c.multiplyScalar(0.82 + 0.30 * lit);
    return c.multiply(new THREE.Color(TOD.rockTint));
  }
  // A canyon wall built from faceted vertical COLUMNS (columnar sandstone) — each a flat
  // color mass with hard edges to its neighbours, jagged tops biting into the sky strip.
  // A canyon wall built from ORGANIC MESA MASSES — vertically stretched, noise-displaced
  // domes with rounded shoulders — replacing the stepped boxes that read as voxel
  // terracing. Displacement is a deterministic function of vertex DIRECTION, and
  // SphereGeometry is indexed, so forms deform without tearing.
  function buildCliff(width, height, cols, origin, dir, depthAmt, opts) {
    opts = opts || {};
    const group = new THREE.Group();
    const colW = width / cols;
    const v = new THREE.Vector3(), dn = new THREE.Vector3();
    for (let i = 0; i < cols; i++) {
      const cx = -width / 2 + (i + 0.5) * colW;
      const prof = opts.profile ? opts.profile(i / (cols - 1)) : 1;
      const h = height * prof * (0.6 + 0.4 * (0.5 + 0.5 * Math.sin(i * 1.7) + 0.28 * Math.sin(i * 0.6 + 1.1)));
      const rx = colW * rnd(0.78, 0.98);            // diameters overlap the neighbours
      const rz = rnd(1.6, Math.max(2.2, depthAmt * 0.55));
      const lit = clamp(0.5 + 0.5 * Math.sin(i * 0.7 + 1.0) + 0.22 * Math.sin(i * 2.9) + (opts.warm || 0), 0, 1);
      const seed = i * 3.77 + (opts.warm || 0) * 11.3;
      const geo = new THREE.SphereGeometry(1, 22, 16);
      const pp = geo.attributes.position;
      for (let k = 0; k < pp.count; k++) {
        v.set(pp.getX(k), pp.getY(k), pp.getZ(k));
        dn.copy(v).normalize();
        // Reference-sheet butte: VERTICAL sides with fluted columns, a hard flat top
        // with a stepped caprock shoulder, and a talus flare at the base.
        const ang = Math.atan2(dn.z, dn.x);
        // vertical flutes: radius varies by angle only, so ridges run top-to-bottom
        let flute = vnoise3(Math.cos(ang) * 2.4 + seed, 0, Math.sin(ang) * 2.4 + seed) - 0.5;
        flute = Math.round(flute * 5) / 5;
        // broad lobes for silhouette variety, quantised into planes
        let n = fbm3(dn.x * 1.3 + seed, dn.y * 0.9 + seed, dn.z * 1.3 + seed, 3) - 0.5;
        n = Math.round(n * 3) / 3;
        const rad = 1 + n * 0.20 + flute * 0.17;
        v.x *= rad; v.z *= rad;                       // radial only — sides stay vertical
        const y01 = clamp(v.y * 0.5 + 0.5, 0, 1);
        if (v.y > 0.70 + flute * 0.08) v.y = 0.70 + flute * 0.08;   // flat top, stepped by flute
        const shoulder = y01 > 0.80 ? 0.90 : 1.0;                   // caprock step-in
        v.x *= shoulder; v.z *= shoulder;
        if (y01 < 0.14) { v.x *= 1.12; v.z *= 1.12; }               // talus flare
        pp.setXYZ(k, v.x, v.y, v.z);
      }
      pp.needsUpdate = true; geo.computeVertexNormals();
      // colour by absolute world height (albedo only; light does the sculpting)
      const scaleY = h * 0.66, baseY = h * 0.42;
      const colors = new Float32Array(pp.count * 3), c = new THREE.Color();
      for (let k = 0; k < pp.count; k++) {
        const wy = origin.y + baseY + pp.getY(k) * scaleY;
        c.copy(cliffColor(wy, lit, origin.y + h));
        // sponged darker blotches on the faces (the sheets' mottled paint texture)
        const wx = cx + pp.getX(k) * rx, wz = pp.getZ(k) * rz;
        const blotch = fbm3(wx * 0.24 + seed, wy * 0.24, wz * 0.24, 3);
        if (blotch > 0.60) c.multiplyScalar(0.85);
        else if (blotch < 0.38) c.multiplyScalar(1.06);
        // horizontal strata banding low on the wall
        if (wy < origin.y + h * 0.32) c.multiplyScalar(0.90 + (Math.sin(wy * 2.4 + seed) * 0.5 + 0.5) * 0.12);
        colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const m = new THREE.Mesh(geo, addRim(new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.97, metalness: 0.0, fog: true,
      })));
      m.scale.set(rx, scaleY, rz);
      m.position.set(cx, baseY, rnd(-0.5, 0.5) * depthAmt);
      m.rotation.y = rnd(-0.4, 0.4);
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
  cliffs.add(buildCliff(360, 30, 64, new THREE.Vector3(0, FLOOR, -32), 0, 5));
  // first terrace band, low, just behind the enemy pockets
  cliffs.add(buildCliff(360, 11, 50, new THREE.Vector3(0, FLOOR, -19), 0, 4, { warm: 0.2 }));
  // low band behind the player before the south spine
  cliffs.add(buildCliff(360, 9, 46, new THREE.Vector3(0, FLOOR, 25), Math.PI, 4, { warm: -0.2 }));
  // Side walls: brought in so they rise on the left/right BEHIND the far bank, leaving a
  // central sky gap (the canyon opening) — the gang-on-the-bank composition.
  cliffs.add(buildCliff(64, 96, 8, new THREE.Vector3(-172, FLOOR, -2), Math.PI / 2 + 0.05, 12, { warm: 0.5 }));   // WEST end cap (the start at your back)
  cliffs.add(buildCliff(64, 96, 8, new THREE.Vector3(172, FLOOR, -2), -Math.PI / 2 - 0.05, 12, { warm: -0.15 })); // EAST end cap (the goal)

  // NEAR WALLS — the enclosure. These start beside/behind the player and run tall enough
  // to exit the top of frame, cropping the left and right edges so the camera is inside a
  // stone corridor rather than looking at a backdrop. They are excluded from casting
  // shadows: physically they'd black out the whole gorge, and the key must still reach
  // the far wall. Depth layering (near = darkest/coolest) does the rest.
  const nearWalls = new THREE.Group();
  nearWalls.add(buildCliff(360, 64, 52, new THREE.Vector3(0, FLOOR, 30), Math.PI, 10, { warm: -0.34 }));  // SOUTH spine at the player's back
  nearWalls.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  cliffs.add(nearWalls);
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

  /* ----- Moon + stars (night only) — the reference's key light, made visible ---- */
  (function moon() {
    if (TOD_NAME !== 'night') return;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#f2eeda'; x.beginPath(); x.arc(64, 64, 46, 0, 7); x.fill();
    // a few soft maria so it isn't a flat disc
    x.fillStyle = 'rgba(196,196,180,0.55)';
    [[52, 52, 13], [78, 70, 9], [60, 84, 7], [84, 46, 6]].forEach(m => {
      x.beginPath(); x.arc(m[0], m[1], m[2], 0, 7); x.fill();
    });
    const tex = new THREE.CanvasTexture(c);
    const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    disc.position.set(-26, 40, -132); disc.scale.setScalar(17); scene.add(disc);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX.smoke, color: 0xbcd0f2, transparent: true, opacity: 0.30,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.position.copy(disc.position); halo.scale.setScalar(62); scene.add(halo);
    // stars
    const sg = new THREE.BufferGeometry();
    const N = 220, arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = rnd(-Math.PI, Math.PI), e = rnd(0.18, 0.95), r = 260;
      arr[i * 3] = Math.sin(a) * Math.cos(e) * r;
      arr[i * 3 + 1] = Math.sin(e) * r;
      arr[i * 3 + 2] = -Math.abs(Math.cos(a) * Math.cos(e)) * r;
    }
    sg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe8f7, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false })));
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
    const specs = [];
    for (let i = 0; i < 11; i++) {
      specs.push([rnd(-170, 170), rnd(48, 82), rnd(-70, -125), rnd(38, 72),
        i % 3 === 0 ? texWarm : texCool, rnd(0.72, 0.95)]);
    }
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
  let riverMat = null;
  const riverUniforms = { uTime: { value: 0 }, uSun: { value: new THREE.Color(TOD.river) }, uCamX: { value: 0 },
    uDeep: { value: new THREE.Color(TOD.waterDeep || 0x0c1424) }, uLit: { value: new THREE.Color(TOD.waterLit || 0x142038) } };
  (function river() {
    const g = new THREE.PlaneGeometry(360, 15, 200, 24);
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
        'uniform float uTime; uniform float uCamX; uniform vec3 uSun; uniform vec3 uDeep; uniform vec3 uLit; varying vec2 vP; varying float vWave;\n' +
        '#include <fog_pars_fragment>\n' +
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1)))*43758.5453); }\n' +
        'float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);\n' +
        '  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }\n' +
        'float fbm(vec2 p){ float s=0.0,a=0.5; for(int k=0;k<4;k++){ s+=a*vnoise(p); p*=2.02; a*=0.5;} return s; }\n' +
        'void main(){\n' +
        '  vec2 flow = vec2(uTime*1.4, uTime*0.25);\n' +
        '  float n = fbm(vP*vec2(0.9,1.7) - flow);\n' +
        '  float band = floor(n*4.0)/4.0;\n' +               // posterized broad masses
        '  vec3 deep = uDeep;\n' +   // midnight navy channel
        '  vec3 lit  = uLit;\n' +   // lit ripple
        '  vec3 col = mix(deep, lit, band*0.85 + 0.15);\n' +
        '  float f = fbm(vP*vec2(2.3,4.0) - flow*2.2);\n' +
        '  float caps = smoothstep(0.60,0.82,f);\n' +
        '  // SIGNATURE: a defined reflection streak running toward the viewer\n' +
        '  float wob = sin(vP.y*0.30 + 0.6)*1.5 + sin(vP.y*0.85)*0.5;\n' +
        '  float dStreak = abs(vP.x - uCamX + wob);\n' +
        '  float streak = pow(smoothstep(5.0, 0.0, dStreak), 1.3);\n' +
        '  // amber reflection — deliberately capped below clipping so it never blows to white\n' +
        '  vec3 sunCol = uSun * 0.82;\n' +
        '  col = mix(col, sunCol, streak*0.92);\n' +
        '  // foam caps — a touch brighter only inside the reflection\n' +
        '  col = mix(col, mix(vec3(0.42,0.47,0.55), sunCol, 0.55), caps*(0.05 + 0.5*streak));\n' +
        '  // shimmering specular along the streak\n' +
        '  float glint = pow(max(0.0, sin(vP.x*2.2 + vP.y*1.5 - uTime*5.0)*0.5+0.5), 6.0);\n' +
        '  col += sunCol * glint * streak * 0.22;\n' +
        '  col = min(col, vec3(0.94));\n' +
        '  gl_FragColor = vec4(col, 1.0);\n' +
        '  #include <fog_fragment>\n' +
        '}',
    });
    riverMat = mat;
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(0, 0.02, -1.5);  // spans between the banks
    scene.add(mesh);
  })();

  // Dark waterline strip / wet shelf to seat the banks graphically.
  (function waterline() {
    const g = new THREE.PlaneGeometry(360, 3); g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: COL.rockWet, transparent: true, opacity: 0.5, fog: true });
    const near = new THREE.Mesh(g, m); near.position.set(0, 0.05, 4.2); scene.add(near);
  })();

  /* =========================================================================
     BANKS + COVER ROCKS + REEDS + DRIFTWOOD
     ========================================================================= */
  const world = new THREE.Group(); scene.add(world);

  function bank(zCenter, zDepth, color, y) {
    const g = new THREE.PlaneGeometry(360, zDepth, 100, 8); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, (y || 0) + Math.sin(x * 0.4) * 0.12 + Math.sin(x * 1.7 + z) * 0.06 + Math.max(0, -z) * 0.05);
    }
    p.needsUpdate = true; g.computeVertexNormals();
    const m = toonSoft(color, { flatShading: true, });
    const mesh = new THREE.Mesh(g, m); mesh.position.z = zCenter;
    mesh.receiveShadow = true; world.add(mesh);
    return mesh;
  }
  // Near bank (player side) — cool wet gravel; Far bank (enemies) — sandstone shelves.
  bank(7.8, 2.6, COL.rockShadow, 0.0);   // just the near water's edge
  bank(-12, 12, 0x46321e, 0.2);

  // Far-bank elevated shelves (give gunslingers different heights)
  // Organic ledge: a displaced, squashed dome — the box slabs read as straight
  // rectangles behind the outlaws.
  function shelf(x, z, w, d, h, color) {
    const geo = new THREE.SphereGeometry(1, 16, 12);
    const pp = geo.attributes.position, v = new THREE.Vector3();
    const seed = x * 0.37 + z * 0.11;
    for (let k = 0; k < pp.count; k++) {
      v.set(pp.getX(k), pp.getY(k), pp.getZ(k));
      const dnn = v.clone().normalize();
      let n = fbm3(dnn.x * 1.9 + seed, dnn.y * 1.4 + seed, dnn.z * 1.9 + seed, 3) - 0.5;
      n = 0.6 * n + 0.4 * (Math.round(n * 3) / 3);
      v.multiplyScalar(1 + n * 0.30);
      v.y = Math.max(v.y, -0.25);            // flatten the buried underside
      pp.setXYZ(k, v.x, v.y, v.z);
    }
    pp.needsUpdate = true; geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, toon(color, { flatShading: false }));
    m.scale.set(w * 0.62, h * 0.55, d * 0.62);
    m.position.set(x, h * 0.35, z);
    ink(m, 0.0035); shad(m); world.add(m); return m;
  }
  // Low far-bank rises the outlaws stand on — NOT tall blocks (the walls are the height).
  shelf(-113, -12.5, 14, 7, 0.8, 0x422f1c);
  shelf(-8, -13.5, 16, 8, 1.3, 0x4d2b18);
  shelf(126, -12.8, 13, 7, 1.0, 0x422f1c);
  shelf(63, -14, 13, 7, 4.6, 0x5d3320);   // Crow's overwatch ledge above the Narrows

  // Scatter cover rocks along both banks + in the river.
  const riverRocks = [];
  function scatterRocks() {
    // south-bank cover chain — a boulder every 13-21 units for the whole run, so there is
    // always a next rock to sprint to (the traversal rhythm of the level)
    for (let x = -152; x <= 152; x += rnd(13, 21)) {
      const rr = rnd(1.0, 2.0);
      const r = makeRock(rr, toon(0x101a2c, { flatShading: true, roughness: 0.6 }), { squashY: 0.62 });
      r.position.set(x + rnd(-2, 2), rr * 0.38, rnd(4.0, 6.4)); world.add(r);
    }
    // river boulders
    for (let i = 0; i < 34; i++) {
      const rr = rnd(0.4, 1.1);
      const r = makeRock(rr, toon(0x14203a, { flatShading: true, roughness: 0.55 }), { squashY: 0.5 });
      r.position.set(rnd(-150, 150), rr * 0.18, rnd(-6, 2)); world.add(r); riverRocks.push(r);
    }
    // far-bank cover boulders, clustered around the enemy pockets
    const farXs = [-128, -117, -108, -26, -14, -2, 8, 118, 130, 144, -62, 34, 92, -88];
    for (const fx of farXs) {
      const rr = rnd(1.0, 1.5);
      const r = makeRock(rr, toon(COL.rockMid, { flatShading: true }), { squashY: 0.75 });
      r.position.set(fx + rnd(-3, 3), rr * 0.5, rnd(-10, -8)); world.add(r);
    }
    // FORDS — pale shallow bars crossing the river: the two crossings of The Run
    for (const fx of [-60, 115]) {
      const bar = blob(toonSoft(0x63492c, { flatShading: false }), 8.0, 0.42, 6.0, 14);
      bar.position.set(fx, 0.02, -1.2); bar.receiveShadow = true; world.add(bar);
    }
    // THE NARROWS — butte clusters jut in from both banks at x ~ 64, pinching the
    // corridor. Same former as the canyon walls so the pinch speaks the wall language.
    world.add(buildCliff(30, 22, 5, new THREE.Vector3(64, FLOOR, -10), 0.35, 7, { warm: 0.35 }));
    world.add(buildCliff(26, 17, 4, new THREE.Vector3(62, FLOOR, 14), Math.PI - 0.3, 6, { warm: -0.15 }));
  }
  scatterRocks();

  (function scrub() {
    const cols = [0x4a5230, 0x5a6340, 0x47502e, 0x5e5a30];
    const tint = new THREE.Color(TOD.rockTint);
    function bush(x, z, sc, y) {
      const n = rint(2, 4);
      for (let i = 0; i < n; i++) {
        const c = new THREE.Color(cols[rint(0, 3)]).multiply(tint).getHex();
        const b = blob(toon(c, { flatShading: false }), sc * rnd(0.5, 0.85), sc * rnd(0.3, 0.5), sc * rnd(0.5, 0.85), 8);
        b.position.set(x + rnd(-sc, sc) * 0.8, (y || 0) + sc * 0.22 + rnd(0, 0.08), z + rnd(-sc, sc) * 0.6);
        b.castShadow = true;
        world.add(b);
      }
    }
    for (let i = 0; i < 48; i++) bush(rnd(-155, 155), rnd(6.6, 20), rnd(0.5, 1.1));    // south bank
    for (let i = 0; i < 42; i++) bush(rnd(-155, 155), rnd(-17, -9.5), rnd(0.5, 1.2));  // far-bank benches
    for (let i = 0; i < 10; i++) bush(rnd(-150, 150), rnd(6.5, 7.3), rnd(0.35, 0.6));  // waterline tufts
  })();

  // Contact shadows. The river is a custom ShaderMaterial so it cannot receive the
  // shadow map; without these the boulders look pasted onto the surface. A soft dark
  // ellipse laid just above the waterline grounds them.
  (function contactShadows() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(6,14,34,0.5)'); g.addColorStop(0.55, 'rgba(7,16,38,0.24)');
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
    for (let i = 0; i < 70; i++) {
      const rr = rnd(0.30, 0.95);
      const m = makeRock(rr, toon(new THREE.Color(i % 3 === 0 ? 0x663a20 : 0x764425).multiply(new THREE.Color(TOD.rockTint)).getHex(), { flatShading: true }), { squashY: 0.55 });
      m.position.set(rnd(-155, 155), rnd(0.05, 0.35), rnd(-8.4, -6.2));
      m.rotation.y = rnd(0, 6.28);
      world.add(m);
    }
    // a few larger blocks sitting proud of the bank edge
    for (let i = 0; i < 20; i++) {
      const rr = rnd(0.9, 1.7);
      const m = makeRock(rr, toon(new THREE.Color(0x734022).multiply(new THREE.Color(TOD.rockTint)).getHex(), { flatShading: true }), { squashY: 0.7 });
      m.position.set(rnd(-152, 152), rnd(0.3, 0.9), rnd(-10.5, -8.5));
      m.rotation.y = rnd(0, 6.28);
      world.add(m);
    }
  })();

  // Reeds (thin swaying quads) along the near bank
  const reeds = [];
  (function makeReeds() {
    const rmat = toonSoft(COL.reed, { side: THREE.DoubleSide, transparent: true });
    // small backlit grass clumps along the near bank edges — never blocking the view
    for (let i = 0; i < 72; i++) {
      const h = rnd(0.28, 0.6);
      const g = new THREE.PlaneGeometry(0.05, h, 1, 3);
      g.translate(0, h / 2, 0);
      const m = new THREE.Mesh(g, rmat);
      const side = i % 2 ? 1 : -1;
      m.position.set(side * rnd(3.5, 152), 0.05, rnd(2.6, 4.4));
      m.rotation.y = rnd(0, Math.PI);
      m.userData.h = h; m.userData.phase = rnd(0, 6.28);
      world.add(m); reeds.push(m);
    }
  })();

  // A little driftwood
  (function driftwood() {
    for (let i = 0; i < 14; i++) {
      const g = new THREE.CylinderGeometry(0.08, 0.11, rnd(1.4, 2.6), 6);
      const m = new THREE.Mesh(g, toon(COL.wood, { flatShading: true }));
      m.rotation.z = Math.PI / 2; m.rotation.y = rnd(0, Math.PI);
      m.position.set(rnd(-150, 150), 0.14, rnd(2.5, 5.5)); ink(m, 0.003); world.add(m);
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
     JODY JONES — full character, for the cinematic third-person camera.
     Seen mostly from behind/over-the-shoulder, so the silhouette that matters is
     hat brim, blond hair, the fringed olive poncho, and the extended Colt arm.
     ========================================================================= */
  const Jody = (function () {
    const g = new THREE.Group();
    // Aztec diamond band on the poncho — the character's signature pattern.
    function ponchoTexture() {
      const c = document.createElement('canvas'); c.width = 128; c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = '#6b6b34'; x.fillRect(0, 0, 128, 128);                 // olive ground
      x.fillStyle = '#4e5026';
      for (let i = 0; i < 128; i += 8) x.fillRect(0, i, 128, 1);           // woven weft
      function band(cy, h, col, accent) {
        x.fillStyle = col; x.fillRect(0, cy - h / 2, 128, h);
        x.fillStyle = accent;
        for (let dx = 0; dx < 128; dx += 22) {                            // diamonds
          x.beginPath();
          x.moveTo(dx + 11, cy - h / 2 + 2); x.lineTo(dx + 20, cy);
          x.lineTo(dx + 11, cy + h / 2 - 2); x.lineTo(dx + 2, cy); x.closePath(); x.fill();
        }
      }
      band(40, 15, '#14203a', '#b04a29');
      band(92, 15, '#14203a', '#ecdfc4');
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1);
      return t;
    }
    const ponchoMat = addRim(new THREE.MeshStandardMaterial({
      map: ponchoTexture(), roughness: 0.95, metalness: 0, flatShading: true, side: THREE.DoubleSide }));
    const shirt = toon(0x1b2440, { flatShading: true });
    const hatM = toon(0x14161e, { flatShading: true });
    const hairM = toon(0xe0b366, { flatShading: true });     // blond — must out-value the olive
    const skinM = toon(0xa9744c, { flatShading: true });
    const leatherM = toon(0x4a2f18, { flatShading: true });
    const gloveM = toon(0x8a6a3f, { flatShading: true });     // light tan — reads against ink
    const steelM = toon(0x6b6a66, { flatShading: true, roughness: 0.35, metalness: 0.65 });  // Stone Gray
    function b(w, h, d, mat, x, y, z, rz, rx) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); if (rz) m.rotation.z = rz; if (rx) m.rotation.x = rx;
      g.add(m); return m;
    }
    // --- SMOOTH FIGURE: swept tubes and spheroids, no stacked boxes ---
    // legs, braced apart behind the cover rock
    g.add(limb(shirt, [[-0.17, 0.94, 0.02], [-0.19, 0.60, 0.05], [-0.20, 0.26, 0.06], [-0.20, 0.10, 0.06]],
      [0.145, 0.125, 0.098, 0.088]));
    g.add(limb(shirt, [[0.18, 0.94, -0.02], [0.21, 0.60, -0.04], [0.22, 0.26, -0.02], [0.22, 0.10, -0.01]],
      [0.145, 0.125, 0.098, 0.088]));
    const bootL = blob(leatherM, 0.115, 0.075, 0.16, 14); bootL.position.set(-0.20, 0.075, 0.03); g.add(bootL);
    const bootR = blob(leatherM, 0.115, 0.075, 0.16, 14); bootR.position.set(0.22, 0.075, 0.01); g.add(bootR);
    // torso: a tapered sweep from hips to shoulders
    g.add(limb(shirt, [[0, 0.92, 0], [0, 1.16, -0.012], [0, 1.40, -0.01], [0, 1.58, 0]],
      [0.235, 0.255, 0.262, 0.222], 14));
    const shoulders = blob(shirt, 0.345, 0.135, 0.20, 16); shoulders.position.set(0, 1.545, 0); g.add(shoulders);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.042, 8, 20), leatherM);
    belt.rotation.x = Math.PI / 2; belt.position.set(0, 0.95, 0); g.add(belt);

    // --- PONCHO: a draped lathe, pleated, hitched over the gun arm ---
    const poncho = lathe([[0.19, 0.74], [0.32, 0.70], [0.41, 0.52], [0.48, 0.22], [0.51, 0.02]], 26, ponchoMat);
    (function drape() {
      const pp = poncho.geometry.attributes.position, v = new THREE.Vector3();
      for (let k = 0; k < pp.count; k++) {
        v.set(pp.getX(k), pp.getY(k), pp.getZ(k));
        const ang = Math.atan2(v.z, v.x), r = Math.hypot(v.x, v.z);
        const down = clamp(1 - v.y / 0.74, 0, 1);
        const pleat = Math.sin(ang * 6.0) * 0.032 + Math.sin(ang * 11.0 + 1.1) * 0.015;
        const nr = r + pleat * down * 1.6;
        v.x = Math.cos(ang) * nr; v.z = Math.sin(ang) * nr;
        v.y += Math.max(0, Math.cos(ang)) * 0.19 * down - Math.max(0, -Math.cos(ang)) * 0.07 * down;
        pp.setXYZ(k, v.x, v.y, v.z);
      }
      pp.needsUpdate = true; poncho.geometry.computeVertexNormals();
    })();
    poncho.position.set(0, 0.80, 0); g.add(poncho);
    for (let i = 0; i < 30; i++) {                       // fringe: tapered spikes, not boxes
      const a = (i / 30) * Math.PI * 2;
      const lift = Math.max(0, Math.cos(a)) * 0.19 - Math.max(0, -Math.cos(a)) * 0.07;
      const x0 = Math.cos(a) * 0.52, z0 = Math.sin(a) * 0.52, y0 = 0.82 + lift;
      g.add(limb(ponchoMat, [[x0, y0, z0], [x0 * 1.03, y0 - 0.10, z0 * 1.03], [x0 * 1.04, y0 - 0.17, z0 * 1.04]],
        [0.016, 0.011, 0.004], 5));
    }

    // --- ARMS: swept tubes. The gun arm leaves the poncho contour entirely. ---
    g.add(limb(shirt, [[-0.30, 1.50, 0.02], [-0.46, 1.30, 0.14], [-0.58, 1.10, 0.32], [-0.62, 1.00, 0.42]],
      [0.098, 0.088, 0.078, 0.070]));                    // braced left arm
    const lHand = blob(gloveM, 0.072, 0.062, 0.085, 12); lHand.position.set(-0.63, 0.97, 0.46); g.add(lHand);
    g.add(limb(shirt, [[0.30, 1.52, 0.0], [0.52, 1.52, -0.20], [0.72, 1.49, -0.52], [0.80, 1.47, -0.70]],
      [0.100, 0.090, 0.076, 0.066]));                    // gun arm, extended clear of the body
    const rHand = blob(gloveM, 0.075, 0.070, 0.090, 12); rHand.position.set(0.82, 1.47, -0.76); g.add(rHand);

    // --- COLT, held in that fist ---
    const colt = new THREE.Group();
    const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.32, 12), steelM);
    cb.rotation.x = Math.PI / 2; cb.position.set(0, 0.015, -0.19); colt.add(cb);
    const ccyl = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.095, 12), steelM);
    ccyl.rotation.x = Math.PI / 2; colt.add(ccyl);
    const cgrip = limb(toon(0x7a4a24, { flatShading: false }),
      [[0, -0.02, 0.03], [0, -0.09, 0.075], [0, -0.155, 0.115]], [0.036, 0.033, 0.026], 8);
    colt.add(cgrip);
    colt.position.set(0.86, 1.47, -0.88); colt.rotation.y = -0.10; g.add(colt);
    const coltFlash = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({
      map: TEX.flash, color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    coltFlash.position.set(0.86, 1.49, -1.12); g.add(coltFlash);
    const coltLight = new THREE.PointLight(0xffa848, 0, 8); coltLight.position.set(0.86, 1.50, -1.18); coltLight.visible = false; flashLights.push(coltLight); g.add(coltLight);

    // --- HEAD: spheroid skull tapering to a jaw, blond hair over the collar ---
    g.add(limb(skinM, [[0, 1.52, 0], [0, 1.62, -0.01]], [0.078, 0.070], 10));   // neck
    const skull = blob(skinM, 0.118, 0.132, 0.126, 18); skull.position.set(0, 1.755, -0.005); g.add(skull);
    const jaw = blob(skinM, 0.092, 0.072, 0.104, 14); jaw.position.set(0, 1.665, -0.022); g.add(jaw);
    const nose = blob(skinM, 0.030, 0.034, 0.045, 10); nose.position.set(0, 1.745, -0.128); g.add(jaw), g.add(nose);
    const brow = blob(skinM, 0.112, 0.026, 0.045, 12); brow.position.set(0, 1.808, -0.104); g.add(brow);
    const stubble = blob(toon(0x6f4630, { flatShading: false }), 0.088, 0.052, 0.098, 14);
    stubble.position.set(0, 1.648, -0.030); g.add(stubble);
    // hair: a rounded mass under the hat plus a fall over the collar
    const hairTop = blob(hairM, 0.126, 0.075, 0.132, 16); hairTop.position.set(0, 1.792, 0.010); g.add(hairTop);
    const hairBack = blob(hairM, 0.145, 0.160, 0.098, 16); hairBack.position.set(0, 1.660, 0.088); g.add(hairBack);
    const hairEnds = blob(hairM, 0.152, 0.075, 0.088, 16); hairEnds.position.set(0, 1.528, 0.072); g.add(hairEnds);
    g.add(limb(hairM, [[0.128, 1.775, 0.03], [0.140, 1.660, 0.05], [0.132, 1.560, 0.06]], [0.052, 0.058, 0.040], 8));
    g.add(limb(hairM, [[-0.128, 1.775, 0.03], [-0.140, 1.660, 0.05], [-0.132, 1.560, 0.06]], [0.052, 0.058, 0.040], 8));

    // --- HAT: lathe brim with a curl, pinched crown, tilted ---
    const brim = lathe([[0.03, 0.040], [0.14, 0.030], [0.21, 0.012], [0.255, 0.003], [0.268, 0.042]], 22, hatM);
    brim.position.set(0, 1.872, -0.012); brim.rotation.z = 0.10; brim.scale.set(1, 1, 1.10); g.add(brim);
    const crown = lathe([[0.02, 0], [0.132, 0.014], [0.150, 0.105], [0.112, 0.215], [0.02, 0.235]], 20, hatM);
    crown.position.set(0, 1.880, 0); crown.rotation.z = 0.10; g.add(crown);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.140, 0.018, 8, 22), toon(0x3a2416, { flatShading: false }));
    band.rotation.x = Math.PI / 2; band.position.set(0, 1.920, 0); band.rotation.z = 0.10; g.add(band);

    // CHARACTER KEY: he stands inside the canyon's shadow, so skylight alone flattens
    // hair, skin, poncho and gun into one value. A dedicated short-throw warm key (the
    // standard film fix) separates them without touching the environment's lighting.
    const charKey = new THREE.PointLight(0xffc98a, 3.6, 5.0, 2.0);
    charKey.position.set(-1.5, 3.0, -1.4); charKey.visible = false; g.add(charKey);
    const charFill = new THREE.PointLight(0x8fb0e8, 1.5, 4.2, 2.0);
    charFill.position.set(1.7, 1.6, 1.5); charFill.visible = false; g.add(charFill);

    g.position.set(0.6, -0.55, 6.4);
    g.rotation.y = 0.34;                // turned so the extended gun arm clears his outline
    shad(g);
    g.visible = false;
    scene.add(g);
    return {
      group: g, flash: coltFlash, light: coltLight,
      charLights(on) { charKey.visible = on; charFill.visible = on; },
      fireFX() { coltFlash.material.opacity = 1; coltFlash.material.rotation = rnd(0, 6.28); coltLight.intensity = 6; },
      update(dt) {
        if (coltFlash.material.opacity > 0) {
          coltFlash.material.opacity = Math.max(0, coltFlash.material.opacity - dt * 5);
          coltLight.intensity = coltFlash.material.opacity * 6;
        }
        // subtle breathing so he isn't a statue
        g.position.y = -0.55 + Math.sin(clock * 1.1) * 0.012;
      },
    };
  })();

  /* =========================================================================
     COLT VIEWMODEL  (Jody's hand + revolver at bottom of frame)
     ========================================================================= */
  const Colt = (function () {
    const grp = new THREE.Group();
    // Rebuilt against the hand-drawn reference: Colt held low-right, barrel angled up and
    // inward, deep-fluted cylinder, cocked hammer, walnut butt showing under the fist,
    // chunky leather glove with the thumb hooked over the back, olive sleeve with a
    // patterned band. Matte materials (spec highlights read as sticker-dots in the style).
    const steelM = new THREE.MeshStandardMaterial({ color: 0x2b3340, roughness: 0.7, metalness: 0.35, fog: false });
    const steelDarkM = new THREE.MeshStandardMaterial({ color: 0x161c26, roughness: 0.75, metalness: 0.3, fog: false });
    const walnutM = new THREE.MeshStandardMaterial({ color: 0x5a3014, roughness: 1.0, metalness: 0, fog: false });
    const gloveM = new THREE.MeshStandardMaterial({ color: 0x4e2c15, roughness: 1.0, metalness: 0, fog: false });
    const gloveDarkM = new THREE.MeshStandardMaterial({ color: 0x38200e, roughness: 1.0, metalness: 0, fog: false });
    const sleeveM = new THREE.MeshStandardMaterial({ color: 0x565b2e, roughness: 1.0, metalness: 0, fog: false });
    const bandM = new THREE.MeshStandardMaterial({ color: 0xa98753, roughness: 1.0, metalness: 0, fog: false });
    function add(m, x, y, z, rx, ry, rz) {
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx; if (ry) m.rotation.y = ry; if (rz) m.rotation.z = rz;
      grp.add(m); return m;
    }
    // --- the Colt, barrel forward (-z) ---
    const barrel = add(new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.024, 0.64, 12), steelM), 0, 0.030, -0.39, Math.PI / 2); ink(barrel, 0.006);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.030, 0.030), steelM), 0, 0.062, -0.69);          // front sight blade
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.30, 8), steelDarkM), 0.024, 0.002, -0.28, Math.PI / 2);  // ejector housing
    const cyl = add(new THREE.Mesh(new THREE.CylinderGeometry(0.060, 0.060, 0.150, 14), steelM), 0, 0.004, -0.035, Math.PI / 2); ink(cyl, 0.006);
    for (let i = 0; i < 6; i++) {                                    // deep flutes — the revolver read
      const a = (i / 6) * Math.PI * 2 + 0.3;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.152, 6), steelDarkM),
        Math.cos(a) * 0.052, 0.004 + Math.sin(a) * 0.052, -0.035, Math.PI / 2);
    }
    const frame = add(blob(steelM, 0.042, 0.055, 0.085, 12), 0, 0.004, 0.070); ink(frame, 0.006);       // recoil shield / frame
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.24, 8), steelM), 0, 0.068, -0.01, Math.PI / 2);  // topstrap
    // cocked hammer: a curved spur swept back, knurled tip
    const hammer = add(limb(steelDarkM, [[0, 0.070, 0.105], [0, 0.112, 0.148], [0, 0.104, 0.185]], [0.015, 0.013, 0.019], 8), 0, 0, 0);
    ink(hammer, 0.005);
    // walnut plow-handle: butt curves out BELOW the fist (per the reference)
    const gripW = add(limb(walnutM, [[0, -0.030, 0.130], [0, -0.100, 0.180], [0, -0.170, 0.205], [0, -0.208, 0.192]],
      [0.030, 0.037, 0.041, 0.026], 10), 0, 0, 0); ink(gripW, 0.006);
    // --- the gloved fist: one chunky mass + finger ridges + hooked thumb ---
    const fist = add(blob(gloveM, 0.068, 0.082, 0.086, 14), 0.010, -0.072, 0.148, 0, 0, 0.12); ink(fist, 0.006);
    for (let i = 0; i < 4; i++) {                                    // finger ridges wrapping the front
      const fy = -0.026 - i * 0.031;
      add(limb(gloveDarkM, [[0.052, fy, 0.150], [0.0, fy - 0.004, 0.104], [-0.048, fy, 0.148]],
        [0.0175, 0.0165, 0.0140], 7), 0, 0, 0);
    }
    add(limb(gloveM, [[0.055, -0.012, 0.190], [0.016, 0.028, 0.166], [-0.026, 0.030, 0.152]],
      [0.020, 0.018, 0.014], 7), 0, 0, 0);                            // thumb hooked over the back
    add(blob(gloveDarkM, 0.020, 0.014, 0.020, 8), 0.046, -0.020, 0.128);   // knuckle bumps
    add(blob(gloveDarkM, 0.018, 0.013, 0.018, 8), 0.050, -0.052, 0.132);
    // flared gauntlet cuff
    const cuff = add(lathe([[0.062, 0], [0.072, 0.030], [0.086, 0.075], [0.094, 0.105]], 12, gloveM), 0.035, -0.185, 0.235, 0.9, 0, -0.25);
    ink(cuff, 0.006);
    // --- olive sleeve sweeping to the bottom-right corner, with the patterned band ---
    const sleeve = add(limb(sleeveM, [[0.050, -0.215, 0.270], [0.135, -0.290, 0.395], [0.255, -0.395, 0.545]],
      [0.078, 0.098, 0.125], 12), 0, 0, 0); ink(sleeve, 0.006);
    const band1 = add(new THREE.Mesh(new THREE.TorusGeometry(0.100, 0.017, 8, 16), bandM), 0.135, -0.290, 0.395);
    band1.rotation.x = 0.85; band1.rotation.z = -0.45; ink(band1, 0.005);
    const band2 = add(new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.012, 8, 16), steelDarkM), 0.168, -0.318, 0.437);
    band2.rotation.x = 0.85; band2.rotation.z = -0.45;

    // muzzle flash + smoke anchor
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), new THREE.MeshBasicMaterial({ map: TEX.flash, color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    flash.position.set(0, 0.035, -0.74); grp.add(flash);
    const flashPt = new THREE.PointLight(0xffa040, 0, 4.0); flashPt.position.set(0, 0.12, -0.6); flashPt.visible = false; flashLights.push(flashPt); grp.add(flashPt);

    // Resting pose: close to camera-forward so the barrel actually crosses the crosshair
    // (it was yawed ~46° across the frame — stylish per the reference photo, but it broke
    // the player's intuition that "where the gun points" = "where the shot lands," since
    // the hitscan is always exactly screen-center regardless of how the viewmodel is posed).
    grp.position.set(0.30, -0.22, -0.66);
    grp.rotation.set(0.10, 0.16, -0.04);
    grp.scale.setScalar(0.88);
    const kicker = new THREE.PointLight(0xffc98a, 0.55, 3.0, 1.2);
    kicker.position.set(-0.55, 0.75, -0.35); camera.add(kicker);
    camera.add(grp); scene.add(camera);

    let recoil = 0, flashT = 0, sway = new THREE.Vector2(), bob = 0, adsBlend = 0, adsTarget = 0;
    const homePos = grp.position.clone();
    const homeRot = grp.rotation.clone();
    // Aim-down-sights pose: nearly dead-straight, pulled toward screen centre.
    const adsPos = new THREE.Vector3(0.045, -0.145, -0.50);
    const adsRot = new THREE.Vector3(0.02, 0.0, 0.0);
    return {
      group: grp, kicker,
      fireFX() { recoil = 1; flashT = 1; flash.material.rotation = rnd(0, 6.28); flashPt.intensity = 6; },
      setADS(on) { adsTarget = on ? 1 : 0; },
      getADS() { return adsBlend; },
      update(dt, lookVel, moving) {
        recoil = lerp(recoil, 0, dt * 10);
        flashT = Math.max(0, flashT - dt * 6);
        flash.material.opacity = flashT;
        flash.scale.setScalar(1 + (1 - flashT) * 0.6);
        flashPt.intensity = flashT * 6;
        adsBlend = lerp(adsBlend, adsTarget, dt * 9);
        // sway from look, gentle idle bob — both damped while aiming down sights
        const swayDamp = 1 - adsBlend * 0.75;
        bob += dt * 1.2;
        sway.x = lerp(sway.x, clamp(-lookVel.x * 0.02, -0.05, 0.05) * swayDamp, dt * 6);
        sway.y = lerp(sway.y, clamp(lookVel.y * 0.02, -0.05, 0.05) * swayDamp, dt * 6);
        const px = lerp(homePos.x, adsPos.x, adsBlend), py = lerp(homePos.y, adsPos.y, adsBlend), pz = lerp(homePos.z, adsPos.z, adsBlend);
        grp.position.x = px + sway.x + Math.sin(bob) * 0.006 * swayDamp;
        grp.position.y = py + sway.y + Math.cos(bob * 0.9) * 0.006 * swayDamp - recoil * 0.05;
        grp.position.z = pz + recoil * 0.14;
        grp.rotation.y = lerp(homeRot.y, adsRot.y, adsBlend);
        grp.rotation.x = lerp(homeRot.x, adsRot.x, adsBlend) - recoil * 0.5 + tremor.x;
        grp.rotation.z = lerp(homeRot.z, adsRot.z, adsBlend) + tremor.y;
      },
    };
  })();
  const tremor = new THREE.Vector2();

  /* =========================================================================
     ENEMIES  — outlaws that peek briefly from cover (movement-first visibility)
     ========================================================================= */
  // An outlaw built silhouette-first: wide hat brim, coat shoulders flaring to a skirt,
  // legs apart, rifle up across the body. Bold simple masses per the production rules.
  // Lathe profile helper — smooth, shaped volumes (coat, hat crown) from a silhouette.
  /* --- ORGANIC FIGURE GEOMETRY ---------------------------------------------
     Characters built from stacked boxes read as toys no matter how they're shaded.
     These build smooth, tapered, posed forms instead: limbs are swept tubes along a
     spline with a per-point radius, masses are deformable spheroids. ------------- */
  function tubeTaper(pts, radii, radialSeg, tubularSeg) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const TS = tubularSeg || 20, RS = radialSeg || 10;
    const frames = curve.computeFrenetFrames(TS, false);
    const position = [], normal = [], index = [];
    const P = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
    for (let i = 0; i <= TS; i++) {
      const t = i / TS;
      curve.getPointAt(t, P);
      N.copy(frames.normals[i]); B.copy(frames.binormals[i]);
      // radius profile sampled along the sweep
      const f = t * (radii.length - 1), i0 = Math.floor(f), i1 = Math.min(radii.length - 1, i0 + 1);
      const r = lerp(radii[i0], radii[i1], f - i0);
      for (let j = 0; j <= RS; j++) {
        const v = (j / RS) * Math.PI * 2, cs = Math.cos(v), sn = Math.sin(v);
        const nx = cs * N.x + sn * B.x, ny = cs * N.y + sn * B.y, nz = cs * N.z + sn * B.z;
        position.push(P.x + nx * r, P.y + ny * r, P.z + nz * r);
        normal.push(nx, ny, nz);
      }
    }
    for (let i = 1; i <= TS; i++) for (let j = 1; j <= RS; j++) {
      const a = (RS + 1) * (i - 1) + (j - 1), b = (RS + 1) * i + (j - 1);
      const c = (RS + 1) * i + j, d = (RS + 1) * (i - 1) + j;
      index.push(a, b, d, b, c, d);
    }
    // CAP THE ENDS. Open tubes read as holes — the bright background shines through the
    // bore and the ink shell rings it, which looked like glowing "eyes" on the limbs.
    // Fans are added with both windings so a cap is solid from every view angle.
    const t0 = curve.getTangentAt(0), t1 = curve.getTangentAt(1);
    const pStart = curve.getPointAt(0), pEnd = curve.getPointAt(1);
    const cs = position.length / 3;
    position.push(pStart.x, pStart.y, pStart.z); normal.push(-t0.x, -t0.y, -t0.z);
    const ce = position.length / 3;
    position.push(pEnd.x, pEnd.y, pEnd.z); normal.push(t1.x, t1.y, t1.z);
    for (let j = 0; j < RS; j++) {
      index.push(cs, j, j + 1); index.push(cs, j + 1, j);
      const base = (RS + 1) * TS;
      index.push(ce, base + j, base + j + 1); index.push(ce, base + j + 1, base + j);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
    g.setIndex(index);
    return g;
  }
  function limb(mat, pts, radii, seg) {
    return new THREE.Mesh(tubeTaper(pts, radii, seg || 10, 22), mat);
  }
  // A spheroid that can be squashed and bent — heads, shoulders, hands, boots.
  function blob(mat, rx, ry, rz, detail) {
    const g = new THREE.SphereGeometry(1, detail || 16, (detail || 16) * 0.7);
    g.scale(rx, ry, rz);
    // geometry.scale() leaves the unit-sphere normals untouched, so non-uniform blobs
    // lit with them grow a false hot "pole" facing the light. Recompute after scaling.
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  }
  function lathe(profile, seg, mat) {
    const pts = profile.map((p) => new THREE.Vector2(p[0], p[1]));
    return new THREE.Mesh(new THREE.LatheGeometry(pts, seg || 12), mat);
  }
  // `variant` shifts build, stance and gear so the gang doesn't read as clones.
  function makeOutlaw(color, scarfCol, variant) {
    const g = new THREE.Group();
    const V = variant || 0;
    const build = [1.0, 1.09, 0.94, 1.04, 0.97][V % 5];
    const cloth = toon(color, { flatShading: false });
    const dark = toon(COL.cloth, { flatShading: false });
    const skin = toon(COL.skin, { flatShading: false });
    const hat = toon(COL.hat, { flatShading: false });
    const scarf = toon(scarfCol == null ? COL.olive : scarfCol, { flatShading: false });
    const steel = toon(0x6b6a66, { flatShading: false, roughness: 0.4, metalness: 0.6 });
    const wood = toon(0x4a2c14, { flatShading: false });
    const vest = toon([0x2b2333, 0x33291f, 0x24303f, 0x392a2a, 0x2a3327][V % 5], { flatShading: false });
    const glove = toon(0x6a4e2c, { flatShading: false });
    const stance = [0.06, 0.10, 0.03, 0.08, 0.05][V % 5];
    // legs as swept tubes, planted at slightly different angles per man
    g.add(limb(dark, [[-0.14, 0.90, 0], [-0.16 - stance, 0.56, 0.02], [-0.17 - stance, 0.22, 0.03], [-0.17 - stance, 0.09, 0.03]],
      [0.115, 0.098, 0.080, 0.072], 8));
    g.add(limb(dark, [[0.15, 0.90, 0], [0.17 + stance * 0.6, 0.56, -0.01], [0.18 + stance * 0.6, 0.22, 0.01], [0.18 + stance * 0.6, 0.09, 0.01]],
      [0.115, 0.098, 0.080, 0.072], 8));
    const bL = blob(dark, 0.095, 0.058, 0.135, 12); bL.position.set(-0.17 - stance, 0.06, 0.03); g.add(bL);
    const bR = blob(dark, 0.095, 0.058, 0.135, 12); bR.position.set(0.18 + stance * 0.6, 0.06, 0.02); g.add(bR);
    // coat: a shaped lathe, waist pinched, hem flaring
    const coat = lathe([[0.03, 0], [0.26, 0.02], [0.36, 0.10], [0.38, 0.28],
      [0.30, 0.50], [0.27, 0.68], [0.30, 0.84], [0.34, 0.98], [0.24, 1.04], [0.03, 1.06]], 18, cloth);
    coat.position.set(0, 0.52, 0); coat.scale.set(build, 1, build * 0.92); g.add(coat);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.036, 7, 16), dark);
    belt.rotation.x = Math.PI / 2; belt.position.set(0, 0.92, 0); g.add(belt);
    const holster = blob(dark, 0.065, 0.10, 0.055, 10); holster.position.set(0.28, 0.83, 0.10); g.add(holster);
    const chest = blob(vest, 0.14, 0.21, 0.13, 14); chest.position.set(0, 1.30, 0.05); g.add(chest);
    // torso + shoulders
    g.add(limb(cloth, [[0, 1.06, 0], [0, 1.30, -0.01], [0, 1.52, 0], [0, 1.62, 0]],
      [0.255 * build, 0.278 * build, 0.268 * build, 0.222 * build], 12));
    const sh = blob(cloth, 0.335 * build, 0.115, 0.185, 14); sh.position.set(0, 1.60, 0); g.add(sh);
    const nk = blob(scarf, 0.105, 0.070, 0.105, 12); nk.position.set(0, 1.70, 0.01); g.add(nk);
    const knot = blob(scarf, 0.075, 0.085, 0.055, 10); knot.position.set(0, 1.655, 0.11); g.add(knot);
    // head + hat
    g.add(limb(skin, [[0, 1.66, 0], [0, 1.74, 0]], [0.062, 0.058], 8));
    const skull = blob(skin, 0.105, 0.118, 0.112, 14); skull.position.set(0, 1.855, 0); g.add(skull);
    const jaw = blob(skin, 0.082, 0.062, 0.092, 12); jaw.position.set(0, 1.775, -0.018); g.add(jaw);
    if (V % 3 === 0) { const bd = blob(toon(0x3a2a20, { flatShading: false }), 0.084, 0.055, 0.09, 12); bd.position.set(0, 1.762, -0.022); g.add(bd); }
    const brim = lathe([[0.03, 0.04], [0.15, 0.032], [0.24, 0.012], [0.30, 0.002], [0.315, 0.046]], 18, hat);
    brim.position.set(0, 1.965, -0.008); brim.rotation.z = 0.06 + (V % 3) * 0.03; g.add(brim);
    const crown = lathe([[0.02, 0], [0.135, 0.012], [0.155, 0.10], [0.118, 0.212], [0.02, 0.23]], 16, hat);
    crown.position.set(0, 1.975, 0); crown.rotation.z = 0.06 + (V % 3) * 0.03; g.add(crown);
    // arms up on the rifle
    const aim = [0.0, 0.05, -0.04, 0.03, -0.02][V % 5];
    g.add(limb(cloth, [[-0.30 * build, 1.55, 0.02], [-0.42 * build, 1.36, 0.14], [-0.50 * build, 1.22, 0.28]],
      [0.082, 0.074, 0.066], 8));
    g.add(limb(cloth, [[0.30 * build, 1.56, 0.02], [0.36 * build, 1.38, 0.16], [0.32 * build, 1.26, 0.30]],
      [0.082, 0.074, 0.066], 8));
    const hL = blob(glove, 0.058, 0.052, 0.068, 10); hL.position.set(-0.52 * build, 1.20, 0.32); g.add(hL);
    const hR = blob(glove, 0.058, 0.052, 0.068, 10); hR.position.set(0.31 * build, 1.24, 0.33); g.add(hR);
    // lever rifle
    const rifle = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.024, 1.24, 10), steel);
    barrel.rotation.z = Math.PI / 2; rifle.add(barrel);
    const mag = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.94, 8), steel);
    mag.rotation.z = Math.PI / 2; mag.position.set(0.06, -0.038, 0); rifle.add(mag);
    const stock = limb(wood, [[0.42, -0.01, 0], [0.66, -0.05, 0], [0.86, -0.085, 0]], [0.05, 0.058, 0.044], 8);
    rifle.add(stock);
    const lever = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.011, 6, 10, Math.PI * 1.2), steel);
    lever.rotation.y = Math.PI / 2; lever.position.set(0.26, -0.085, 0); rifle.add(lever);
    rifle.position.set(-0.10, 1.22, 0.32); rifle.rotation.y = -0.12;
    rifle.rotation.z = 0.05 + aim;
    g.add(rifle);
    // muzzle flash at the barrel tip
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: TEX.flash, color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    flash.position.set(-0.76, 1.20, 0.34); g.add(flash);
    const fpt = new THREE.PointLight(0xffa848, 0, 9.0); fpt.position.set(-0.92, 1.22, 0.46); fpt.visible = false; flashLights.push(fpt); g.add(fpt);
    g.userData = { flash, fpt, rifle };
    shad(g);
    return g;
  }
  const Enemies = (function () {
    const list = [];
    // seat each outlaw behind a far-bank cover point at a chosen height
    const seats = [
      // Three pockets along The Run; `wake` is the x the player must reach to rouse them.
      // Pocket A — the cover run (beat 2)
      { x: -124, y: 0.20, z: -8.5, hide: -1.9, color: 0x3a2a44, scarf: 0x6a3a2a, wake: -160 },
      { x: -113, y: 0.45, z: -11.0, hide: -2.0, color: 0x2c2438, scarf: 0x555c37, wake: -160 },
      // Pocket B — the north-bank maze (beat 4)
      { x: -22, y: 0.30, z: -9.5, hide: -2.0, color: 0x40302a, scarf: 0x7a4a2a, wake: -68 },
      { x: -8, y: 1.35, z: -13.0, hide: -2.0, color: 0x2a3040, scarf: 0x555c37, wake: -68 },  // on the shelf
      { x: 2, y: 0.15, z: -8.0, hide: -1.9, color: 0x352838, scarf: 0x6a3a2a, wake: -68 },
      // Pocket C — past the second ford (beats 6-7)
      { x: 126, y: 0.30, z: -9.0, hide: -2.0, color: 0x2c2438, scarf: 0x555c37, wake: 78 },
      { x: 143, y: 0.40, z: -12.5, hide: -1.9, color: 0x3a2a44, scarf: 0x6a3a2a, wake: 78 },
    ];
    for (const s of seats) {
      const o = makeOutlaw(s.color, s.scarf, seats.indexOf(s));
      o.position.set(s.x, s.y + s.hide, s.z);
      o.userData.seatY = s.y; o.userData.hideY = s.y + s.hide; o.userData.wake = s.wake;
      o.userData.seatX = s.x; o.userData.seatZ = s.z;
      o.userData.state = 'down'; o.userData.t = rnd(1.5, 5); o.userData.up = 0;
      o.userData.alive = true;
      scene.add(o); list.push(o);
    }
    function update(dt) {
      for (const o of list) {
        const u = o.userData;
        if (SHOT) {   // screenshot mode: hold varied peek heights (never a standing row)
          const peek = [0.62, 0.40, 0.85, 0.48, 0.70][Enemies.list.indexOf(o) % 5];
          u.up = Math.min(peek, u.up + dt * 3); o.position.y = lerp(u.hideY, u.seatY, u.up);
          o.rotation.y = Math.atan2(camera.position.x - o.position.x, camera.position.z - o.position.z);
          continue;
        }
        if (!u.alive) {
          // Shot dead: knocked back and tips over, sinking faster than a casual duck
          // back into cover — the "something happens when you hit them" read.
          u.up = lerp(u.up, 0, dt * (u.hitDeath ? 10 : 6));
          o.position.y = lerp(u.hideY, u.seatY, u.up);
          if (u.hitDeath) {
            u.kick = lerp(u.kick, 0, dt * 3.2);
            o.position.x = u.seatX + u.kickDir.x * u.kick * 0.45;
            o.position.z = u.seatZ + u.kickDir.z * u.kick * 0.45;
            o.rotation.x = -u.kick * 0.55;
          }
          continue;
        }
        // pocket gating: sleep until the player advances past this pocket's wake line
        const engaged = player.pos.x >= u.wake && Math.abs(player.pos.x - o.position.x) < 75;
        if (!engaged) {
          u.up = lerp(u.up, 0, dt * 4); o.position.y = lerp(u.hideY, u.seatY, u.up);
          u.state = 'down'; u.t = rnd(1.0, 2.5); continue;
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
        if (f.material.opacity > 0) { f.material.opacity = Math.max(0, f.material.opacity - dt * 5); o.userData.fpt.intensity = f.material.opacity * 3.4; }
      }
    }
    function fire(o) {
      o.userData.flash.material.opacity = 1; o.userData.flash.material.rotation = rnd(0, 6.28);
      o.userData.fpt.intensity = 3.4;
      Audio.enemyShot(o.position);
      Puffs.spawn(o.position.x - 0.85, o.position.y + 1.2, o.position.z + 0.35, 0x9aa7c0, 2);
      // Three outcomes, like a real gunfight: a genuine hit, a near-miss (chips cover,
      // rattles nerve), or a clean miss with no effect. Grunts are hip-firing revolvers
      // at range, so a confirmed hit is the least likely of the three.
      const roll = Math.random();
      if (roll < 0.22) takeDamage(rnd(8, 14), o.position);
      else if (roll < 0.62) NearMiss.trigger();
    }
    function raycastHit(ray) {
      let best = null, bd = 1e9, bp = null;
      for (const o of list) {
        if (!o.userData.alive || o.userData.up < 0.4) continue;
        const box = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(o.position.x, o.position.y + 1.15, o.position.z), new THREE.Vector3(1.0, 2.1, 0.7));
        const hit = ray.ray.intersectBox(box, new THREE.Vector3());
        if (hit) { const d = hit.distanceTo(ray.ray.origin); if (d < bd) { bd = d; best = o; bp = hit; } }
      }
      return best ? { o: best, point: bp } : null;
    }
    function down(o) {
      const u = o.userData;
      u.alive = false; u.state = 'dead'; u.hitDeath = true; u.kick = 1.0;
      const kd = new THREE.Vector3(u.seatX - player.pos.x, 0, u.seatZ - player.pos.z);
      u.kickDir = kd.lengthSq() > 1e-6 ? kd.normalize() : new THREE.Vector3(0, 0, 1);
      Audio.hitBody();
      Puffs.spawn(o.position.x, o.position.y + 0.7, o.position.z, 0x9a6a44, 9);   // bigger, warmer impact burst
    }
    // Revive everyone for a fresh run after the player dies and retries.
    function resetAll() {
      for (const o of list) {
        const u = o.userData;
        u.alive = true; u.hitDeath = false; u.kick = 0; u.fired = false;
        u.state = 'down'; u.t = rnd(1.5, 5); u.up = 0;
        o.position.set(u.seatX, u.hideY, u.seatZ);
        o.rotation.set(0, 0, 0);
      }
    }
    return { list, update, raycastHit, down, resetAll };
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
    b(0.80, 0.10, 0.80, toon(0xa87b3e, { flatShading: true, emissive: 0xa87b3e, emissiveIntensity: 0.5 }), 0, 3.11, 0);  // Aged Brass band — Crow only
    // long Sharps rifle, butt on the ground, barrel angled across him
    const sharps = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 3.05, 8), toon(0x22252e, { flatShading: true }));
    bar.rotation.z = Math.PI / 2; sharps.add(bar);                       // horizontal — his signature line
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.20, 0.14), toon(0x3a2413, { flatShading: true }));
    st.position.set(1.62, -0.04, 0); sharps.add(st);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.15, 8), toon(0x1a1c24, { flatShading: true }));
    scope.rotation.z = Math.PI / 2; scope.position.set(0.30, 0.17, 0.10); sharps.add(scope);
    sharps.position.set(-0.30, 2.05, 0.30); g.add(sharps);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xffca7a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    glow.position.set(1.25, 2.75, 0.45); g.add(glow);
    const pt = new THREE.PointLight(0xffc070, 0, 14); pt.position.set(1.3, 2.8, 0.7); pt.visible = false; flashLights.push(pt); g.add(pt);
    g.position.set(63, 4.55, -13.2); g.scale.setScalar(1.5);
    shad(g);
    scene.add(g);

    let t = rnd(6, 10), state = 'watch', charge = 0;
    function update(dt) {
      // faint idle: duster shift
      g.rotation.y = -1.0 + Math.sin(clock * 0.4) * 0.03;
      const inRange = player.pos.x > 8 && player.pos.x < 112;
      if (state === 'watch') { if (inRange) { t -= dt; if (t <= 0) { state = 'charge'; charge = 0; } } }
      else if (state === 'charge') {
        charge += dt; glow.material.opacity = Math.min(1, charge / 1.4) * (0.6 + 0.4 * Math.sin(clock * 20));
        pt.intensity = Math.min(1, charge / 1.4) * 6;
        if (charge >= 1.5) { boom(); state = 'watch'; t = rnd(9, 15); glow.material.opacity = 0; pt.intensity = 0; }
      }
    }
    function boom() {
      glow.material.opacity = 1; pt.intensity = 14;
      Audio.sharps(g.position);
      // A called-out sniper shot: rarer than a grunt's hip-fire but far more dangerous —
      // Crow is "the environmental threat" per the brief, so a hit should feel severe.
      if (Math.random() < 0.5) takeDamage(rnd(30, 42), g.position);
      else NearMiss.trigger(true);   // a rock beside Jody explodes instead
      setTimeout(() => { pt.intensity = 0; glow.material.opacity = 0; }, 120);
    }
    function reset() { state = 'watch'; t = rnd(6, 10); charge = 0; glow.material.opacity = 0; pt.intensity = 0; }
    return { group: g, update, reset };
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
      s.position.set(rnd(-150, 150), rnd(1, 6), rnd(-14, 2));
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
      [-31, 0.3, 7.0, 380, TOD.mist[0], 0.20 * TOD.mistI],   // haze hugging the far bank
      [-23, 0.1, 5.4, 370, TOD.mist[1], 0.15 * TOD.mistI],
      [-13, 0.0, 3.8, 360, TOD.mist[2], 0.11 * TOD.mistI],   // mid-river mist
      [-4, -0.1, 2.6, 350, TOD.mist[3], 0.08 * TOD.mistI],
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
    m.position.set(rnd(-150, 150), rnd(7, 16), rnd(-27, -21));
    m.userData = { vy: 0 }; scene.add(m); stones.push(m);
  }
  let stoneTimer = 3;

  /* =========================================================================
     IMPACTS  — near-miss chip on the boulder, water splashes
     ========================================================================= */
  const NearMiss = {
    trigger(heavy) {
      // choose a point on the foreground rock near the player
      const x = player.pos.x + rnd(-2.6, 2.6), y = rnd(0.2, 1.6), z = player.pos.z - rnd(2.2, 3.6);
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

  // A quick bright streak from muzzle to impact point, so a shot always shows
  // where it went — hit, miss on rock, or splash — not just when it lands on a body.
  const Tracer = (function () {
    const items = [];
    function spawn(from, to) {
      const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
      const mat = new THREE.LineBasicMaterial({ color: 0xfff0c4, transparent: true, opacity: 0.95, depthWrite: false, fog: false });
      const line = new THREE.Line(geo, mat);
      line.renderOrder = 6;
      scene.add(line);
      items.push({ line, age: 0, life: 0.085 });
    }
    function update(dt) {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]; it.age += dt;
        it.line.material.opacity = Math.max(0, 0.95 * (1 - it.age / it.life));
        if (it.age >= it.life) { scene.remove(it.line); it.line.geometry.dispose(); it.line.material.dispose(); items.splice(i, 1); }
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
      // A revolver crack has three layered parts: a bright transient click (the hammer
      // strike/ignition), the loud noise body (the report), and a low thump (chest impact
      // of the blast) — plus the canyon echo bus for slap-back down the corridor.
      colt() { if (!ctx) return;
        shotNoise(0.045, 6500, 1.0, false);
        shotNoise(0.55, 2800, 1.35, true);
        tone(150, 0.16, 'square', 0.55);
        tone(58, 0.30, 'sine', 0.6);
      },
      enemyShot() { if (!ctx) return; shotNoise(0.035, 5000, 0.6, false); shotNoise(0.4, 2000, 0.55, true); },
      sharps() { if (!ctx) return;
        shotNoise(0.05, 5000, 1.25, false);
        shotNoise(0.9, 1400, 1.5, true);
        tone(55, 0.45, 'sine', 0.75);
        tone(110, 0.22, 'square', 0.45);
      },
      splash() { if (!ctx) return; shotNoise(0.18, 5000, 0.3, false); },
      chip(heavy) { if (!ctx) return; shotNoise(0.1, 7000, heavy ? 0.5 : 0.28, false); tone(rnd(1400, 2200), 0.08, 'sine', 0.12); },
      hitBody() { if (!ctx) return; shotNoise(0.12, 800, 0.4, false); },
      // The player got hit — a heavier, duller thud than a body-kill, scaled up for
      // Crow's Sharps rounds so the "environmental threat" reads as dangerous.
      hitPlayer(heavy) { if (!ctx) return;
        shotNoise(heavy ? 0.24 : 0.14, heavy ? 550 : 900, heavy ? 0.75 : 0.5, false);
        tone(heavy ? 65 : 105, heavy ? 0.38 : 0.22, 'sine', heavy ? 0.55 : 0.35);
      },
      dry() { if (!ctx) return; tone(1200, 0.03, 'square', 0.08); },
    };
  })();

  /* =========================================================================
     INPUT  (aim / fire / reload) + pointer-lock-free steer fallback
     ========================================================================= */
  const SHOT = location.search.indexOf('shot') >= 0;
  // CINEMATIC third-person rig: over-the-shoulder, Jody large on the right of frame,
  // the canyon receding to the left — the composition of the film reference stills.
  let cine = location.search.indexOf('cine') >= 0;
  const CINE = {
    offset: new THREE.Vector3(-1.14, 2.00, 3.05),   // behind + left of Jody's shoulder
    look: new THREE.Vector3(0.05, 1.30, -15.0),     // aim point across the river
    fov: 46,
  };
  const FPS_FOV = 58;   // freeze look at authored defaults for screenshots
  const ADS_FOV = 46;   // narrower while aiming down sights — precision aiming convention
  const Q = new URLSearchParams(location.search);
  const SHOT_X = parseFloat(Q.get('px') || '-10'), SHOT_Z = parseFloat(Q.get('pz') || '9'), SHOT_YAW = parseFloat(Q.get('pyaw') || '0'), SHOT_PITCH = parseFloat(Q.get('ppitch') || '-0.155');
  const player = {
    yaw: SHOT ? SHOT_YAW : 0, pitch: SHOT ? SHOT_PITCH : -0.155, locked: false, lockBlocked: false,
    steer: new THREE.Vector2(), lookVel: new THREE.Vector2(),
    pos: new THREE.Vector3(SHOT ? SHOT_X : -152, 0, SHOT ? SHOT_Z : 9),
    keys: {}, eye: 1.9, stepT: 0, moving: false,
    health: 100, maxHealth: 100, alive: true, ads: false,
  };
  const START_POS = player.pos.clone(), START_YAW = player.yaw, START_PITCH = player.pitch;
  const PITCH_LO = -0.45, PITCH_HI = 0.45;
  let ammo = 6, reloading = false, running = false;
  let nerve = 1, shake = 0;

  function onMove(e) {
    if (SHOT) return;
    if (player.locked) {
      const s = (player.ads ? 0.55 : 1) * 0.0022;
      player.yaw -= e.movementX * s;
      player.pitch = clamp(player.pitch - e.movementY * s, PITCH_LO, PITCH_HI);
      player.lookVel.set(e.movementX, e.movementY);
    } else if (player.lockBlocked && running) {
      // Steer-mode fallback (pointer lock unavailable — e.g. inside a sandboxed iframe):
      // cursor position relative to screen centre drives a continuous turn rate, like a
      // virtual look-stick. A small dead zone so the centre is calm; the response is
      // curved (power >1) so small offsets near centre give fine control while the edges
      // still reach a fast, usable turn rate — this was the "aim feels laggy" complaint.
      const nx = (e.clientX / innerWidth) * 2 - 1, ny = (e.clientY / innerHeight) * 2 - 1;
      const dz = 0.035;
      const rx = Math.abs(nx) < dz ? 0 : (nx - Math.sign(nx) * dz) / (1 - dz);
      const ry = Math.abs(ny) < dz ? 0 : (ny - Math.sign(ny) * dz) / (1 - dz);
      player.steer.x = Math.sign(rx) * Math.pow(Math.abs(rx), 1.6);
      player.steer.y = Math.sign(ry) * Math.pow(Math.abs(ry), 1.6);
    }
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mousedown', (e) => {
    if (!running) return;
    if (e.button === 0) { fire(); if (!player.locked && !player.lockBlocked) requestLock(); }
    if (e.button === 2 && player.alive) { player.ads = true; Colt.setADS(true); }
  });
  document.addEventListener('mouseup', (e) => { if (e.button === 2) { player.ads = false; Colt.setADS(false); } });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => {
    player.keys[e.code] = true;
    if (e.code === 'KeyR') reload();
    if (e.code === 'KeyC') cine = !cine;
    if (e.code === 'Space') { e.preventDefault(); if (running) fire(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') player.steady = true;
  });
  document.addEventListener('keyup', (e) => {
    player.keys[e.code] = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') player.steady = false;
  });

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

  let kills = 0;
  function updateHostilesUI() { dom.hostilesNum.textContent = kills; }
  function showHitmarker() {
    dom.hitmarker.classList.remove('show'); void dom.hitmarker.offsetWidth; // restart the CSS animation
    dom.hitmarker.classList.add('show');
  }
  function fire() {
    if (!running || reloading || !player.alive) return;
    if (ammo <= 0) { Audio.dry(); dom.reloadTag.classList.add('show'); return; }
    ammo--; updateRounds();
    Colt.fireFX(); Jody.fireFX(); Audio.colt();
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const muzzle = camera.position.clone().addScaledVector(dir, 1.5).add(new THREE.Vector3(0.25, -0.25, 0));
    Puffs.spawn(muzzle.x, muzzle.y, muzzle.z, 0x93a2bd, 3);
    shake += 0.18; tremor.set(rnd(-0.02, 0.02), rnd(-0.02, 0.02));
    // ray from camera center — exactly what the reticle marks, hip-fire or ADS alike
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hit = Enemies.raycastHit(ray);
    if (hit) {
      Enemies.down(hit.o);
      kills++; updateHostilesUI(); showHitmarker();
      Tracer.spawn(muzzle, hit.point);
    } else {
      // where the shot actually landed — a chip on the rock it hit, or a splash if
      // nothing solid was in the way and it reaches the river — so a miss reads as
      // a miss instead of vanishing into nothing.
      const envHit = ray.intersectObject(world, true)[0];
      let landed = null;
      if (envHit) {
        Puffs.spawn(envHit.point.x, envHit.point.y, envHit.point.z, 0x9a8a72, 3);
        Audio.chip(false);
        landed = envHit.point;
      } else {
        const t = -ray.ray.origin.y / ray.ray.direction.y;
        if (t > 0) { const px = ray.ray.origin.x + ray.ray.direction.x * t, pz = ray.ray.origin.z + ray.ray.direction.z * t;
          if (pz < 3 && pz > -7 && Math.abs(px) < 168) { Splashes.spawn(px, pz); landed = new THREE.Vector3(px, 0.15, pz); }
        }
      }
      Tracer.spawn(muzzle, landed || muzzle.clone().addScaledVector(dir, 80));
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

  /* =========================================================================
     PLAYER DAMAGE — real hits from enemy fire. Standard FPS conventions:
     a health bar that actually depletes, a compass arrow toward the shooter,
     a bigger screen-damage flash than a mere near-miss, and a death/retry screen
     instead of the player being unkillable.
     ========================================================================= */
  function updateHealthUI() { dom.healthFill.style.transform = 'scaleX(' + clamp(player.health / player.maxHealth, 0, 1) + ')'; }
  let dmgDirTimer = null;
  function showDamageDirection(sourcePos) {
    const dx = sourcePos.x - player.pos.x, dz = sourcePos.z - player.pos.z;
    const worldAngle = Math.atan2(-dx, -dz);           // matches the forward-vector convention used for movement
    let rel = worldAngle - player.yaw;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));    // normalize to [-PI, PI]
    dom.dmgDir.style.transform = 'rotate(' + (rel * 180 / Math.PI) + 'deg)';
    dom.dmgDir.classList.add('show');
    clearTimeout(dmgDirTimer);
    dmgDirTimer = setTimeout(() => dom.dmgDir.classList.remove('show'), 700);
  }
  function takeDamage(amount, sourcePos) {
    if (!player.alive) return;
    player.health = clamp(player.health - amount, 0, player.maxHealth);
    updateHealthUI();
    flashHit(clamp(0.4 + amount / 55, 0.4, 1.0));
    shake += 0.22 + amount * 0.012;
    nerve = clamp(nerve - amount * 0.009, 0.08, 1);
    if (sourcePos) showDamageDirection(sourcePos);
    Audio.hitPlayer(amount >= 25);
    if (player.health <= 0) killPlayer();
  }
  function killPlayer() {
    player.alive = false;
    document.body.classList.remove('aiming');
    dom.deathScreen.classList.remove('hidden');
    if (document.exitPointerLock) document.exitPointerLock();
  }
  function restartRun() {
    player.pos.copy(START_POS); player.yaw = START_YAW; player.pitch = START_PITCH;
    player.health = player.maxHealth; player.alive = true; player.ads = false;
    ammo = 6; reloading = false; updateRounds(); dom.reloadTag.classList.remove('show');
    nerve = 1; shake = 0; kills = 0; updateHostilesUI();
    Enemies.resetAll(); Crow.reset();
    tick._ended = false;
    updateHealthUI();
    dom.deathScreen.classList.add('hidden');
    document.body.classList.add('aiming');
    requestLock();
  }

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
  const _up = new THREE.Vector3(0, 1, 0);
  let last = performance.now(), clock = 0;
  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now(); const dt = Math.min((now - last) / 1000, 0.05); last = now;
    tick(dt); composer.render();
  }
  // One simulation+render step. Exposed for the headless tools: rAF in headless_shell is
  // throttled to near-zero (the page counts as hidden), so tests and capture scripts
  // drive the loop explicitly and deterministically via window.__step.
  function tick(dt) {
    clock += dt;

    riverUniforms.uTime.value = clock;
    if (riverMat) { riverMat.uniforms.uTime.value = clock; riverMat.uniforms.uCamX.value = camera.position.x; }
    RIM.dir.copy(sun.position).sub(sun.target.position).normalize();
    for (let i = 0; i < flashLights.length; i++) flashLights[i].visible = flashLights[i].intensity > 0.05;

    // steer look — much higher rate than before (was 1.4/1.0 rad/s, felt sluggish and
    // capped); ADS still slows it down for precision, matching the pointer-lock path.
    if (!SHOT && player.lockBlocked && (player.steer.x || player.steer.y)) {
      const steerMul = player.ads ? 0.55 : 1;
      player.yaw -= player.steer.x * 2.6 * steerMul * dt;
      player.pitch = clamp(player.pitch - player.steer.y * 2.0 * steerMul * dt, PITCH_LO, PITCH_HI);
      player.lookVel.set(player.steer.x * 40, player.steer.y * 40);
    }

    // --- TRAVERSAL MOVEMENT: walk the run, west to east ---
    if (running && !SHOT && player.alive) {
      let ix = 0, iz = 0;
      if (player.keys['KeyW']) iz += 1; if (player.keys['KeyS']) iz -= 1;
      if (player.keys['KeyA']) ix -= 1; if (player.keys['KeyD']) ix += 1;
      const mlen = Math.hypot(ix, iz);
      player.moving = mlen > 0;
      const onFord = Math.abs(player.pos.x + 60) < 9 || Math.abs(player.pos.x - 115) < 9;
      const inWater = player.pos.z > -7.6 && player.pos.z < 4.6 && !onFord;
      if (player.moving) {
        ix /= mlen; iz /= mlen;
        const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
        const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
        const spd = inWater ? 2.6 : (onFord ? 4.2 : 5.6);
        player.pos.x += (fx * iz + rx * ix) * spd * dt;
        player.pos.z += (fz * iz + rz * ix) * spd * dt;
        player.stepT += dt * spd;
      }
      // corridor bounds + the Narrows pinch (only the gap by the water is passable)
      player.pos.x = clamp(player.pos.x, -160, 160);
      player.pos.z = clamp(player.pos.z, -19, 23);
      if (player.pos.x > 50 && player.pos.x < 78) player.pos.z = clamp(player.pos.z, -0.5, 7.5);
      // wading: the eye dips and the walk slows
      player.eye = lerp(player.eye, inWater ? 1.42 : 1.9, dt * 4);
      // reaching the east bend completes the run
      if (!tick._ended && player.pos.x > 156) { tick._ended = true; endCard(); }
    }

    // camera orientation + breathing + shake + tremor from low nerve
    const breathe = Math.sin(clock * 1.1) * 0.004;
    const trem = (1 - nerve) * 0.02;
    shake = Math.max(0, shake - dt * 1.4);
    const sx = (Math.random() - 0.5) * shake * 0.06, sy = (Math.random() - 0.5) * shake * 0.06;
    camera.rotation.order = 'YXZ';
    if (cine) {
      // Frame Jody from over his shoulder; he yaws with the player's aim.
      Jody.group.visible = true; Colt.group.visible = false;
      Jody.charLights(true); Colt.kicker.visible = false;
      Jody.group.position.x = player.pos.x + 0.4;
      Jody.group.position.z = player.pos.z - 1.4;
      Jody.group.rotation.y = 0.34 + player.yaw * 0.55;
      const base = Jody.group.position;
      const off = CINE.offset.clone().applyAxisAngle(_up, player.yaw * 0.55);
      camera.position.set(base.x + off.x, base.y + off.y, base.z + off.z);
      const target = CINE.look.clone().applyAxisAngle(_up, player.yaw * 0.55);
      camera.lookAt(base.x + target.x, target.y + player.pitch * 6.0, base.z + target.z - 6.4);
      camera.rotation.z = 0;
      if (camera.fov !== CINE.fov) { camera.fov = CINE.fov; camera.updateProjectionMatrix(); }
    } else {
      Jody.group.visible = false; Colt.group.visible = true;
      Jody.charLights(false); Colt.kicker.visible = true;
      const bob = player.moving ? Math.sin(player.stepT * 2.1) * 0.05 : 0;
      camera.position.set(player.pos.x, player.eye + bob, player.pos.z);
      camera.rotation.y = player.yaw + sx + Math.sin(clock * 7) * trem;
      camera.rotation.x = player.pitch + sy + breathe + Math.cos(clock * 6) * trem;
      const targetFov = SHOT ? FPS_FOV : (player.ads ? ADS_FOV : FPS_FOV);
      const newFov = SHOT ? targetFov : lerp(camera.fov, targetFov, dt * 9);
      if (Math.abs(camera.fov - newFov) > 0.01) { camera.fov = newFov; camera.updateProjectionMatrix(); }
    }
    player.lookVel.multiplyScalar(0.85);

    if (running && (player.alive || SHOT)) {
      Colt.update(dt, player.lookVel, false);
      Jody.update(dt);
      Enemies.update(dt);
      Crow.update(dt);
    }
    Puffs.update(dt); Splashes.update(dt); Tracer.update(dt);

    // reeds sway
    for (const r of reeds) { r.rotation.z = Math.sin(clock * 1.6 + r.userData.phase) * 0.18; }
    // haze drift
    for (const h of haze) { h.position.x += h.userData.vx * dt; if (h.position.x > 160) h.position.x = -160; h.material.opacity = Math.min(0.14, h.material.opacity + dt * 0.001); }
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
  }

  /* =========================================================================
     BOOT
     ========================================================================= */
  function endCard() {
    const d = document.createElement('div');
    d.className = 'steerHint';
    d.style.bottom = '44vh'; d.style.fontSize = '17px'; d.style.letterSpacing = '0.32em'; d.style.padding = '12px 26px';
    d.textContent = 'THE CANYON OPENS \u2014 YOU MADE THE RUN';
    dom.hud.appendChild(d);
    Audio.waveStart && Audio.waveStart();
  }
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
    dom.hostilesTotal.textContent = Enemies.list.length;
    updateHostilesUI(); updateHealthUI();
    running = true;
    requestLock();
  });
  dom.retryBtn.addEventListener('click', () => { Audio.resume(); restartRun(); });

  // debug hook for headless smoke tests
  window.__dbg = { yaw: () => player.yaw, pitch: () => player.pitch, ammo: () => ammo, puffs: () => Puffs.count(), enemies: () => Enemies.list.length };
  window.__health = () => [+player.health.toFixed(1), player.alive];
  window.__takeDamage = (amt, pos) => takeDamage(amt, pos || player.pos.clone());
  window.__kills = () => kills;
  window.__ads = (on) => { player.ads = !!on; Colt.setADS(!!on); };
  window.__fire = () => fire();
  window.__pos = () => [+player.pos.x.toFixed(1), +player.pos.z.toFixed(1)];
  window.__setPos = (x, z, yaw) => { player.pos.x = x; player.pos.z = z; if (yaw != null) player.yaw = yaw; };
  window.__key = (c, v) => { player.keys[c] = v; };
  window.__step = (n, dtStep) => { for (let i = 0; i < n; i++) tick(dtStep || 0.0166); };
  window.__reload = () => { ammo = 6; updateRounds(); };
  window.__enemyFire = () => { for (const o of Enemies.list) { o.userData.flash.material.opacity = 1; o.userData.fpt.intensity = 3.4; } };
  window.__three = { scene, camera, THREE, cliffs };
  window.__renderer = renderer; window.__composer = composer;
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
