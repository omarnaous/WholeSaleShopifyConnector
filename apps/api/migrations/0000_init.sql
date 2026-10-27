CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`variant_id` text,
	`key` text NOT NULL,
	`alt` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `images_product_idx` ON `images` (`product_id`);--> statement-breakpoint
CREATE TABLE `import_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`total` integer NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`errors` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `imported_products` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`product_id` text NOT NULL,
	`shopify_product_id` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`imported_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`last_synced_at` text,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `imported_shop_product_uq` ON `imported_products` (`shop_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `imported_shopify_id_idx` ON `imported_products` (`shopify_product_id`);--> statement-breakpoint
CREATE TABLE `imported_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`imported_product_id` text NOT NULL,
	`shop_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`shopify_variant_id` text NOT NULL,
	`inventory_item_id` text NOT NULL,
	`last_known_price` integer,
	`last_synced_cost` integer,
	`last_synced_stock` integer,
	FOREIGN KEY (`imported_product_id`) REFERENCES `imported_products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `imported_variant_uq` ON `imported_variants` (`shop_id`,`variant_id`);--> statement-breakpoint
CREATE INDEX `imported_variants_shopify_idx` ON `imported_variants` (`shopify_variant_id`);--> statement-breakpoint
CREATE TABLE `margin_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`imported_variant_id` text NOT NULL,
	`cost` integer NOT NULL,
	`price` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`resolved_at` text,
	`dismissed_at` text,
	FOREIGN KEY (`imported_variant_id`) REFERENCES `imported_variants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `margin_alerts_shop_idx` ON `margin_alerts` (`shop_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`collection` text NOT NULL,
	`style` text NOT NULL,
	`frame_material` text NOT NULL,
	`lens_types` text NOT NULL,
	`gender` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE TABLE `shops` (
	`id` text PRIMARY KEY NOT NULL,
	`domain` text NOT NULL,
	`access_token` text,
	`scope` text,
	`subscription_id` text,
	`subscription_status` text DEFAULT 'NONE' NOT NULL,
	`subscription_test` integer DEFAULT false NOT NULL,
	`current_period_end` text,
	`location_id` text,
	`location_name` text,
	`currency` text,
	`installed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`uninstalled_at` text,
	`last_sync_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shops_domain_unique` ON `shops` (`domain`);--> statement-breakpoint
CREATE TABLE `sync_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`shop_id` text NOT NULL,
	`product_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE INDEX `sync_jobs_created_idx` ON `sync_jobs` (`created_at`);--> statement-breakpoint
CREATE TABLE `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`sku` text NOT NULL,
	`frame_color` text NOT NULL,
	`frame_color_hex` text NOT NULL,
	`lens_color` text NOT NULL,
	`lens_color_hex` text NOT NULL,
	`size` text NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`wholesale_cost` integer NOT NULL,
	`suggested_price` integer NOT NULL,
	`image_key` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `variants_sku_unique` ON `variants` (`sku`);--> statement-breakpoint
CREATE INDEX `variants_product_idx` ON `variants` (`product_id`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`shop` text NOT NULL,
	`topic` text NOT NULL,
	`received_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
