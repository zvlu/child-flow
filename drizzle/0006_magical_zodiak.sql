ALTER TABLE `chat_messages` MODIFY COLUMN `sentAt` timestamp(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` MODIFY COLUMN `staffLastReadAt` timestamp(3);--> statement-breakpoint
ALTER TABLE `conversations` MODIFY COLUMN `familyLastReadAt` timestamp(3);