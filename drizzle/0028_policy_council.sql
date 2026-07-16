CREATE TABLE `policy_council_meetings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`meetingDate` timestamp NOT NULL,
	`title` varchar(255) NOT NULL,
	`minutes` text,
	`attendeeCount` int NOT NULL DEFAULT 0,
	`quorumMet` int NOT NULL DEFAULT 0,
	`actionItems` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `policy_council_meetings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `policy_council_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`memberType` enum('parent','community_rep') NOT NULL,
	`councilRole` enum('chair','vice_chair','secretary','treasurer','member') NOT NULL DEFAULT 'member',
	`familyId` int,
	`termStart` timestamp,
	`termEnd` timestamp,
	`status` enum('active','ended') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `policy_council_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `policy_council_meetings` ADD CONSTRAINT `policy_council_meetings_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `policy_council_members` ADD CONSTRAINT `policy_council_members_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `policy_council_members` ADD CONSTRAINT `policy_council_members_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;