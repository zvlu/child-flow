CREATE TABLE `grant_budget_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`fiscalYear` varchar(9) NOT NULL,
	`category` enum('education','health','disability_services','family_services','program_management','transportation','facilities','tta','other') NOT NULL,
	`budgetedCents` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grant_budget_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grant_expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`fiscalYear` varchar(9) NOT NULL,
	`category` enum('education','health','disability_services','family_services','program_management','transportation','facilities','tta','other') NOT NULL,
	`description` varchar(500) NOT NULL,
	`amountCents` int NOT NULL,
	`expenseDate` timestamp NOT NULL,
	`nonFederalShare` int NOT NULL DEFAULT 0,
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `grant_expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `grant_budget_lines` ADD CONSTRAINT `grant_budget_lines_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grant_expenses` ADD CONSTRAINT `grant_expenses_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `grant_expenses` ADD CONSTRAINT `grant_expenses_recordedBy_staff_id_fk` FOREIGN KEY (`recordedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;