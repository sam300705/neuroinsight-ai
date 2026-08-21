CREATE TABLE `scan_artifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scanRecordId` int NOT NULL,
	`artifactType` enum('report','grad_cam','segmentation_mask','three_dimensional') NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(1024) NOT NULL,
	`contentType` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scan_artifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scan_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scanId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`mode` enum('classification','segmentation') NOT NULL,
	`status` enum('complete','low_confidence','incompatible','partial','unavailable') NOT NULL,
	`modelVersion` varchar(128) NOT NULL,
	`processingTimeMs` int NOT NULL,
	`predictedClass` enum('glioma','meningioma','pituitary','no_tumor'),
	`confidenceScore` decimal(6,5),
	`calibrated` int NOT NULL DEFAULT 0,
	`uncertaintyReason` text,
	`manualReviewRecommended` int NOT NULL DEFAULT 1,
	`measurementJson` text NOT NULL,
	`warningsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scan_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `scan_records_scanId_unique` UNIQUE(`scanId`)
);
--> statement-breakpoint
CREATE INDEX `scan_artifacts_scan_idx` ON `scan_artifacts` (`scanRecordId`);--> statement-breakpoint
CREATE INDEX `scan_artifacts_type_idx` ON `scan_artifacts` (`artifactType`);--> statement-breakpoint
CREATE INDEX `scan_records_user_created_idx` ON `scan_records` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `scan_records_user_status_idx` ON `scan_records` (`userId`,`status`);