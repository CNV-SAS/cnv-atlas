CREATE TYPE "public"."bis_condition_field_type" AS ENUM('boolean', 'number', 'text');--> statement-breakpoint
CREATE TYPE "public"."bis_condition_kind" AS ENUM('calidad', 'contraindicacion', 'advertencia');--> statement-breakpoint
CREATE TYPE "public"."bis_condition_scope" AS ENUM('general', 'mujeres');--> statement-breakpoint
CREATE TABLE "bis_condition_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_number" integer NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	CONSTRAINT "bis_condition_versions_number_unique" UNIQUE("version_number")
);
--> statement-breakpoint
CREATE TABLE "bis_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bis_condition_version_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"scope" "bis_condition_scope" NOT NULL,
	"kind" "bis_condition_kind" NOT NULL,
	"input_type" "bis_condition_field_type" DEFAULT 'boolean' NOT NULL,
	"requires_detail" boolean DEFAULT false NOT NULL,
	"detail_label" text,
	"detail_type" "bis_condition_field_type",
	"order_index" integer NOT NULL,
	CONSTRAINT "bis_conditions_version_key_unique" UNIQUE("bis_condition_version_id","key"),
	CONSTRAINT "bis_conditions_version_order_unique" UNIQUE("bis_condition_version_id","order_index")
);
--> statement-breakpoint
CREATE TABLE "evaluation_bis_intake" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"bis_condition_version_id" uuid NOT NULL,
	"condition_answers" jsonb NOT NULL,
	"contraindicated" boolean DEFAULT false NOT NULL,
	"grip_strength_kg" numeric,
	"weight_goal_kg" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evaluation_bis_intake_evaluation_unique" UNIQUE("evaluation_id")
);
--> statement-breakpoint
ALTER TABLE "bis_conditions" ADD CONSTRAINT "bis_conditions_bis_condition_version_id_bis_condition_versions_id_fk" FOREIGN KEY ("bis_condition_version_id") REFERENCES "public"."bis_condition_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_bis_intake" ADD CONSTRAINT "evaluation_bis_intake_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_bis_intake" ADD CONSTRAINT "evaluation_bis_intake_bis_condition_version_id_bis_condition_versions_id_fk" FOREIGN KEY ("bis_condition_version_id") REFERENCES "public"."bis_condition_versions"("id") ON DELETE no action ON UPDATE no action;