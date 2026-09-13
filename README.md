# Soli Image Carousel Plugin

~Plugin Name: wp-soli-image-carousel-plugin~
~Current Version: 1.0.0~

A Gutenberg block for soli.nl that turns a selection from the media library into an image carousel. It works in any post type that uses the block editor, custom post types included.

## Editor

- Toolbar and placeholder button **Select images** opens the WordPress media library in multi-select (gallery) mode. Opening it again pre-selects the current images so you can add or deselect.
- The selection is shown as a grid. Each tile has a remove button and left/right buttons to reorder.
- Block settings: aspect ratio, thumbnails, captions and download button on or off.

## Front end

- Crossfading slides with previous/next buttons, keyboard arrows and touch swipe.
- Progress dots and a `current/total` counter.
- Thumbnail strip that follows the active slide.
- Fullscreen toggle (native Fullscreen API, with a fixed-position fallback where the API is unavailable). Escape exits.
- Download button for the full-size file of the current slide.

Only attachment ids are trusted from saved content. `render.php` resolves URLs, alt text and captions at render time, so regenerated or edited media shows up without re-saving the post.

## Development

```bash
npm install
npm run build        # or npm start for watch mode
npm run env:start    # wp-env on http://localhost:8910 (tests env on 8911)
npm run test:e2e     # Playwright against the tests environment
npm run publish      # build + zip for distribution
```

The e2e tests mount `e2e/mu-plugins/soli-e2e-cpt.php` into the tests environment to prove the block works on a custom post type.

## Versioning

Semantic versioning. The version lives in four places and must stay in sync: the plugin header and constant in `soli-image-carousel-plugin.php`, this README, and `package.json`. Releases, nightlies and CI follow the shared Soli workflow described in the repository's `CLAUDE.md`.

## License

GPL-2.0-or-later
