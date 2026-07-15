CREATE TABLE `eligibility_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`childName` varchar(200) NOT NULL,
	`childDateOfBirth` timestamp NOT NULL,
	`familyId` int,
	`applicationDate` timestamp NOT NULL,
	`householdSize` int NOT NULL,
	`annualIncomeCents` int NOT NULL,
	`incomeSource` varchar(255),
	`categoricalEligibility` varchar(100) NOT NULL,
	`priorityScore` int NOT NULL DEFAULT 0,
	`riskFactors` json,
	`status` varchar(64) NOT NULL,
	`enrolledDate` timestamp,
	`classroom` varchar(200),
	`waitlistPosition` int,
	`notes` text,
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `eligibility_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `family_engagement_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`plannedDate` timestamp NOT NULL,
	`actualDate` timestamp,
	`location` varchar(255),
	`createdBy` int,
	`objectives` json,
	`preEventChecklist` json,
	`dayOfChecklist` json,
	`postEventChecklist` json,
	`expectedAttendance` int DEFAULT 0,
	`actualAttendance` int,
	`notes` text,
	`status` varchar(32) NOT NULL DEFAULT 'Planning',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `family_engagement_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mental_health_consults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`childId` int,
	`consultDate` timestamp NOT NULL,
	`consultantName` varchar(200) NOT NULL,
	`consultType` varchar(64) NOT NULL,
	`summary` text,
	`followUpDate` timestamp,
	`followUpNotes` text,
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mental_health_consults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nutrition_infant_formula_forms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`childId` int NOT NULL,
	`classroom` varchar(200),
	`completedDate` timestamp NOT NULL,
	`parentName` varchar(200),
	`formulaBrand` varchar(200),
	`formulaType` varchar(200),
	`preparationInstructions` text,
	`feedingSchedule` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nutrition_infant_formula_forms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nutrition_medical_statements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`childId` int NOT NULL,
	`classroom` varchar(200),
	`physicianName` varchar(200),
	`physicianPhone` varchar(32),
	`diagnosis` text,
	`foodsToAvoid` json,
	`substitutions` text,
	`signedDate` timestamp NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nutrition_medical_statements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nutrition_preference_forms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`childId` int NOT NULL,
	`classroom` varchar(200),
	`completedDate` timestamp NOT NULL,
	`parentName` varchar(200),
	`preferences` json,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nutrition_preference_forms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `safety_drill_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`drillType` varchar(64) NOT NULL,
	`drillDate` timestamp NOT NULL,
	`conductedBy` int,
	`durationMinutes` int NOT NULL DEFAULT 0,
	`participantCount` int NOT NULL DEFAULT 0,
	`notes` text,
	`issuesFound` text,
	`resolvedDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `safety_drill_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `health_records` MODIFY COLUMN `type` enum('immunization','dental','physical','vision','hearing','lead','hemoglobin','developmental','other') NOT NULL;--> statement-breakpoint
ALTER TABLE `suspension_expulsion_logs` ADD `incidentTypeDetail` varchar(64);--> statement-breakpoint
ALTER TABLE `suspension_expulsion_logs` ADD `mentalHealthConsultDate` timestamp;--> statement-breakpoint
ALTER TABLE `suspension_expulsion_logs` ADD `familyMeetingDate` timestamp;--> statement-breakpoint
ALTER TABLE `suspension_expulsion_logs` ADD `behaviourSupportPlanDate` timestamp;--> statement-breakpoint
ALTER TABLE `suspension_expulsion_logs` ADD `stateAgencyNotified` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `suspension_expulsion_logs` ADD `stateNotificationDate` timestamp;--> statement-breakpoint
ALTER TABLE `eligibility_records` ADD CONSTRAINT `eligibility_records_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `eligibility_records` ADD CONSTRAINT `eligibility_records_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `eligibility_records` ADD CONSTRAINT `eligibility_records_recordedBy_staff_id_fk` FOREIGN KEY (`recordedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_engagement_events` ADD CONSTRAINT `family_engagement_events_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_engagement_events` ADD CONSTRAINT `family_engagement_events_createdBy_staff_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mental_health_consults` ADD CONSTRAINT `mental_health_consults_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mental_health_consults` ADD CONSTRAINT `mental_health_consults_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mental_health_consults` ADD CONSTRAINT `mental_health_consults_recordedBy_staff_id_fk` FOREIGN KEY (`recordedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `nutrition_infant_formula_forms` ADD CONSTRAINT `nutrition_infant_formula_forms_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `nutrition_infant_formula_forms` ADD CONSTRAINT `nutrition_infant_formula_forms_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `nutrition_medical_statements` ADD CONSTRAINT `nutrition_medical_statements_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `nutrition_medical_statements` ADD CONSTRAINT `nutrition_medical_statements_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `nutrition_preference_forms` ADD CONSTRAINT `nutrition_preference_forms_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `nutrition_preference_forms` ADD CONSTRAINT `nutrition_preference_forms_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `safety_drill_logs` ADD CONSTRAINT `safety_drill_logs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `safety_drill_logs` ADD CONSTRAINT `safety_drill_logs_conductedBy_staff_id_fk` FOREIGN KEY (`conductedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;