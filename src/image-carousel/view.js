/**
 * Front-end behaviour for the soli/image-carousel block.
 *
 * Plain DOM, no framework: the markup is rendered by render.php and this
 * script only wires up navigation, progress, thumbnails, fullscreen and the
 * download link. Everything works without it except switching slides.
 */

const SWIPE_THRESHOLD = 40;
const HTML_OPEN_CLASS = 'soli-carousel-fullscreen-open';

/**
 * Only one carousel can be fullscreen at a time, so the state that lives on
 * <html> (scroll lock) is owned here rather than by each instance.
 */
let fullscreenRoot = null;

function setup( root ) {
	if ( root.dataset.soliCarouselReady ) {
		return;
	}
	root.dataset.soliCarouselReady = '1';

	const slides = Array.from( root.querySelectorAll( '.soli-carousel__slide' ) );
	const dots = Array.from( root.querySelectorAll( '.soli-carousel__dot' ) );
	const thumbs = Array.from( root.querySelectorAll( '.soli-carousel__thumb' ) );
	const tabs = [ ...dots, ...thumbs ];
	const counter = root.querySelector( '[data-role="current"]' );
	const download = root.querySelector( '[data-action="download"]' );
	const fullscreenButton = root.querySelector( '[data-action="fullscreen"]' );
	const stage = root.querySelector( '.soli-carousel__stage' );
	const count = slides.length;
	let current = 0;

	// Fallback fullscreen moves the element to <body> so a transformed or
	// contained ancestor cannot clip it; remember where to put it back.
	let placeholder = null;

	const wrap = ( index ) => ( ( index % count ) + count ) % count;

	const show = ( index ) => {
		const focusedTab = tabs.find( ( tab ) => tab === document.activeElement );
		current = wrap( index );
		slides.forEach( ( slide, i ) => {
			const active = i === current;
			slide.classList.toggle( 'is-active', active );
			slide.setAttribute( 'aria-hidden', active ? 'false' : 'true' );
		} );
		tabs.forEach( ( tab ) => {
			const active = Number( tab.dataset.index ) === current;
			tab.classList.toggle( 'is-active', active );
			if ( active ) {
				tab.setAttribute( 'aria-current', 'true' );
			} else {
				tab.removeAttribute( 'aria-current' );
			}
			tab.tabIndex = active ? 0 : -1;
		} );
		// Roving tabindex: keep focus on a focusable tab in the same list.
		if ( focusedTab ) {
			const list = dots.includes( focusedTab ) ? dots : thumbs;
			const next = list[ current ];
			if ( next ) {
				next.focus( { preventScroll: true } );
			}
		}
		const activeThumb = thumbs[ current ];
		if ( activeThumb && activeThumb.scrollIntoView ) {
			activeThumb.scrollIntoView( { block: 'nearest', inline: 'center', behavior: 'smooth' } );
		}
		if ( counter ) {
			counter.textContent = String( current + 1 );
		}
		if ( download ) {
			const slide = slides[ current ];
			const full = slide.dataset.full;
			// No resolvable full-size file: hide the link rather than let it
			// keep pointing at the previous slide's file.
			download.hidden = ! full;
			if ( full ) {
				download.href = full;
				download.setAttribute( 'download', slide.dataset.filename || '' );
			}
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

	// Touch swipe on the stage. Horizontal intent only, so a diagonal page
	// scroll does not flip slides.
	let touchStart = null;
	stage.addEventListener( 'touchstart', ( event ) => {
		const t = event.changedTouches[ 0 ];
		touchStart = { x: t.clientX, y: t.clientY };
	}, { passive: true } );
	stage.addEventListener( 'touchend', ( event ) => {
		if ( ! touchStart ) {
			return;
		}
		const t = event.changedTouches[ 0 ];
		const dx = t.clientX - touchStart.x;
		const dy = t.clientY - touchStart.y;
		touchStart = null;
		if ( Math.abs( dx ) > SWIPE_THRESHOLD && Math.abs( dx ) > Math.abs( dy ) ) {
			show( dx < 0 ? current + 1 : current - 1 );
		}
	}, { passive: true } );

	const setFullscreenState = ( on ) => {
		const wasOn = root.classList.contains( 'is-fullscreen' );
		if ( on === wasOn ) {
			return;
		}
		root.classList.toggle( 'is-fullscreen', on );
		if ( on ) {
			fullscreenRoot = root;
			document.documentElement.classList.add( HTML_OPEN_CLASS );
			// Fallback only: reparent to <body> so `position: fixed` is not
			// trapped by an ancestor with transform/filter/contain.
			if ( document.fullscreenElement !== root ) {
				placeholder = document.createComment( 'soli-carousel' );
				root.parentNode.insertBefore( placeholder, root );
				document.body.appendChild( root );
			}
		} else {
			if ( fullscreenRoot === root ) {
				fullscreenRoot = null;
				document.documentElement.classList.remove( HTML_OPEN_CLASS );
			}
			if ( placeholder && placeholder.parentNode ) {
				placeholder.parentNode.replaceChild( root, placeholder );
			}
			placeholder = null;
		}
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

	// Only react to transitions that involve this instance; another carousel
	// entering or leaving fullscreen is not our business.
	document.addEventListener( 'fullscreenchange', () => {
		if ( document.fullscreenElement === root ) {
			setFullscreenState( true );
		} else if ( ! document.fullscreenElement && root.classList.contains( 'is-fullscreen' ) && ! placeholder ) {
			setFullscreenState( false );
		}
	} );

	root.tabIndex = root.tabIndex >= 0 ? root.tabIndex : -1;
	show( 0 );
}

function init( scope = document ) {
	scope.querySelectorAll( '.soli-carousel' ).forEach( setup );
}

// Carousels that arrive after load (AJAX, "load more", region swaps) are
// wired up as they are inserted. setup() is idempotent via the ready flag.
const observer = new MutationObserver( ( mutations ) => {
	for ( const mutation of mutations ) {
		for ( const node of mutation.addedNodes ) {
			if ( node.nodeType !== Node.ELEMENT_NODE ) {
				continue;
			}
			if ( node.classList.contains( 'soli-carousel' ) ) {
				setup( node );
			} else {
				init( node );
			}
		}
	}
} );

function start() {
	init();
	observer.observe( document.body, { childList: true, subtree: true } );
}

// Themes that swap content without touching the DOM tree observed above can
// call this explicitly.
window.soliCarouselInit = init;

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', start );
} else {
	start();
}
