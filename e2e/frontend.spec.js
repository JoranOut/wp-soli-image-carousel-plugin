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
	let twoCarouselsLink;
	let singleLink;
	let autoLink;
	let deletedLink;
	let postId;

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
		twoCarouselsLink = await create( markup( ids ) + markup( ids.slice( 0, 2 ) ) );
		singleLink = await create( markup( ids.slice( 0, 1 ) ) );
		autoLink = await create( markup( ids, { aspectRatio: 'auto' } ) );

		// One valid image, one deleted attachment, one id that is a page, not
		// an attachment: only the first may render.
		const [ doomed ] = await uploadTestImages( admin, nonce, 1 );
		const del = await authenticatedRest( admin, nonce, {
			route: `/wp/v2/media/${ doomed }`,
			method: 'DELETE',
			body: { force: true },
		} );
		expect( del.status ).toBe( 200 );
		const probe = await authenticatedRest( admin, nonce, {
			route: '/wp/v2/pages',
			method: 'POST',
			body: { title: 'not an image', status: 'publish', content: '' },
		} );
		postId = probe.body.id;
		deletedLink = await create( markup( [ ids[ 0 ], doomed, postId ] ) );
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

	test( 'enters native fullscreen and exits again', async ( { page } ) => {
		await page.goto( link );
		const carousel = page.locator( '.soli-carousel' );
		const button = carousel.locator( '[data-action="fullscreen"]' );
		await button.click();
		await expect( carousel ).toHaveClass( /is-fullscreen/ );
		// The native path must have been taken, not the CSS fallback.
		await expect
			.poll( () => page.evaluate( () => document.fullscreenElement?.classList.contains( 'soli-carousel' ) ) )
			.toBe( true );
		await expect( button ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect( button ).toHaveAttribute( 'aria-label', 'Exit fullscreen' );
		await expect( page.locator( 'html' ) ).toHaveClass( /soli-carousel-fullscreen-open/ );

		await button.click();
		await expect( carousel ).not.toHaveClass( /is-fullscreen/ );
		await expect.poll( () => page.evaluate( () => document.fullscreenElement ) ).toBeNull();
		await expect( button ).toHaveAttribute( 'aria-pressed', 'false' );
		await expect( page.locator( 'html' ) ).not.toHaveClass( /soli-carousel-fullscreen-open/ );
	} );

	test( 'falls back to a CSS overlay without the Fullscreen API, moved out of a transformed ancestor', async ( { page } ) => {
		// Simulate iOS Safari: no Fullscreen API. Wrap the carousel in a
		// transformed ancestor, which would clip a position:fixed child.
		await page.addInitScript( () => {
			Object.defineProperty( document, 'fullscreenEnabled', { get: () => false } );
			delete Element.prototype.requestFullscreen;
		} );
		await page.goto( link );
		await page.evaluate( () => {
			const root = document.querySelector( '.soli-carousel' );
			const wrapper = document.createElement( 'div' );
			wrapper.id = 'transformed';
			wrapper.style.transform = 'translateZ(0)';
			wrapper.style.width = '200px';
			wrapper.style.height = '100px';
			wrapper.style.overflow = 'hidden';
			root.parentNode.insertBefore( wrapper, root );
			wrapper.appendChild( root );
		} );
		const carousel = page.locator( '.soli-carousel' );
		await carousel.locator( '[data-action="fullscreen"]' ).click();
		await expect( carousel ).toHaveClass( /is-fullscreen/ );
		expect( await page.evaluate( () => document.fullscreenElement ) ).toBeNull();
		// Reparented to <body>, so the overlay covers the viewport.
		expect( await page.evaluate( () => document.querySelector( '.soli-carousel' ).parentElement.tagName ) ).toBe( 'BODY' );
		const box = await carousel.boundingBox();
		const viewport = page.viewportSize();
		expect( Math.round( box.width ) ).toBe( viewport.width );
		expect( Math.round( box.height ) ).toBe( viewport.height );
		await expect( page.locator( 'html' ) ).toHaveClass( /soli-carousel-fullscreen-open/ );

		// Escape exits and puts the carousel back where it came from.
		await page.keyboard.press( 'Escape' );
		await expect( carousel ).not.toHaveClass( /is-fullscreen/ );
		expect( await page.evaluate( () => document.querySelector( '.soli-carousel' ).parentElement.id ) ).toBe( 'transformed' );
		await expect( page.locator( 'html' ) ).not.toHaveClass( /soli-carousel-fullscreen-open/ );
	} );

	test( 'two carousels on one page keep independent state', async ( { page } ) => {
		await page.goto( twoCarouselsLink );
		const first = page.locator( '.soli-carousel' ).nth( 0 );
		const second = page.locator( '.soli-carousel' ).nth( 1 );
		await expect( first.locator( '.soli-carousel__slide' ) ).toHaveCount( 3 );
		await expect( second.locator( '.soli-carousel__slide' ) ).toHaveCount( 2 );

		await first.locator( '[data-action="next"]' ).click();
		await expect( first.locator( '.soli-carousel__slide.is-active' ) ).toHaveAttribute( 'data-index', '1' );
		await expect( second.locator( '.soli-carousel__slide.is-active' ) ).toHaveAttribute( 'data-index', '0' );

		// The scroll-lock class on <html> must survive the second carousel's
		// fullscreenchange listener firing for the first one's transition.
		await first.locator( '[data-action="fullscreen"]' ).click();
		await expect( first ).toHaveClass( /is-fullscreen/ );
		await expect( second ).not.toHaveClass( /is-fullscreen/ );
		await expect( page.locator( 'html' ) ).toHaveClass( /soli-carousel-fullscreen-open/ );
		await first.locator( '[data-action="fullscreen"]' ).click();
		await expect( first ).not.toHaveClass( /is-fullscreen/ );
		await expect( page.locator( 'html' ) ).not.toHaveClass( /soli-carousel-fullscreen-open/ );
	} );

	test( 'wires up a carousel inserted after page load', async ( { page } ) => {
		await page.goto( link );
		await page.evaluate( () => {
			const clone = document.querySelector( '.soli-carousel' ).cloneNode( true );
			delete clone.dataset.soliCarouselReady;
			clone.id = 'late';
			document.body.appendChild( clone );
		} );
		const late = page.locator( '#late' );
		await expect( late ).toHaveAttribute( 'data-soli-carousel-ready', '1' );
		await late.locator( '[data-action="next"]' ).click();
		await expect( late.locator( '.soli-carousel__slide.is-active' ) ).toHaveAttribute( 'data-index', '1' );
	} );

	test( 'supports keyboard navigation and keeps focus on the active dot', async ( { page } ) => {
		await page.goto( link );
		const carousel = page.locator( '.soli-carousel' );
		const active = carousel.locator( '.soli-carousel__slide.is-active' );
		await carousel.locator( '.soli-carousel__dot[data-index="0"]' ).focus();
		await page.keyboard.press( 'ArrowRight' );
		await expect( active ).toHaveAttribute( 'data-index', '1' );
		await expect( carousel.locator( '.soli-carousel__dot[data-index="1"]' ) ).toBeFocused();
		await expect( carousel.locator( '.soli-carousel__dot[data-index="1"]' ) ).toHaveAttribute( 'aria-current', 'true' );
		await expect( carousel.locator( '.soli-carousel__dot[data-index="0"]' ) ).not.toHaveAttribute( 'aria-current', 'true' );
		await page.keyboard.press( 'ArrowLeft' );
		await expect( active ).toHaveAttribute( 'data-index', '0' );
	} );

	test( 'renders captions, alt text and lazy loading from the attachment', async ( { page } ) => {
		await page.goto( link );
		const slides = page.locator( '.soli-carousel__slide' );
		await expect( slides.nth( 0 ).locator( '.soli-carousel__caption' ) ).toContainText( 'Caption for carousel-e2e-' );
		await expect( slides.nth( 0 ).locator( 'img' ) ).toHaveAttribute( 'alt', /carousel-e2e-.*-0\.png/ );
		await expect( slides.nth( 0 ).locator( 'img' ) ).toHaveAttribute( 'loading', 'eager' );
		await expect( slides.nth( 1 ).locator( 'img' ) ).toHaveAttribute( 'loading', 'lazy' );
	} );

	test( 'applies the aspect ratio setting', async ( { page } ) => {
		await page.goto( link );
		const carousel = page.locator( '.soli-carousel' );
		await expect( carousel ).toHaveClass( /has-ratio/ );
		await expect( carousel ).toHaveAttribute( 'style', /--soli-carousel-ratio:16\/9/ );
		const track = await carousel.locator( '.soli-carousel__track' ).boundingBox();
		expect( track.width / track.height ).toBeCloseTo( 16 / 9, 1 );

		await page.goto( autoLink );
		await expect( page.locator( '.soli-carousel' ) ).toHaveClass( /is-auto-height/ );
		await expect( page.locator( '.soli-carousel' ) ).not.toHaveAttribute( 'style', /soli-carousel-ratio/ );
	} );

	test( 'a single image has no navigation, dots or thumbnails', async ( { page } ) => {
		await page.goto( singleLink );
		const carousel = page.locator( '.soli-carousel' );
		await expect( carousel.locator( '.soli-carousel__slide' ) ).toHaveCount( 1 );
		await expect( carousel.locator( '.soli-carousel__nav' ) ).toHaveCount( 0 );
		await expect( carousel.locator( '.soli-carousel__dot' ) ).toHaveCount( 0 );
		await expect( carousel.locator( '.soli-carousel__thumb' ) ).toHaveCount( 0 );
		await expect( carousel.locator( '.soli-carousel__counter' ) ).toHaveText( '1/1' );
		await expect( carousel.locator( '[data-action="download"]' ) ).toBeVisible();
	} );

	test( 'skips deleted attachments and ids that are not attachments', async ( { page } ) => {
		await page.goto( deletedLink );
		const carousel = page.locator( '.soli-carousel' );
		await expect( carousel.locator( '.soli-carousel__slide' ) ).toHaveCount( 1 );
		await expect( carousel.locator( '.soli-carousel__dot' ) ).toHaveCount( 0 );
		await expect( page.locator( '.soli-carousel__notice' ) ).toHaveCount( 0 );
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
