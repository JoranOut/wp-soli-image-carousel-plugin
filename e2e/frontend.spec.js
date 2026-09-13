/**
 * Front-end rendering: render.php output plus the compiled view.js behaviour.
 */
const { test, expect } = require( '@playwright/test' );
const { loginAndGetNonce, authenticatedRest, expectNoPhpDiagnostics } = require( './helpers' );
const { uploadTestImages } = require( './media' );

function markup( ids, extra = {} ) {
	const attrs = JSON.stringify( { images: ids.map( ( id ) => ( { id } ) ), ...extra } );
	return `<!-- wp:soli/image-carousel ${ attrs } /-->`;
}

test.describe( 'Image carousel front-end', () => {
	let ids;
	let link;
	let noThumbsLink;

	test.beforeAll( async ( { browser } ) => {
		const context = await browser.newContext();
		const admin = await context.newPage();
		const nonce = await loginAndGetNonce( admin );
		ids = await uploadTestImages( admin, nonce, 3 );

		const create = async ( content ) => {
			const res = await authenticatedRest( admin, nonce, {
				route: '/wp/v2/pages',
				method: 'POST',
				body: { title: 'Carousel e2e', status: 'publish', content },
			} );
			expect( res.status ).toBe( 201 );
			return res.body.link;
		};
		link = await create( markup( ids ) );
		noThumbsLink = await create( markup( ids, { showThumbnails: false, showDownload: false } ) );
		await context.close();
	} );

	test.afterEach( async ( { page } ) => {
		if ( page.url().startsWith( 'http' ) ) {
			await expectNoPhpDiagnostics( page );
		}
	} );

	test( 'renders slides, progress dots, thumbnails and toolbar', async ( { page } ) => {
		await page.goto( link );
		const carousel = page.locator( '.soli-carousel' );
		await expect( carousel ).toHaveCount( 1 );
		await expect( carousel.locator( '.soli-carousel__slide' ) ).toHaveCount( 3 );
		await expect( carousel.locator( '.soli-carousel__dot' ) ).toHaveCount( 3 );
		await expect( carousel.locator( '.soli-carousel__thumb' ) ).toHaveCount( 3 );
		await expect( carousel.locator( '[data-action="download"]' ) ).toBeVisible();
		await expect( carousel.locator( '[data-action="fullscreen"]' ) ).toBeVisible();
		await expect( carousel.locator( '.soli-carousel__slide.is-active img' ) ).toBeVisible();
	} );

	test( 'navigates with buttons, dots and thumbnails and updates the download link', async ( { page } ) => {
		await page.goto( link );
		const carousel = page.locator( '.soli-carousel' );
		await expect( carousel ).toHaveAttribute( 'data-soli-carousel-ready', '1' );
		const active = carousel.locator( '.soli-carousel__slide.is-active' );
		const counter = carousel.locator( '[data-role="current"]' );
		const download = carousel.locator( '[data-action="download"]' );

		const firstHref = await download.getAttribute( 'href' );
		await expect( download ).toHaveAttribute( 'download', /.+/ );

		await carousel.locator( '[data-action="next"]' ).click();
		await expect( active ).toHaveAttribute( 'data-index', '1' );
		await expect( counter ).toHaveText( '2' );
		await expect( carousel.locator( '.soli-carousel__dot.is-active' ) ).toHaveAttribute( 'data-index', '1' );
		await expect( carousel.locator( '.soli-carousel__thumb.is-active' ) ).toHaveAttribute( 'data-index', '1' );
		expect( await download.getAttribute( 'href' ) ).not.toBe( firstHref );

		await carousel.locator( '.soli-carousel__thumb[data-index="2"]' ).click();
		await expect( active ).toHaveAttribute( 'data-index', '2' );
		await carousel.locator( '[data-action="next"]' ).click();
		await expect( active ).toHaveAttribute( 'data-index', '0' ); // wraps
		await carousel.locator( '[data-action="prev"]' ).click();
		await expect( active ).toHaveAttribute( 'data-index', '2' );
		await carousel.locator( '.soli-carousel__dot[data-index="0"]' ).click();
		await expect( active ).toHaveAttribute( 'data-index', '0' );
		expect( await download.getAttribute( 'href' ) ).toBe( firstHref );
	} );

	test( 'toggles fullscreen and back', async ( { page } ) => {
		await page.goto( link );
		const carousel = page.locator( '.soli-carousel' );
		const button = carousel.locator( '[data-action="fullscreen"]' );
		await button.click();
		await expect( carousel ).toHaveClass( /is-fullscreen/ );
		await expect( button ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect( button ).toHaveAttribute( 'aria-label', 'Exit fullscreen' );
		await button.click();
		await expect( carousel ).not.toHaveClass( /is-fullscreen/ );
		await expect( button ).toHaveAttribute( 'aria-pressed', 'false' );
	} );

	test( 'download link points at a file that exists', async ( { page, request } ) => {
		await page.goto( link );
		const href = await page.locator( '.soli-carousel [data-action="download"]' ).getAttribute( 'href' );
		const res = await request.get( href );
		expect( res.status() ).toBe( 200 );
		expect( res.headers()[ 'content-type' ] ).toMatch( /^image\// );
	} );

	test( 'respects the thumbnails and download toggles', async ( { page } ) => {
		await page.goto( noThumbsLink );
		const carousel = page.locator( '.soli-carousel' );
		await expect( carousel.locator( '.soli-carousel__thumb' ) ).toHaveCount( 0 );
		await expect( carousel.locator( '[data-action="download"]' ) ).toHaveCount( 0 );
		await expect( carousel.locator( '.soli-carousel__dot' ) ).toHaveCount( 3 );
	} );
} );
