/**
 * Uploads small generated PNGs to the media library through the REST API and
 * returns their attachment ids.
 */
const { PNG } = require( 'pngjs' );

function pngBuffer( width, height, [ r, g, b ] ) {
	const png = new PNG( { width, height } );
	for ( let i = 0; i < width * height; i++ ) {
		png.data[ i * 4 ] = r;
		png.data[ i * 4 + 1 ] = g;
		png.data[ i * 4 + 2 ] = b;
		png.data[ i * 4 + 3 ] = 255;
	}
	return PNG.sync.write( png );
}

const COLOURS = [ [ 200, 40, 40 ], [ 40, 160, 60 ], [ 40, 80, 200 ], [ 220, 180, 20 ] ];

async function uploadTestImages( page, nonce, count ) {
	const ids = [];
	for ( let i = 0; i < count; i++ ) {
		const buffer = pngBuffer( 640, 400, COLOURS[ i % COLOURS.length ] );
		const id = await page.evaluate(
			async ( { bytes, nonce: restNonce, name } ) => {
				const blob = new Blob( [ new Uint8Array( bytes ) ], { type: 'image/png' } );
				const form = new FormData();
				form.append( 'file', blob, name );
				form.append( 'alt_text', name );
				form.append( 'caption', 'Caption for ' + name );
				const res = await fetch( '/?rest_route=' + encodeURIComponent( '/wp/v2/media' ), {
					method: 'POST',
					headers: { 'X-WP-Nonce': restNonce },
					credentials: 'same-origin',
					body: form,
				} );
				const json = await res.json();
				if ( res.status !== 201 ) {
					throw new Error( 'upload failed: ' + res.status + ' ' + JSON.stringify( json ) );
				}
				return json.id;
			},
			{ bytes: Array.from( buffer ), nonce, name: `carousel-e2e-${ Date.now() }-${ i }.png` }
		);
		ids.push( id );
	}
	return ids;
}

module.exports = { uploadTestImages };
