CREATE TABLE `approval_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`type` enum('custom_role','staff_hire','staff_role_change') NOT NULL,
	`status` enum('pending','approved','denied') NOT NULL DEFAULT 'pending',
	`payload` text NOT NULL,
	`targetStaffId` int,
	`requestedByUserId` int NOT NULL,
	`requestedByStaffId` int,
	`requestReason` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`decisionNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `staff` MODIFY COLUMN `role` enum('admin','director','fiscal_officer','education_coordinator','coach','health_coordinator','nurse','nutritionist','mental_health_consultant','disabilities_coordinator','family_services_manager','family_advocate','home_visitor','ersea_coordinator','teacher','assistant','cook','bus_driver','coordinator','assistant_director','center_director','data_manager','lead_teacher','office_manager','enrollment_specialist','custodian','bus_monitor','kitchen_assistant','substitute') DEFAULT 'teacher';--> statement-breakpoint
ALTER TABLE `staff` ADD `customRoleId` int;--> statement-breakpoint
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_targetStaffId_staff_id_fk` FOREIGN KEY (`targetStaffId`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_requestedByUserId_users_id_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_requestedByStaffId_staff_id_fk` FOREIGN KEY (`requestedByStaffId`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_requests` ADD CONSTRAINT `approval_requests_reviewedBy_users_id_fk` FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff` ADD CONSTRAINT `staff_customRoleId_custom_roles_id_fk` FOREIGN KEY (`customRoleId`) REFERENCES `custom_roles`(`id`) ON DELETE no action ON UPDATE no action;