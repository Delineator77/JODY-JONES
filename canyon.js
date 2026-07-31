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
     RENDERER / SCENE / CAMERA
     ========================================================================= */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  // Flat graphic color: no sRGB output curve + no tonemapping => authored hex renders as-is.
  // (This build predates ColorManagement, so sRGB output would lift/desaturate the flats.)
  renderer.outputEncoding = THREE.LinearEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  dom.stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.deep);
  scene.fog = new THREE.FogExp2(0x1a2740, 0.006);   // light canyon haze — never washes the hero wall

  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 900);
  const CAM_BASE = new THREE.Vector3(0, 1.9, 8.0);   // standing behind the boulder, looking over it
  camera.position.copy(CAM_BASE);

  const composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.7, 0.82);
  composer.addPass(bloom);

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

  function toon(color, opts) {
    return new THREE.MeshToonMaterial(Object.assign({ color: color, gradientMap: RAMP }, opts || {}));
  }
  function toonSoft(color, opts) {
    return new THREE.MeshToonMaterial(Object.assign({ color: color, gradientMap: RAMP_SOFT }, opts || {}));
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
  const TEX = {
    flash: softDot('rgba(255,240,210,1)', 'rgba(255,150,60,0.65)'),
    smoke: softDot('rgba(120,130,150,0.5)', 'rgba(70,80,110,0.22)'),
    splash: softDot('rgba(220,232,244,0.95)', 'rgba(150,180,210,0.35)'),
    glow: softDot('rgba(255,190,110,0.9)', 'rgba(255,120,40,0.3)'),
  };

  /* =========================================================================
     ROCK / BOULDER GEOMETRY  (chunky faceted masses)
     ========================================================================= */
  function rockGeo(radius, squashY, jitter) {
    const g = new THREE.IcosahedronGeometry(radius, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const j = 1 + rnd(-jitter, jitter);
      p.setXYZ(i, x * j, y * j * squashY, z * j);
    }
    p.needsUpdate = true; g.computeVertexNormals();
    return g;
  }
  function makeRock(radius, mat, opts) {
    opts = opts || {};
    const geo = rockGeo(radius, opts.squashY == null ? 0.7 : opts.squashY, opts.jitter == null ? 0.28 : opts.jitter);
    const m = new THREE.Mesh(geo, mat);
    m.material.flatShading = true; m.material.needsUpdate = true;
    if (opts.ink !== false) ink(m, opts.ink || 0.004);
    return m;
  }

  /* =========================================================================
     LIGHTING  — cool shadow world, one low warm sun for rim + cliff glow
     ========================================================================= */
  const hemi = new THREE.HemisphereLight(0x2a3a66, 0x0c1120, 0.9); scene.add(hemi);
  scene.add(new THREE.AmbientLight(0x152340, 0.5));
  const sun = new THREE.DirectionalLight(0xffb063, 1.4);      // low, warm, from behind far bank
  sun.position.set(-16, 30, -34); scene.add(sun);
  const coolFill = new THREE.DirectionalLight(0x4664a0, 0.55); // sky fill from above
  coolFill.position.set(10, 24, 20); scene.add(coolFill);
  const bounce = new THREE.DirectionalLight(0x243a5e, 0.35);   // river bounce, from below-front
  bounce.position.set(0, -6, 12); scene.add(bounce);

  /* =========================================================================
     CANYON WALLS  — enormous, vertex-colored indigo→amber, narrow sky
     ========================================================================= */
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // Canyon wall color as a function of absolute world height + how sunlit the column is.
  // Navy shadow at the floor → burnt-vermillion sunlit faces → amber/ivory blazing tops.
  function cliffColor(worldY, lit) {
    const h = clamp(worldY / 74, 0, 1.15);
    const c = new THREE.Color(COL.indigo);
    c.lerp(new THREE.Color(COL.vermillion), smoothstep(0.04, 0.50, h));
    c.lerp(new THREE.Color(COL.amber), smoothstep(0.58, 0.90, h) * 0.9);
    c.lerp(new THREE.Color(COL.ivory), smoothstep(0.86, 1.12, h) * 0.55);
    // recessed (shadow) columns stay cool and dark; buttresses catch the warm light
    return new THREE.Color(COL.rockShadow).lerp(c, 0.30 + 0.70 * lit);
  }
  // A canyon wall built from faceted vertical COLUMNS (columnar sandstone) — each a flat
  // color mass with hard edges to its neighbours, jagged tops biting into the sky strip.
  function buildCliff(width, height, cols, origin, dir, depthAmt, opts) {
    opts = opts || {};
    const group = new THREE.Group();
    const colW = width / cols;
    for (let i = 0; i < cols; i++) {
      const cx = -width / 2 + (i + 0.5) * colW;
      const w = colW * rnd(0.9, 1.14);
      const prof = opts.profile ? opts.profile(i / (cols - 1)) : 1;
      const h = height * prof * (0.6 + 0.4 * (0.5 + 0.5 * Math.sin(i * 1.7) + 0.28 * Math.sin(i * 0.6 + 1.1)));
      const d = rnd(0.9, depthAmt);
      const lit = clamp(0.5 + 0.5 * Math.sin(i * 0.7 + 1.0) + 0.22 * Math.sin(i * 2.9) + (opts.warm || 0), 0, 1);
      const geo = new THREE.BoxGeometry(w, h, d, 1, 4, 1);
      const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
      for (let k = 0; k < pos.count; k++) {
        const wy = origin.y + h / 2 + pos.getY(k);   // absolute world height of this vertex
        c.copy(cliffColor(wy, lit));
        colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }));
      m.position.set(cx, h / 2, rnd(-0.5, 0.5) * depthAmt);
      m.frustumCulled = false;
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
  cliffs.add(buildCliff(130, 118, 16, new THREE.Vector3(-33, FLOOR, -2), Math.PI / 2 + 0.05, 12, { warm: 0.5 }));   // left wall catches the low sun
  cliffs.add(buildCliff(130, 118, 16, new THREE.Vector3(33, FLOOR, -2), -Math.PI / 2 - 0.05, 12, { warm: -0.15 })); // right wall in shadow
  scene.add(cliffs);

  /* ----- Sky strip -------------------------------------------------------- */
  (function sky() {
    const g = new THREE.SphereGeometry(600, 20, 14);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, fog: false, depthWrite: false,
      uniforms: {
        cLow: { value: new THREE.Color(COL.skyLow) }, cMid: { value: new THREE.Color(COL.skyMid) }, cHigh: { value: new THREE.Color(COL.skyHigh) },
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

  /* =========================================================================
     RIVER  — stylized cel water shader (broad masses, amber sun band, foam)
     ========================================================================= */
  const riverUniforms = { uTime: { value: 0 }, uSun: { value: new THREE.Color(COL.amberHi) } };
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
        '  vec3 deep = vec3(0.055,0.10,0.205);\n' +
        '  vec3 lit  = vec3(0.16,0.31,0.50);\n' +
        '  vec3 col = mix(deep, lit, band*0.85 + 0.15);\n' +
        '  float f = fbm(vP*vec2(2.3,4.0) - flow*2.2);\n' +
        '  float caps = smoothstep(0.60,0.82,f);\n' +
        '  // SIGNATURE: a defined reflection streak running toward the viewer\n' +
        '  float streakX = sin(vP.y*0.30 + 0.6)*2.4 + sin(vP.y*0.85)*0.9;\n' +
        '  float streak = smoothstep(5.5, 0.0, abs(vP.x - streakX));\n' +
        '  vec3 sunCol = mix(uSun, vec3(1.0,0.90,0.66), 0.35);\n' +
        '  col = mix(col, sunCol, streak*0.82);\n' +
        '  // foam caps — brighter only inside the reflection\n' +
        '  col = mix(col, mix(vec3(0.80,0.85,0.92), sunCol, 0.5), caps*(0.2 + 0.5*streak));\n' +
        '  // shimmering specular along the streak\n' +
        '  float glint = pow(max(0.0, sin(vP.x*2.2 + vP.y*1.5 - uTime*5.0)*0.5+0.5), 6.0);\n' +
        '  col += sunCol * glint * streak * 0.55;\n' +
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
    const m = toonSoft(color, { flatShading: true });
    const mesh = new THREE.Mesh(g, m); mesh.position.z = zCenter; world.add(mesh);
    return mesh;
  }
  // Near bank (player side) — cool wet gravel; Far bank (enemies) — sandstone shelves.
  bank(7.8, 2.6, COL.rockShadow, 0.0);   // just the near water's edge
  bank(-12, 12, COL.sand, 0.2);

  // Far-bank elevated shelves (give gunslingers different heights)
  function shelf(x, z, w, d, h, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, toon(color, { flatShading: true }));
    m.position.set(x, h / 2, z); ink(m, 0.0035); world.add(m); return m;
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
      const r = makeRock(s[2], toon(COL.rockShadow, { flatShading: true }), { squashY: 0.62 });
      r.position.set(s[0], s[2] * 0.4, s[1]); world.add(r);
    }
    // river boulders
    for (let i = 0; i < 9; i++) {
      const rr = rnd(0.4, 1.1);
      const r = makeRock(rr, toon(COL.rockWet, { flatShading: true }), { squashY: 0.5 });
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
    const main = makeRock(3.4, toon(COL.rockWet, { flatShading: true }), { squashY: 0.8, jitter: 0.34, ink: 0.0055 });
    main.position.set(-0.4, 0.2, 0); grp.add(main);
    const side = makeRock(2.1, toon(COL.rockShadow, { flatShading: true }), { squashY: 0.75, jitter: 0.32, ink: 0.005 });
    side.position.set(2.6, -0.2, 0.6); grp.add(side);
    const small = makeRock(1.4, toon(COL.rockWet, { flatShading: true }), { squashY: 0.7, ink: 0.004 });
    small.position.set(-3.0, -0.4, 0.7); grp.add(small);
    grp.position.set(-2.4, -1.7, 6.6);   // foreground cover lip, bottom-left
    scene.add(grp);
    window.__boulder = main;
  })();

  /* =========================================================================
     COLT VIEWMODEL  (Jody's hand + revolver at bottom of frame)
     ========================================================================= */
  const Colt = (function () {
    const grp = new THREE.Group();
    const steel = toonMetal(0x2a2f3a, { flatShading: true });
    const steelInk = 0.006;
    const wood = toon(0x5a3418, { flatShading: true });
    const glove = toon(0x4a3524, { flatShading: true });
    const cuff = toon(COL.cloth, { flatShading: true });
    function box(w, h, d, mat, x, y, z, rx, ry, rz) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); if (rx) m.rotation.x = rx; if (ry) m.rotation.y = ry; if (rz) m.rotation.z = rz;
      grp.add(m); return m;
    }
    // barrel + frame
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.62, 10), steel);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.34); ink(barrel, steelInk); grp.add(barrel);
    const frame = box(0.12, 0.15, 0.34, steel, 0, -0.02, -0.02); ink(frame, steelInk);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 8), steel);
    cyl.rotation.x = Math.PI / 2; cyl.position.set(0, -0.01, -0.02); ink(cyl, steelInk); grp.add(cyl);
    // hammer + sight
    box(0.03, 0.07, 0.05, steel, 0, 0.08, 0.12);
    box(0.02, 0.03, 0.02, steel, 0, 0.1, -0.6);
    // grip (angled) with wood
    const grip = box(0.11, 0.26, 0.12, wood, 0, -0.2, 0.12, 0.4); ink(grip, steelInk);
    // hand — glove wrapping the grip + cuff
    const palm = box(0.15, 0.16, 0.17, glove, 0.02, -0.16, 0.14, 0.4); ink(palm, 0.005);
    box(0.16, 0.06, 0.12, glove, 0.0, -0.05, 0.05, 0.2);         // fingers over frame
    const forearm = box(0.17, 0.17, 0.5, cuff, 0.05, -0.34, 0.42, 0.5); ink(forearm, 0.005);
    box(0.2, 0.2, 0.14, glove, 0.05, -0.28, 0.28, 0.5);          // wrist

    // muzzle flash + smoke anchor
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: TEX.flash, color: COL.muzzle, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    flash.position.set(0, 0.02, -0.72); grp.add(flash);
    const flashPt = new THREE.PointLight(0xffb060, 0, 8); flashPt.position.set(0, 0.2, -1); grp.add(flashPt);

    grp.position.set(0.30, -0.32, -0.62);
    grp.rotation.y = -0.13; grp.rotation.z = 0.04; grp.rotation.x = 0.12;
    grp.scale.setScalar(0.9);
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
  function makeOutlaw(color) {
    const g = new THREE.Group();
    const cloth = toon(color, { flatShading: true });
    const dark = toon(COL.cloth, { flatShading: true });
    const skin = toon(COL.skin, { flatShading: true });
    const hat = toon(COL.hat, { flatShading: true });
    function b(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; }
    const torso = b(0.62, 0.72, 0.34, cloth, 0, 0.36, 0); ink(torso, 0.004);
    b(0.66, 0.18, 0.36, dark, 0, 0.06, 0);                 // gunbelt
    const head = b(0.26, 0.28, 0.26, skin, 0, 0.86, 0); ink(head, 0.004);
    const brim = b(0.5, 0.06, 0.5, hat, 0, 0.98, 0); ink(brim, 0.004);
    b(0.3, 0.2, 0.3, hat, 0, 1.06, 0);                      // crown
    b(0.18, 0.5, 0.18, cloth, -0.36, 0.42, 0);              // arms
    b(0.18, 0.5, 0.18, cloth, 0.36, 0.42, 0);
    // rifle raised across cover
    const rifle = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 6), toon(0x2a2f3a, { flatShading: true }));
    barrel.rotation.z = Math.PI / 2; rifle.add(barrel);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.08), toon(0x4a2c14, { flatShading: true }));
    stock.position.x = 0.55; rifle.add(stock);
    rifle.position.set(0.2, 0.55, 0.18); rifle.rotation.y = -0.15; g.add(rifle);
    // muzzle flash
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: TEX.flash, color: COL.muzzle, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    flash.position.set(-0.55, 0.55, 0.2); g.add(flash);
    const fpt = new THREE.PointLight(0xffb060, 0, 6); fpt.position.set(-0.7, 0.6, 0.3); g.add(fpt);
    g.userData = { flash, fpt, rifle };
    return g;
  }
  const Enemies = (function () {
    const list = [];
    // seat each outlaw behind a far-bank cover point at a chosen height
    const seats = [
      { x: -18, y: 0.2, z: -8, hide: -1.0, color: 0x3a2a44 },
      { x: -8, y: 0.4, z: -9, hide: -1.1, color: 0x2c2438 },
      { x: 2.5, y: 1.4, z: -9.5, hide: -1.1, color: 0x40302a }, // on a shelf, higher
      { x: 13, y: 0.5, z: -9, hide: -1.1, color: 0x2a3040 },
      { x: 21, y: 0.3, z: -10, hide: -1.0, color: 0x352838 },
    ];
    for (const s of seats) {
      const o = makeOutlaw(s.color);
      o.position.set(s.x, s.y + s.hide, s.z);
      o.userData.seatY = s.y; o.userData.hideY = s.y + s.hide;
      o.userData.state = 'down'; o.userData.t = rnd(1.5, 5); o.userData.up = 0;
      o.userData.alive = true;
      scene.add(o); list.push(o);
    }
    function update(dt) {
      for (const o of list) {
        const u = o.userData;
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
        if (f.material.opacity > 0) { f.material.opacity = Math.max(0, f.material.opacity - dt * 5); o.userData.fpt.intensity = f.material.opacity * 5; }
      }
    }
    function fire(o) {
      o.userData.flash.material.opacity = 1; o.userData.flash.material.rotation = rnd(0, 6.28);
      o.userData.fpt.intensity = 5;
      Audio.enemyShot(o.position);
      // a near-miss on the player: chip the boulder + whistle + nerve hit
      if (Math.random() < 0.6) NearMiss.trigger();
    }
    function raycastHit(ray) {
      let best = null, bd = 1e9;
      for (const o of list) {
        if (!o.userData.alive || o.userData.up < 0.4) continue;
        const box = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(o.position.x, o.position.y + 0.6, o.position.z), new THREE.Vector3(0.9, 1.4, 0.6));
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
    const body = b(1.0, 1.7, 0.5, duster, 0, 1.1, 0); ink(body, 0.004);
    b(1.3, 1.1, 0.5, duster, 0, 0.7, 0);                  // coat flare
    const head = b(0.34, 0.36, 0.32, toon(0x6e4a34, { flatShading: true }), 0, 2.1, 0); ink(head, 0.004);
    b(0.9, 0.08, 0.9, hat, 0, 2.28, 0); ink(b(0.5, 0.28, 0.5, hat, 0, 2.42, 0), 0.004);
    // long Sharps rifle held at the side
    const sharps = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 6), toon(0x22252e, { flatShading: true }));
    bar.rotation.z = 0.5; sharps.add(bar);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.09), toon(0x3a2413, { flatShading: true }));
    st.position.set(-0.7, -0.42, 0); st.rotation.z = 0.5; sharps.add(st);
    sharps.position.set(0.7, 1.1, 0.2); g.add(sharps);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xffca7a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    glow.position.set(0.95, 1.35, 0.4); g.add(glow);
    const pt = new THREE.PointLight(0xffc070, 0, 14); pt.position.set(1.0, 1.4, 0.6); g.add(pt);
    g.position.set(-3, 2.3, -20.5); g.scale.setScalar(1.35);
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
        s.userData = { vy: rnd(0.1, 0.4), vx: rnd(-0.05, 0.25), grow: rnd(0.3, 0.8), life: rnd(3, 6), age: 0 };
        scene.add(s); items.push(s);
      }
    }
    function update(dt) {
      for (let i = items.length - 1; i >= 0; i--) {
        const s = items[i], u = s.userData; u.age += dt;
        s.position.y += u.vy * dt; s.position.x += u.vx * dt;
        s.scale.addScalar(u.grow * dt);
        s.material.opacity = Math.max(0, s.material.opacity - dt * 0.12);
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
