ALTER TABLE `scan_artifact_intents` DROP FOREIGN KEY `scan_artifact_intents_userId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `scan_artifact_intents` DROP FOREIGN KEY `scan_artifact_intents_scanRecordId_scan_records_id_fk`;
--> statement-breakpoint
ALTER TABLE `scan_artifacts` DROP FOREIGN KEY `scan_artifacts_scanRecordId_scan_records_id_fk`;
--> statement-breakpoint
ALTER TABLE `scan_records` DROP FOREIGN KEY `scan_records_userId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `scan_artifact_intents` MODIFY COLUMN `scanRecordId` int;--> statement-breakpoint
ALTER TABLE `scan_artifacts` MODIFY COLUMN `scanRecordId` int;--> statement-breakpoint
ALTER TABLE `scan_artifact_intents` ADD CONSTRAINT `scan_artifact_intents_scanRecordId_scan_records_id_fk` FOREIGN KEY (`scanRecordId`) REFERENCES `scan_records`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scan_artifacts` ADD CONSTRAINT `scan_artifacts_scanRecordId_scan_records_id_fk` FOREIGN KEY (`scanRecordId`) REFERENCES `scan_records`(`id`) ON DELETE set null ON UPDATE no action;