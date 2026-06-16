CREATE TABLE `absence_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`familyId` int NOT NULL,
	`childId` int NOT NULL,
	`absenceDate` timestamp NOT NULL,
	`reason` enum('sick','appointment','family_emergency','transportation','travel','other') NOT NULL,
	`note` text,
	`status` enum('pending','approved','denied') NOT NULL DEFAULT 'pending',
	`reportedBy` int,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `absence_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `family_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`familyId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`progress` int NOT NULL DEFAULT 0,
	`status` enum('active','completed','paused') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `family_goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `absence_reports` ADD CONSTRAINT `absence_reports_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `absence_reports` ADD CONSTRAINT `absence_reports_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `absence_reports` ADD CONSTRAINT `absence_reports_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_goals` ADD CONSTRAINT `family_goals_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;