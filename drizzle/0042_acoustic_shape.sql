CREATE TABLE `compliance_checklist_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`itemKey` varchar(100) NOT NULL,
	`label` varchar(255) NOT NULL,
	`category` varchar(100),
	`isCompliant` int DEFAULT 0,
	`note` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `compliance_checklist_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `compliance_checklist_items_org_item` UNIQUE(`organizationId`,`itemKey`)
);
--> statement-breakpoint
CREATE TABLE `staff_training_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffId` int NOT NULL,
	`organizationId` int NOT NULL,
	`trainingName` varchar(255) NOT NULL,
	`hours` decimal(5,2) NOT NULL,
	`trainingDate` timestamp NOT NULL,
	`notes` text,
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_training_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `story_post_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`authorName` varchar(255) NOT NULL,
	`familyId` int,
	`staffId` int,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `story_post_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `story_post_likes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`familyId` int,
	`staffId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `story_post_likes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `story_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`classroomId` int,
	`authorStaffId` int,
	`content` text NOT NULL,
	`photoUrl` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `story_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `compliance_checklist_items` ADD CONSTRAINT `compliance_checklist_items_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `compliance_checklist_items` ADD CONSTRAINT `compliance_checklist_items_reviewedBy_staff_id_fk` FOREIGN KEY (`reviewedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_training_logs` ADD CONSTRAINT `staff_training_logs_staffId_staff_id_fk` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_training_logs` ADD CONSTRAINT `staff_training_logs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_training_logs` ADD CONSTRAINT `staff_training_logs_recordedBy_staff_id_fk` FOREIGN KEY (`recordedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_post_comments` ADD CONSTRAINT `story_post_comments_postId_story_posts_id_fk` FOREIGN KEY (`postId`) REFERENCES `story_posts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_post_comments` ADD CONSTRAINT `story_post_comments_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_post_comments` ADD CONSTRAINT `story_post_comments_staffId_staff_id_fk` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_post_likes` ADD CONSTRAINT `story_post_likes_postId_story_posts_id_fk` FOREIGN KEY (`postId`) REFERENCES `story_posts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_post_likes` ADD CONSTRAINT `story_post_likes_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_post_likes` ADD CONSTRAINT `story_post_likes_staffId_staff_id_fk` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_posts` ADD CONSTRAINT `story_posts_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_posts` ADD CONSTRAINT `story_posts_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_posts` ADD CONSTRAINT `story_posts_authorStaffId_staff_id_fk` FOREIGN KEY (`authorStaffId`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;