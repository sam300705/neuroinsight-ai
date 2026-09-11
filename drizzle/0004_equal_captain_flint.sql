CREATE TABLE `scan_artifact_intents` (
	`id` varchar(64) NOT NULL,
	`scanRecordId` int NOT NULL,
	`userId` int NOT NULL,
	`artifactType` enum('report','grad_cam','segmentation_mask','three_dimensional') NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`displacedStorageKey` varchar(512),
	`state` enum('pending','committed','cancelled') NOT NULL,
	`expectedRevision` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`cleanupComplete` int NOT NULL DEFAULT 0,
	`retryCount` int NOT NULL DEFAULT 0,
	CONSTRAINT `scan_artifact_intents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `scan_artifact_intents` ADD CONSTRAINT `scan_artifact_intents_scanRecordId_scan_records_id_fk` FOREIGN KEY (`scanRecordId`) REFERENCES `scan_records`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scan_artifact_intents` ADD CONSTRAINT `scan_artifact_intents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `scan_artifact_intents_scan_idx` ON `scan_artifact_intents` (`scanRecordId`);--> statement-breakpoint
CREATE INDEX `scan_artifact_intents_user_idx` ON `scan_artifact_intents` (`userId`);--> statement-breakpoint
CREATE INDEX `scan_artifact_intents_state_cleanup_idx` ON `scan_artifact_intents` (`state`,`cleanupComplete`);