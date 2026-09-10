ALTER TABLE `scan_artifacts` DROP FOREIGN KEY `scan_artifacts_scanRecordId_scan_records_id_fk`;
--> statement-breakpoint
ALTER TABLE `scan_artifacts` MODIFY COLUMN `scanRecordId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `scan_records` ADD CONSTRAINT `scan_records_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `scan_artifacts` ADD CONSTRAINT `scan_artifacts_scanRecordId_scan_records_id_fk` FOREIGN KEY (`scanRecordId`) REFERENCES `scan_records`(`id`) ON DELETE restrict ON UPDATE no action;
