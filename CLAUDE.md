# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DrFunn.com — a personal portfolio and interactive software playground hosted at drfunn.com. Static site with no build system, no package manager, no transpilation (except Mysterio which uses Babel standalone via CDN).

**Deployment:** Cloudflare Pages, auto-deploys on push to `main`. Custom domain: drfunn.com.

## Development

No build step. To develop locally, serve the root directory with any static HTTP server (needed for fetch-based footer loading and CORS). Open any `index.html` directly for quick checks.

No tests, no linter, no CI/CD pipeline.

## Architecture

### Landing Page (`/index.html`, `/style.css`)
Portfolio grid of project cards. Loads footer dynamically via `fetch()` from `/common/footer-home.html`. Contact modal submits to FormSpree.

### Dryer (`/dryer/`)
Chaotic percussion generator — the most complex project. Modular ES6 architecture with four files:

- **dryer-main.js** — Application controller, animation loop, feature toggles (Ball Type, Lint Trap, Moon Gravity)
- **dryer-physics.js** — Custom rigid body physics engine (~800 lines). Rotating reference frame simulation at ~240Hz (4 substeps × 60fps). Collision detection against cylindrical drum walls and configurable vanes. Centrifugal/Coriolis forces.
- **dryer-audio.js** — Web Audio API FM synthesis + Web MIDI API output. Percussion envelopes, dynamic MIDI note mapping based on collision surfaces.
- **dryer-ui.js** — Canvas-based rendering and interactive circular knob controls. Mouse/touch input handling.

Key parameters: RPM (1–40), Drum Size (60–100cm), Vanes (1–9), Vane Height (10–50%).

### Mysterio (`/mysterio/`)
3D particle visualization. Single `index.html` with inline React 18 + JSX (loaded via CDN with Babel standalone). Canvas-based 3D→2D projection, portal navigation between themed domains, mouse-tracked camera.

### CloudFlare Video Tests (`/cf-vidtests/`)
Video gallery using CloudFlare Stream API. Responsive thumbnail grid with modal player.

### Chordify (`/chordify/`)
Future project — only a planning document exists (`HARMONIZER_CHORDIFY_PROJECT.md`).

### Shared Resources (`/common/`)
Footer HTML templates, favicon, logo variants (WebP). Footers are loaded at runtime via `fetch()` and injected into pages.

## Conventions

- Pure vanilla JS (ES6 classes/modules) — no frameworks except React via CDN in Mysterio
- Canvas 2D API for all visualizations and custom UI controls
- WebP for images, Google Fonts (Orbitron) for typography
- Each project is self-contained in its own directory with its own `index.html`
- Open Graph and Twitter Card meta tags on all pages
