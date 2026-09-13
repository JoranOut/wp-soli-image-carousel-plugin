/**
 * Plugin activation and block registration.
 */
const { test, expect } = require( '@playwright/test' );
const { loginAsAdmin, loginAndGetNonce, authenticatedRest, expectNoPhpDiagnostics } = require( './helpers' );

test.describe( 'Soli Image Carousel plugin', () => {
	test( 'is active and renders the plugins screen without PHP errors', async ( { page } ) => {
		await loginAsAdmin( page );
		await page.goto( '/wp-admin/plugins.php' );
		const row = page.locator( 'tr[data-slug="soli-image-carousel-plugin"], tr[data-plugin="wp-soli-image-carousel-plugin/soli-image-carousel-plugin.php"]' );
		await expect( row ).toHaveCount( 1 );
		await expect( row ).toHaveClass( /active/ );
		await expectNoPhpDiagnostics( page );
	} );

	test( 'registers the soli/image-carousel block type', async ( { page } ) => {
		const nonce = await loginAndGetNonce( page );
		const { status, body } = await authenticatedRest( page, nonce, {
			route: '/wp/v2/block-types/soli/image-carousel',
		} );
		expect( status ).toBe( 200 );
		expect( body.name ).toBe( 'soli/image-carousel' );
		expect( body.attributes.images ).toBeDefined();
		expect( body.attributes.showThumbnails.default ).toBe( true );
	} );
} );
