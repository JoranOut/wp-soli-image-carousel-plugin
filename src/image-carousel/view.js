/**
 * Front-end behaviour for the soli/image-carousel block.
 *
 * Plain DOM, no framework: the markup is rendered by render.php and this
 * script only wires up navigation, progress, thumbnails, fullscreen and the
 * download link. Everything works without it except switching slides.
 */

const SWIPE_THRESHOLD = 40;

function setup( root ) {
	if ( root.dataset.soliCarouselReady ) {
		return;
	}
	root.dataset.soliCarouselReady = '1';

	const slides = Array.from( root.querySelectorAll( '.soli-carousel__slide' ) );
	const dots = Array.from( root.querySelectorAll( '.soli-carousel__dot' ) );
	const thumbs = Array.from( root.querySelectorAll( '.soli-carousel__thumb' ) );
	const counter = root.querySelector( '[data-role="current"]' );
	const download = root.querySelector( '[data-action="download"]' );
	const fullscreenButton = root.querySelector( '[data-action="fullscreen"]' );
	const stage = root.querySelector( '.soli-carousel__stage' );
	const count = slides.length;
	let current = 0;

	const wrap = ( index ) => ( ( index % count ) + count ) % count;

	const show = ( index ) => {
		current = wrap( index );
		slides.forEach( ( slide, i ) => {
			const active = i === current;
			slide.classList.toggle( 'is-active', active );
			slide.setAttribute( 'aria-hidden', active ? 'false' : 'true' );
		} );
		[ ...dots, ...thumbs ].forEach( ( tab ) => {
			const active = Number( tab.dataset.index ) === current;
			tab.classList.toggle( 'is-active', active );
			tab.setAttribute( 'aria-selected', active ? 'true' : 'false' );
			tab.tabIndex = active ? 0 : -1;
		} );
		const activeThumb = thumbs[ current ];
		if ( activeThumb && activeThumb.scrollIntoView ) {
			activeThumb.scrollIntoView( { block: 'nearest', inline: 'center', behavior: 'smooth' } );
		}
		if ( counter ) {
			counter.textContent = String( current + 1 );
		}
		if ( download ) {
			const slide = slides[ current ];
			download.href = slide.dataset.full || download.href;
			download.setAttribute( 'download', slide.dataset.filename || '' );
		}
	};

	root.addEventListener( 'click', ( event ) => {
		const target = event.target.closest( '[data-action]' );
		if ( ! target || ! root.contains( target ) ) {
			return;
		}
		switch ( target.dataset.action ) {
			case 'prev':
				show( current - 1 );
				break;
			case 'next':
				show( current + 1 );
				break;
			case 'goto':
				show( Number( target.dataset.index ) );
				break;
			case 'fullscreen':
				toggleFullscreen();
				break;
			default:
		}
	} );

	root.addEventListener( 'keydown', ( event ) => {
		if ( event.key === 'ArrowLeft' ) {
			event.preventDefault();
			show( current - 1 );
		} else if ( event.key === 'ArrowRight' ) {
			event.preventDefault();
			show( current + 1 );
		} else if ( event.key === 'Escape' && root.classList.contains( 'is-fullscreen' ) && ! document.fullscreenElement ) {
			// Fallback mode (no Fullscreen API, e.g. iOS Safari): Escape exits too.
			setFullscreenState( false );
		}
	} );

	// Touch swipe on the stage.
	let touchStartX = null;
	stage.addEventListener( 'touchstart', ( event ) => {
		touchStartX = event.changedTouches[ 0 ].clientX;
	}, { passive: true } );
	stage.addEventListener( 'touchend', ( event ) => {
		if ( touchStartX === null ) {
			return;
		}
		const delta = event.changedTouches[ 0 ].clientX - touchStartX;
		touchStartX = null;
		if ( Math.abs( delta ) > SWIPE_THRESHOLD ) {
			show( delta < 0 ? current + 1 : current - 1 );
		}
	}, { passive: true } );

	// Fullscreen: use the API where available, otherwise a fixed-position
	// fallback class so the button still works everywhere.
	const setFullscreenState = ( on ) => {
		root.classList.toggle( 'is-fullscreen', on );
		document.documentElement.classList.toggle( 'soli-carousel-fullscreen-open', on );
		if ( fullscreenButton ) {
			fullscreenButton.setAttribute( 'aria-pressed', on ? 'true' : 'false' );
			const label = on ? fullscreenButton.dataset.labelExit : fullscreenButton.dataset.labelEnter;
			fullscreenButton.setAttribute( 'aria-label', label );
			fullscreenButton.title = label;
		}
		if ( on ) {
			root.focus( { preventScroll: true } );
		}
	};

	const toggleFullscreen = () => {
		const isOn = root.classList.contains( 'is-fullscreen' );
		if ( root.requestFullscreen && document.fullscreenEnabled ) {
			if ( isOn && document.fullscreenElement === root ) {
				document.exitFullscreen();
			} else if ( ! isOn ) {
				root.requestFullscreen().catch( () => setFullscreenState( true ) );
			} else {
				setFullscreenState( false );
			}
			return;
		}
		setFullscreenState( ! isOn );
	};

	document.addEventListener( 'fullscreenchange', () => {
		setFullscreenState( document.fullscreenElement === root );
	} );

	root.tabIndex = root.tabIndex >= 0 ? root.tabIndex : -1;
	show( 0 );
}

function init() {
	document.querySelectorAll( '.soli-carousel' ).forEach( setup );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
