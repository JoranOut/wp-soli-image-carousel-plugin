<?php

namespace Soli\ImageCarousel;

/*
  Plugin Name: Soli Image Carousel Plugin
  Description: Gutenberg block that turns a selection from the media library into an image carousel with progress indicators, thumbnails, fullscreen and download.
  Version: 1.0.0
  Author: Joran Out
  License: GPL-2.0-or-later
  Text Domain: soli-image-carousel
  Domain Path: /languages
*/

if (!defined('ABSPATH')) exit; // Exit if accessed directly

require_once 'updater.php';
require_once 'inc/blocks.php';

define('SOLI_IMAGE_CAROUSEL__PLUGIN_DIR_PATH', plugin_dir_path(__FILE__));
define('SOLI_IMAGE_CAROUSEL__PLUGIN_DIR_URL', plugin_dir_url(__FILE__));
define('SOLI_IMAGE_CAROUSEL__PLUGIN_VERSION', "1.0.0");

add_action('init', function () {

  if (!defined('WP_GITHUB_FORCE_UPDATE')) define('WP_GITHUB_FORCE_UPDATE', true);

  if (is_admin()) { // note the use of is_admin() to double check that this is happening in the admin

    $config = array(
      'slug' => plugin_basename(__FILE__), // this is the slug of your plugin
      'proper_folder_name' => dirname(plugin_basename(__FILE__)), // this is the name of the folder your plugin lives in
      'api_url' => 'https://api.github.com/repos/JoranOut/wp-soli-image-carousel-plugin', // the GitHub API url of your GitHub repo
      'raw_url' => 'https://raw.githubusercontent.com/JoranOut/wp-soli-image-carousel-plugin/main', // the GitHub raw url of your GitHub repo
      'github_url' => 'https://github.com/JoranOut/wp-soli-image-carousel-plugin', // the GitHub url of your GitHub repo
      // Fallback only. The updater resolves the real download from the GitHub
      // releases API and overrides this with the release's zip asset.
      'zip_url' => 'https://github.com/JoranOut/wp-soli-image-carousel-plugin/releases/latest/download/wp-soli-image-carousel-plugin.zip', // the zip url of the GitHub repo
      'sslverify' => true,
      // Both ends of the supported range are stamped at packaging time by the
      // release and nightly workflows, from the same two versions the e2e
      // matrix runs against. The values checked in here are only what a build
      // from a working tree would report.
      'requires' => '6.9', // which version of WordPress does your plugin require?
      'tested' => '7.0.4',  // which version of WordPress is your plugin tested up to?
      'readme' => 'README.md', // which file to use as the readme for the version number
    );

    new WP_GitHub_Updater($config);
  }

});
