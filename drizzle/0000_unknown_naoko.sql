CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"meta_event" text NOT NULL,
	"ga4_event" text NOT NULL,
	"payload_json" text DEFAULT '{}' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_error_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"error_id" text NOT NULL,
	"kind" text DEFAULT 'react_boundary' NOT NULL,
	"name" text DEFAULT 'Error' NOT NULL,
	"message" text NOT NULL,
	"stack" text DEFAULT '' NOT NULL,
	"component_stack" text DEFAULT '' NOT NULL,
	"route" text DEFAULT '/' NOT NULL,
	"locale" text DEFAULT 'uk' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"phone" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"city" text DEFAULT 'Одеса' NOT NULL,
	"channel" text DEFAULT 'Telegram' NOT NULL,
	"segment" text DEFAULT 'b2c' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "contacts_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "customer_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"city" text DEFAULT 'Одеса' NOT NULL,
	"firebase_uid" text DEFAULT '' NOT NULL,
	"password_hash" text DEFAULT '' NOT NULL,
	"auth_provider" text DEFAULT 'google' NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"last_login_at" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "customer_accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "customer_wishlist" (
	"customer_id" integer NOT NULL,
	"product_id" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "customer_wishlist_customer_id_product_id_pk" PRIMARY KEY("customer_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_number" text NOT NULL,
	"contact_id" integer,
	"customer_id" integer,
	"customer_email" text DEFAULT '' NOT NULL,
	"type" text NOT NULL,
	"stage" text DEFAULT 'new' NOT NULL,
	"customer_name" text DEFAULT '' NOT NULL,
	"phone" text NOT NULL,
	"city" text DEFAULT 'Одеса' NOT NULL,
	"channel" text DEFAULT 'Telegram' NOT NULL,
	"topic" text DEFAULT '' NOT NULL,
	"task_type" text DEFAULT '' NOT NULL,
	"loads_json" text DEFAULT '[]' NOT NULL,
	"items_json" text DEFAULT '[]' NOT NULL,
	"total_usd" integer DEFAULT 0 NOT NULL,
	"assignee" text DEFAULT 'Олександр (інженер)' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"telegram_sent" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "deals_deal_number_unique" UNIQUE("deal_number")
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer,
	"deal_id" integer,
	"author" text DEFAULT 'Менеджер CRM' NOT NULL,
	"body" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"author_uid" text NOT NULL,
	"author_name" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at_ms" bigint NOT NULL,
	"updated_at_ms" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"title" text NOT NULL,
	"cat" text NOT NULL,
	"raw_cats_json" text DEFAULT '[]' NOT NULL,
	"brand" text NOT NULL,
	"is_kit" integer DEFAULT 0 NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"old_price" integer DEFAULT 0 NOT NULL,
	"in_stock" integer DEFAULT 1 NOT NULL,
	"status_label" text DEFAULT 'в наявності' NOT NULL,
	"img" text DEFAULT '' NOT NULL,
	"specs_json" text DEFAULT '[]' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"source_url" text DEFAULT '' NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"seg" text DEFAULT 'b2c' NOT NULL,
	"tag" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"img" text DEFAULT '' NOT NULL,
	"task" text DEFAULT '' NOT NULL,
	"solution" text DEFAULT '' NOT NULL,
	"specs" text DEFAULT '' NOT NULL,
	"result" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"login" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"position" text DEFAULT 'Менеджер' NOT NULL,
	"role" text DEFAULT 'manager' NOT NULL,
	"assignee_label" text NOT NULL,
	"password_hash" text DEFAULT '' NOT NULL,
	"can_login" integer DEFAULT 0 NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "staff_users_login_unique" UNIQUE("login")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer,
	"deal_id" integer,
	"title" text NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"assignee" text DEFAULT 'Олександр (інженер)' NOT NULL,
	"due_date" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_wishlist" ADD CONSTRAINT "customer_wishlist_customer_id_customer_accounts_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_customer_id_customer_accounts_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_product_reviews_product_status" ON "product_reviews" USING btree ("product_id","status","created_at_ms");