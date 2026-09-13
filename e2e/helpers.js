/**
 * Shared helpers for the Soli Image Carousel e2e tests.
 *
 * The wp-env test environment uses plain permalinks, so REST requests are made
 * through the `?rest_route=` fallback instead of `/wp-json/`.
 */

const { expect } = require( '@playwright/test' );

const ADMIN_USER = 'admin';
const ADMIN_PASSWORD = 'password';

/**
 * Fragments of paths that identify this plugin's own PHP files.
 *
 * Used to scope the softer PHP diagnostics (warnings, notices, deprecations) to
 * code this repository owns, so that unrelated WordPress core or theme noise
 * cannot turn CI red. `image-carousel/render.php` is the compiled copy of the
 * block's render template in `build/`.
 */
const PLUGIN_PHP_FILES =
	'soli-image-carousel-plugin\\.php|inc/blocks\\.php|image-carousel/render\\.php';

/** Diagnostics that are never acceptable, wherever they come from. */
const FATAL_ERROR_PATTERN = /Fatal error|Parse error/i;

/** Softer diagnostics, but only when they point at this plugin's files. */
const PLUGIN_DIAGNOSTIC_PATTERN = new RegExp(
	'(Warning|Notice|Deprecated):[^\\n]*(' + PLUGIN_PHP_FILES + ')',
	'i'
);

/**
 * Reads the body text of the current page twice, for the two assertions below.
 *
 * Both reads use `textContent`, NOT `innerText`. `innerText` reflects
 * *rendered* text, so it silently omits anything inside an element that is
 * hidden — a container that ships `display: none` until JavaScript reveals it,
 * a collapsed panel, an inactive tab. A PHP diagnostic emitted inside such a
 * container is then invisible to the assertion, which passes vacuously. That is
 * not hypothetical: measured in `wp-soli-ticket-scanner-plugin`, whose template
 * ships `#pin-screen` and `#scanner-screen` hidden, one injected error produced
 * 3 failures via `textContent` and only 2 via `innerText`. Do not "optimise"
 * this back to `innerText`.
 *
 * The two reads differ only in whether script/style sources are included, and
 * that difference is deliberate in both directions:
 *
 * - `markup` (a body clone with `script, style, template, noscript` removed)
 *   feeds `PLUGIN_DIAGNOSTIC_PATTERN`. That pattern matches *within a line*
 *   (`[^\n]*`), and wp-admin prints large single-line JSON blobs into inline
 *   scripts, so a string containing `Warning:` near a plugin path could match
 *   script text and turn CI red for nothing. The path-scoped pattern must NOT
 *   see script text. Scoping the read is the right fix; loosening the pattern
 *   to tolerate script noise would blunt the diagnostic itself.
 *
 * - `full` (the live body, scripts included) feeds `FATAL_ERROR_PATTERN`. That
 *   pattern must see script text: a fatal thrown while an inline script is
 *   being printed lands inside that `<script>` node, and a stripped clone would
 *   lose it. `Fatal error` / `Parse error` are also far less likely than
 *   `Warning:` to appear in legitimate script source.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<{full: string, markup: string}>} Full body text, and body
 *                                                   text with script/style
 *                                                   sources removed.
 */
function readBodyText( page ) {
	return page.evaluate( () => {
		const clone = document.body.cloneNode( true );
		clone
			.querySelectorAll( 'script, style, template, noscript' )
			.forEach( ( node ) => node.remove() );

		return {
			full: document.body.textContent || '',
			markup: clone.textContent || '',
		};
	} );
}

/**
 * Asserts that the currently loaded page contains no PHP diagnostics.
 *
 * `WP_DEBUG` and `WP_DEBUG_DISPLAY` are enabled for the wp-env `tests`
 * environment (see `.wp-env.json`), so PHP diagnostics are printed into the
 * rendered document. Anything PHP emits before `<html>` or inside `<head>` is
 * relocated into the body by the HTML parser, so reading the body text catches
 * diagnostics from any point in the request.
 *
 * See `readBodyText()` for why this reads `textContent` and not `innerText`,
 * and why the two assertions read different bodies.
 *
 * @param {import('@playwright/test').Page} page
 */
async function expectNoPhpDiagnostics( page ) {
	const url = page.url();
	const { full, markup } = await readBodyText( page );

	expect( full, `PHP fatal/parse error rendered by ${ url }` ).not.toMatch(
		FATAL_ERROR_PATTERN
	);
	expect(
		markup,
		`PHP warning/notice/deprecation from this plugin rendered by ${ url }`
	).not.toMatch( PLUGIN_DIAGNOSTIC_PATTERN );
}

/**
 * Builds a REST URL that works with plain permalinks.
 *
 * @param {string} route REST route, e.g. `/wp/v2/pages`.
 * @return {string} Relative URL.
 */
function restUrl( route ) {
	return '/?rest_route=' + encodeURIComponent( route );
}

/**
 * Logs in as the wp-env administrator.
 *
 * @param {import('@playwright/test').Page} page
 */
async function loginAsAdmin( page ) {
	await page.goto( '/wp-login.php' );
	await page.fill( '#user_login', ADMIN_USER );
	await page.fill( '#user_pass', ADMIN_PASSWORD );
	await page.click( '#wp-submit' );
	await page.waitForURL( /wp-admin/ );
}

/**
 * Logs in and returns a REST nonce for cookie authenticated requests.
 *
 * WordPress only accepts cookie authentication for the REST API when a valid
 * `wp_rest` nonce is supplied, so the nonce is read from the admin page that
 * WordPress prints it on.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<string>} The `wp_rest` nonce.
 */
async function loginAndGetNonce( page ) {
	await loginAsAdmin( page );

	// post-new.php reliably enqueues wp-api-fetch / wp-api-request, which is
	// what prints `wpApiSettings` (including the nonce) into the page.
	await page.goto( '/wp-admin/post-new.php?post_type=page' );
	await page.waitForFunction(
		() => !! ( window.wpApiSettings && window.wpApiSettings.nonce )
	);

	return page.evaluate( () => window.wpApiSettings.nonce );
}

/**
 * Performs an authenticated REST request from inside the logged-in browser
 * context.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          nonce
 * @param {Object}                          options
 * @param {string}                          options.route  REST route.
 * @param {string}                          [options.method] HTTP method.
 * @param {*}                               [options.body]   JSON body.
 * @return {Promise<{status: number, body: *}>} Status code and parsed body.
 */
async function authenticatedRest( page, nonce, { route, method = 'GET', body } ) {
	return page.evaluate(
		async ( { url, method: httpMethod, nonce: restNonce, body: payload } ) => {
			const response = await fetch( url, {
				method: httpMethod,
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': restNonce,
				},
				credentials: 'same-origin',
				body:
					payload === undefined
						? undefined
						: JSON.stringify( payload ),
			} );

			let parsed = null;
			try {
				parsed = await response.json();
			} catch {
				parsed = null;
			}

			return { status: response.status, body: parsed };
		},
		{ url: restUrl( route ), method, nonce, body }
	);
}

module.exports = {
	ADMIN_USER,
	ADMIN_PASSWORD,
	PLUGIN_PHP_FILES,
	FATAL_ERROR_PATTERN,
	PLUGIN_DIAGNOSTIC_PATTERN,
	restUrl,
	loginAsAdmin,
	loginAndGetNonce,
	authenticatedRest,
	expectNoPhpDiagnostics,
};
