<?php

namespace Soli\ImageCarousel;

if (!defined('ABSPATH')) exit;

/**
 * Registers the block from the manifest that `wp-scripts build --blocks-manifest`
 * writes into `build/`. The block is dynamic: its markup comes from
 * `src/image-carousel/render.php`, so image URLs are always resolved from the
 * attachment ids at render time and never go stale when a file is regenerated.
 */
add_action('init', function () {
	$build_dir = plugin_dir_path(__DIR__) . 'build';
	$manifest  = $build_dir . '/blocks-manifest.php';

	if (!file_exists($manifest)) {
		// Built assets are gitignored; a checkout without `npm run build` has no
		// block to register. Say so in the admin instead of failing silently.
		add_action('admin_notices', function () {
			echo '<div class="notice notice-error"><p>' .
				esc_html__('Soli Image Carousel: build/blocks-manifest.php is missing. Run "npm run build" in the plugin directory.', 'soli-image-carousel') .
				'</p></div>';
		});
		return;
	}

	// WP 6.8+, and the plugin requires 6.9.
	wp_register_block_types_from_metadata_collection($build_dir, $manifest);
});

add_action('init', function () {
	load_plugin_textdomain('soli-image-carousel', false, dirname(plugin_basename(__DIR__)) . '/languages');
});

add_action('init', function () {
	wp_set_script_translations('soli-image-carousel-editor-script', 'soli-image-carousel', plugin_dir_path(__DIR__) . 'languages');
}, 20);
