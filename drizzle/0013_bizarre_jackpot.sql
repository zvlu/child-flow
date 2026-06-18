CREATE TABLE `in_kind_contributions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`type` enum('volunteer','goods','services','facility','other') NOT NULL,
	`contributor` varchar(200) NOT NULL,
	`description` varchar(500),
	`date` timestamp NOT NULL,
	`hours` decimal(7,2),
	`value` decimal(12,2) NOT NULL,
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `in_kind_contributions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `in_kind_contributions` ADD CONSTRAINT `in_kind_contributions_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;