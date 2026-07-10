CREATE TABLE `billing_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`familyId` int NOT NULL,
	`childId` int,
	`name` varchar(200) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`frequency` enum('weekly','biweekly','monthly') NOT NULL DEFAULT 'monthly',
	`nextInvoiceDate` date NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billing_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `billing_plans` ADD CONSTRAINT `billing_plans_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_plans` ADD CONSTRAINT `billing_plans_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_plans` ADD CONSTRAINT `billing_plans_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;