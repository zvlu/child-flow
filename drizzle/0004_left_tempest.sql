CREATE TABLE `family_invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`familyId` int NOT NULL,
	`code` varchar(16) NOT NULL,
	`adultEmail` varchar(320),
	`createdBy` int,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `family_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `family_invitations_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','staff','parent') NOT NULL DEFAULT 'user';--> statement-breakpoint
UPDATE `users` SET `role` = 'staff' WHERE `role` = 'user';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','staff','parent') NOT NULL DEFAULT 'staff';--> statement-breakpoint
ALTER TABLE `users` ADD `familyId` int;--> statement-breakpoint
ALTER TABLE `family_invitations` ADD CONSTRAINT `family_invitations_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_invitations` ADD CONSTRAINT `family_invitations_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;