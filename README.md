# Timeline Merge

A cinematic split-reality puzzle-platformer. One traveler exists as an echo in two versions of the same world — the golden **Dawn** and the corrupted **Eclipse** — shown side by side and divided by a violet seam. Only one reality can hold you at a time: shift between them to cross broken bridges, open barred gates, recover lost memories and restore the shattered portals.

The journey spans **100 echoes in 10 chapters**. Every few echoes something new awakens, either an ability or a phenomenon of the world, so each step forward changes how you play.

Built with **TypeScript, Vite and Phaser 3**. All artwork and audio are generated procedurally at startup — no external assets, accounts or backend.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm test           # unit, level-integrity and full-playthrough tests
```

`dist/` is a static site and can be hosted anywhere (paths are relative).

## Docker

The `Dockerfile` installs dependencies, runs the test suite and builds the game in a Node stage, then serves `dist/` with nginx (long-lived cache for hashed assets, `no-cache` for the page, security headers, health check).

```bash
docker build -t timeline-merge . && docker run -p 8080:80 timeline-merge   # http://localhost:8080
```

## Continuous deployment

`.github/workflows/deploy.yml` runs on every push to `main` (Markdown-only changes are skipped) and can be started by hand from the Actions tab:

1. **CI** — type-check, unit tests, production build, `shellcheck` and the blue-green script test. Pull requests stop here.
2. **Image** — builds the Docker image and publishes it to GHCR as `ghcr.io/lucasmarujo/timeline-merge:<commit sha>` and `:latest`.
3. **Deploy** — over SSH, writes `deploy/docker-compose.prod.yml` and `deploy/blue-green.sh` to `/opt/timeline-merge` on the server and runs a blue-green swap: the idle colour (`timeline_merge_blue` / `timeline_merge_green`) starts with the new image, and the old one is removed only after the new one is healthy. If it never becomes healthy, the deploy fails and the current version stays online. Caddy routes the domain to whichever colour is healthy.

Repository secrets: `VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_SSH_KEY` (a deploy-only key) and `VPS_FINGERPRINT` (the server's SSH host key fingerprint, so the runner refuses an impostor host).

Roll back by re-running an earlier successful run of the workflow, or on the server with `IMAGE_TAG=<older sha> bash blue-green.sh docker-compose.prod.yml game timeline_merge` (after `docker login ghcr.io`).

## Controls

| Key | Action |
| --- | --- |
| A / D or ← / → | Move |
| W, ↑ or Space | Jump (hold for a higher jump) |
| Tab | Shift between Dawn and Eclipse |
| E | Interact with mechanisms and the portal |
| Q or K | Dash |
| R | Return to the latest checkpoint |
| Esc | Pause / resume |
| M | Toggle sound |

Abilities only answer once they have awakened (see [The journey](#the-journey)). Menus use W / S (or ↑ / ↓) and Enter; the atlas uses ← / → to pick an echo and ↑ / ↓ to change chapter.

### Phones and tablets

Touch devices get on-screen controls automatically (a keyboard still works and switches the screen back to the keyboard layout).

| Control | Action |
| --- | --- |
| Left pad | Slide your thumb left or right to move |
| JUMP | Jump (hold for a higher jump) |
| SHIFT | Shift between Dawn and Eclipse — slide from JUMP onto SHIFT to shift mid-air without cutting the jump |
| USE | Interact (glows when something can be used) |
| DASH | Dash |
| ❚❚ | Pause menu: resume, return to checkpoint, restart, atlas, sound, quit |

Buttons for abilities that have not awakened yet stay dimmed, and each one lights up when it is discovered. Tap an echo in the atlas to select it and tap it again to play.

Play in landscape; tablets also work in portrait. Android and iPad enter fullscreen on the first tap. On iPhone, which has no fullscreen for web pages, use **Share → Add to Home Screen** to play without the browser bars.

## The journey

Echo 1 starts with nothing but running and jumping. Discoveries arrive on a fixed schedule, and each one opens with a card that explains it, followed by a segment that teaches it:

| Echo | Discovery | Kind |
| --- | --- | --- |
| 2 | Reality Shift — step between Dawn and Eclipse while grounded | Ability |
| 3 | Echo Touch — turn winches and strike bells | Ability |
| 4 | Thornfields — thorns that exist in one reality only | Phenomenon |
| 5 | Rift Step — shift in mid-air | Ability |
| 7 | Tolling Bells — a bell in one reality raises light steps in the other | Phenomenon |
| 11 | Rift Leap — every mid-air shift rekindles your jump | Ability |
| 15 | Binding Chains — zones where the rift is sealed | Phenomenon |
| 21 | Echo Dash — a burst through the air, once per leap | Ability |
| 26 | Drifting Ruins — moving platforms and elevators | Phenomenon |
| 31 | Cape Glide — hold jump while falling; updrafts lift you | Ability |
| 41 | Wraiths — patrolling hazards that haunt one reality | Phenomenon |
| 51 | Wall Grip — slide down walls and kick off them | Ability |
| 61 | Crumbling Stone — floors that give way and reform | Phenomenon |
| 71 | Rift Pulse — seams that flip reality on a rhythm | Phenomenon |
| 81 | Rift Chain — a mid-air shift also restores your dash | Ability |
| 91 | The Unraveling — the world collapses behind you | Phenomenon |

Chapters: I The Sundered Span · II The Hanging Gardens · III The Ember Reach · IV The Glass Tide · V The Clockwork Deep · VI The Ashen Choir · VII The Starfall Steppe · VIII The Hollow Crown · IX The Mirrorwater · X The Last Seam. Each chapter has its own colour grade for both realities.

- Echoes end at a gate. Each one hides an optional **echo shard**.
- Every tenth echo is a **chapter trial**: recover three memories and restore the shattered portal to reach the finale cinematic. Echo 10 is the original handcrafted level.
- The **Atlas of Echoes** (title and pause menus) shows every chapter, your best times and shards, and lets you replay any unlocked echo.
- Progress is saved in the browser (`localStorage`).

Echoes other than 10 are built by a seeded generator (`src/levels/generator`) from segment templates. The same echo is always identical, and every generated echo is verified by an autopilot in the test suite: it must be finishable with only the abilities unlocked by then, without dying, collecting its shard or memories.

## Displays

The game keeps a 720-pixel-high world and widens the view on screens wider than 16:9, up to 32:9, so ultrawide monitors show more of both realities instead of black bars. 16:9 and narrower screens are unchanged. Menus and cards stay in a centred 16:9 band.

## Structure

- `src/core` — deterministic game rules with no Phaser dependency: fixed-step physics, timeline shifting and placement validation, simulation, game flow and the finale timeline.
- `src/levels` — the handcrafted level, the 100-echo progression (chapters, discoveries, unlocks), saved progress, the atlas model and the seeded level generator.
- `src/render` — presentation: procedural pixel-art generation (`art/`), split-screen camera rig, world, player, portal, parallax backdrops and particles.
- `src/scenes` — Phaser scenes (boot, game orchestration, UI).
- `src/ui`, `src/input`, `src/audio` — HUD and menus, keyboard and touch input, procedural Web Audio.
- `tests` — Vitest suites, including autopilots that complete the handcrafted level and all 99 generated echoes and check that the puzzles cannot be skipped.
