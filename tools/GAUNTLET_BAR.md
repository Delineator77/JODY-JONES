# The Bar — AAA Arena Shooter (the reference the Gauntlet Loop judges against)

The concrete quality bar for GAUNTLET is a **modern AAA first-person arena shooter**
in the lineage of *Call of Duty*, *DOOM Eternal*, and *Destiny 2* Crucible — running
in a browser. When a critic looks at our rendered frame, the honest question is:

> "If I put a real AAA-shooter screenshot next to this frame, which one looks like a
> real game and which looks like an amateur WebGL demo — and exactly why?"

The reference wins by default. The critic's job is to name the **single biggest reason**
it wins and hand back concrete, implementable fixes.

## What the AAA bar looks like (concrete, inspectable criteria)

**Atmosphere & lighting**
- Deliberate cinematic color grade; strong but controlled contrast; readable darks that
  are not crushed to black; highlights that bloom tastefully, never blow out the frame.
- A clear key light + fill + rim/accent lights that shape every surface. No flat regions.
- Depth: fog/haze/atmospheric perspective that reads distance. Not an empty flat void.

**Environment / level art**
- Dense, intentional composition — foreground, midground, background layers. Something
  interesting in most of the frame; little dead empty sky or floor.
- Material variety and surface detail (panels, trims, wear, emissive signage). Not big
  untextured black boxes.
- Leading lines, focal points, set-dressing that says "a designer built this space."

**Enemies**
- Instantly readable, menacing silhouette that stands out from the background at a glance.
- Clear visual hierarchy (a threatening core/face), believable motion, telegraphed attacks.
- High contrast against the environment so the player always knows where threats are.

**Weapon / gunplay feel (viewmodel)**
- The gun reads unmistakably as a real firearm — recognizable receiver, barrel, magazine,
  grip, sight — with material believability, not an abstract wedge.
- Punchy feedback: muzzle flash, recoil kick + recovery, tracers, impact sparks, screen
  shake, hitmarkers. Firing feels physical.

**HUD & game feel / juice**
- Clean, legible, stylish HUD that never clutters the center. Instant feedback on every
  hit, kill, damage taken. Screen shake, hit markers, damage vignette, kill feedback.
- The frame feels alive and responsive, with polish in every interaction.

## How to inspect the real pixels

Render frames yourself (headless Chromium is wired up). Examples:

```
# menu / establishing shot
node tools/shoot.mjs index.html shots/<name>_menu.png 1500 "wait800"
# live combat, aimed at a hostile, muzzle flash + impacts
node tools/shoot.mjs index.html shots/<name>_combat.png 250 "start,wait2500,aim,gunfire"
# a hostile framed mid-field (not yet killed)
node tools/shoot.mjs index.html shots/<name>_enemy.png 250 "start,wait1600,aim"
```

Then open the PNGs and judge what you actually see. Ground every claim in the pixels.
```
```
