CREATE TABLE `family_partnership_agreements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`familyId` int NOT NULL,
	`organizationId` int NOT NULL,
	`status` enum('draft','active','review_due','completed','expired') NOT NULL DEFAULT 'draft',
	`strengths` json,
	`needsAssessment` text,
	`targetVisits` int NOT NULL DEFAULT 2,
	`parentSigned` int NOT NULL DEFAULT 0,
	`parentSignedAt` timestamp,
	`staffSigned` int NOT NULL DEFAULT 0,
	`staffSignedAt` timestamp,
	`reviewDate` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `family_partnership_agreements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `family_partnership_agreements` ADD CONSTRAINT `family_partnership_agreements_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_partnership_agreements` ADD CONSTRAINT `family_partnership_agreements_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_partnership_agreements` ADD CONSTRAINT `family_partnership_agreements_createdBy_staff_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;