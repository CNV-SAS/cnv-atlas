-- REGISTRO DE LA ENTREGA DE LA HISTORIA CLINICA AL PACIENTE.
--
-- POR QUE EXISTE. El paciente tiene derecho a su historia clinica completa (Resolucion 1995, Ley 1581) y
-- quien se la entrega es su profesional, no CNV (Anexo 3, clausula 13). **El profesional necesita poder
-- MOSTRAR que la entrego**, y para eso el hecho tiene que estar en una tabla de dominio que el pueda leer,
-- no solo en la auditoria: `clinical_audit_log` es admin-only para SELECT, asi que un registro que solo
-- viviera alli seria un registro que el profesional escribe y no ve nunca. Ya nos paso una vez, con el
-- descarte del aviso de alergeno: un almacen se elige por TODAS sus propiedades, y la de LECTURA es la que
-- se olvida.
--
-- Y ADEMAS VA AL AUDIT LOG, inline en la misma transaccion (regla dura 8). No es duplicar: son dos cosas
-- distintas. La tabla es el HECHO que el profesional consulta ("se la entregue el 2 de septiembre"); el
-- audit log es el RASTRO inmutable del acto, con su actor y su IP, que es lo que se revisa cuando alguien
-- pregunta quien saco un documento con datos de salud.
--
-- QUE SE GUARDA Y QUE NO. Se guarda QUE se entrego, A QUIEN, CUANDO, POR QUE MEDIO y QUIEN lo hizo. **No se
-- guarda el PDF**: se puede volver a generar del mismo lector, y almacenar una copia de la historia clinica
-- de cada entrega multiplicaria las copias de PHI sin ganar nada. Si algun dia hay que probar QUE decia el
-- documento entregado, lo que reconstruye eso es la constelacion de versiones de la evaluacion, no un
-- archivo suelto.
--
-- VARIAS ENTREGAS POR EVALUACION, a proposito: el paciente puede pedirla otra vez, y cada peticion es un
-- hecho. Sin clave unica, con indice por evaluacion para leerlas en orden.

create table if not exists hc_deliveries (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete restrict,
  -- Medio por el que salio. Hoy solo el correo; se deja como texto y no como enum para no pagar un
  -- `ALTER TYPE ... ADD VALUE` (que no corre dentro de una transaccion) el dia que se agregue otro.
  medium text not null default 'email',
  -- A DONDE se envio, tal como estaba en ese momento. El contacto del paciente puede cambiar despues, y
  -- "se le envio a su correo" sin decir a cual no prueba nada.
  sent_to text not null,
  delivered_by uuid not null references profiles(id) on delete restrict,
  delivered_by_email text not null,
  delivered_at timestamptz not null default now()
);--> statement-breakpoint

comment on table hc_deliveries is
  'Entregas de la historia clinica al paciente (derecho de acceso, Resolucion 1995). El profesional necesita poder mostrar que la entrego, y por eso es tabla de dominio y no solo audit log, que es admin-only para SELECT. No guarda el PDF: se regenera del mismo lector.';--> statement-breakpoint

create index if not exists hc_deliveries_evaluation_idx
  on hc_deliveries (evaluation_id, delivered_at desc);--> statement-breakpoint

alter table hc_deliveries enable row level security;--> statement-breakpoint

-- Misma visibilidad que la evaluacion cuya historia se entrego: si el profesional puede ver al paciente,
-- puede ver que se le entrego su historia. Es justo lo que la tabla existe para permitir.
create policy "hc_deliveries_select" on public.hc_deliveries
  for select to authenticated using (
    public.has_role('admin') or public.is_patient_professional(hc_deliveries.patient_id)
  );--> statement-breakpoint

-- Sin policy de escritura por sesion: se escribe por service_role dentro de la transaccion que tambien
-- deja el evento en clinical_audit_log, igual que el resto de los hechos clinicos.
