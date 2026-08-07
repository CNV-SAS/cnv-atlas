CREATE TABLE "nutraceutical_count_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"nutraceutical_id" uuid NOT NULL,
	"lote" text,
	"physical_qty" integer NOT NULL,
	"system_qty" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutraceutical_count_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nutraceutical_faltante_cases" ADD COLUMN "count_session_id" uuid;--> statement-breakpoint
ALTER TABLE "nutraceutical_count_lines" ADD CONSTRAINT "nutraceutical_count_lines_session_id_nutraceutical_count_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."nutraceutical_count_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutraceutical_count_lines" ADD CONSTRAINT "nutraceutical_count_lines_nutraceutical_id_nutraceuticals_id_fk" FOREIGN KEY ("nutraceutical_id") REFERENCES "public"."nutraceuticals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutraceutical_count_sessions" ADD CONSTRAINT "nutraceutical_count_sessions_professional_id_professional_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professional_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutraceutical_count_sessions" ADD CONSTRAINT "nutraceutical_count_sessions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nutra_count_lines_session_idx" ON "nutraceutical_count_lines" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "nutra_count_prof_idx" ON "nutraceutical_count_sessions" USING btree ("professional_id");--> statement-breakpoint
ALTER TABLE "nutraceutical_faltante_cases" ADD CONSTRAINT "nutraceutical_faltante_cases_count_session_id_nutraceutical_count_sessions_id_fk" FOREIGN KEY ("count_session_id") REFERENCES "public"."nutraceutical_count_sessions"("id") ON DELETE no action ON UPDATE no action;