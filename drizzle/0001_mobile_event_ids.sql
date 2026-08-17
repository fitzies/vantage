ALTER TABLE "events" ADD COLUMN "event_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "events_project_event_id_unique" ON "events" USING btree ("project_id","event_id") WHERE "events"."event_id" is not null;
