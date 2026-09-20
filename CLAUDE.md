# Cómo se trabaja en este proyecto

Leer esto **antes de tocar nada**. Acá va *cómo* se trabaja; el *porqué* de cada
decisión ya tomada está en [`AGENTS.md`](./AGENTS.md) y lo que falta hacer en
[`docs/pendientes.md`](./docs/pendientes.md).

Las reglas de abajo salieron de trabajar con Marcela y de sus documentos de
`dev/ginialym`. No son las mismas —este proyecto es mucho más chico— pero el
criterio es idéntico.

---

## 1. Qué es esto

Una todo list personal, **"Hoy sí"**, en producción en `tareas.ginialtech.com`.
No es un prototipo: Marcela la usa todos los días y la va a compartir.

**El objetivo no es organizar tareas: es que arranque lo que viene pateando.**
Antes de agregar cualquier cosa, la pregunta es *¿esto ayuda a empezar?* Si no,
no va. Está explicado en el punto 1 de `AGENTS.md` y vale para todo.

---

## 2. Lo que se pregunta SIEMPRE, antes de hacerlo

No es falta de autonomía: es que la consecuencia le llega a ella por fuera del
repo. Se pregunta **antes**, no se avisa después.

| Cosa | Por qué no es del agente |
|---|---|
| **`git push`** | Sale a producción sola. Se pide permiso cada vez, aunque se haya dado hace cinco minutos. |
| **Agregar una dependencia** (`bun add`) | Es código de otro corriendo en producción. Ya entraron tres sin preguntar: `pino`, `firebase-admin`, `firebase-tools`. |
| **Dar de alta un servicio de terceros** | Una cuenta más para mantener y un lugar más donde romperse solo. |
| **Ampliar el pedido** | Una mejora que nadie pidió es algo que ella no sabe que está ahí hasta que se rompe. Se nombra al final y se espera el sí. |
| **Cambiar lo que la gente ve** | Es su producto. |
| **Guardar datos nuevos de personas** | Tiene consecuencias legales que el agente no evalúa. |
| **Borrar archivos o credenciales** | Ver el error de la cuenta de servicio, abajo. |

**Los comandos sí se corren.** Cuando hay terminal, el agente ejecuta: builds,
chequeos, reglas de Firestore, diagnósticos. No se le devuelve tarea a Marcela
para que copie y pegue salidas. **El push es la excepción.**

---

## 3. Lo que NO se hace

- **No se manejan los tiempos de Marcela.** Nada de "dejalo para mañana",
  "descansá", "con la cabeza fresca". Cuánto trabaja lo decide ella. Lo que sí
  es del agente es **no abrumar**: menos cosas por mensaje y un paso por vez.
- **No se toca lo que anda.** Si no está en el pedido, no se toca. Aunque se vea
  mal hecho: se avisa, se anota en `docs/pendientes.md` y se sigue.
- **Nada de parches.** Ni hardcodeo, ni datos inventados, ni `any` suelto, ni
  silenciar una regla del linter sin motivo escrito al lado.
- **No se inventan datos de personas.** Correos, nombres, teléfonos: se
  preguntan. Lo público del proyecto va con `ginialtech@gmail.com`, nunca con la
  cuenta personal. `ginialym.com` es otro proyecto: no se mezcla.

---

## 4. Nada está listo hasta que se probó

**Asumir que está roto hasta demostrar lo contrario.** No se dice "listo" sin:

```bash
bun run check    # tipos — ver la trampa de abajo
bun run build    # compila de verdad
bun run lint     # oxlint
```

Y además **verlo funcionando en el navegador**, no suponerlo.

> ⚠️ **`tsc --noEmit` MIENTE en este proyecto.** `tsconfig.json` tiene
> `"files": []` y solo referencias, así que ese comando no compila nada y sale
> con éxito **aunque el código esté roto**. Verificado rompiéndolo a propósito.
> El comando que sirve es **`bun run check`** (`tsc -b`).

Cuando se prueba contra producción (webhooks de terceros, variables de Vercel),
se dice que se está probando en producción. Lo demás se prueba en local.

---

## 5. Convenciones

- **Gestor de paquetes: `bun`. Nunca `npm`.** `bunx firebase-tools` está roto en
  esta máquina (caché corrupto): usar los scripts de `package.json`.
- **Código en inglés, comentarios en español, UI en español.** Commits en
  español también.
- **Cero jerga técnica en pantalla.** La app se comparte: nadie tiene que leer
  "Firestore", "uid" ni un comando de terminal. El detalle técnico va por
  consola o envuelto en `import.meta.env.DEV`. Ver punto 7b de `AGENTS.md`.
- **Nunca `console.*`**: se usa `log` de `src/lib/logger.ts`. Hay una regla
  `no-console` en oxlint que lo hace fallar.
- **En `api/` los imports relativos llevan `.js`**, aunque el archivo sea `.ts`.
  Es ESM y Node no resuelve sin extensión.
- **El rojo es solo para lo que de verdad se pasó.** Una lista que te reta
  produce más evitación, que es lo contrario de para qué existe la app.

---

## 6. Secretos

- Todo lo que empieza con **`VITE_` es público**: va dentro del JavaScript que
  baja cualquiera. Vercel ni siquiera deja marcarlas como secretas.
- Las claves de verdad (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
  `FIREBASE_SERVICE_ACCOUNT`) **no llevan prefijo** y viven solo en el servidor.
- Antes de commitear algo que las toque, verificar que no entraron al bundle ni
  al repo.
- **Si aparece una credencial, primero se deja la infraestructura andando y
  recién después se limpia.** Ver abajo.

---

## 7. Errores ya cometidos — no repetirlos

Están acá porque cada uno costó tiempo real.

1. **Se borró la cuenta de servicio antes de usarla.** Servía para desplegar las
   reglas sin intervención humana. Se usó para registrar la app web y se borró
   enseguida. Resultado: todo lo que seguía pasó a depender de que Marcela
   corriera comandos, y después hubo que generar otra.
2. **Se le dijo que "las reglas hay que manejarlas del backend" era un error
   suyo, y en parte tenía razón.** Las Security Rules **son** backend (corren en
   los servidores de Google), pero lo que estaba mal de verdad era el
   `allow read, write: if true` que había puesto el agente.
3. **Las reglas leían un campo nuevo sin `.get()`** y rompieron toda escritura
   sobre las tareas viejas: no se podía tachar nada. En Firestore, leer un campo
   que no existe hace fallar la regla entera.
4. **Se festejaba antes de confirmar el guardado.** Confeti y felicitaciones por
   algo que no había pasado.
5. **Las escrituras fallaban en silencio.** Se apretaba "Anotar" y no pasaba
   nada. Ninguna acción puede terminar sin feedback.
6. **`api/` no la chequeaba ningún tsconfig**, así que un import sin extensión
   pasó el build y reventó en producción sin dar pistas.
7. **Se publicó el correo personal de Marcela** en la política de privacidad, sin
   preguntar.
8. **Se afirmó en el login que "no la ve ni quien hizo esta app"**, que era
   falso: quien administra el proyecto tiene acceso técnico a la base.

El patrón de casi todos: **se avanzó sin verificar**. La verificación es parte
del trabajo, no un paso opcional al final.

---

## 8. Dónde vive cada cosa

| Archivo | Qué tiene |
|---|---|
| `CLAUDE.md` (este) | Cómo se trabaja |
| `AGENTS.md` | El porqué de cada decisión ya tomada. **Se actualiza cada vez que se decide algo.** |
| `docs/pendientes.md` | Lo que falta. Lo que se te ocurre en el medio **se anota acá y se sigue con lo que estabas haciendo**. |
| `README.md` | Cómo levantar el proyecto |

---

## 9. Comandos

```bash
bun run dev       # servidor local, http://localhost:5173
bun run check     # tipos (tsc -b) — el que sirve
bun run build     # chequeo + compilación de producción
bun run lint      # oxlint
bun run rules     # desplegar firestore.rules
bun run fb:login  # entrar a Firebase desde la terminal
```
