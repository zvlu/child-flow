CREATE TABLE `lesson_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lessonPlanId` int NOT NULL,
	`dayOfWeek` enum('monday','tuesday','wednesday','thursday','friday') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`domain` enum('social_emotional','language_literacy','cognition','physical','creative_arts','approaches_to_learning'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lesson_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lesson_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`classroomId` int NOT NULL,
	`weekStartDate` date NOT NULL,
	`title` varchar(255),
	`theme` varchar(255),
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lesson_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `lesson_activities` ADD CONSTRAINT `lesson_activities_lessonPlanId_lesson_plans_id_fk` FOREIGN KEY (`lessonPlanId`) REFERENCES `lesson_plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lesson_plans` ADD CONSTRAINT `lesson_plans_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lesson_plans` ADD CONSTRAINT `lesson_plans_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lesson_plans` ADD CONSTRAINT `lesson_plans_createdBy_staff_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;