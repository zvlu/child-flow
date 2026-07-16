CREATE TABLE `suspension_expulsion_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`childId` int NOT NULL,
	`incidentDate` timestamp NOT NULL,
	`type` enum('temporary_suspension','expulsion_prevented','transition_out') NOT NULL,
	`description` text NOT NULL,
	`stepsTaken` json,
	`outcome` text,
	`status` enum('open','resolved') NOT NULL DEFAULT 'open',
	`resolvedAt` timestamp,
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suspension_expulsion_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `suspension_expulsion_logs` ADD CONSTRAINT `suspension_expulsion_logs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `suspension_expulsion_logs` ADD CONSTRAINT `suspension_expulsion_logs_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `suspension_expulsion_logs` ADD CONSTRAINT `suspension_expulsion_logs_recordedBy_staff_id_fk` FOREIGN KEY (`recordedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;