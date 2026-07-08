CREATE TYPE "public"."charger_type" AS ENUM('ac', 'dc');--> statement-breakpoint
CREATE TYPE "public"."drive_classification" AS ENUM('unclassified', 'private', 'business', 'commute');--> statement-breakpoint
CREATE TYPE "public"."place_type" AS ENUM('home', 'work', 'customer', 'charger', 'other');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"entity_type" text NOT NULL,
	"entity_id" bigint NOT NULL,
	"field" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charge_session_tags" (
	"charge_session_id" bigint NOT NULL,
	"tag_id" bigint NOT NULL,
	CONSTRAINT "charge_session_tags_charge_session_id_tag_id_pk" PRIMARY KEY("charge_session_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "charge_sessions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "charge_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"vehicle_id" bigint NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"lat" double precision,
	"lon" double precision,
	"place_id" bigint,
	"place_locked" boolean DEFAULT false NOT NULL,
	"address" text,
	"start_soc" smallint,
	"end_soc" smallint,
	"energy_added_kwh" double precision,
	"energy_used_kwh" double precision,
	"max_power_kw" double precision,
	"avg_power_kw" double precision,
	"charger_type" charger_type,
	"duration_seconds" integer,
	"cost" numeric(10, 2),
	"currency" char(3),
	"notes" text,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charge_sessions_source_uq" UNIQUE("source","source_id")
);
--> statement-breakpoint
CREATE TABLE "drive_tags" (
	"drive_id" bigint NOT NULL,
	"tag_id" bigint NOT NULL,
	CONSTRAINT "drive_tags_drive_id_tag_id_pk" PRIMARY KEY("drive_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "drives" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drives_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"vehicle_id" bigint NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"start_odometer_km" double precision,
	"end_odometer_km" double precision,
	"distance_km" double precision,
	"duration_seconds" integer,
	"start_lat" double precision,
	"start_lon" double precision,
	"end_lat" double precision,
	"end_lon" double precision,
	"start_place_id" bigint,
	"end_place_id" bigint,
	"start_place_locked" boolean DEFAULT false NOT NULL,
	"end_place_locked" boolean DEFAULT false NOT NULL,
	"start_address" text,
	"end_address" text,
	"start_soc" smallint,
	"end_soc" smallint,
	"consumed_energy_kwh" double precision,
	"energy_is_estimated" boolean DEFAULT true NOT NULL,
	"avg_consumption_wh_km" double precision,
	"ascent_m" integer,
	"descent_m" integer,
	"classification" "drive_classification" DEFAULT 'unclassified' NOT NULL,
	"purpose" text,
	"customer" text,
	"project" text,
	"notes" text,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drives_source_uq" UNIQUE("source","source_id")
);
--> statement-breakpoint
CREATE TABLE "park_sessions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "park_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"vehicle_id" bigint NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"lat" double precision,
	"lon" double precision,
	"place_id" bigint,
	"place_locked" boolean DEFAULT false NOT NULL,
	"address" text,
	"duration_seconds" integer,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "park_sessions_source_uq" UNIQUE("source","source_id")
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "places_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"type" "place_type" DEFAULT 'other' NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"radius_m" integer DEFAULT 100 NOT NULL,
	"address" text,
	"source" text DEFAULT 'user' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_points" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "route_points_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"drive_id" bigint NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"elevation_m" double precision,
	"speed_kmh" double precision,
	"odometer_km" double precision,
	"soc" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"source" text NOT NULL,
	"entity" text NOT NULL,
	"watermark_ts" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_status" text,
	"last_error" text,
	"rows_upserted" integer,
	CONSTRAINT "sync_state_source_entity_pk" PRIMARY KEY("source","entity")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"color" text,
	"category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"display_name" text NOT NULL,
	"vin" text,
	"model" text,
	"trim_badging" text,
	"efficiency_kwh_per_km" double precision,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_source_uq" UNIQUE("source","source_id")
);
--> statement-breakpoint
ALTER TABLE "charge_session_tags" ADD CONSTRAINT "charge_session_tags_charge_session_id_charge_sessions_id_fk" FOREIGN KEY ("charge_session_id") REFERENCES "public"."charge_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_session_tags" ADD CONSTRAINT "charge_session_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_sessions" ADD CONSTRAINT "charge_sessions_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_sessions" ADD CONSTRAINT "charge_sessions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_tags" ADD CONSTRAINT "drive_tags_drive_id_drives_id_fk" FOREIGN KEY ("drive_id") REFERENCES "public"."drives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_tags" ADD CONSTRAINT "drive_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drives" ADD CONSTRAINT "drives_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drives" ADD CONSTRAINT "drives_start_place_id_places_id_fk" FOREIGN KEY ("start_place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drives" ADD CONSTRAINT "drives_end_place_id_places_id_fk" FOREIGN KEY ("end_place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "park_sessions" ADD CONSTRAINT "park_sessions_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "park_sessions" ADD CONSTRAINT "park_sessions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_points" ADD CONSTRAINT "route_points_drive_id_drives_id_fk" FOREIGN KEY ("drive_id") REFERENCES "public"."drives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "charge_sessions_vehicle_start_idx" ON "charge_sessions" USING btree ("vehicle_id","start_time");--> statement-breakpoint
CREATE INDEX "drives_vehicle_start_idx" ON "drives" USING btree ("vehicle_id","start_time");--> statement-breakpoint
CREATE INDEX "drives_classification_start_idx" ON "drives" USING btree ("classification","start_time");--> statement-breakpoint
CREATE INDEX "drives_start_place_idx" ON "drives" USING btree ("start_place_id");--> statement-breakpoint
CREATE INDEX "drives_end_place_idx" ON "drives" USING btree ("end_place_id");--> statement-breakpoint
CREATE INDEX "park_sessions_vehicle_start_idx" ON "park_sessions" USING btree ("vehicle_id","start_time");--> statement-breakpoint
CREATE INDEX "route_points_drive_ts_idx" ON "route_points" USING btree ("drive_id","ts");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");