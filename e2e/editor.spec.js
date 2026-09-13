/**
 * The editing experience: the "Select images" button opens the media library
 * in multi-select mode, the selection appears as a grid, and images can be
 * removed from the grid.
 *
 * Runs on a custom post type registered by a mu-plugin the test installs, so
 * that the block is proven to work outside posts and pages.
 */
const { test, expect } = require( '@playwright/test' );
const { loginAndGetNonce, authenticatedRest, loginAsAdmin, expectNoPhpDiagnostics } = require( './helpers' );
const { uploadTestImages } = require( './media' );

const BLOCK_NAME = 'soli/image-carousel';

async function openNewEditor( page, postType = 'post' ) {
	await page.goto( `/wp-admin/post-new.php?post_type=${ postType }` );
	// Dismiss the welcome guide if it shows.
	const guide = page.locator( '.edit-post-welcome-guide, .editor-welcome-guide' );
	if ( await guide.isVisible().catch( () => false ) ) {
		await page.keyboard.press( 'Escape' );
	}
	await page.waitForFunction( () => window.wp && window.wp.data && window.wp.data.select( 'core/block-editor' ) );
}

/**
 * The block canvas is iframed (`name="editor-canvas"`) on current WordPress;
 * older versions render it inline. Resolve the block in whichever is present.
 */
function canvas( page ) {
	return page.frameLocator( 'iframe[name="editor-canvas"]' );
}

async function blockLocator( page ) {
	const frame = page.locator( 'iframe[name="editor-canvas"]' );
	const iframed = await frame
		.waitFor( { state: 'attached', timeout: 2000 } )
		.then( () => true )
		.catch( () => false );
	if ( iframed ) {
		return canvas( page ).locator( `[data-type="${ BLOCK_NAME }"]` );
	}
	return page.locator( `[data-type="${ BLOCK_NAME }"]` );
}

async function insertCarousel( page, attributes = {} ) {
	await page.evaluate(
		( { name, attributes: attrs } ) => {
			const block = window.wp.blocks.createBlock( name, attrs );
			window.wp.data.dispatch( 'core/block-editor' ).insertBlocks( block );
		},
		{ name: BLOCK_NAME, attributes }
	);
	return blockLocator( page );
}

test.describe( 'Image carousel in the editor', () => {
	let imageIds;

	test.beforeAll( async ( { browser } ) => {
		const context = await browser.newContext();
		const page = await context.newPage();
		const nonce = await loginAndGetNonce( page );
		imageIds = await uploadTestImages( page, nonce, 3 );
		await context.close();
	} );

	test( 'shows a "Select images" button that opens the media library in multi-select mode', async ( { page } ) => {
		await loginAsAdmin( page );
		await openNewEditor( page );
		const block = await insertCarousel( page );

		const button = block.getByRole( 'button', { name: 'Select images' } );
		await expect( button ).toBeVisible();
		await button.click();

		const modal = page.locator( '.media-modal' );
		await expect( modal ).toBeVisible();

		// Multi-select: the media frame is opened with `multiple` set.
		const multiple = await page.evaluate( () => {
			const frame = window.wp.media.frame;
			const state = frame && frame.state();
			return state ? state.get( 'multiple' ) : null;
		} );
		expect( multiple ).toBeTruthy();

		// A fresh browser context lands on the "Upload files" tab.
		const libraryTab = modal.getByRole( 'tab', { name: 'Media Library' } );
		if ( await libraryTab.isVisible().catch( () => false ) ) {
			await libraryTab.click();
		}
		await expect( modal.locator( '.attachments .attachment' ).first() ).toBeVisible();

		// Ctrl/Cmd-click toggles individual attachments (Shift would select a
		// range, which only works while the uploads happen to be adjacent).
		for ( const id of imageIds ) {
			const tile = modal.locator( `.attachments-browser .attachments .attachment[data-id="${ id }"]` ).first();
			await tile.scrollIntoViewIfNeeded();
			await tile.click( { modifiers: [ 'ControlOrMeta' ] } );
		}
		const selected = await page.evaluate( () => window.wp.media.frame.state().get( 'selection' ).length );
		expect( selected ).toBe( imageIds.length );

		// Gallery frame: "Create a new gallery" leads to the edit step, which
		// has the insert button.
		await modal.getByRole( 'button', { name: 'Create a new gallery' } ).click();
		await modal.getByRole( 'button', { name: 'Insert gallery' } ).click();
		await expect( modal ).toBeHidden();

		const items = block.locator( '.soli-carousel-editor__item' );
		await expect( items ).toHaveCount( imageIds.length );
		await expect( block ).toContainText( `${ imageIds.length } images in carousel` );
	} );

	test( 'marks an image that no longer exists in the media library', async ( { page } ) => {
		const nonce = await loginAndGetNonce( page );
		const [ doomed ] = await uploadTestImages( page, nonce, 1 );
		const del = await authenticatedRest( page, nonce, {
			route: `/wp/v2/media/${ doomed }`,
			method: 'DELETE',
			body: { force: true },
		} );
		expect( del.status ).toBe( 200 );

		await openNewEditor( page );
		const block = await insertCarousel( page, {
			images: [ imageIds[ 0 ], doomed ].map( ( id ) => ( { id, url: '', alt: '' } ) ),
		} );
		const items = block.locator( '.soli-carousel-editor__item' );
		await expect( items ).toHaveCount( 2 );
		await expect( items.nth( 1 ) ).toHaveClass( /is-missing/ );
		await expect( items.nth( 1 ) ).toContainText( 'Image no longer exists' );
		await expect( items.nth( 0 ) ).not.toHaveClass( /is-missing/ );
		await expect( block ).toContainText( '1 image in carousel (1 missing)' );
	} );

	test( 'removes an image from the grid', async ( { page } ) => {
		await loginAsAdmin( page );
		await openNewEditor( page );
		const block = await insertCarousel( page, {
			images: imageIds.map( ( id ) => ( { id, url: '', alt: '' } ) ),
		} );
		const items = block.locator( '.soli-carousel-editor__item' );
		await expect( items ).toHaveCount( 3 );

		await items.nth( 1 ).hover();
		await block.getByRole( 'button', { name: 'Remove image 2 from carousel' } ).click();
		await expect( items ).toHaveCount( 2 );

		const remaining = await page.evaluate( ( name ) => {
			const blocks = window.wp.data.select( 'core/block-editor' ).getBlocks();
			return blocks.find( ( b ) => b.name === name ).attributes.images.map( ( i ) => i.id );
		}, BLOCK_NAME );
		expect( remaining ).toEqual( [ imageIds[ 0 ], imageIds[ 2 ] ] );
	} );

	test( 'is available on a custom post type', async ( { page } ) => {
		await loginAsAdmin( page );
		await openNewEditor( page, 'soli_e2e_cpt' );
		await expect( page ).toHaveURL( /post_type=soli_e2e_cpt/ );
		const allowed = await page.evaluate( ( name ) => {
			const { getBlockTypes } = window.wp.blocks;
			return getBlockTypes().some( ( b ) => b.name === name );
		}, BLOCK_NAME );
		expect( allowed ).toBe( true );
		const block = await insertCarousel( page );
		await expect( block.getByRole( 'button', { name: 'Select images' } ) ).toBeVisible();
		await expectNoPhpDiagnostics( page );
	} );
} );
