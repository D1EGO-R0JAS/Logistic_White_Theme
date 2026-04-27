# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static corporate website for **Logistic Support**, a Colombian integrated logistics operator. No build step, no package manager, no framework — pure HTML5 + CSS3 + vanilla JS (ES6+).

## Development Commands

```bash
# Serve locally (any of these work)
python3 -m http.server 8080
npx serve .
php -S localhost:8080

# Validate JS syntax
node --check js/main.js

# Search across frontend source files
grep -rn "searchterm" --include="*.html" --include="*.css" --include="*.js" .
```

There are no build, lint, or test commands — the site runs directly from source.

## Architecture

### File Layout

```
index.html          # Single-page app (59 KB) — all sections, all markup
css/styles.css      # All styles (47 KB) — no preprocessor
js/main.js          # All behaviour (~645 lines) — no bundler
images/             # Static assets (hero srcset, port/airport logos, office photos)
decretos/           # Regulatory PDFs linked in footer
```

### JavaScript Module Structure (`js/main.js`)

The file is organised into clearly commented modules executed in order:

| Lines | Module | Notes |
|-------|--------|-------|
| 1–31 | Utilities | `escapeHTML()` (XSS guard), `makeTimeoutSignal()` (fetch AbortController) |
| 50–63 | Loading screen | 2.45 s splash, then calls expensive inits |
| 89–131 | Scroll reveal + counters | IntersectionObserver; `.rv` elements get `.on` when visible |
| 133–221 | Lazy section init | Marquee and service-flip handlers registered only when section enters viewport (200 px margin) |
| 293–488 | TRM widget | Currency converter state machine — see below |
| 517–645 | Cargo tracking | Google Apps Script API call, result rendering |

### TRM Currency Widget

Holds its own state object (`trm`, `rates`, `sel`, `date`). On open it fires two parallel fetches — `datos.gov.co` for the official USD/COP rate and `frankfurter.app` for EUR/GBP/JPY cross-rates — using `Promise.allSettled` so one failure doesn't block the other. Results are cached in the state object for the session.

### Cargo Tracking

Calls a Google Apps Script web app (`API_URL` constant at line ~518) via GET with `cod_cliente` and `cod_servicio` params. The response JSON splits into *meta* fields (`CLIENTE`, `CANAL`, `TIPO_SERVICIO`, `PROCESO`) rendered in a header row, and all remaining key-value pairs rendered as a detail table. All output passes through `escapeHTML()` before being injected into the DOM.

### External API Dependencies

| API | Used for | Timeout |
|-----|----------|---------|
| `datos.gov.co/resource/32sa-8pi3.json` | Official TRM (USD/COP) | 6 s |
| `api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY` | Cross-rates | 6 s |
| `script.google.com/macros/s/[SCRIPT_ID]/exec` | Cargo tracking backend | 20 s |

### Key Pending Items

- **WhatsApp button** (`index.html` line ~934): placeholder `[TU_NUMERO]` must be replaced with the real phone number before going live.
- **Google Apps Script URL**: if the deployment is redeployed, update `API_URL` in `main.js`.

## Responsive & Performance Conventions

- Typography and spacing use `clamp()` — avoid adding hard `px` breakpoints for those properties.
- Expensive initialisations (marquee duplication, service-card flip listeners) are deferred inside `initSectionWhenVisible()` — follow the same pattern for any new heavy section.
- Hero images use `srcset` with `-small`, `-medium`, `-large` suffixes — add the same set when replacing the hero asset.
- Animations use `transform`/`opacity` only (hardware-accelerated); don't add `top`/`left`/`width` transitions.
