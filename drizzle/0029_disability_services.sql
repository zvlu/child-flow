CREATE TABLE `disability_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`childId` int NOT NULL,
	`planType` enum('iep','ifsp','section_504') NOT NULL,
	`status` enum('pending_evaluation','active','expired','exited') NOT NULL DEFAULT 'active',
	`primaryDisability` varchar(200),
	`effectiveDate` timestamp,
	`expirationDate` timestamp,
	`leaAgency` varchar(200),
	`leaContact` varchar(200),
	`parentRightsNotifiedAt` timestamp,
	`parentRightsLanguage` varchar(32),
	`transitionChecklist` json,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `disability_services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `disability_services` ADD CONSTRAINT `disability_services_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `disability_services` ADD CONSTRAINT `disability_services_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;