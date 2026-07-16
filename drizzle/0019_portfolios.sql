CREATE TABLE `portfolio_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`childId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`observation` text,
	`domain` enum('social_emotional','language_literacy','cognition','physical','creative_arts','approaches_to_learning'),
	`mediaUrl` text,
	`observedAt` date,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portfolio_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `portfolio_entries` ADD CONSTRAINT `portfolio_entries_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolio_entries` ADD CONSTRAINT `portfolio_entries_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolio_entries` ADD CONSTRAINT `portfolio_entries_createdBy_staff_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;