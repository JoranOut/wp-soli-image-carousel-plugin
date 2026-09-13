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
- **Front end is plain DOM.** `view.js` wires navigation, dots, thumbnails, the download link (`href` and `download` filename follow the active slide; hidden when no full-size URL exists) and fullscreen. It marks a root with `data-soli-carousel-ready="1"` so tests can wait for hydration. A `MutationObserver` picks up carousels inserted after load, and `window.soliCarouselInit(scope)` exists for themes that swap content some other way.
- **Fullscreen** uses `requestFullscreen` when available. Otherwise it toggles `.is-fullscreen` (fixed overlay) and reparents the root to `<body>` so a transformed or contained ancestor cannot clip it, restoring the original position on exit. The scroll-lock class on `<html>` is owned by a module-level variable, so several carousels on one page do not clobber each other.
- **Dots and thumbnails are plain buttons** with `aria-current` and a roving `tabIndex`, not an ARIA tab pattern. Arrow keys move both the slide and focus.
- **Missing media.** `render.php` drops ids that are no longer image attachments and, when nothing is left, prints a notice only to users who can edit the post. The editor marks such tiles `is-missing` and counts them separately.
- **Attributes:** `images` (array of `{id,url,alt}`), `showThumbnails`, `showCaptions`, `showDownload`, `aspectRatio` (`16/9`, `4/3`, `3/2`, `1/1`, `auto`).

## Testing

- `.wp-env.json` pins `core` to a wordpress.org zip on purpose: WordPress 7.0.4 shipped without a git tag and broke wp-env's git resolution. CI overrides it per leg through `WP_ENV_CORE`. Do not "simplify" it away.
- `npm run test:e2e` runs against the wp-env tests environment on port 8911. Ports 8910/8911 are pinned because several Soli environments run concurrently.
- The editor canvas is an iframe (`iframe[name="editor-canvas"]`); locate blocks through it.
- `e2e/media.js` uploads generated PNGs via REST so tests never depend on fixtures.
- `.wp-env.json` maps `e2e/mu-plugins/soli-e2e-cpt.php` into mu-plugins to register the `soli_e2e_cpt` post type used by the custom-post-type test.
- The PHP-diagnostics assertion was proven on 2026-09-13 by injecting an undefined variable into `render.php`: 5 failures before revert, 5 passes after.

## Conventions

Everything else (versioning in 4 places, release flow, CI workflows, coding standards, translations) follows the root `/git/soli/CLAUDE.md`.
