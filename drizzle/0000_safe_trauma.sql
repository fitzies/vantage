CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"event" text NOT NULL,
	"user_id" text,
	"anon_id" text,
	"session_id" text,
	"timestamp" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"url" text,
	"referrer" text,
	"user_agent" text,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"write_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug"),
	CONSTRAINT "projects_write_key_unique" UNIQUE("write_key")
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_project_ts_idx" ON "events" USING btree ("project_id","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_project_user_ts_idx" ON "events" USING btree ("project_id","user_id","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_project_event_ts_idx" ON "events" USING btree ("project_id","event","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_project_anon_ts_idx" ON "events" USING btree ("project_id","anon_id","timestamp" DESC NULLS LAST);