CREATE TABLE `application_verifications` (
	`id` varchar(64) NOT NULL,
	`organizationId` int NOT NULL,
	`childName` varchar(200) NOT NULL,
	`applicationDate` timestamp NOT NULL DEFAULT (now()),
	`verifiedBy` varchar(160) NOT NULL DEFAULT '',
	`verifiedDate` timestamp,
	`primaryAdult` json NOT NULL,
	`secondaryAdult` json,
	`childChecklist` json NOT NULL,
	`status` enum('Pending','In Progress','Complete','Needs Info') NOT NULL DEFAULT 'Pending',
	`notes` text DEFAULT (''),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `application_verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `application_verifications` ADD CONSTRAINT `application_verifications_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;