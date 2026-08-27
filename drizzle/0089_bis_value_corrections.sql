-- Corrección de medidas antropométricas de una medición BIS.
--
-- POR QUE. Si el archivo del equipo trae la cintura mal, o falta, hoy la unica salida es CERRAR LA
-- EVALUACION Y REHACERLA (el mecanismo del Biody del paciente equivocado). Para un digito eso es
-- desproporcionado. Su archivo permite editar peso, estatura, cintura y cadera, con esta nota: "son
-- editables (si faltan en el archivo o llegaron mal). Los indices IMC, ICC, ICT, ASMI y las
-- clasificaciones de AF/FFMI/FMI se recalculan automaticamente al editar".
--
-- POR QUE UNA TABLA APARTE Y NO EDITAR bis_raw_values. Dos razones, y las dos importan:
--
--   1. LOS CRUDOS DEL EQUIPO NO SE PISAN. `bis_raw_values` es la medicion tal como la entrego el
--      Biody, y es la evidencia de que ese aparato midio eso. Sobrescribirla dejaria el archivo
--      diciendo una cosa y la pantalla otra, sin forma de saber cual era cual. Con la correccion
--      aparte, el valor medido y el corregido conviven y la pantalla puede mostrar los dos.
--   2. Se evita `ALTER TYPE ... ADD VALUE` sobre `bis_value_origin`, que NO corre dentro de una
--      transaccion y las migraciones de drizzle si lo hacen.
--
-- QUE SE PUEDE CORREGIR, y que no. Solo las cuatro medidas que el profesional toma con cinta o
-- bascula y que el equipo puede traer mal: peso, estatura, cintura y cadera. NO la edad ni el sexo
-- (en su archivo tampoco son editables: van en gris). Y NO la fuerza prensil, que YA se captura en el
-- bloque de condiciones BIS y no debe tener dos sitios de edicion.
--
-- CUANDO. Solo ANTES del diagnostico. Despues, la evaluacion queda sellada y el camino es "Corregir",
-- que versiona evaluacion, diagnostico y reporte sin sobrescribir. La regla ya existe en la pantalla
-- ("la captura ya no es editable tras el diagnostico") y esta la hereda: cambiar una medicion sobre la
-- que YA se emitio un diagnostico no es una edicion, es una correccion, y tiene que dejar version.
--
-- UNA CORRECCION VIGENTE POR VARIABLE (pk sobre measurement_id + variable_name): corregir dos veces la
-- misma medida no es historia, es la misma correccion. El rastro completo de intentos vive en
-- clinical_audit_log, como con el descarte del aviso de alergeno.

create table if not exists bis_value_corrections (
  measurement_id uuid not null references bis_measurements(id) on delete cascade,
  variable_name text not null,
  value numeric not null,
  corrected_by uuid not null references profiles(id),
  corrected_by_email text not null,
  corrected_at timestamptz not null default now(),
  primary key (measurement_id, variable_name)
);--> statement-breakpoint

comment on table bis_value_corrections is
  'Correccion de una medida antropometrica de una medicion BIS (peso, estatura, cintura, cadera). NO sobrescribe bis_raw_values: el crudo del equipo se conserva y la pantalla puede mostrar cual es cual. Solo antes del diagnostico; despues el camino es el flujo de correccion, que versiona.';

alter table bis_value_corrections enable row level security;--> statement-breakpoint

-- Misma visibilidad que los crudos que corrige: si el profesional puede ver la medicion, puede ver su
-- correccion. Espejo de bis_raw_values_select, para que no exista el caso de ver un valor y no saber
-- que fue corregido.
create policy "bis_value_corrections_select" on public.bis_value_corrections
  for select to authenticated using (
    public.has_role('admin') or exists (
      select 1 from public.bis_measurements m
      join public.evaluations e on e.id = m.evaluation_id
      where m.id = bis_value_corrections.measurement_id and public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

-- Sin policy de escritura por sesion: se escribe por service_role dentro de la transaccion que tambien
-- deja el evento en clinical_audit_log, igual que el resto de los hechos clinicos.
