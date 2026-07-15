ALTER TABLE `child_flags` MODIFY COLUMN `type` enum('allergy','dietary','disability','special','medication') NOT NULL;--> statement-breakpoint
ALTER TABLE `digitalDocuments` MODIFY COLUMN `documentType` enum('enrollment','consent','waiver','health_form','iep','emergency_medical_consent') NOT NULL;--> statement-breakpoint
ALTER TABLE `digitalDocuments` ADD `childId` int;--> statement-breakpoint
ALTER TABLE `family_contact_addresses` ADD `authorizedPickup` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `family_contact_addresses` ADD `authorizedEmergencyMedical` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `health_records` ADD `exemptionType` enum('medical','religious','personal');--> statement-breakpoint
ALTER TABLE `health_records` ADD `exemptionExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `health_records` ADD `exemptionDocumentId` int;--> statement-breakpoint
ALTER TABLE `digitalDocuments` ADD CONSTRAINT `digitalDocuments_childId_children_id_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `health_records` ADD CONSTRAINT `health_records_exemptionDocumentId_documents_id_fk` FOREIGN KEY (`exemptionDocumentId`) REFERENCES `documents`(`id`) ON DELETE no action ON UPDATE no action;