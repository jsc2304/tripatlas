CREATE TYPE "public"."journey_type" AS ENUM('vacation', 'business_trip', 'roadtrip', 'other');--> statement-breakpoint
CREATE TABLE "journey_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "journey_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"journey_id" bigint NOT NULL,
	"item_type" text NOT NULL,
	"item_id" bigint NOT NULL,
	"sort_order" integer,
	"assigned_by" text DEFAULT 'auto' NOT NULL,
	"excluded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journey_items_uq" UNIQUE("journey_id","item_type","item_id")
);
--> statement-breakpoint
CREATE TABLE "journeys" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "journeys_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"type" "journey_type" DEFAULT 'other' NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"color" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journey_items" ADD CONSTRAINT "journey_items_journey_id_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journey_items_journey_idx" ON "journey_items" USING btree ("journey_id");--> statement-breakpoint
CREATE INDEX "journeys_start_idx" ON "journeys" USING btree ("start_time");