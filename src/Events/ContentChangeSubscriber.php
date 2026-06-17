<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Events;

use FastCgiCacheForPloi\Cache\FlushReason;
use FastCgiCacheForPloi\Cache\FlushScheduler;
use FastCgiCacheForPloi\Settings\PloiSettings;
use WPForge\Hooks\Action;
use WP_Post;

/**
 * Listens to the content-change hooks (declared as the #[Action] attributes
 * below) and schedules a (debounced) flush.
 *
 * Every handler funnels through trigger(), whose FIRST check is the per-event
 * toggle — so turning a toggle off stops a flush from ALL of that event's
 * underlying hooks. No hook bypasses the gate. When the target isn't ready
 * (no token/server/site), trigger() returns silently: a no-op, never an error.
 */
final class ContentChangeSubscriber
{
    public function __construct(
        private readonly PloiSettings $settings,
        private readonly FlushScheduler $scheduler,
    ) {
    }

    // --- post_save toggle --------------------------------------------------

    #[Action('save_post', priority: 10, acceptedArgs: 3)]
    public function onSavePost(int $postId, WP_Post $post, bool $update): void
    {
        if (wp_is_post_revision($postId) || (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE)) {
            return;
        }

        if ($post->post_status !== 'publish' || ! is_post_type_viewable($post->post_type)) {
            return;
        }

        $this->trigger(FlushReason::PostSave);
    }

    #[Action('transition_post_status', priority: 10, acceptedArgs: 3)]
    public function onTransitionPostStatus(string $newStatus, string $oldStatus, WP_Post $post): void
    {
        if ($newStatus === $oldStatus) {
            return;
        }

        // Only transitions that affect public output (entering or leaving publish).
        if ($newStatus !== 'publish' && $oldStatus !== 'publish') {
            return;
        }

        if (! is_post_type_viewable($post->post_type)) {
            return;
        }

        $this->trigger(FlushReason::PostSave);
    }

    // --- post_delete toggle ------------------------------------------------

    #[Action('deleted_post', priority: 10, acceptedArgs: 2)]
    public function onDeletedPost(int $postId, WP_Post $post): void
    {
        if (! is_post_type_viewable($post->post_type)) {
            return;
        }

        $this->trigger(FlushReason::PostDelete);
    }

    // --- comment toggle ----------------------------------------------------

    #[Action('comment_post', priority: 10, acceptedArgs: 2)]
    public function onNewComment(int $commentId, int|string $approved): void
    {
        // Only a published (approved) comment changes the public page.
        if ($approved !== 1 && $approved !== '1' && $approved !== 'approve') {
            return;
        }

        $this->trigger(FlushReason::Comment);
    }

    #[Action('transition_comment_status', priority: 10, acceptedArgs: 3)]
    public function onCommentStatusChange(string $newStatus, string $oldStatus, object $comment): void
    {
        $this->trigger(FlushReason::Comment);
    }

    #[Action('edit_comment', priority: 10, acceptedArgs: 1)]
    public function onEditComment(int $commentId): void
    {
        $this->trigger(FlushReason::Comment);
    }

    // --- theme / customizer / menu toggles ---------------------------------

    #[Action('switch_theme', priority: 10, acceptedArgs: 0)]
    public function onSwitchTheme(): void
    {
        $this->trigger(FlushReason::Theme);
    }

    #[Action('customize_save_after', priority: 10, acceptedArgs: 0)]
    public function onCustomizerSave(): void
    {
        $this->trigger(FlushReason::Customizer);
    }

    #[Action('wp_update_nav_menu', priority: 10, acceptedArgs: 0)]
    public function onNavMenuUpdate(): void
    {
        $this->trigger(FlushReason::Menu);
    }

    // --- gate --------------------------------------------------------------

    private function trigger(FlushReason $reason): void
    {
        if (! $this->settings->isEventEnabled($reason->value)) {
            return;
        }

        if (! $this->settings->isReadyForAutoFlush()) {
            return;
        }

        $this->scheduler->schedule($reason);
    }
}
