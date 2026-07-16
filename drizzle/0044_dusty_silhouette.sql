CREATE TABLE `conversation_archives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`userId` int NOT NULL,
	`archivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_archives_id` PRIMARY KEY(`id`),
	CONSTRAINT `conversation_archives_convo_user` UNIQUE(`conversationId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `conversation_archives` ADD CONSTRAINT `conversation_archives_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversation_archives` ADD CONSTRAINT `conversation_archives_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;