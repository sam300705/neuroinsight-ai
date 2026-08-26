ALTER TABLE `scan_records` DROP INDEX `scan_records_scanId_unique`;--> statement-breakpoint
ALTER TABLE `scan_artifacts` ADD CONSTRAINT `scan_artifacts_record_type_unique` UNIQUE(`scanRecordId`,`artifactType`);--> statement-breakpoint
ALTER TABLE `scan_records` ADD CONSTRAINT `scan_records_user_scan_unique` UNIQUE(`userId`,`scanId`);--> statement-breakpoint
ALTER TABLE `scan_artifacts` ADD CONSTRAINT `scan_artifacts_scanRecordId_scan_records_id_fk` FOREIGN KEY (`scanRecordId`) REFERENCES `scan_records`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scan_records` ADD CONSTRAINT `scan_records_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;