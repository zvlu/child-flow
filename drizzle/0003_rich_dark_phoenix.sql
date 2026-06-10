CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`actorOpenId` varchar(64),
	`action` varchar(32) NOT NULL,
	`resourceType` varchar(48) NOT NULL,
	`resourceId` varchar(64),
	`ipAddress` varchar(64),
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);