# Plan · La quinta pestaña (Reporte / Historia clínica)

**Preparado el 2026-08-24, sin construir.** Sale del cotejo (P-37) y de la propuesta de Santiago de crearla y mover el reporte.

---

# 1. Qué reabre, y por qué es el momento

**La decisión que se revisa:** el reporte se dejó dentro de Tratamiento en el checkpoint 2, **porque no había pestaña destino**. Está registrado así en `BACKLOG.md`. No fue una decisión de diseño: fue la única opción disponible.

**Y hay una segunda pregunta, ya abierta en BACKLOG, que esto obliga a responder:** ¿`reports` es **un** documento o **dos**?

> **Hipótesis registrada:** un reporte del **diagnóstico** (documenta el análisis; tiene sentido emitirlo sin prescribir, por ejemplo para remitir) y un reporte del **tratamiento** (documenta la prescripción). Si son dos, la pregunta "¿el reporte va antes o después de prescribir?" cambia de forma: no es cuál va primero, es **cuál de los dos**.

**Estado verificado:** nuestro `reports` **hoy es el del diagnóstico** (indicadores, EFR, DFI, rutas). El de tratamiento no existe.

**Por qué ahora es el momento:** el flujo de nutracéuticos depende de tener dónde cerrar la consulta, y las cuatro salidas al paciente (P-38) ya están inventariadas. Construir la pestaña sin ese inventario habría sido adivinar.

---

# 2. Qué tiene él y qué tenemos nosotros

## Su historia clínica: once secciones

1. Datos del paciente · 2. Motivo de consulta · 3. Antecedentes personales · 4. Tabla resumen de índices por niveles de Wang · 5. Resumen diagnóstico (DFI, meta, objetivo) · 6. Rutas activadas · 7. Tratamiento · 8. Recomendaciones · 9. Remisiones y derivaciones · 10. Exámenes solicitados · 11. Próxima cita y firma.

## Nuestro PDF: seis

Paciente · Documento · Indicadores · Cambio respecto a la medición anterior · Notas del profesional · Recomendación de nutracéuticos.

## Las cinco que faltan, y no todas son iguales

| Sección | Estado del dato | Trabajo |
|---|---|---|
| **Motivo de consulta** | **no se captura** | pieza nueva (un campo, y decidir dónde se pregunta) |
| **Antecedentes personales** | **existe**, en la encuesta (d5_39, d5_38, d6_43, d6_44) | mostrar; **ojo**: d6_43/d6_44 no llegan al motor (P-39) |
| **Tabla de Wang** | **existe**, ya se muestra en Diagnóstico | reusar el componente |
| **Tratamiento, remisiones, exámenes** | **existen** | reusar; los exámenes salen del snapshot del protocolo |
| **Próxima cita y firma** | la cita **existe** (se captura al aprobar el reporte); la firma **no** | decidir qué significa "firma" aquí |

**La única de verdad nueva es el motivo de consulta.** El resto es reunir lo que ya está.

---

# 3. Las cuatro salidas al paciente, ordenadas

Del inventario de su archivo (P-38), tres documentos por dos canales:

| Documento | Canal | Qué lleva | Nosotros |
|---|---|---|---|
| **El plan** | papel/PDF | objetivo, distribución, menú y la lista de intercambio del paciente. **Excluye** la cadena, la tabla de trabajo y la validación | no existe |
| **El informe de composición** | app del paciente (entra con documento y fecha de nacimiento) | la composición corporal en versión amigable | **es lo que hoy enviamos por correo** |
| **La consulta completa** | papel/PDF | toda la pestaña | no existe |

**Dos consecuencias para el plan:**

- **El filtro de impresión define el contenido**, no es cosmética. Lo que se imprime del plan excluye lo técnico a propósito (P-36). Esa lista es contenido del envío, y por eso hoy está en pantalla "prestada".
- **El informe de composición es del DIAGNÓSTICO**, no del tratamiento. Confirma que el reporte que ya tenemos pertenece a esta pestaña.

---

# 4. Qué se construye

### 4.1 · La pestaña

Quinta etapa en la barra, al nivel de Entrada, Diagnóstico, Tratamiento y Seguimiento. Con la misma regla de acceso que las demás (RLS y la profesión del actor).

### 4.2 · Se MUEVE, no se duplica

Lo que hoy vive en Tratamiento y pertenece aquí: la `ReportCard` (aprobar, modos de envío, enviar), el historial de envíos, y la **lista de intercambio del paciente**, que sale de la pantalla del plan y pasa a ser contenido de este documento.

**Cuidado registrado:** mover la `ReportCard` **cambia el gate de la próxima cita**. Hoy la cita se captura al aprobar el reporte, dentro de Tratamiento; si el reporte se va, hay que decidir si la cita se va con él o se queda con el plan. **Lectura: se va con el reporte**, porque es lo que el paciente necesita saber, y así está en su HC (sección 11).

### 4.3 · La historia clínica

Las once secciones, reusando lo que existe. **El motivo de consulta es lo único nuevo**: un campo, y la decisión de dónde se pregunta (probablemente en la Entrada, junto a la identidad, que es cuando el paciente lo dice).

### 4.4 · El cierre de la consulta

**Vive aquí**, y es lo que conecta este plan con el de nutracéuticos: la lista de lo que quedó sin decidir, la opción de cerrar marcando pendientes, y el cambio de `in_progress` a `completed`, que hoy **nadie pone** (38 abiertas, cero cerradas).

---

# 5. Lo que NO entra

- **El envío del plan como documento** (el PDF con su filtro): es el bloque de envío, y va después de que la pestaña exista.
- **La app del paciente**: canal propio, fuera de alcance.
- **El pago mixto y el cobro en Tratamiento**: van en el otro plan.

---

# 6. Orden y dimensión

| # | Pieza | Dimensión | Depende de |
|---|---|---|---|
| 1 | La pestaña vacía, con acceso y navegación | **chica** | nada |
| 2 | Mover la `ReportCard` y el historial de envíos | chica | 1 |
| 3 | Decidir y mover la próxima cita | chica | 2 |
| 4 | La HC con lo que ya existe (Wang, tratamiento, remisiones, exámenes, antecedentes) | **media** | 1 |
| 5 | El motivo de consulta (captura + muestra) | chica | dónde se pregunta |
| 6 | El cierre de la consulta con su lista | media | 1, y la pregunta del nutracéutico |
| 7 | Mover la lista de intercambio del paciente | chica | 1 |

**Total: media.** Casi todo es reunir lo que ya está; lo único nuevo es el motivo de consulta y el cierre.

---

# 7. La decisión que hay que tomar antes de la pieza 4

**¿`reports` se parte en dos documentos?**

- **Si NO se parte:** la HC es una vista que reúne diagnóstico y tratamiento, y el `reports` actual sigue siendo el único documento emitible. Más simple, y suficiente por ahora.
- **Si SÍ se parte:** hay un reporte del diagnóstico (emitible sin prescribir, para remitir) y uno del tratamiento (documenta la prescripción). Eso **reordena T4** y toca la confirmación del diagnóstico, que hoy es efecto lateral de aprobar el reporte.

**Recomendación: NO partirlo ahora.** Construir la pestaña con el reporte que existe, y dejar la partición como decisión propia cuando haya un caso real que la pida (un paciente al que se remite sin prescribir). Partir un documento clínico sin ese caso delante es diseñar para una hipótesis.

**Es decisión de Santiago**, y es la única que bloquea algo de este plan.
