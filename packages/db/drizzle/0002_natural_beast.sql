CREATE TABLE "vehicle_status" (
	"vehicle_id" bigint PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone,
	"lat" double precision,
	"lon" double precision,
	"soc" smallint,
	"odometer_km" double precision,
	"state" text,
	"state_since" timestamp with time zone,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "vehicle_status" ADD CONSTRAINT "vehicle_status_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;