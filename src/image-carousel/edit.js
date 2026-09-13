import { __, sprintf } from '@wordpress/i18n';
import {
	useBlockProps,
	MediaUpload,
	MediaUploadCheck,
	BlockControls,
	InspectorControls,
} from '@wordpress/block-editor';
import {
	Button,
	Placeholder,
	PanelBody,
	ToggleControl,
	SelectControl,
	ToolbarGroup,
	ToolbarButton,
} from '@wordpress/components';
import { closeSmall, chevronLeft, chevronRight } from '@wordpress/icons';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import './editor.scss';

const ALLOWED_MEDIA_TYPES = [ 'image' ];

/**
 * Reduce a media-library selection to what the block stores. URLs are only
 * kept for the editor preview; render.php resolves everything from the id.
 */
function toImage( media ) {
	const sizes = media.sizes || {};
	return {
		id: media.id,
		url: ( sizes.medium || sizes.large || sizes.full || {} ).url || media.url,
		alt: media.alt || '',
	};
}

export default function Edit( { attributes, setAttributes } ) {
	const { images, showThumbnails, showDownload, showCaptions, aspectRatio } =
		attributes;
	const blockProps = useBlockProps( { className: 'soli-carousel-editor' } );
	const ids = images.map( ( img ) => img.id );

	// Preview URLs are stored on selection, but content created outside the
	// editor (REST, migrations) may carry ids only. Resolve those from the
	// media library so the grid never shows an empty tile.
	const mediaById = useSelect(
		( select ) => {
			if ( ! ids.length ) {
				return {};
			}
			const records = select( coreStore ).getEntityRecords( 'postType', 'attachment', {
				include: ids,
				per_page: ids.length,
				context: 'view',
			} );
			return Object.fromEntries( ( records || [] ).map( ( r ) => [ r.id, r ] ) );
		},
		[ ids.join( ',' ) ]
	);
	const previewUrl = ( image ) => {
		const record = mediaById[ image.id ];
		const sizes = record?.media_details?.sizes || {};
		return (
			( sizes.medium || sizes.large || sizes.thumbnail )?.source_url ||
			record?.source_url ||
			image.url
		);
	};

	const onSelect = ( selection ) => {
		setAttributes( { images: selection.map( toImage ) } );
	};

	const removeAt = ( index ) => {
		setAttributes( { images: images.filter( ( _, i ) => i !== index ) } );
	};

	const move = ( from, to ) => {
		if ( to < 0 || to >= images.length ) {
			return;
		}
		const next = [ ...images ];
		const [ item ] = next.splice( from, 1 );
		next.splice( to, 0, item );
		setAttributes( { images: next } );
	};

	const selectButton = ( open, label ) => (
		<Button variant="primary" onClick={ open }>
			{ label }
		</Button>
	);

	return (
		<>
			<BlockControls>
				<ToolbarGroup>
					<MediaUploadCheck>
						<MediaUpload
							onSelect={ onSelect }
							allowedTypes={ ALLOWED_MEDIA_TYPES }
							multiple="add"
							gallery
							addToGallery
							value={ ids }
							render={ ( { open } ) => (
								<ToolbarButton onClick={ open }>
									{ __( 'Select images', 'soli-image-carousel' ) }
								</ToolbarButton>
							) }
						/>
					</MediaUploadCheck>
				</ToolbarGroup>
			</BlockControls>

			<InspectorControls>
				<PanelBody title={ __( 'Carousel settings', 'soli-image-carousel' ) }>
					<SelectControl
						label={ __( 'Aspect ratio', 'soli-image-carousel' ) }
						value={ aspectRatio }
						options={ [
							{ label: '16:9', value: '16/9' },
							{ label: '4:3', value: '4/3' },
							{ label: '3:2', value: '3/2' },
							{ label: '1:1', value: '1/1' },
							{ label: __( 'Auto (image height)', 'soli-image-carousel' ), value: 'auto' },
						] }
						onChange={ ( value ) => setAttributes( { aspectRatio: value } ) }
						__nextHasNoMarginBottom
						__next40pxDefaultSize
					/>
					<ToggleControl
						label={ __( 'Show thumbnails', 'soli-image-carousel' ) }
						checked={ showThumbnails }
						onChange={ ( value ) => setAttributes( { showThumbnails: value } ) }
						__nextHasNoMarginBottom
					/>
					<ToggleControl
						label={ __( 'Show captions', 'soli-image-carousel' ) }
						checked={ showCaptions }
						onChange={ ( value ) => setAttributes( { showCaptions: value } ) }
						__nextHasNoMarginBottom
					/>
					<ToggleControl
						label={ __( 'Show download button', 'soli-image-carousel' ) }
						checked={ showDownload }
						onChange={ ( value ) => setAttributes( { showDownload: value } ) }
						__nextHasNoMarginBottom
					/>
				</PanelBody>
			</InspectorControls>

			<div { ...blockProps }>
				{ images.length === 0 ? (
					<Placeholder
						icon="images-alt2"
						label={ __( 'Soli Image Carousel', 'soli-image-carousel' ) }
						instructions={ __(
							'Select one or more images from the media library.',
							'soli-image-carousel'
						) }
					>
						<MediaUploadCheck>
							<MediaUpload
								onSelect={ onSelect }
								allowedTypes={ ALLOWED_MEDIA_TYPES }
								multiple
								gallery
								value={ ids }
								render={ ( { open } ) =>
									selectButton( open, __( 'Select images', 'soli-image-carousel' ) )
								}
							/>
						</MediaUploadCheck>
					</Placeholder>
				) : (
					<>
						<ul className="soli-carousel-editor__grid">
							{ images.map( ( image, index ) => (
								<li key={ image.id } className="soli-carousel-editor__item">
									<img src={ previewUrl( image ) } alt={ image.alt } />
									<span className="soli-carousel-editor__index">
										{ index + 1 }
									</span>
									<div className="soli-carousel-editor__actions">
										<Button
											icon={ chevronLeft }
											size="small"
											disabled={ index === 0 }
											label={ __( 'Move left', 'soli-image-carousel' ) }
											onClick={ () => move( index, index - 1 ) }
										/>
										<Button
											icon={ chevronRight }
											size="small"
											disabled={ index === images.length - 1 }
											label={ __( 'Move right', 'soli-image-carousel' ) }
											onClick={ () => move( index, index + 1 ) }
										/>
									</div>
									<Button
										className="soli-carousel-editor__remove"
										icon={ closeSmall }
										size="small"
										isDestructive
										label={ sprintf(
											/* translators: %d: position of the image in the carousel */
											__( 'Remove image %d from carousel', 'soli-image-carousel' ),
											index + 1
										) }
										onClick={ () => removeAt( index ) }
									/>
								</li>
							) ) }
						</ul>
						<div className="soli-carousel-editor__footer">
							<span>
								{ sprintf(
									/* translators: %d: number of images */
									__( '%d images in carousel', 'soli-image-carousel' ),
									images.length
								) }
							</span>
							<MediaUploadCheck>
								<MediaUpload
									onSelect={ onSelect }
									allowedTypes={ ALLOWED_MEDIA_TYPES }
									multiple="add"
									gallery
									addToGallery
									value={ ids }
									render={ ( { open } ) => (
										<Button variant="secondary" onClick={ open }>
											{ __( 'Select images', 'soli-image-carousel' ) }
										</Button>
									) }
								/>
							</MediaUploadCheck>
						</div>
					</>
				) }
			</div>
		</>
	);
}
