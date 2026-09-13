<?php
/**
 * Front-end markup for the soli/image-carousel block.
 *
 * Only attachment ids are trusted from the saved attributes; every URL, alt
 * text and caption is resolved here so it reflects the current media library.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Inner content (unused, dynamic block).
 * @var WP_Block $block      Block instance.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$soli_carousel_ids = array();
foreach ( (array) ( $attributes['images'] ?? array() ) as $soli_carousel_item ) {
	$soli_carousel_id = absint( is_array( $soli_carousel_item ) ? ( $soli_carousel_item['id'] ?? 0 ) : $soli_carousel_item );
	if ( $soli_carousel_id && 'attachment' === get_post_type( $soli_carousel_id ) && wp_attachment_is_image( $soli_carousel_id ) ) {
		$soli_carousel_ids[] = $soli_carousel_id;
	}
}

if ( empty( $soli_carousel_ids ) ) {
	return;
}

$soli_carousel_show_thumbs   = ! empty( $attributes['showThumbnails'] );
$soli_carousel_show_download = ! empty( $attributes['showDownload'] );
$soli_carousel_show_captions = ! empty( $attributes['showCaptions'] );
$soli_carousel_ratio         = preg_match( '#^\d+/\d+$#', (string) ( $attributes['aspectRatio'] ?? '' ) ) ? $attributes['aspectRatio'] : 'auto';
$soli_carousel_count         = count( $soli_carousel_ids );
$soli_carousel_uid           = wp_unique_id( 'soli-carousel-' );

$soli_carousel_classes = array( 'soli-carousel' );
if ( $soli_carousel_show_thumbs && $soli_carousel_count > 1 ) {
	$soli_carousel_classes[] = 'has-thumbnails';
}

$soli_carousel_wrapper = get_block_wrapper_attributes(
	array(
		'class'            => implode( ' ', $soli_carousel_classes ),
		'id'               => $soli_carousel_uid,
		'data-count'       => $soli_carousel_count,
		'role'             => 'region',
		'aria-roledescription' => 'carousel',
		'aria-label'       => __( 'Image carousel', 'soli-image-carousel' ),
		'style'            => 'auto' === $soli_carousel_ratio ? '' : '--soli-carousel-ratio:' . $soli_carousel_ratio . ';',
	)
);
?>
<div <?php echo $soli_carousel_wrapper; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by get_block_wrapper_attributes(). ?>>
	<div class="soli-carousel__stage">
		<div class="soli-carousel__track" aria-live="polite">
			<?php foreach ( $soli_carousel_ids as $soli_carousel_i => $soli_carousel_id ) : ?>
				<?php
				$soli_carousel_full    = wp_get_attachment_image_url( $soli_carousel_id, 'full' );
				$soli_carousel_caption = wp_get_attachment_caption( $soli_carousel_id );
				?>
				<figure
					class="soli-carousel__slide<?php echo 0 === $soli_carousel_i ? ' is-active' : ''; ?>"
					role="group"
					aria-roledescription="slide"
					aria-label="<?php echo esc_attr( sprintf( /* translators: 1: slide number, 2: total slides */ __( '%1$d of %2$d', 'soli-image-carousel' ), $soli_carousel_i + 1, $soli_carousel_count ) ); ?>"
					data-index="<?php echo esc_attr( $soli_carousel_i ); ?>"
					data-full="<?php echo esc_url( $soli_carousel_full ); ?>"
					data-filename="<?php echo esc_attr( wp_basename( get_attached_file( $soli_carousel_id ) ?: '' ) ); ?>"
					<?php echo 0 === $soli_carousel_i ? '' : 'aria-hidden="true"'; ?>
				>
					<?php
					echo wp_get_attachment_image(
						$soli_carousel_id,
						'large',
						false,
						array(
							'class'   => 'soli-carousel__image',
							'loading' => 0 === $soli_carousel_i ? 'eager' : 'lazy',
							'sizes'   => '(min-width: 1200px) 1100px, 100vw',
						)
					);
					?>
					<?php if ( $soli_carousel_show_captions && $soli_carousel_caption ) : ?>
						<figcaption class="soli-carousel__caption"><?php echo wp_kses_post( $soli_carousel_caption ); ?></figcaption>
					<?php endif; ?>
				</figure>
			<?php endforeach; ?>
		</div>

		<?php if ( $soli_carousel_count > 1 ) : ?>
			<button type="button" class="soli-carousel__nav soli-carousel__nav--prev" data-action="prev" aria-label="<?php esc_attr_e( 'Previous image', 'soli-image-carousel' ); ?>">
				<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
			</button>
			<button type="button" class="soli-carousel__nav soli-carousel__nav--next" data-action="next" aria-label="<?php esc_attr_e( 'Next image', 'soli-image-carousel' ); ?>">
				<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
			</button>
		<?php endif; ?>

		<div class="soli-carousel__toolbar">
			<span class="soli-carousel__counter" aria-hidden="true"><span data-role="current">1</span>/<?php echo esc_html( $soli_carousel_count ); ?></span>
			<?php if ( $soli_carousel_show_download ) : ?>
				<a class="soli-carousel__button soli-carousel__download" data-action="download" href="<?php echo esc_url( wp_get_attachment_image_url( $soli_carousel_ids[0], 'full' ) ); ?>" download aria-label="<?php esc_attr_e( 'Download image', 'soli-image-carousel' ); ?>" title="<?php esc_attr_e( 'Download image', 'soli-image-carousel' ); ?>">
					<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 4v12m0 0l-5-5m5 5l5-5M4 20h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
				</a>
			<?php endif; ?>
			<button type="button" class="soli-carousel__button soli-carousel__fullscreen" data-action="fullscreen" aria-pressed="false" aria-label="<?php esc_attr_e( 'Fullscreen', 'soli-image-carousel' ); ?>" data-label-enter="<?php esc_attr_e( 'Fullscreen', 'soli-image-carousel' ); ?>" data-label-exit="<?php esc_attr_e( 'Exit fullscreen', 'soli-image-carousel' ); ?>" title="<?php esc_attr_e( 'Fullscreen', 'soli-image-carousel' ); ?>">
				<svg class="soli-carousel__icon-enter" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
				<svg class="soli-carousel__icon-exit" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
			</button>
		</div>

		<?php if ( $soli_carousel_count > 1 ) : ?>
			<div class="soli-carousel__progress" role="tablist" aria-label="<?php esc_attr_e( 'Choose image', 'soli-image-carousel' ); ?>">
				<?php foreach ( $soli_carousel_ids as $soli_carousel_i => $soli_carousel_id ) : ?>
					<button type="button" role="tab" class="soli-carousel__dot<?php echo 0 === $soli_carousel_i ? ' is-active' : ''; ?>" data-action="goto" data-index="<?php echo esc_attr( $soli_carousel_i ); ?>" aria-selected="<?php echo 0 === $soli_carousel_i ? 'true' : 'false'; ?>" aria-label="<?php echo esc_attr( sprintf( /* translators: %d: slide number */ __( 'Go to image %d', 'soli-image-carousel' ), $soli_carousel_i + 1 ) ); ?>"></button>
				<?php endforeach; ?>
			</div>
		<?php endif; ?>
	</div>

	<?php if ( $soli_carousel_show_thumbs && $soli_carousel_count > 1 ) : ?>
		<div class="soli-carousel__thumbs" role="tablist" aria-label="<?php esc_attr_e( 'Thumbnails', 'soli-image-carousel' ); ?>">
			<?php foreach ( $soli_carousel_ids as $soli_carousel_i => $soli_carousel_id ) : ?>
				<button type="button" role="tab" class="soli-carousel__thumb<?php echo 0 === $soli_carousel_i ? ' is-active' : ''; ?>" data-action="goto" data-index="<?php echo esc_attr( $soli_carousel_i ); ?>" aria-selected="<?php echo 0 === $soli_carousel_i ? 'true' : 'false'; ?>" aria-label="<?php echo esc_attr( sprintf( /* translators: %d: slide number */ __( 'Go to image %d', 'soli-image-carousel' ), $soli_carousel_i + 1 ) ); ?>">
					<?php echo wp_get_attachment_image( $soli_carousel_id, 'thumbnail', false, array( 'loading' => 'lazy' ) ); ?>
				</button>
			<?php endforeach; ?>
		</div>
	<?php endif; ?>
</div>
