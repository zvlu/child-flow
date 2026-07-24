ALTER TABLE `nutrition_infant_formula_forms` DROP FOREIGN KEY `nutrition_infant_formula_forms_organizationId_organizations_id_fk`;
--> statement-breakpoint
ALTER TABLE `nutrition_infant_formula_forms` DROP FOREIGN KEY `nutrition_infant_formula_forms_childId_children_id_fk`;
--> statement-breakpoint
ALTER TABLE `nutrition_infant_formula_forms` ADD CONSTRAINT `nif_forms_org_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `nutrition_infant_formula_forms` ADD CONSTRAINT `nif_forms_child_fk` FOREIGN KEY (`childId`) REFERENCES `children`(`id`) ON DELETE no action ON UPDATE no action;