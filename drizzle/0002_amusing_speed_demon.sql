CREATE TABLE `activityLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`childId` int NOT NULL,
	`staffId` int NOT NULL,
	`activityType` enum('meal','nap','diaper','activity','note','photo') NOT NULL,
	`description` text,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activityLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_insights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`childId` int NOT NULL,
	`organizationId` int NOT NULL,
	`insightType` enum('case_summary','compliance_flag','health_alert','behavioral_note','recommendation') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`priority` enum('low','medium','high','critical') DEFAULT 'medium',
	`actionRequired` int DEFAULT 0,
	`dismissedAt` timestamp,
	`generatedAt` timestamp DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_insights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bulk_action_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`classroomId` int NOT NULL,
	`actionType` enum('bulk_attendance','bulk_health_screening','bulk_notes','bulk_enrollment') NOT NULL,
	`description` text,
	`recordCount` int NOT NULL,
	`status` enum('pending','completed','failed') DEFAULT 'pending',
	`performedBy` int NOT NULL,
	`actionDate` timestamp DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bulk_action_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cacfpReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`reportMonth` date NOT NULL,
	`mealsServed` int DEFAULT 0,
	`reimbursementAmount` decimal(10,2),
	`status` enum('draft','submitted','approved') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cacfpReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendar_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`eventType` enum('holiday','school_event','parent_event','staff_training','deadline','other') DEFAULT 'other',
	`startDate` timestamp NOT NULL,
	`endDate` timestamp,
	`location` varchar(255),
	`classroomId` int,
	`allDay` int DEFAULT 1,
	`color` varchar(7) DEFAULT '#3b82f6',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendar_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `certifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffId` int NOT NULL,
	`certificationType` varchar(255) NOT NULL,
	`issueDate` date NOT NULL,
	`expiryDate` date NOT NULL,
	`certificationNumber` varchar(255),
	`documentUrl` varchar(512),
	`status` enum('active','expiring_soon','expired') NOT NULL DEFAULT 'active',
	CONSTRAINT `certifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `child_classroom_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`childId` int NOT NULL,
	`classroomId` int NOT NULL,
	`assignmentDate` timestamp DEFAULT (now()),
	`endDate` timestamp,
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `child_classroom_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classrooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`ageGroup` varchar(50),
	`capacity` int DEFAULT 15,
	`teacherId` int,
	`assistantId` int,
	`color` varchar(7) DEFAULT '#3b82f6',
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `classrooms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `communication_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`recipientId` int NOT NULL,
	`type` enum('sms','email','broadcast') NOT NULL,
	`subject` varchar(255),
	`content` text NOT NULL,
	`status` enum('pending','sent','failed') DEFAULT 'pending',
	`providerMessageId` varchar(255),
	`sentAt` timestamp DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `communication_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`reportName` varchar(255) NOT NULL,
	`reportType` enum('enrollment','attendance','health','compliance','financial','custom') NOT NULL,
	`filters` json,
	`columns` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastRunAt` timestamp,
	CONSTRAINT `customReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digitalDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`familyId` int NOT NULL,
	`documentType` enum('enrollment','consent','waiver','health_form') NOT NULL,
	`documentUrl` varchar(512) NOT NULL,
	`signatureUrl` varchar(512),
	`signedBy` varchar(255),
	`signedAt` timestamp,
	`status` enum('pending','signed','expired') NOT NULL DEFAULT 'pending',
	`expiresAt` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `digitalDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`childId` int NOT NULL,
	`organizationId` int NOT NULL,
	`documentType` enum('birth_certificate','immunization_record','consent_form','medical_record','assessment','other') NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileSize` int,
	`mimeType` varchar(100),
	`expiryDate` timestamp,
	`uploadedBy` int NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `education_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`childId` int NOT NULL,
	`organizationId` int NOT NULL,
	`type` enum('assessment','parent_conference','home_visit','individual_plan') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`assessmentDate` timestamp NOT NULL,
	`score` varchar(50),
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `education_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `family_contact_addresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`familyId` int NOT NULL,
	`contactName` varchar(100) NOT NULL,
	`relationship` varchar(50),
	`phone` varchar(20),
	`email` varchar(320),
	`address` text,
	`city` varchar(100),
	`state` varchar(2),
	`zipCode` varchar(10),
	`isPrimary` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `family_contact_addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `family_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`familyId` int NOT NULL,
	`organizationId` int NOT NULL,
	`type` enum('home_visit','office_visit','phone_call','email','referral','other') NOT NULL,
	`serviceDate` timestamp NOT NULL,
	`description` text NOT NULL,
	`outcome` text,
	`followUpRequired` int DEFAULT 0,
	`followUpDate` timestamp,
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `family_services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `health_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`childId` int NOT NULL,
	`organizationId` int NOT NULL,
	`type` enum('immunization','dental','physical','vision','hearing','lead','hemoglobin','other') NOT NULL,
	`status` enum('up_to_date','due_soon','overdue','exempt','not_required') DEFAULT 'up_to_date',
	`recordDate` timestamp NOT NULL,
	`expiryDate` timestamp,
	`provider` varchar(255),
	`notes` text,
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `health_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`familyId` int NOT NULL,
	`invoiceNumber` varchar(64) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`dueDate` date NOT NULL,
	`status` enum('draft','sent','paid','overdue','cancelled') NOT NULL DEFAULT 'draft',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`paidAt` timestamp,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `mealItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mealPlanId` int NOT NULL,
	`dayOfWeek` enum('monday','tuesday','wednesday','thursday','friday') NOT NULL,
	`mealType` enum('breakfast','snack','lunch','afternoon_snack') NOT NULL,
	`description` text NOT NULL,
	`servings` int,
	`cacfpCompliant` int DEFAULT 1,
	CONSTRAINT `mealItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mealPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`classroomId` int NOT NULL,
	`weekStartDate` date NOT NULL,
	`status` enum('draft','approved','served') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mealPlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parentNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`familyId` int NOT NULL,
	`message` text NOT NULL,
	`type` enum('activity','alert','announcement','photo') NOT NULL,
	`isRead` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `parentNotifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`organizationId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`paymentMethod` enum('credit_card','ach','check','cash') NOT NULL,
	`stripePaymentId` varchar(255),
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`transactionDate` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pir_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`year` varchar(9) NOT NULL,
	`section` varchar(100) NOT NULL,
	`questionId` varchar(50) NOT NULL,
	`value` text NOT NULL,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pir_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reportResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customReportId` int NOT NULL,
	`resultData` json NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`exportFormat` enum('pdf','excel','csv'),
	`fileUrl` varchar(512),
	CONSTRAINT `reportResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_caseloads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffId` int NOT NULL,
	`classroomId` int NOT NULL,
	`role` enum('teacher','assistant','coordinator') DEFAULT 'teacher',
	`isActive` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_caseloads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`childId` int NOT NULL,
	`organizationId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`priority` enum('low','medium','high','critical') DEFAULT 'medium',
	`isPinned` int DEFAULT 0,
	`category` varchar(50),
	`expiryDate` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `timeClock` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffId` int NOT NULL,
	`clockInTime` timestamp NOT NULL,
	`clockOutTime` timestamp,
	`hoursWorked` decimal(5,2),
	`date` date NOT NULL,
	CONSTRAINT `timeClock_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `children` ADD `familyId` int;--> statement-breakpoint
ALTER TABLE `activityLogs` ADD CONSTRAINT `activityLogs_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activityLogs` ADD CONSTRAINT `activityLogs_staffId_staff_id_fk` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_insights` ADD CONSTRAINT `ai_insights_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_insights` ADD CONSTRAINT `ai_insights_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bulk_action_logs` ADD CONSTRAINT `bulk_action_logs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bulk_action_logs` ADD CONSTRAINT `bulk_action_logs_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bulk_action_logs` ADD CONSTRAINT `bulk_action_logs_performedBy_staff_id_fk` FOREIGN KEY (`performedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cacfpReports` ADD CONSTRAINT `cacfpReports_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_createdBy_staff_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `certifications` ADD CONSTRAINT `certifications_staffId_staff_id_fk` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `child_classroom_assignments` ADD CONSTRAINT `child_classroom_assignments_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `child_classroom_assignments` ADD CONSTRAINT `child_classroom_assignments_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classrooms` ADD CONSTRAINT `classrooms_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classrooms` ADD CONSTRAINT `classrooms_teacherId_staff_id_fk` FOREIGN KEY (`teacherId`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classrooms` ADD CONSTRAINT `classrooms_assistantId_staff_id_fk` FOREIGN KEY (`assistantId`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communication_logs` ADD CONSTRAINT `communication_logs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communication_logs` ADD CONSTRAINT `communication_logs_recipientId_families_id_fk` FOREIGN KEY (`recipientId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customReports` ADD CONSTRAINT `customReports_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customReports` ADD CONSTRAINT `customReports_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `digitalDocuments` ADD CONSTRAINT `digitalDocuments_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `digitalDocuments` ADD CONSTRAINT `digitalDocuments_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_uploadedBy_staff_id_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `education_records` ADD CONSTRAINT `education_records_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `education_records` ADD CONSTRAINT `education_records_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `education_records` ADD CONSTRAINT `education_records_recordedBy_staff_id_fk` FOREIGN KEY (`recordedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_contact_addresses` ADD CONSTRAINT `family_contact_addresses_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_services` ADD CONSTRAINT `family_services_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_services` ADD CONSTRAINT `family_services_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `family_services` ADD CONSTRAINT `family_services_recordedBy_staff_id_fk` FOREIGN KEY (`recordedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `health_records` ADD CONSTRAINT `health_records_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `health_records` ADD CONSTRAINT `health_records_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `health_records` ADD CONSTRAINT `health_records_recordedBy_staff_id_fk` FOREIGN KEY (`recordedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mealItems` ADD CONSTRAINT `mealItems_mealPlanId_mealPlans_id_fk` FOREIGN KEY (`mealPlanId`) REFERENCES `mealPlans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mealPlans` ADD CONSTRAINT `mealPlans_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mealPlans` ADD CONSTRAINT `mealPlans_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `parentNotifications` ADD CONSTRAINT `parentNotifications_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_invoiceId_invoices_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pir_data` ADD CONSTRAINT `pir_data_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pir_data` ADD CONSTRAINT `pir_data_updatedBy_staff_id_fk` FOREIGN KEY (`updatedBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reportResults` ADD CONSTRAINT `reportResults_customReportId_customReports_id_fk` FOREIGN KEY (`customReportId`) REFERENCES `customReports`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_caseloads` ADD CONSTRAINT `staff_caseloads_staffId_staff_id_fk` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_caseloads` ADD CONSTRAINT `staff_caseloads_classroomId_classrooms_id_fk` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_notes` ADD CONSTRAINT `student_notes_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_notes` ADD CONSTRAINT `student_notes_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_notes` ADD CONSTRAINT `student_notes_createdBy_staff_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `timeClock` ADD CONSTRAINT `timeClock_staffId_staff_id_fk` FOREIGN KEY (`staffId`) REFERENCES `staff`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `children` ADD CONSTRAINT `children_familyId_families_id_fk` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE no action ON UPDATE no action;