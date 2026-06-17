CREATE TABLE `custom_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`accessLevel` enum('staff','admin') NOT NULL DEFAULT 'staff',
	`color` varchar(24) NOT NULL DEFAULT 'sage',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custom_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `settings` json;--> statement-breakpoint
ALTER TABLE `custom_roles` ADD CONSTRAINT `custom_roles_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;