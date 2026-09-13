<?php
/*
 * Plugin Name: Soli e2e custom post type
 * Description: Registers a block-editor-enabled custom post type so the e2e suite can prove the carousel works outside posts and pages. Test environment only.
 */
add_action('init', function () {
	register_post_type('soli_e2e_cpt', [
		'label' => 'E2E CPT',
		'public' => true,
		'show_in_rest' => true,
		'supports' => ['title', 'editor'],
	]);
});
