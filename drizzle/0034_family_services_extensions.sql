CREATE TABLE `attendance_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`childId` int NOT NULL,
	`familyAdvocate` int,
	`createdDate` timestamp NOT NULL DEFAULT (now()),
	`reviewDate` timestamp,
	`barriers` json,
	`strategies` json,
	`status` enum('active','resolved','closed') NOT NULL DEFAULT 'active',
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cfcr_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`childId` int NOT NULL,
	`meetingDate` timestamp NOT NULL,
	`participants` json,
	`attendanceNotes` text,
	`healthNotes` text,
	`behaviorNotes` text,
	`developmentalNotes` text,
	`familyGoalNotes` text,
	`actionItems` json,
	`conductedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cfcr_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `family_case_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`familyId` int NOT NULL,
	`authorId` int,
	`type` enum('home_visit','phone_call','office_visit','incident','general') NOT NULL,
	`confidentiality` enum('standard','sensitive') NOT NULL DEFAULT 'standard',
	`body` text NOT NULL,
	`followUpRequired` int NOT NULL DEFAULT 0,
	`followUpDue` timestamp,
	`followUpCompleted` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `family_case_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `family_home_visits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`familyId` int NOT NULL,
	`visitDate` timestamp NOT NULL,
	`visitType` enum('home_visit','office_visit','phone_call','group_social','community_event') NOT NULL,
	`durationMinutes` int NOT NULL DEFAULT 0,
	`conductedBy` int,
	`topicsCovered` json,
	`notes` text,
	`goalsMentioned` json,
	`locationVerified` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `family_home_visits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `family_needs_assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`familyId` int NOT NULL,
	`conductedBy` int,
	`conductedDate` timestamp NOT NULL DEFAULT (now()),
	`reviewDate` timestamp,
	`ratings` json NOT NULL,
	`notes` text,
	`isComplete` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `family_needs_assessments_id` PRIMARY KEY(`id`),
	CONSTRAINT `family_needs_assessments_familyId_unique` UNIQUE(`familyId`)
);
--> statement-breakpoint
CREATE TABLE `family_referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`familyId` int NOT NULL,
	`agencyName` varchar(255) NOT NULL,
	`serviceType` enum('housing','food_assistance','mental_health','substance_use','domestic_violence','legal_aid','employment','adult_education','childcare','medical_care','dental_care','vision_care','transportation','utility_assistance','financial_counseling','other') NOT NULL,
	`referredBy` int,
	`referralDate` timestamp NOT NULL,
	`followUpDate` timestamp,
	`status` enum('pending','contacted','enrolled','declined','unavailable','completed') NOT NULL DEFAULT 'pending',
	`notes` text,
	`outcomeNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `family_referrals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
-- Remap existing family_goals.status values BEFORE narrowing the enum, so no
-- row is left holding a value the new enum doesn't allow.
UPDATE `family_goals` SET `status` = 'in_progress' WHERE `status` = 'active';--> statement-breakpoint
UPDATE `family_goals` SET `status` = 'on_hold' WHERE `status` = 'paused';--> statement-breakpoint
ALTER TABLE `family_goals` MODIFY COLUMN `status` enum('not_started','in_progress','completed','on_hold') NOT NULL DEFAULT 'not_started';--> statement-breakpoint
ALTER TABLE `family_services` MODIFY COLUMN `type` enum('home_visit','office_visit','phone_call','email','referral','coordinated_services','monthly_contact','other','in_person','text','zoom','voicemail') NOT NULL;--> statement-breakpoint
ALTER TABLE `family_goals` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `family_goals` ADD `description` text;--> statement-breakpoint
ALTER TABLE `family_goals` ADD `category` varchar(50);--> statement-breakpoint
ALTER TABLE `family_goals` ADD `targetDate` timestamp;--> statement-breakpoint
ALTER TABLE `family_goals` ADD `completedDate` timestamp;--> statement-breakpoint
ALTER TABLE `family_goals` ADD `steps` json;--> statement-breakpoint
-- Backfill organizationId for pre-existing goals via their family's org.
UPDATE `family_goals` fg
  INNER JOIN `families` f ON f.`id` = fg.`familyId`
  SET fg.`organizationId` = f.`organizationId`
  WHERE fg.`organizationId` IS NULL;--> statement-breakpoint
ALTER TABLE `attendance_plans` ADD CONSTRAINT `attendance_plans_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_plans` ADD CONSTRAINT `attendance_plans_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_plans` ADD CONSTRAINT `attendance_plans_familyAdvocate_staff_id_fk` FOREIGN KEY (`familyAdvocate`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cfcr_records` ADD CONSTRAINT `cfcr_records_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cfcr_records` ADD CONSTRAINT `cfcr_records_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cfcr_records` ADD CONSTRAINT `cfcr_records_conductedBy_staff_id_fk` FOREIGN KEY (`conductedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_case_notes` ADD CONSTRAINT `family_case_notes_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_case_notes` ADD CONSTRAINT `family_case_notes_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_case_notes` ADD CONSTRAINT `family_case_notes_authorId_staff_id_fk` FOREIGN KEY (`authorId`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_home_visits` ADD CONSTRAINT `family_home_visits_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_home_visits` ADD CONSTRAINT `family_home_visits_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_home_visits` ADD CONSTRAINT `family_home_visits_conductedBy_staff_id_fk` FOREIGN KEY (`conductedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_needs_assessments` ADD CONSTRAINT `family_needs_assessments_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_needs_assessments` ADD CONSTRAINT `family_needs_assessments_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_needs_assessments` ADD CONSTRAINT `family_needs_assessments_conductedBy_staff_id_fk` FOREIGN KEY (`conductedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_referrals` ADD CONSTRAINT `family_referrals_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_referrals` ADD CONSTRAINT `family_referrals_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_referrals` ADD CONSTRAINT `family_referrals_referredBy_staff_id_fk` FOREIGN KEY (`referredBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_goals` ADD CONSTRAINT `family_goals_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;