CREATE TABLE "ai_criterion_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"diagnosis_id" uuid NOT NULL,
	"generated_by" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"generated_text" text,
	"raw_response" jsonb,
	"status" "ai_suggestion_status" NOT NULL,
	"latency_ms" integer,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "diagnosis_notes" ADD COLUMN "ai_assisted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_criterion_suggestions" ADD CONSTRAINT "ai_criterion_suggestions_diagnosis_id_diagnoses_id_fk" FOREIGN KEY ("diagnosis_id") REFERENCES "public"."diagnoses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_criterion_suggestions" ADD CONSTRAINT "ai_criterion_suggestions_generated_by_profiles_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_criterion_suggestions_diagnosis_idx" ON "ai_criterion_suggestions" USING btree ("diagnosis_id");--> statement-breakpoint
-- ai_criterion_suggestions: inmutable por ausencia de UPDATE/DELETE (sin trigger). RLS calcada de
-- ai_menu_suggestions: solo el admin o el profesional del paciente ven/insertan; la escritura real va por
-- el owner db (BYPASSRLS) con audit inline, esto es defensa en profundidad. No se muestra en pantalla al
-- profesional (procedencia para auditoria); la policy no fuerza mostrarla, solo la acota si se consulta.
ALTER TABLE "ai_criterion_suggestions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "ai_criterion_suggestions_select" ON public.ai_criterion_suggestions
  FOR SELECT TO authenticated USING (
    public.has_role('admin') OR EXISTS (
      SELECT 1 FROM public.diagnoses d
      JOIN public.evaluations e ON e.id = d.evaluation_id
      WHERE d.id = ai_criterion_suggestions.diagnosis_id AND public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint
CREATE POLICY "ai_criterion_suggestions_insert" ON public.ai_criterion_suggestions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.diagnoses d
      JOIN public.evaluations e ON e.id = d.evaluation_id
      WHERE d.id = ai_criterion_suggestions.diagnosis_id AND public.is_patient_professional(e.patient_id)
    )
  );
