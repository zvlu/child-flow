CREATE TABLE `child_flags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`childId` int NOT NULL,
	`type` enum('allergy','dietary','disability','special') NOT NULL,
	`label` varchar(100) NOT NULL,
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `child_flags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `child_flags` ADD CONSTRAINT `child_flags_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;