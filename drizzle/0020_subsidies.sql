CREATE TABLE `subsidies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`familyId` int NOT NULL,
	`agencyName` varchar(200) NOT NULL,
	`caseNumber` varchar(100),
	`authorizedAmount` decimal(10,2),
	`copayAmount` decimal(10,2),
	`startDate` date,
	`endDate` date,
	`status` enum('active','pending','expired') NOT NULL DEFAULT 'active',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subsidies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `subsidies` ADD CONSTRAINT `subsidies_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subsidies` ADD CONSTRAINT `subsidies_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;