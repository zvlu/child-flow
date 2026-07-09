ALTER TABLE `organizations` ADD `enabledModules` json;
--> statement-breakpoint
-- Existing orgs predate modularization and are all Head Start programs: backfill the module on.
UPDATE `organizations` SET `enabledModules` = JSON_ARRAY('head_start') WHERE `enabledModules` IS NULL;
