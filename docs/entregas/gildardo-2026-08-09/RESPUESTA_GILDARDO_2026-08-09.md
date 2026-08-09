# Respuesta al paquete del 2026-08-08

**De:** Gildardo Uribe — Dirección Científica CNV
**Para:** Santiago
**Fecha:** 9 de agosto de 2026

Respondo las 17 preguntas. Ninguna queda abierta.

Antes, dos cosas que cambian trabajo ya planificado y conviene leer primero:

- **El punto 15 no es un conflicto de reglas**, es una colisión de nombres. No hay que elegir: hay que renombrar. Ver §15.
- **El C6 no requiere cifras nuevas de mi parte**: ya están en mi archivo. Las transcribo en §1 para que las tomen de ahí. Lo que sí cambia es **de dónde sale el déficit**, y eso corrige una decisión ya firmada. Ver §1 y la nota sobre D-002.

---

## Sobre la PARTE 1 — ratificación con dos enmiendas

Ratifico las decisiones D-001 a D-016 **salvo D-002**, que necesita dos correcciones antes de firmarse. Las demás quedan tal como están redactadas.

**Enmiendas a D-002:**

1. **El déficit o superávit calórico sale del peso meta**, el que fijan profesional y paciente en el módulo de Antropometría. No de un déficit fijo por fenotipo. Hoy el motor aplica −500 kcal en obesidad como valor fijo; eso debe reemplazarse por el cálculo derivado de la diferencia entre peso actual y peso meta.
2. **La salvaguarda de TCA no es un requisito duro que bloquee el plan.** Ver §5: genera alerta, no anula el déficit.

Con esas dos correcciones, D-002 queda ratificada.

Confirmo además que **D-016 está implementada y verificada**: el ángulo de fase se muestra con un decimal en los siete sitios donde aparece.

---

## PARTE 2 — Respuestas

### 1. C6 — proteína y sobrecosto calórico por condición

**No hacen falta cifras nuevas: ya están en mi archivo**, en la función `motorTratNutri`. Las transcribo para que las porten desde ahí y no se reconstruyan de memoria.

**Definiciones operativas.** Las condiciones no se leen solo del diagnóstico escrito: se derivan también de la composición corporal. Esto importa porque un paciente sin diagnóstico registrado puede activar igual el protocolo.

| Condición | Cómo se determina |
|---|---|
| Obesidad | IMC ≥ 30 **o** FMI > 6 (H) / > 9 (M) |
| Sarcopenia | FFMI < 17 (H) / < 15 (M) **o** ASMI < 7,0 (H) / < 5,5 (M) |
| Desnutrición | IMC < 18,5 |
| HTA, DM2, dislipidemia, ERC, cáncer | del diagnóstico registrado en la encuesta |

**Proteína, en g/kg:**

| Condición | Proteína | Régimen |
|---|---|---|
| Sin condición específica | 1,0 g/kg | normocalórica |
| Cáncer activo o desnutrición | 1,25 g/kg | hipercalórica |
| Obesidad | 1,3 g/kg | hipocalórica |
| Obesidad **con** sarcopenia | 1,4 g/kg | hipocalórica, preserva masa magra |
| Sarcopenia sola | 1,4 g/kg | normocalórica + fuerza obligatoria |
| **Enfermedad renal crónica** | **0,7 g/kg** (rango 0,6–0,8) | bajo guía de nefrología |

**Regla de precedencia: la ERC manda sobre la proteína alta.** Un paciente con ERC y sarcopenia va a 0,7, no a 1,4.

**La proteína se calcula sobre el peso meta** (`protG = protKg × pesoMeta`), no sobre el peso actual.

**Energía:**

| Situación | Cálculo |
|---|---|
| Cáncer activo o desnutrición | **27,5 kcal/kg** de **peso actual** |
| Resto de casos | GET − déficit |
| Piso, **solo cuando hay déficit** | **1.500 kcal** (H) · **1.200 kcal** (M) |

El arranque de **10–15 kcal/kg** por riesgo de realimentación (ASPEN, vigilando fosfato, potasio y magnesio) es una **nota clínica para el profesional**, no un cálculo que el motor aplique. Que quede así.

**Grasa:** 25 % del valor calórico en dislipidemia, 30 % en el resto. Con dislipidemia, además, grasa saturada por debajo del 7 %.

**Sodio:** hay **tres vías** que fijan el límite, y siempre queda el más restrictivo:

| Origen | Límite |
|---|---|
| Hipertensión | 1.500 mg + patrón DASH |
| ERC | 2.000 mg |
| Alteración hídrica (IEHH > 1, AEC/ACT > 44 % o sed reportada) | 2.000 mg, solo si no hay ya otro límite |

**Diabetes tipo 2** no cambia cifras: añade carbohidratos controlados y bajo índice glucémico como atributos del plan.

**Tres cosas que hay que mirar antes de portar esto:**

1. **El gasto se calcula sobre el peso actual, no sobre el peso de referencia.** D-002 dice "Mifflin sobre el peso de referencia", pero el motor usa `pesoAct`. Son cosas distintas y hay que decidir cuál queda. Mi criterio: el gasto basal es una medición del cuerpo que existe hoy, así que **peso actual es lo correcto**; lo que debe salir del peso meta es el déficit, no el gasto. Corrijan la redacción de D-002 en ese punto.
2. **Existe un peso ajustado que se calcula y no se usa.** `pesoAjust = PI + 0,25 × (peso actual − PI)` para IMC ≥ 25. Se devuelve pero no entra en ningún cálculo. O se usa o se retira; hoy es código muerto que confunde.
3. **El peso meta tiene un valor por defecto.** Si el profesional no lo fija, el motor usa el **peso ideal de Lorentz** —H: `talla−100−((talla−150)/4)`; M: `talla−100−((talla−150)/2,5)`— cuando el IMC está fuera de 18,5–25, y el peso actual en caso contrario. Como la proteína se calcula sobre ese peso, un peso meta no fijado cambia la prescripción sin que nadie lo note. **Ese default hay que hacerlo visible en pantalla.**

**La corrección importante.** Hoy el déficit es un valor fijo (500 kcal en obesidad). **Debe derivarse del peso meta.** El profesional y el paciente acuerdan el peso meta en Antropometría, y de esa diferencia sale el déficit o el superávit. El fenotipo puede seguir sugiriendo un valor inicial, pero **el peso meta lo reemplaza en cuanto está fijado**.

Esto también resuelve el sentido de D-001: si no hay peso de referencia registrado, no hay de dónde sacar el déficit, y por eso no se prescribe.

### 2. Nutracéuticos — P2 y P3

**Los nutracéuticos se envían según el modelo existente. Ese modelo no ha cambiado.**

No hay manual nuevo que entregar. El motor que hoy produce la recomendación por ruta **es** la referencia vigente. P2 queda cerrado: no está pendiente de mi lado, estaba pendiente de una aclaración que doy aquí.

Si al portarlo encuentran un comportamiento que no cuadra, tráiganmelo como caso concreto y lo reviso; pero no hay documento adicional esperando.

### 3. Las dos referencias del Biody BIS (`MCA_ref` y `hidSG_ref`)

**Les entrego la tabla por sexo y edad.** Queda de mi lado.

Hasta que llegue: **dejen esas salidas vacías, nunca degradadas en silencio.** El ISCM y las dos señales celulares que dependen de ellas no se emiten. Es preferible una casilla vacía a un índice calculado con una referencia inventada.

**Dos precisiones sobre su premisa:**

- Dicen que las identidades de derivación son *"justo lo siguiente que vamos a construir"*. **Ya están construidas** en el v8: la función `derivarFaltantes` con las identidades verificadas sobre los 5.073 registros, más una cadena de rescate de cuatro niveles que resuelve además el problema de los encabezados cambiantes del export. Está todo documentado en el técnico del v8 que les envié. No hay que diseñarlo, solo portarlo.
- **El punto 3 y el punto 17 son la misma pregunta.** `MCA_ref` y `hidSG_ref` son dos de las siete constantes que marqué como no aprobadas. Cuando entregue la tabla, esas dos salen de esa lista; las otras cinco siguen sin usarse.

### 4. Factor de actividad

**Confirmado: sigan mi archivo.** El factor que calcula el motor de ejercicio (moderado si hay obesidad, ligero en el resto) entra como valor por defecto y el profesional puede cambiarlo. No usen valor fijo ligero.

### 5. Salvaguarda de TCA

**Primero una aclaración de nomenclatura, porque en el paquete se prestó a confusión: TCA es Trastorno de la Conducta Alimentaria. No tiene ninguna relación con el ICA-BIS, que es la carga alostática.** Son cosas distintas y no deben mezclarse en la documentación.

**La conducta correcta:** cuando hay riesgo de trastorno de la conducta alimentaria, **la decisión sigue partiendo del peso meta, igual que en cualquier otro caso**, y **se genera la alerta**.

**Esto corrige lo que hay hoy.** El motor actual anula el déficit (`pausadoTCA` lo pone en cero) y fuerza dieta normocalórica. Eso no es lo que corresponde: el plan no se bloquea. Lo que hace el sistema es **avisar** —al profesional, con la marca de remisión— y el peso meta acordado sigue gobernando el cálculo.

Ya está corregido en el prototipo (v8). Falta aplicarlo en la versión en línea.

### 6. La cita del "empeoró"

**Sí: la fecha debe aparecer en el reporte del paciente.**

No basta la frase genérica "tu profesional revisará contigo el plan en la próxima consulta". Si se le comunica un empeoramiento, tiene que ver **cuándo** va a ser revisado. El campo de fecha cumple el requisito; no hace falta agenda con recordatorios.

### 7. La pregunta de cirugías

**Solo registro clínico.** Colecistectomía, bariátrica, resección intestinal y gastrectomía se guardan en la historia y el profesional las ve, pero **no modifican ningún cálculo del motor nutricional**.

Pórtenla como pregunta y déjenla ahí.

### 8. Suspensión por encuesta incompleta

**Cualquier dominio que falte suspende las tres salidas** que dependen de la encuesta: edad bioeléctrica, índice contextual y rutas derivadas.

No hagan un mapa de dependencias por dominio. Es más conservador y evita el caso peor: emitir una ruta calculada sobre información que no se recogió.

El diagnóstico bioeléctrico —el de la medición— sí se emite, como ya está en D-007.

### 9. Redacción de "conducta propia"

El problema no es solo de redacción: es que **el reporte está repitiendo lo que ya dicen las rutas**.

**Lo que debe hacer:** si varias rutas remiten al médico, el reporte **no repite ruta por ruta**. Consolida en una sola línea:

> **Remisión al médico para** *(resumen de todo lo que las rutas envían al médico)*

Y lo mismo con cada profesional: una línea por profesión, con el resumen de lo que se le remite. Cuando la remisión es a la propia profesión del que atiende, esa línea no dice "remisión" sino que queda como conducta propia dentro de su plan.

Así el profesional lee un resumen por destinatario, no una lista repetida.

### 10. Nombres de los indicadores

Estos son los correctos. Que quede uno solo por indicador, en todas las vistas:

| Sigla | Nombre correcto |
|---|---|
| **IFC** | Índice de Función Celular |
| **IRC** | Índice de Riesgo Celular |
| **PABU** | Proporción Áurea Bioeléctrica de Uribe |
| **ISCM** | Índice de Susceptibilidad Cardiometabólica |
| **IEHH** | Índice del Estado de Hidratación Humana |

Descarten "Fuerza Celular", "distancia a la proporción áurea", "multicomponente", "espectro de hidratación" y "equilibrio hídrico". Son variantes viejas.

### 11. Dos detalles de display

**(a) Severidad por dominio: Leve / Moderado / Alto.** Manda el clasificador, coherente con D-015. Descarten "Vigilancia / Crítico".

**(b) IRC: se muestra crudo.** Aquí me corrijo yo: el ×10 forma parte de **la fórmula**, no de la presentación. Lo que se muestra es el dato final, sin escalar. **Ustedes lo tienen bien; la que hay que corregir es mi tabla de display.**

### 12. Campos sociodemográficos

**(a) Ninguno alimenta el modelo.** Etnia, nivel educativo, ocupación, estado civil, estrato y motivo de consulta son **solo caracterización** para el observatorio. No entran en ningún cálculo ni ruta.

**(b) La etnia sí es necesaria.** El observatorio la requiere y no se puede reconstruir después. Eso implica **ampliar el consentimiento informado antes de pedírsela a ningún paciente**, porque es dato sensible bajo la ley colombiana. No la capturen hasta que el consentimiento esté ampliado.

### 13. Calibración de la edad bioeléctrica y el índice contextual

**La edad bioeléctrica se basa en lo último que trabajamos, tal como está en el HTML.** El ICEC es el componente contextual que afecta la edad biológica; ese es su papel y no cambia.

**Sobre su pregunta: si el mapeo se activa, las constantes no pueden quedarse intactas. No tendría sentido.** Se recalibran junto con el mapeo, en el mismo acto.

Revisé el archivo y confirmo lo que ya está anotado ahí, que es más grave de lo que parece:

- La ecuación **EB-BIS v5** es `41,438 + 1,082·z(IFC) + 2,837·z(PABU) − 7,982·z(ICEC)`, con el ICEC estandarizado contra **μ = 58,578 y σ = 13,332**.
- El mapeo del ICEC **está roto en producción**: lee tres campos (`d1_9`, `d1_10`, `d1_16`) que **no existen en la encuesta**. En pacientes reales devuelven 0, y los dominios de Alimentación e Hidratación quedan clavados en 30 y 20 **para todos**.
- El mapeo correcto ya está implementado detrás de la bandera `LE8_MAPEO_CORREGIDO`, hoy en `false`: Alimentación → `calcPatron(enc).score`, Hidratación → `enc.d7_agua`.
- **Activarlo baja la edad bioeléctrica de todos los pacientes entre 1 y 8 años**, más cuanto más sano esté el paciente, porque el ICEC deja de estar artificialmente deprimido.

**Por eso μ y σ tienen que recalcularse antes o al mismo tiempo.** Si esas constantes se obtuvieron sobre el ICEC ya roto, llevan el sesgo dentro, y activar el mapeo sin tocarlas dejaría a todos con una edad biológica demasiado joven.

**Lo que hace falta:** recalcular μ y σ del ICEC sobre la base con el mapeo corregido. Eso es un cálculo sobre nuestros datos, no una decisión de diseño. Mientras no exista, **la bandera se queda en `false`** y D-006 sigue vigente.

Ya quedó anotado en el prototipo, junto a la bandera, para que la activación sea un cambio de una línea el día que tengamos las constantes nuevas.

### 14. Alcohol y contaminantes ambientales

**Solo caracterización.** Se siguen capturando para el observatorio pero no modifican ningún cálculo ni ruta. El punto queda cerrado.

### 15. Coherencia de la ruta R2

**No hay incoherencia. Hay una colisión de nombres, y las dos definiciones son correctas.**

Lo verifiqué en el archivo. Son dos objetos distintos que comparten los mismos códigos. Y al revisarlo apareció un tercer problema que no habían reportado: el eje de función y riesgo estaba usando **dos prefijos distintos** en dos partes del código.

**Como estaba:**

| Eje | Qué mide | Código |
|---|---|---|
| FFMI × FMI | índice de masa libre de grasa × índice de masa grasa — **estructura** | `R1–R9` ← choca con las rutas |
| IFC × IRC | **Mapa FyR BIS** — función y riesgo | `A1–A9` en un bloque, `S1–S9` en otro |
| Rutas de atención | plan de intervención | `R1–R6` |

**Como queda, y ya está aplicado en el prototipo:**

| Eje | Código nuevo |
|---|---|
| FFMI × FMI — estructura | **`E1–E9`** |
| IFC × IRC — Mapa FyR BIS | **`A1–A9`** en todo el sistema |
| Rutas de atención | **`R1–R6`**, sin cambios |

Así la letra `R` queda reservada para las rutas, que es donde el código tiene sentido clínico, y el Mapa FyR BIS deja de tener dos nombres.

**Los datos ya guardados no se reescriben.** Las consultas anteriores llevan el código viejo (`radioId = "R4"`, por ejemplo). Se traducen **al mostrarlas**, con una función que convierte `R1–R9` a `E1–E9` en los tres sitios donde se imprime: reporte HC, informe imprimible y ficha resumen. Un reporte antiguo y uno nuevo se leen igual, y ningún registro de paciente se modifica.

Repliquen el mismo esquema en la versión en línea, incluida la traducción al mostrar.

### 16. Mi HTML como referencia

**Lo mantengo al día** con las modificaciones autorizadas, para que siga sirviendo de banco de pruebas frente a la versión en línea.

### 17. Material sin urgencia

- **Las 7 constantes de referencia poblacional siguen sin usarse**, como pedí. Dos de ellas (masa celular activa e hidratación sin grasa) quedan resueltas cuando entregue la tabla del §3; las otras cinco siguen fuera hasta nueva orden.
- La lista de indicadores que miden lo mismo y alertan juntos queda pendiente de mi revisión. No bloquea nada.

---

## Resumen de lo que cambia para ustedes

| Punto | Efecto sobre el trabajo |
|---|---|
| §1 C6 | **Desbloqueado.** Cifras en mi archivo. Cambia el origen del déficit: sale del peso meta. |
| §2 Nutracéuticos | **Cerrado.** No hay manual pendiente; el modelo actual es el vigente. |
| §3 Referencias | Tabla de mi lado. Salidas vacías mientras tanto. Las identidades **ya están construidas** en el v8. |
| §5 TCA | **Corrige el comportamiento actual**: alerta, no bloqueo. |
| §9 Conducta propia | Rehacer el reporte como resumen por destinatario, no lista por ruta. |
| §11b IRC | Ustedes lo tienen bien; se corrige mi tabla. |
| §12 Etnia | Ampliar consentimiento antes de capturarla. |
| §13 EB-BIS | Recalcular μ y σ sobre la base con el mapeo corregido. Bandera en `false` hasta entonces. |
| §15 R2 | **No es elegir, es renombrar.** Estructura → E1–E9; Mapa FyR BIS unificado en A1–A9; rutas siguen R1–R6. Códigos viejos se traducen al mostrar. |

Las dos enmiendas a D-002 (§1 y §5) tocan decisiones ya firmadas. Con ellas incorporadas, ratifico el resto del bloque.
