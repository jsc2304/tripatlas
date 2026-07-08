CREATE TABLE "classification_rules" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "classification_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"start_place_id" bigint,
	"end_place_id" bigint,
	"weekdays" smallint[],
	"classification" "drive_classification",
	"tag_id" bigint,
	"purpose" text,
	"customer" text,
	"project" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "charge_sessions" ADD COLUMN "cost_source" text;--> statement-breakpoint
ALTER TABLE "drives" ADD COLUMN "classified_by_rule_id" bigint;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "electricity_price_per_kwh" numeric(8, 4);--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "electricity_price_currency" char(3);--> statement-breakpoint
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_start_place_id_places_id_fk" FOREIGN KEY ("start_place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_end_place_id_places_id_fk" FOREIGN KEY ("end_place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drives" ADD CONSTRAINT "drives_classified_by_rule_id_classification_rules_id_fk" FOREIGN KEY ("classified_by_rule_id") REFERENCES "public"."classification_rules"("id") ON DELETE set null ON UPDATE no action;