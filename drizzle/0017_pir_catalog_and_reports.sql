CREATE TABLE `pir_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(120) NOT NULL,
	`sectionId` varchar(48) NOT NULL,
	`section` varchar(120) NOT NULL,
	`subsectionId` varchar(64),
	`subsection` varchar(200),
	`label` varchar(400) NOT NULL,
	`valueType` enum('integer','percent','boolean','enum','text') NOT NULL DEFAULT 'integer',
	`subject` enum('child','family','staff','program','grant') NOT NULL,
	`options` json,
	`paired` enum('enrollment','eoy'),
	`note` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pir_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pir_questions_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `pir_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`year` varchar(9) NOT NULL,
	`status` enum('draft','submitted','accepted') NOT NULL DEFAULT 'draft',
	`submittedBy` int,
	`submittedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pir_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `pir_reports_org_year` UNIQUE(`organizationId`,`year`)
);
--> statement-breakpoint
ALTER TABLE `pir_data` MODIFY COLUMN `questionId` varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE `pir_data` ADD `reportId` int;--> statement-breakpoint
ALTER TABLE `pir_reports` ADD CONSTRAINT `pir_reports_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pir_reports` ADD CONSTRAINT `pir_reports_submittedBy_staff_id_fk` FOREIGN KEY (`submittedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pir_data` ADD CONSTRAINT `pir_data_reportId_pir_reports_id_fk` FOREIGN KEY (`reportId`) REFERENCES `pir_reports`(`id`) ON DELETE no action ON UPDATE no action;