ALTER TABLE `story_posts` ADD `audience` enum('all_families','my_families','staff_only') DEFAULT 'all_families';--> statement-breakpoint
ALTER TABLE `story_posts` ADD `taggedChildIds` json;