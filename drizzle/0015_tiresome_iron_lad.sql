CREATE TABLE `program_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationName` varchar(255) NOT NULL,
	`agencyId` varchar(64),
	`contactName` varchar(160) NOT NULL,
	`contactEmail` varchar(320) NOT NULL,
	`phone` varchar(32),
	`message` varchar(1000),
	`status` enum('pending','approved','declined') NOT NULL DEFAULT 'pending',
	`createdOrgId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `program_requests_id` PRIMARY KEY(`id`)
);
