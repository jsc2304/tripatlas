CREATE TABLE "charge_points" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "charge_points_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"charge_session_id" bigint NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"power_kw" double precision,
	"soc" smallint,
	"outside_temp" double precision
);
--> statement-breakpoint
CREATE TABLE "software_updates" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "software_updates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"vehicle_id" bigint NOT NULL,
	"version" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"synced_at" timestamp with time zone,
	CONSTRAINT "software_updates_source_uq" UNIQUE("source","source_id")
);
--> statement-breakpoint
ALTER TABLE "charge_sessions" ADD COLUMN "outside_temp_avg" double precision;--> statement-breakpoint
ALTER TABLE "drives" ADD COLUMN "outside_temp_avg" double precision;--> statement-breakpoint
ALTER TABLE "drives" ADD COLUMN "inside_temp_avg" double precision;--> statement-breakpoint
ALTER TABLE "drives" ADD COLUMN "speed_max_kmh" smallint;--> statement-breakpoint
ALTER TABLE "drives" ADD COLUMN "power_max_kw" smallint;--> statement-breakpoint
ALTER TABLE "drives" ADD COLUMN "power_min_kw" smallint;--> statement-breakpoint
ALTER TABLE "drives" ADD COLUMN "weather_temp_c" double precision;--> statement-breakpoint
ALTER TABLE "drives" ADD COLUMN "weather_precipitation_mm" double precision;--> statement-breakpoint
ALTER TABLE "drives" ADD COLUMN "weather_wind_kmh" double precision;--> statement-breakpoint
ALTER TABLE "drives" ADD COLUMN "weather_code" smallint;--> statement-breakpoint
ALTER TABLE "drives" ADD COLUMN "weather_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vehicle_status" ADD COLUMN "tpms_fl_bar" double precision;--> statement-breakpoint
ALTER TABLE "vehicle_status" ADD COLUMN "tpms_fr_bar" double precision;--> statement-breakpoint
ALTER TABLE "vehicle_status" ADD COLUMN "tpms_rl_bar" double precision;--> statement-breakpoint
ALTER TABLE "vehicle_status" ADD COLUMN "tpms_rr_bar" double precision;--> statement-breakpoint
ALTER TABLE "charge_points" ADD CONSTRAINT "charge_points_charge_session_id_charge_sessions_id_fk" FOREIGN KEY ("charge_session_id") REFERENCES "public"."charge_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "software_updates" ADD CONSTRAINT "software_updates_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "charge_points_session_ts_idx" ON "charge_points" USING btree ("charge_session_id","ts");--> statement-breakpoint
CREATE INDEX "software_updates_vehicle_idx" ON "software_updates" USING btree ("vehicle_id","start_time");