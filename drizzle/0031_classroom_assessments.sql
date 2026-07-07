CREATE TABLE `classroom_assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`classroomId` int NOT NULL,
	`tool` enum('class','ecers') NOT NULL,
	`assessmentDate` timestamp NOT NULL,
	`observer` varchar(200),
	`scores` json NOT NULL,
	`coachingNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `classroom_assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `classroom_assessments` ADD CONSTRAINT `classroom_assessments_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classroom_assessments` ADD CONSTRAINT `classroom_assessments_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE no action ON UPDATE no action;