# Lo que se deshizo: qué hay hoy y qué costaría el panel

**Para Santiago, 2026-09-30. Dimensionado, no construido.**

Sale de tu pregunta a raíz de "una compra devuelta sigue contando como compra": si eso vale, ¿dónde se ve
cuántas se anularon, cuántas se devolvieron y cuántas terminaron en contracargo?

---

## 1. El dato existe entero. Lo que no existe es la cifra agregada

Todo lo que se deshace vive en una sola tabla, `sale_reversals`, con su clase y su estado:

| Clase | Estados posibles | Qué es |
| --- | --- | --- |
| `contracargo` | abierta · ganada · perdida | El banco o el paciente disputa el cobro. Se gana o se pierde |
| `anulacion_wompi` | abierta · ganada · perdida | La pasarela anuló un cobro ya hecho |
| `devolucion` | devuelta | El paciente devolvió producto. No pasa por "abierta": ya volvió |

Y cada fila trae con qué explicarla: la nota escrita, la referencia de la disputa, lo que el banco debitó de
verdad, la línea y las unidades devueltas, quién resolvió y cuándo.

**Hay una cuarta cosa que no está ahí y que conviene no mezclar:** un link de pago **anulado antes de
cobrarse** (`transactions.status = 'failed'` con `cancelled_at`). Ahí nadie compró y nadie devolvió nada; no
se deshizo una venta, se descartó un intento. Contarlo junto con lo demás inflaría "cuánto se deshace" con
algo que nunca se hizo.

## 2. Dónde aparece hoy, y por qué ninguno responde tu pregunta

- **En el dinero de /direccion:** lo perdido y lo devuelto **se restan del bruto**. Correcto, pero invisible:
  el bruto sale más bajo y la pantalla no dice cuánto bajó ni por qué.
- **En los pendientes:** salen las disputas **abiertas** y las que esperan nota crédito en Alegra. Es una
  bandeja de trabajo, no una medición: lo resuelto desaparece de ahí.
- **En la pantalla del profesional:** ve las reversas **de sus propias ventas** (migración 0194). Una por una.

**Así que hoy nadie puede responder "¿cuánto de lo vendido se deshizo, de qué clase y por qué?".** El dato
está completo y no está agregado en ninguna parte.

## 3. Lo que propongo construir

Una sección en /direccion, al lado de la de insights, con cuatro cosas:

1. **Cuántas y cuánto, por clase y estado.** Contracargos abiertos, ganados y perdidos; devoluciones; y
   aparte, los links anulados antes de cobrar.
2. **Sobre cuántas ventas pagadas**, que es lo que convierte el conteo en una tasa legible. Sin denominador,
   "3 devoluciones" no dice nada.
3. **Por qué.** Las notas escritas al abrir el caso, agrupadas como los motivos de venta sin consulta.
4. **Qué producto se devuelve más.** La devolución guarda su línea, así que se puede llegar al producto. Es el
   dato que más le sirve a la dirección científica: un producto que vuelve mucho dice algo.

**Y una que quiero dejar dicha en la pantalla:** esto **no resta** de la sección de insights. Ahí una compra
devuelta sigue contando como compra, porque esa pregunta es si se siguió la prescripción. Aquí la pregunta es
otra. Las dos cifras conviven y la pantalla explica por qué, o alguien las va a cruzar y a concluir mal.

## 4. El tamaño

**Media jornada. No hay migración, y esa es la parte buena:** el dato ya está y está completo, incluida la
huella de quién resolvió qué. Lo que falta es leerlo.

| Pieza | Tamaño |
| --- | --- |
| Un lector de agregados (dos consultas: por clase/estado, y por producto devuelto) | pequeño |
| Una sección de pantalla | pequeño |
| Un candado contra la BD | mediano, y es el que cuesta |

**El candado es la mitad del trabajo, como siempre en esto:** son agregaciones con `filter` y `left join`, la
clase de SQL que compila, corre y devuelve un número **plausible y equivocado**. Aquí un cero de más no rompe
nada: produce una conclusión de negocio falsa, que es peor que un error.

## 5. Lo que no haría

- **Contar los links anulados como ventas deshechas.** Van, pero en su propia línea y con su nombre.
- **Restarlo de los insights.** Dicho arriba: son dos preguntas distintas.
- **Meterlo en el smoke de ahora.** Es una pantalla de lectura sobre datos que ya existen; no bloquea nada y
  se puede construir después del arranque.
