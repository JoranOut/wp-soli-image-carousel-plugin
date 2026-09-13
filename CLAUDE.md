# wp-soli-image-carousel-plugin

Gutenberg block `soli/image-carousel`: a media-library selection rendered as a carousel with progress dots, thumbnails, fullscreen and download. Available in every block-editor post type.

## Layout

```
soli-image-carousel-plugin.php   plugin header, constants, GitHub updater config
inc/blocks.php                   registers build/blocks-manifest.php, loads translations
src/image-carousel/              @wordpress/create-block source (block.json, edit.js, render.php, view.js, scss)
build/                           gitignored; `npm run build` output, what the plugin actually loads
e2e/                             Playwright suite (helpers, media upload helper, CPT mu-plugin)
```

## Architecture

- **Dynamic block.** `save` returns null; `render.php` builds the markup from attachment ids. Only `images[].id` is trusted; URLs, alt and captions come from the attachment at render time. `images[].url` is an editor-only preview hint and `edit.js` falls back to the core data store when it is missing.
- **Front end is plain DOM.** `view.js` wires navigation, dots, thumbnails, the download link (`href` and `download` filename follow the active slide) and fullscreen. It marks a root with `data-soli-carousel-ready="1"` so tests can wait for hydration.
- **Fullscreen** uses `requestFullscreen` when available and otherwise toggles `.is-fullscreen` (fixed overlay). Both states share the same CSS.
- **Attributes:** `images` (array of `{id,url,alt}`), `showThumbnails`, `showCaptions`, `showDownload`, `aspectRatio` (`16/9`, `4/3`, `3/2`, `1/1`, `auto`).

## Testing

- `npm run test:e2e` runs against the wp-env tests environment on port 8911. Ports 8910/8911 are pinned because several Soli environments run concurrently.
- The editor canvas is an iframe (`iframe[name="editor-canvas"]`); locate blocks through it.
- `e2e/media.js` uploads generated PNGs via REST so tests never depend on fixtures.
- `.wp-env.json` maps `e2e/mu-plugins/soli-e2e-cpt.php` into mu-plugins to register the `soli_e2e_cpt` post type used by the custom-post-type test.
- The PHP-diagnostics assertion was proven on 2026-09-13 by injecting an undefined variable into `render.php`: 5 failures before revert, 5 passes after.

## Conventions

Everything else (versioning in 4 places, release flow, CI workflows, coding standards, translations) follows the root `/git/soli/CLAUDE.md`.
