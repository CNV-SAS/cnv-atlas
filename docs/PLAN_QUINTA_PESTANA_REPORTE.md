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

## Su historia clínica, VERIFICADA contra las capturas (2026-08-24)

El inventario decía "once secciones". **Las capturas muestran catorce bloques**, y la lista del inventario no coincidía: fundía algunos y nombraba uno que no existe. Esta es la lista real, en su orden:

| # | Bloque | De dónde sale | ¿Sin recalcular? |
|---|---|---|---|
| 1 | **Datos del paciente** (paciente, edad/sexo, peso/talla, fecha, profesional, **ocupación**) | perfil + medición | sí |
| 2 | **Motivo de consulta** | `evaluations.reason_for_visit` | sí |
| 3 | **Antecedentes personales** (diagnósticos + "Otro", HTA, **medicación antihipertensiva**, familiares, **lactancia materna**, medicamentos actuales, **alergias**, **intolerancias**) | encuesta | sí, pero cuatro campos **no los consume el motor** (P-39) |
| 4 | **Composición corporal, niveles de Wang** | snapshot | la **referencia** se computa en vivo (ver §4.5) |
| 5 | **Resumen diagnóstico · \<profesión\>** | snapshot | sí |
| 6 | **Diagnóstico funcional integrado (DFI)** | snapshot | sí |
| 7 | **Meta terapéutica** | snapshot | sí |
| 8 | **Objetivo del tratamiento** | protocolo sellado | sí |
| 9 | **Rutas de intervención activadas** | snapshot (`rutasContent`) | sí |
| 10 | **Tratamiento · plan nutricional** (GEB, GET, objetivo, proteínas, carbohidratos, grasas, sodio, actividad física) | protocolo sellado | sí |
| 11 | **Recomendaciones** | condicional por diagnóstico + bloque genérico | **parcial** (ver §4.6) |
| 12 | **Remisiones y derivaciones** | `referrals` | sí |
| 13 | **Próxima consulta** | `treatments.proxima_cita` | sí |
| 14 | **Firma y fecha** | línea en blanco + nombre + fecha | sí |

**Correcciones al inventario anterior, que hay que registrar porque cambian el trabajo:**

- **"Exámenes solicitados" NO es una sección suya.** Los estudios aparecen **dentro del texto de la remisión** ("Estudios sugeridos: vitamina D, testosterona/estrógenos, IGF-1"). No hay bloque propio.
- **Su tabla de Wang en la HC es ABREVIADA**, no la de la pestaña de Diagnóstico: seis filas (IMC en Nivel V; % Grasa y SMM/W en Nivel IV; AF en Nivel III) más un bloque **ANI BIS-E** con IEHH e IAE. La HC resume; el Diagnóstico despliega.
- **Aparecen dos campos que no teníamos en la lista: "Ocupación" y "Lactancia materna".**
- **El "Resumen diagnóstico" lleva la PROFESIÓN en el título** ("RESUMEN DIAGNÓSTICO · NUTRICIONISTA"): es el resumen del profesional que atiende, no uno solo.

**Dos defectos de su prototipo que NO se copian** (regla: cuando el prototipo difiere de lo correcto, el equivocado es el prototipo):

1. **El motivo de consulta sale sin separador**: "Control de peso / composición corporal**Rendimiento deportivo**Envejecimiento saludable / longevidad". Las opciones se concatenan pegadas. Nosotros unimos con coma.
2. **`Fenotipo MCCB: F7 — undefined` y `PBI: undefined`** salen literalmente en su pantalla. Es un `undefined` suyo, no un dato.
3. **La fecha de la firma es `new Date()`**, la de impresión, no la de la consulta. Un documento clínico impreso seis meses después diría la fecha equivocada. Nosotros usamos la fecha de la evaluación.

## Nuestro PDF: seis

Paciente · Documento · Indicadores · Cambio respecto a la medición anterior · Notas del profesional · Recomendación de nutracéuticos.

## Las cinco que faltan, y no todas son iguales

| Sección | Estado del dato | Trabajo |
|---|---|---|
| **Motivo de consulta** | **YA SE CAPTURA** (verificado): `evaluations.reason_for_visit`, multi-select de 8 opciones con "Otro" y texto libre, en el intake | **solo mostrarlo** |
| **Antecedentes personales** | **existe**, en la encuesta (d5_39, d5_38, d6_43, d6_44) | mostrar; **ojo**: d6_43/d6_44 no llegan al motor (P-39) |
| **Tabla de Wang** | **existe**, ya se muestra en Diagnóstico | reusar el componente |
| **Tratamiento, remisiones, exámenes** | **existen** | reusar; los exámenes salen del snapshot del protocolo |
| **Próxima cita y firma** | la cita **existe** (se captura al aprobar el reporte); la firma **no** | decidir qué significa "firma" aquí |

**No hay ninguna de verdad nueva: todo es reunir lo que ya está.** El motivo de consulta parecía la excepción y no lo es: se captura desde el intake (es el campo que tuvo el arreglo del texto libre de "Otro"), y es el mismo concepto que su sección 2. **Ojo a una diferencia de forma:** el suyo es texto libre y el nuestro es multi-select; al mostrarlo se unen las opciones elegidas, y el "Otro: <texto>" ya viaja completo desde el arreglo del texto libre.

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

Las once secciones, **reusando lo que existe**: ninguna exige capturar un dato nuevo. El motivo de consulta ya viene del intake (ver §2), la tabla de Wang se reusa de Diagnóstico, y tratamiento, remisiones y exámenes salen del snapshot del protocolo.

### 4.4 · El cierre de la consulta

**Vive aquí**, y es lo que conecta este plan con el de nutracéuticos: la lista de lo que quedó sin decidir, la opción de cerrar marcando pendientes, y el cambio de `in_progress` a `completed`, que hoy **nadie pone** (38 abiertas, cero cerradas). La columna Estado de la ficha del paciente **ya existe y ya tiene la etiqueta "Completada"** escrita: solo falta que algo ponga el valor.

---

### 4.5 · La tabla de Wang: los rangos son de HOY, los valores son de ENTONCES

**Hallazgo (2026-08-24).** Los valores de la tabla salen del snapshot sellado, pero la columna de **referencia y Δ** se computa **en vivo** en la página (`indicatorRange` sobre `snapshot.indicators`, con el clasificador de hoy). En la pestaña de Diagnóstico eso es correcto: se mira el caso vivo. En una **historia clínica** no: se mira lo que se decidió entonces, y un documento con **valores viejos y rangos nuevos** miente sin que nada avise.

**DECIDIDO: se marca que los rangos son actuales** (opción C). Las tres que se consideraron:

| Opción | Qué implica | Tamaño |
|---|---|---|
| A · **Sellar los rangos con el reporte** | los rangos entran al snapshot al crear el reporte. Es lo más fiel a "documento clínico"; pero **solo sirve de aquí en adelante** (los reportes ya emitidos no lo tienen, y no se reescriben) y suma campo al snapshot inmutable | media |
| B · **Mostrar la tabla sin referencia** | quita el problema quitando la información. La referencia es justo lo que hace legible un valor: sin ella la tabla pierde su función | chica |
| C · **Marcar que los rangos son los vigentes** | una nota al pie: los valores son los de la evaluación, los rangos son los del modelo vigente hoy. No miente, no borra información, y funciona **también para lo ya emitido** | **chica** |

**Por qué C y no A:** A es mejor en teoría y peor en la práctica, porque deja fuera a todos los reportes anteriores, que son los que más riesgo corren (son los más viejos). C cubre a todos desde el primer día. **Y A sigue disponible después**: si algún día el rango cambia de verdad, sellarlo se vuelve necesario y C ya habrá evitado el daño mientras tanto. Se anota como el disparador que reabre la decisión.

### 4.6 · Las recomendaciones: NO están bloqueadas enteras

Corrección a lo que este plan decía. Verificado en su archivo (L15255-15272): la sección **es condicional por diagnóstico**, con siete bloques posibles:

| Bloque | Se activa con | ¿Portable ya? |
|---|---|---|
| Control glucémico | Diabetes 2 / Prediabetes | **sí** (texto fijo) |
| Control de lípidos | Dislipidemia / Hipertrigliceridemia | **sí** (texto fijo) |
| Alimentación saludable general | **siempre** | **sí** (seis viñetas fijas) |
| Dieta DASH y control de sodio | HTA | no: cita `sodioMax` |
| Nefroprotección (KDIGO 2024) | IRC | no: cita `protKg`/`protG` |
| Preservación de masa muscular | FFMI < 17 | no: cita `protKg`/`protG` |
| Manejo del exceso de grasa | déficit > 0 y sin sarcopenia | no: cita `kcalObjetivo`/`deficit` |

Los cuatro que faltan citan cifras que produce `motorTratNutri`, que es el porte bloqueado. **Los tres primeros se portan ya.** La captura muestra solo el genérico porque el paciente demo no tiene comorbilidades: no es que la sección sea genérica, es que ese caso lo es.

**La sección se muestra SIEMPRE, con su título**, aunque falten los cuatro condicionales: omitirla haría que el documento pareciera completo cuando le falta algo que él sí tiene.

### 4.7 · La firma: qué es, verificado

No hay que decidirlo: su archivo lo resuelve (L15328). **`FIRMA Y FECHA` es una línea en blanco para firmar en papel** (un borde inferior de 32 px de alto), y debajo el nombre del profesional y la fecha. **No es firma gráfica ni acto de firma con marca de tiempo.** Es el pie de un documento que se imprime.

Se porta igual, con **una corrección**: él usa `new Date()` (la fecha de impresión); nosotros usamos la fecha de la evaluación, porque un documento impreso meses después no debe fecharse hoy.

Si algún día hace falta una firma con valor probatorio, ya existe la maquinaria del consentimiento (hash + marca de tiempo + aceptación del medio electrónico); pero eso sería otra decisión, y hoy el documento es para imprimir.

### 4.8 · "Existe pero no llegó al motor": se marca en la sección

Tercera categoría, que no habíamos previsto y que no es un vacío sino una cuestión de **procedencia**. Las cuatro preguntas del bloque de antecedentes (alergias, intolerancias, cirugía metabólica, medicación antihipertensiva) se muestran porque el paciente las declaró, y son ciertas. Lo que no se puede es dejar creer que el diagnóstico las consideró.

**Se marca en la propia sección:** lo declarado por el paciente que el diagnóstico no consumió va señalado, con una nota que lo dice en una línea. Es incómodo a propósito: es lo que va a hacer que se arregle.

**Cuando P-39 se resuelva y las cuatro entren al motor, la marca desaparece sola** si se deriva de la lista de campos que el motor consume, en vez de escribirse a mano. Esa es la forma correcta de construirla (familia de "texto que afirma un estado sin derivarlo").

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
| 5 | Mostrar el motivo de consulta (ya capturado) | **trivial** | 4 |
| 6 | El cierre de la consulta con su lista | media | 1, y la pregunta del nutracéutico |
| 7 | Mover la lista de intercambio del paciente | chica | 1 |

**Total: media, y menor de lo estimado.** Todo es reunir lo que ya está; **lo único nuevo es el cierre**.

---

# 7. La decisión sobre partir `reports` (tomada)

**¿`reports` se parte en dos documentos, uno del diagnóstico y otro del tratamiento?**

- **Si NO se parte:** la HC es una vista que reúne diagnóstico y tratamiento, y el `reports` actual sigue siendo el único documento emitible. Más simple, y suficiente por ahora.
- **Si SÍ se parte:** hay un reporte del diagnóstico (emitible sin prescribir, para remitir) y uno del tratamiento (documenta la prescripción). Eso **reordena T4** y toca la confirmación del diagnóstico, que hoy es efecto lateral de aprobar el reporte.

**DECIDIDO (Santiago, 2026-08-24): NO se parte ahora.** Se construye la pestaña con el reporte que existe. El argumento, tal cual: **partir un documento clínico sin el caso real delante es diseñar para una hipótesis.**

**El disparador que la reabre, escrito para que no se pierda:** cuando aparezca un paciente **al que se remite sin prescribir** (una consulta que emite diagnóstico y termina en remisión, sin protocolo), ese es el caso que pide un reporte del diagnóstico emitible por su cuenta. Ahí se revisa.
