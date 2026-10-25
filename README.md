# Timeline Merge

A cinematic split-reality puzzle-platformer. One traveler exists as an echo in two versions of the same world — the golden **Dawn** and the corrupted **Eclipse** — shown side by side and divided by a violet seam. Only one reality can hold you at a time: shift between them to cross broken bridges, open barred gates, recover three lost memories and restore the shattered portal.

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
| Tab | Shift between Dawn and Eclipse (works in mid-air) |
| E | Interact with mechanisms and the portal |
| R | Return to the latest checkpoint |
| Esc | Pause / resume |
| M | Toggle sound |

### Phones and tablets

Touch devices get on-screen controls automatically (a keyboard still works and switches the screen back to the keyboard layout).

| Control | Action |
| --- | --- |
| Left pad | Slide your thumb left or right to move |
| JUMP | Jump (hold for a higher jump) |
| SHIFT | Shift between Dawn and Eclipse — slide from JUMP onto SHIFT to shift mid-air without cutting the jump |
| USE | Interact (glows when something can be used) |
| ❚❚ | Pause menu: resume, return to checkpoint, restart, sound, quit |

Play in landscape; tablets also work in portrait. Android and iPad enter fullscreen on the first tap. On iPhone, which has no fullscreen for web pages, use **Share → Add to Home Screen** to play without the browser bars.

## Structure

- `src/core` — deterministic game rules with no Phaser dependency: fixed-step physics, timeline shifting and placement validation, simulation, game flow and the finale timeline.
- `src/levels` — level data (geometry per timeline, puzzles, fragments, checkpoints, hints, decor).
- `src/render` — presentation: procedural pixel-art generation (`art/`), split-screen camera rig, world, player, portal, parallax backdrops and particles.
- `src/scenes` — Phaser scenes (boot, game orchestration, UI).
- `src/ui`, `src/input`, `src/audio` — HUD and menus, keyboard and touch input, procedural Web Audio.
- `tests` — Vitest suites, including an autopilot that completes the whole level and checks that the puzzles cannot be skipped.
