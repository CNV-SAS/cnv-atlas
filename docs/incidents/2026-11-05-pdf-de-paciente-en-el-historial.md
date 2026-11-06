# PDF de informes de paciente en el historial de git (y en GitHub)

**Connected Nutrition Ventures · Atlas · 5 de noviembre de 2026**
**Estado:** LIMPIEZA EJECUTADA EN LOCAL el 5 de noviembre. Falta **un solo paso, y es de Santiago**: el
push forzado del punto 4.5. Hasta que lo haga, el remoto sigue teniendo los once PDF.
**Responsable de respuesta:** Santiago (SECURITY.md, "Respuesta a incidentes").
**Decisiones tomadas:** sección 6.

---

## 1 · Qué pasó

El 5 de noviembre metí `docs/entregas/cotejo-visual/SUGERENCIA_INFORME_ANBISE.pdf` en el commit `b893efe3`
con un `git add -A` de una tanda de trabajo. Ese archivo **es un informe de paciente**: lleva nombre
completo, número de documento, fecha de medición y cifras clínicas. La carpeta `docs/entregas/` tenía regla
de `.gitignore` para `.xlsx`, `.csv` y `.docx`, pero **no para `.pdf`**.

Reporté que no había llegado a GitHub porque el push lo hace Santiago al final. **Ya había hecho push**, así
que el archivo está en el repositorio remoto (privado).

**Y al preparar la limpieza salió lo que de verdad importa: ese PDF no es el único ni el primero.**

---

## 2 · El alcance real, verificado

Once blobs `.pdf` distintos en el historial completo, en cinco commits, **desde el 1 de septiembre**:

| Commit | Fecha | Archivos |
|---|---|---|
| `e406a1c0` | 2026-09-01 | 4 (`(local)`/`(web) Resultados - Atlas`, dos `reporte-<uuid>`) |
| `02f0036a` | 2026-09-02 | 2 (`HC descargar-imprimir`, `HC enviada al correo`) |
| `80e9b64e` | 2026-09-02 | 2 (los dos anteriores, versión 2) |
| `1d49aa9c` | 2026-09-03 | 2 (`Reporte de la subpestaña nutricionista`, `Reporte ver preview de pestaña Reporte-HC`) |
| `b893efe3` | 2026-11-05 | 1 (`SUGERENCIA_INFORME_ANBISE`) |

Todos salvo el último están bajo `docs/entregas/cotejo-visual/reportes/`.

**Los once son documentos de paciente, y eso no es una suposición:** son las salidas de impresión del
informe y de la historia clínica de Atlas, y las dos plantillas imprimen el rótulo `Documento` en su caja
de identidad (`src/modules/reports/pdf/report-document.tsx:182`,
`src/modules/reports/pdf/plan-document.tsx:73`, más el encabezado de `hc-document.tsx`). Cuatro llevan
además capturas JPEG de la pantalla, que muestran lo mismo.

**Lo que sí hay que decir con precisión:** el repositorio es **privado** y, por los refs del remoto, no hay
forks, ni ramas abiertas, ni tags, ni más colaboradores con push que Santiago. Es una exposición a quien
tenga acceso al repositorio, no una publicación abierta.

**La decisión que no es nuestra:** si esto activa el deber de notificación a la Superintendencia de
Industria y Comercio (SECURITY.md, paso 3: quince días hábiles desde la detección). Son dos meses de datos
de paciente en un remoto, aunque privado y con acceso restringido. Lo decide Santiago con el asesor
jurídico, no el equipo técnico, y la fecha de detección es hoy, 5 de noviembre de 2026.

---

## 3 · Lo que ya está hecho

- `docs/entregas/**/*.pdf` en `.gitignore` (línea 96), con su razón escrita al lado. **Verificado que
  cubre toda la carpeta a cualquier profundidad**, con `git check-ignore -v` sobre cuatro rutas:
  `docs/entregas/suelto.pdf`, `cotejo-visual/x.pdf`, `cotejo-visual/reportes/y.pdf` y `a/b/c/z.pdf`. Las
  cuatro caen en la regla.
- El archivo de hoy fuera del índice (`git rm --cached`); sigue en el disco para poder trabajarlo.
- Los tres PDF que hoy están en el disco (el de la sugerencia y dos en `docs/entregas/dudas/`) quedan
  ignorados por esa regla, y los de `dudas/` además por `docs/entregas/dudas/**`.

---

## 4 · La limpieza del historial, paso a paso

### 4.1 · Antes de tocar nada: lo que hay que verificar

1. **Que nadie más tenga un clon o una rama abierta.** Es lo único que puede deshacer el trabajo: un
   `push --force` no llega a los clones de otros, y si alguien empuja después desde un clon viejo, **los
   PDF vuelven**. Verificado hoy desde aquí: el remoto tiene un solo ref (`refs/heads/main`), sin tags.
   Falta lo que solo se ve en GitHub, y es Santiago quien tiene que mirarlo:
   - `Settings > Collaborators`: quién tiene acceso con push.
   - `Insights > Forks`: un fork conserva los objetos y **no se reescribe** con el force push.
   - `Pull requests` (incluidas las cerradas): los refs de merge de una PR mantienen vivos los objetos
     viejos y tampoco se reescriben.
   - Que nadie tenga un Codespace o un clon en otra máquina con trabajo sin empujar.
2. **Un respaldo antes de reescribir.** Un espejo completo, fuera del repositorio:
   ```powershell
   git clone --mirror https://github.com/CNV-SAS/cnv-atlas.git "$env:USERPROFILE\Respaldos\cnv-atlas-antes-de-limpiar.git"
   ```
   Ese espejo **también contiene los PDF**, así que es un archivo sensible: va fuera de cualquier carpeta
   sincronizada, y se borra cuando la limpieza esté confirmada.
3. **Árbol de trabajo limpio** (`git status` sin nada pendiente) y todo comiteado.

### 4.2 · La reescritura

`git filter-repo` es la herramienta recomendada hoy, pero necesita Python, y en esta máquina **no hay
Python ni Java** (comprobado), así que BFG tampoco. `git filter-branch` viene con Git for Windows y está
disponible ahora mismo; con 1.995 commits y 20 MB de `.git` tarda unos minutos, no horas.

En PowerShell, desde la raíz del repositorio:

```powershell
$env:FILTER_BRANCH_SQUELCH_WARNING = "1"
git filter-branch --force --index-filter 'git rm -r --cached --ignore-unmatch "docs/entregas/*.pdf"' --prune-empty --tag-name-filter cat -- --all
```

Tres cosas de esa línea, porque no son evidentes:

- **`docs/entregas/*.pdf` alcanza las subcarpetas.** En un pathspec de git el `*` cruza las barras, así que
  esa única expresión toma los once, incluidos los de `cotejo-visual/reportes/`. Verificado contra dos
  commits del historial (`e406a1c0` y `b893efe3`): el pathspec los lista.
- **`-- --all`, no un rango.** El primer PDF entró el 1 de septiembre, 790 commits atrás, así que limpiar
  solo lo de hoy no sirve de nada.
- **`--prune-empty`** descarta los commits que se queden sin ningún cambio. Ninguno de los cinco lo hará
  (todos traían código además del PDF), pero es la red por si acaso.

### 4.3 · Borrar lo que queda apuntando a lo viejo

`filter-branch` deja los commits originales accesibles en `refs/original/`, y el reflog también:

```powershell
git for-each-ref --format="%(refname)" refs/original | ForEach-Object { git update-ref -d $_ }
git reflog expire --expire=now --all
git gc --prune=now
```

### 4.4 · Comprobar antes de empujar

Las dos tienen que salir vacías:

```powershell
git log --all --oneline -- "docs/entregas/*.pdf"
git rev-list --objects --all | Select-String "\.pdf$"
```

Y que el árbol de trabajo siga igual (la reescritura cambia el historial, no el contenido de hoy):

```powershell
git status
git log --oneline -3
```

Los identificadores de los commits cambian. El contenido, no.

### 4.5 · El push forzado

```powershell
git push --force-with-lease=main:21622f2d38bc215c2ffe83681163eaf8f5bd2285 origin main
```

**Dos avisos, y los dos salieron de ejecutar la limpieza de verdad (no estaban en la versión preparada):**

1. **El `--force-with-lease` a secas ya no sirve, y no por un detalle.** La reescritura corrió contra
   `-- --all`, que incluye las ramas de seguimiento, así que `origin/main` **local** quedó reescrito
   (de `21622f2d` a `79492075`). Un `--force-with-lease` sin argumento compara el remoto contra ese
   valor local y fallaría siempre. La forma explícita de arriba dice *"el remoto tiene que estar
   exactamente en `21622f2d`"*, que es el valor **verificado hoy** con `git ls-remote`, y es un freno
   mejor: no depende de cuándo se hizo el último fetch.
2. **NO hacer `git fetch` antes del push.** Un fetch traería de vuelta el `origin/main` real, y con él
   **los once PDF volverían al clon local**, que es justo lo que se acabó de limpiar. Después del push
   el fetch es inofensivo.

   **Y esto no es hipotético: pasó el mismo 5 de noviembre, una hora después de limpiar.**
   `scripts/check-migrations.mjs` hace `git fetch --quiet origin` en su línea 73, como mejora para poder
   avisar si el árbol está atrasado. Correrlo como paso normal de verificación del bloque devolvió
   `origin/main` a `21622f2d` y los once blobs al clon. Se rehízo la limpieza (ver abajo) y se verificó
   otra vez.

   **Mientras el push no esté hecho, cualquier cosa que haga `fetch` reintroduce los objetos**, incluido
   un comando propio que lo hace por conveniencia. Los conocidos: `pnpm db:check` / `db:check:cloud` (vía
   `check-migrations.mjs`) y, obviamente, `git pull`. Después del push forzado el riesgo desaparece,
   porque lo que trae el fetch ya es el historial limpio.

   Si vuelve a pasar antes del push, la reparación es esta y no hace falta reescribir nada otra vez:

   ```powershell
   git update-ref refs/remotes/origin/main 79492075
   git update-ref refs/remotes/origin/HEAD 79492075
   git reflog expire --expire=now --all
   git gc --prune=now
   git rev-list --objects --all | Select-String "\.pdf$"   # debe salir vacio
   ```

Si el push falla con *"stale info"*, es que algo se movió en el remoto: no forzar, mirar qué fue.

### 4.6 · Lo que el push forzado NO arregla, y hay que hacer aparte

1. **GitHub conserva los objetos viejos.** Quedan inalcanzables desde cualquier rama, pero siguen
   recuperables por su identificador hasta que GitHub recoja la basura, y eso no pasa por pedirlo con un
   comando. Hay que **abrir un ticket a GitHub Support** pidiendo la purga de los objetos inalcanzables
   del repositorio `CNV-SAS/cnv-atlas`, citando que contienen datos personales de salud.
2. **Los clones ajenos siguen teniéndolos.** Quien tenga un clon tiene que borrarlo y volver a clonar; un
   `git pull` sobre un clon viejo no limpia nada y puede reintroducirlo.
3. **El respaldo del punto 4.1.2 contiene los PDF.** Se borra cuando esto esté cerrado.

---

## 5 · Mitigación para que no se repita

- La regla de `.gitignore` ya cubre los PDF de `docs/entregas/`, que es por donde llegaron las dos veces
  (hay un commit anterior titulado *"drop the report PDFs of the previous round"*: la carpeta ya había
  dado el aviso y la regla seguía sin cubrirlos).
- **CONSTRUIDO (5 de noviembre): `scripts/check-entregas.mjs`, con lista de lo PERMITIDO.** A
  `docs/entregas/` solo entra `.md`, `.sql`, `.js` y `.json`, que es lo que se revisa en un diff; todo lo
  demás se rechaza, incluido el formato que nadie ha previsto todavía. Corre en el gancho
  `.githooks/pre-commit` (se activa con `git config core.hooksPath .githooks`, en `DEPLOY.md` punto 1) y
  además sobre todo lo versionado con `pnpm check:entregas`, que entró a `pnpm verify`.
  - Lo que ya estaba versionado (siete `.docx`, doce HTML, un CSV) queda excepcionado **por nombre**,
    porque sacarlos es otra decisión y tiene su consecuencia (un clon nuevo se queda sin las
    especificaciones de Gildardo). Los veinte se barrieron antes de excepcionarlos: ninguno lleva
    identidad de paciente (sección 6.1).
  - Candado: `src/tests/el-control-de-entregas-muerde.test.ts`, 9 casos, que **ejecuta** la decisión
    (no lee el archivo) y además afirma que el gancho sigue llamando al control y que ningún `.pdf`
    aparece en la lista de excepciones.
- **Por qué una lista de lo permitido y no una de lo prohibido.** La de prohibidos se escribió tres
  veces, cada una después del archivo que la estrenó: los Excel el 2 de octubre, los HTML el 22 de
  octubre, los PDF hoy. Una lista de prohibidos va siempre un formato por detrás del siguiente archivo
  que llega, y `git add -A` no pregunta.

---

## 6 · Las decisiones, tomadas el 5 de noviembre

### 6.1 · Se barrió el historial buscando OTROS archivos con datos de paciente, no solo PDF

Antes de reescribir se miró **todo el historial**, no la carpeta de hoy, porque una sola reescritura es
barata y dos no. Todos los blobs de riesgo que existen en los 2.002 commits:

| Formato | Cuántos | Veredicto |
|---|---|---|
| `.pdf` | **11** | Documentos clínicos. **Salen** (sección 2). |
| `.docx` | 7 | Documentos de Gildardo. Texto extraído y medido: **cero** rótulos de identidad, **cero** números de 7 a 11 dígitos. El único número largo del de la especificación v7 es un fragmento de UUID junto a dos edades, que es seudónimo. Se quedan. |
| `.html` | 20 | Sus prototipos y nuestro exportador. Medidos: los únicos números largos son el id de un modelo de IA, un `z-index` y los milisegundos de un día. Las 14 apariciones de "cédula" son **los rótulos del formulario**, no datos. Se quedan. |
| `.csv` | 1 | `cohorte_AEC_ACT_2026-08-18.csv`: 5.885 filas, columnas `n, sexo, edad, ACT_L, AEC_L, AEC_pct_ACT, Re_ohm, Rinf_ohm`. **Seudonimizada, sin un solo identificador.** Se queda. |
| `.xlsx` | 2 | `src/tests/fixtures/biody_synthetic.xlsx` y `biody-bis-male-synthetic.xlsx`: sintéticos. Se quedan. |
| `.png` | 4 | Logos de marca y el icono de la app. Se quedan. |

**Nada de esto se verificó imprimiendo datos de paciente:** se contaron rótulos y patrones, y los
contextos que se miraron salieron con los dígitos enmascarados.

### 6.2 · No se notifica a la SIC (decisión de Santiago)

**Su razón:** el repositorio es privado, nadie más tiene acceso, y los datos expuestos son nombre y
documento, que en Colombia no son reservados.

**Lo que queda dicho, para que la decisión esté completa:** lo que hace sensible al conjunto no es el
nombre ni la cédula por separado, es que van **unidos a datos de salud** (edad biológica, composición
corporal, diagnóstico), y eso sí es dato sensible del artículo 5 de la Ley 1581. La decisión se sostiene
igualmente sobre la otra pata, que es la que importa aquí: **no hubo acceso de un tercero**. Si Santiago
quiere certeza y no criterio, la consulta es de quince minutos con el asesor jurídico, y el plazo de los
15 días hábiles corre desde hoy.

### 6.3 · No se abre ticket a GitHub (decisión de Santiago)

**Su razón:** a los objetos inalcanzables solo llega quien tenga acceso al repositorio, y ese es él.

**Lo que eso deja en pie, dicho sin adornos:** los once blobs seguirán recuperables por su identificador
en los servidores de GitHub hasta que GitHub recoja la basura por su cuenta, y eso no tiene fecha. Es un
riesgo acotado a quien ya tiene acceso al repositorio privado, que es exactamente el mismo conjunto de
personas que podía verlos antes. **La decisión no cambia quién puede ver qué**; solo deja de cerrar la
puerta del todo.

### 6.4 · Se limpió el historial, y esto es lo que pasó

- **Respaldo**, fuera del repositorio, verificado (`git bundle verify`: *"records a complete history"*):
  `C:\Users\sarro\respaldo-atlas-antes-de-limpiar-2026-11-05.bundle` (13,5 MB). **Contiene los once PDF.**
  Se borra cuando el push esté hecho y comprobado:
  ```powershell
  Remove-Item "C:\Users\sarro\respaldo-atlas-antes-de-limpiar-2026-11-05.bundle"
  ```
- **La reescritura** corrió `git filter-branch --index-filter` contra `-- --all`: 2.002 commits en
  16 minutos.
- **`main` pasó de `f5de2c2b` a `4b6ddf5a`**, y `origin/main` local de `21622f2d` a `79492075`.
- **Un commit desapareció, y es correcto:** `a59ff328` *("chore(cotejo): drop the report PDFs of the
  previous round")* no hacía más que borrar PDF, así que al sacarlos del historial quedó vacío y
  `--prune-empty` lo retiró. 2.002 commits pasaron a 2.001.
- **El contenido actual no cambió en nada:** `git diff f5de2c2b 4b6ddf5a` sale **vacío**. Era de esperar
  (en `HEAD` no quedaba ningún PDF rastreado), y comprobarlo es lo que distingue "limpié el historial" de
  "perdí algo sin saberlo".
- **Las tres comprobaciones, después del `gc`:**
  1. `git log --all --oneline -- "docs/entregas/*.pdf"` → vacío.
  2. `git rev-list --objects --all | Select-String "\.pdf$"` → vacío.
  3. `git cat-file -t f5de2c2b` y `git cat-file -t 21622f2d` → *"Not a valid object name"*: los commits
     viejos ya no existen ni como objeto suelto.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
