# Jody Jones & Monk — Art Bible (CCC "illustrated-cinema" look)

The single source of truth for the game's visual identity. Every scene must obey it.
Derived from the reference sheets (Cold Springs, Campfire, The Desert, The Cave, Train
Car, Continental Pacific, Canyon Bridge) and the canyon-river reference stills.

## The five production rules (printed on every reference sheet)
1. Keep all shapes **bold and simple**.
2. **Strong graphic silhouettes** at all distances.
3. **Limit fine detail. No tiny parts.**
4. **Use color to define planes and depth** (not texture noise).
5. Maintain the **illustrated cinema** style — cel shading, ink lines, flat color masses.

## Locked palette
Every sheet labels the same core four, plus two accents:

| Name             | Hex        | Use                                            |
|------------------|------------|------------------------------------------------|
| Midnight Navy    | `#14203a`  | shadow, deep water, night sky, ink base        |
| Burnt Vermillion | `#b04a29`  | sunlit rock faces, dust, warm masses           |
| Warm Ivory       | `#ecdfc4`  | sky near horizon, paper/UI, highlights, foam   |
| Olive Green      | `#555c37`  | Jody's poncho, vegetation, canvas              |
| Aged Brass       | `#a87b3e`  | metal accents, lantern glow, hardware          |
| Stone Gray       | `#6b6a66`  | neutral rock, metal, secondary masses          |

Extended canyon-dusk ramp (interpolate within the four above — do not add new hues):
`#0e1626` deep → `#14203a` navy → `#2a3d63` steel-blue → `#b04a29` vermillion →
`#d76a2f` vermillion-hi → `#e89440` amber → `#f4b45e` amber-hi → `#ecdfc4` ivory.

Ink outline: `#0b1120`, uniform-ish screen weight, on hero shapes only (characters,
foreground rock, weapon) — NOT on distant walls, water, or vegetation (those stay broad
masses defined by color).

## Rendering method (in engine)
- `MeshToonMaterial` + a 3–4 step gradient ramp → hard cel bands.
- Flat shading on rock/character volumes → faceted, graphic.
- Clip-space inverted-hull outlines for ink on hero objects.
- Canyon walls: unlit vertex-colored masses (color = plane + depth, per rule 4).
- Water: custom shader — posterized broad masses, NOT realistic.

## Canyon River Shootout — scene notes
- Lower canyon in deep **navy shadow**; **vermillion** cliff faces catch the low sun;
  **amber→ivory** blaze at the very tops. Narrow warm **sky strip** with big, simple,
  cel-shaded clouds (ivory tops, navy undersides).
- **The river carries a reflection streak toward the viewer** — orange/amber at dusk,
  silver at night — over deep navy water. This is the signature of the location.
- Reeds, driftwood, far rocks read as **near-black silhouettes** with a thin warm rim.
- Player crouched behind a large dark wet foreground boulder; Colt + gloved hand low in
  frame. Enemies peek from far-bank cover at varied heights. Crow: distant, still, Sharps.
- Lighting identity: cool shadow world + one low warm sun (rim + cliff glow) + brief
  **orange muzzle flashes** punching warm light into the blue.
- Two canonical times of day exist in the references: **dusk** (orange) and **moonlit
  night** (silver). Both are implemented as swappable presets (`TOD_PRESETS` in
  `canyon.js`) covering key light, fills, fog, sky ramp, river reflection colour, mist
  layers, bloom and the grade's duotone. Open `canyon.html?night` for the night look;
  dusk is the default. Add future scenes by reusing the same two presets.

## Cast (from references)
- **Jody Jones** — blond shoulder-length hair, stubble, blue eyes, **olive fringed poncho
  w/ aztec diamond pattern** over a dark navy shirt, black/brown hat, Colt on the hip.
- **Monk** — dark hair, full beard, brown coat, green neckscarf, lever-action rifle +
  bandolier. Older, heavier, steadier than Jody.
- **Harlan Crow** — antagonist. Huge frame, black hat, dark duster, long Sharps rifle.
- **The Warrior Leader** — canyon guardian, 40s, layered leather + woven textiles, rifle
  + knife, braided dark hair, protective talisman.

## Other locations (reference sheets on file, for later scenes)
Cold Springs (frontier town) · Campfire (high-desert camp) · The Desert (monument valley) ·
The Cave (hideout) · Train Car Interior (the safe) · The Continental Pacific (locomotive) ·
Canyon Bridge (wooden trestle). All share the palette + five rules above.
