CREATE TABLE `enrollment_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`childFirstName` varchar(100) NOT NULL,
	`childLastName` varchar(100) NOT NULL,
	`dateOfBirth` timestamp,
	`gender` enum('male','female','other','prefer_not_to_say'),
	`parentName` varchar(160),
	`parentPhone` varchar(32),
	`parentEmail` varchar(320),
	`address` varchar(400),
	`incomeLevel` enum('below_100','below_130','below_185','above_185'),
	`householdSize` int,
	`priority` enum('high','medium','low') NOT NULL DEFAULT 'medium',
	`status` enum('pending','reviewing','approved','denied','enrolled') NOT NULL DEFAULT 'pending',
	`notes` text,
	`enrolledChildId` int,
	`appliedDate` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `enrollment_applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `enrollment_applications` ADD CONSTRAINT `enrollment_applications_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;