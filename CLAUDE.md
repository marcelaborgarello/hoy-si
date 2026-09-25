# Cómo se trabaja en este repositorio

Guía para cualquier persona —o agente— que vaya a tocar este código. Acá va el
*cómo*. El *porqué* de cada decisión ya tomada está en [`AGENTS.md`](./AGENTS.md)
y lo que falta hacer, en [`docs/pendientes.md`](./docs/pendientes.md).

---

## 1. Qué es esto

**"Hoy sí"**, una lista de tareas en producción en `tareas.ginialtech.com`. No es
un prototipo: se usa todos los días y se comparte con otras personas.

**El objetivo no es organizar tareas: es que arranque lo que viene pateando.**
Antes de agregar cualquier cosa, la pregunta es *¿esto ayuda a empezar?* Si la
respuesta no es un sí claro, no va. Está desarrollado en el punto 1 de
`AGENTS.md` y vale para todo lo demás.

## 2. Lo que se pregunta siempre, antes de hacerlo

No es falta de autonomía: son cosas cuya consecuencia cae fuera del repositorio,
sobre una persona que no está mirando la terminal. Se pregunta **antes**, no se
avisa después.

| Acción | Por qué no la decide quien programa |
|---|---|
| **`git push`** | Sale a producción solo. Se pide permiso cada vez, aunque se haya dado hace cinco minutos. |
| **Agregar una dependencia** | Es código de un tercero corriendo en producción. Ya entraron tres sin preguntar. |
| **Dar de alta un servicio externo** | Una cuenta más que mantener y un lugar más donde romperse solo. |
| **Ampliar el alcance del pedido** | Una mejora que nadie pidió es algo que nadie sabe que está ahí hasta que falla. Se propone al final y se espera la respuesta. |
| **Cambiar lo que la gente ve** | Es una decisión de producto, no de implementación. |
| **Guardar datos nuevos de personas** | Tiene consecuencias legales que no se evalúan sobre la marcha. |
| **Borrar archivos o credenciales** | Ver la lección 1 del punto 7. |

**Los comandos sí se corren.** Cuando hay terminal disponible se ejecutan builds,
chequeos, despliegues de reglas y diagnósticos, sin devolverle la tarea a otra
persona para que copie y pegue salidas. **El push es la excepción.**

## 3. Lo que no se hace

- **No se opina sobre los tiempos de nadie.** Cuánto se trabaja lo decide quien
  trabaja. Lo que sí es responsabilidad de quien asiste es **no abrumar**: menos
  cosas por mensaje y un paso por vez.
- **No se toca lo que anda.** Si no está en el pedido, no se toca. Aunque se vea
  mal resuelto: se avisa, se anota en `docs/pendientes.md` y se sigue.
- **Nada de parches.** Ni valores hardcodeados, ni datos inventados, ni `any`
  suelto, ni reglas del linter silenciadas sin un motivo escrito al lado.
- **No se inventan datos de personas.** Correos, nombres y teléfonos se
  preguntan. Lo público del proyecto va con la cuenta del proyecto, nunca con
  una cuenta personal.

## 4. Nada está listo hasta que se probó

**Se asume que está roto hasta demostrar lo contrario.** No se dice "listo" sin:

```bash
bun run check    # tipos — ver la advertencia de abajo
bun run build    # compila de verdad
bun run lint     # oxlint
```

Y además **verlo funcionando en el navegador**, no suponerlo.

> ⚠️ **`tsc --noEmit` miente en este proyecto.** `tsconfig.json` tiene
> `"files": []` y solo referencias, así que ese comando no compila nada y termina
> con éxito **aunque el código esté roto**. Verificado rompiéndolo a propósito.
> El comando que sirve es **`bun run check`** (`tsc -b`).

Cuando se prueba contra producción (webhooks de terceros, variables del hosting),
se dice explícitamente que se está probando en producción. Todo lo demás se
prueba en local.

## 5. Convenciones

- **Gestor de paquetes: `bun`. Nunca `npm`.**
- **Código en inglés, comentarios en español, interfaz en español.** Los mensajes
  de commit también en español.
- **Cero jerga técnica en pantalla.** La app se comparte: nadie tiene por qué
  leer "Firestore", "uid" ni un comando de terminal. El detalle técnico va por
  consola o envuelto en `import.meta.env.DEV`. Ver el punto 7b de `AGENTS.md`.
- **Nunca `console.*`**: se usa `log` de `src/lib/logger.ts`. Hay una regla
  `no-console` en oxlint que lo hace fallar. Está exceptuada en tres lugares, con
  un motivo cada uno: `logger.ts` **es** el logger, `api/` escribe con pino, y
  `worker/` corre en Cloudflare, donde `console.log` es la única forma de dejar
  registro y no existe pino. (`.oxlintrc.json` no admite comentarios: por eso el
  motivo está acá.)
- **En `api/` los imports relativos llevan `.js`**, aunque el archivo sea `.ts`.
  Es ESM y Node no resuelve sin extensión.
- **El rojo es solo para lo que de verdad se pasó de fecha.** Una lista que reta
  produce más evitación, que es lo contrario de para qué existe la app.

## 6. Seguridad

> **Regla del proyecto: nada se filtra del lado del cliente.** No se relaja
> porque esto "sea solo una lista de tareas" — el tamaño del proyecto no cambia
> el criterio. Ante la duda, se pregunta.

### Secretos

- Todo lo que empieza con **`VITE_` es público**: viaja dentro del JavaScript
  que descarga cualquiera. El hosting ni siquiera permite marcarlas como
  secretas.
- Las claves de verdad (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
  `FIREBASE_SERVICE_ACCOUNT`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`) **no llevan
  prefijo** y viven solo en el servidor.
- Antes de commitear algo que las toque, verificar que no entraron al bundle ni
  al repositorio.
- **Si aparece una credencial, primero se deja la infraestructura funcionando y
  recién después se limpia.** Ver la lección 1 del punto 7.

### Permisos en Firestore

**Estar autenticado no es ser el dueño.** `request.auth != null` responde "¿hay
alguien?", no "¿es quien dice ser?". Cada vez que un documento lleva un `uid`
adentro, ese campo lo eligió el cliente y hay que compararlo contra
`request.auth.uid`. Esa comparación faltante fue el agujero más serio que tuvo
el proyecto (punto 7p de `AGENTS.md`).

Y un detalle que ya rompió la app una vez: **todo campo opcional se lee con
`d.get('campo', default)`**. Leer un campo que no existe hace fallar la regla
entera y Firestore rechaza la escritura.

### Datos guardados en el navegador

**`localStorage` es modo de emergencia, no una opción de diseño.** Es texto
plano, lo lee cualquier script que llegue a correr en la página, y **sobrevive a
cerrar sesión**: queda ahí para quien use esa computadora después.

- **Antes de persistir algo nuevo en el navegador, se pregunta.** La respuesta
  por defecto es que va al servidor, donde las reglas deciden quién lo lee.
- Lo único que hoy vive ahí es **`todo-list:tasks:v1`**, el respaldo que evita
  perder lo anotado cuando la nube no responde. Está justificado y se avisa en
  pantalla.
- No entran en esta regla las tareas dibujadas en pantalla ni el caché propio de
  Firestore: eso es inevitable. La regla es sobre lo que se **persiste a
  propósito**.

Ver el punto 7e de `AGENTS.md`.

## 6b. Configurar cuentas y consolas de terceros

Las consolas externas (hosting, DNS, Firebase, Google Cloud) son el punto donde
quien programa no ve nada y quien configura trabaja a ciegas. Es donde más tiempo
se perdió en este proyecto, así que hay reglas propias.

### Antes de mandar a alguien a una consola

- **Dar el mapa completo de entrada, no de a pedazos.** Si un valor va en dos
  lugares, se dice **desde el principio** y se explica por qué. Mencionarlo al
  pasar, en medio de otro párrafo, equivale a no decirlo.
- **Un solo paso por mensaje**, con un lugar y un valor. Nada de tres pantallas
  distintas en la misma respuesta.
- **Nombres exactos de lo que se ve en pantalla, no los de la documentación.**
  Si el nombre real no se conoce, **se averigua antes** en vez de mandar a
  buscar algo que no existe con ese nombre.
- **Decir en qué entorno va** (Production / Preview / Development) y si hace
  falta **redesplegar** para que tome efecto. Las variables se compilan dentro
  del build: cambiarlas sin redesplegar no hace absolutamente nada.
- **Dar la forma de verificar que quedó bien**, para que no dependa de volver a
  preguntar.

### Cuando no encuentran algo

No repetir la misma indicación más fuerte. **Averiguar el nombre real, pedir que
describan lo que ven, o —con permiso— mirar el navegador.** Que algo "esté en
Settings" no ayuda si en esa pantalla está arriba del todo.

## 7. Lecciones que costaron tiempo

Están acá porque cada una se pagó con horas. El patrón de casi todas es el
mismo: **se avanzó sin verificar.**

1. **Se borró una cuenta de servicio antes de usarla.** Servía para desplegar
   las reglas sin intervención humana; se usó para registrar la app web y se
   borró enseguida. Todo lo que siguió pasó a depender de que una persona
   corriera comandos a mano. **Primero se deja la infraestructura lista, después
   se limpia la credencial.**
2. **Las reglas abiertas no se compensan con un buen login.** La primera versión
   tenía `allow read, write: if true`. Las Security Rules *son* backend —corren
   en los servidores de Google—, pero solo protegen si dicen algo.
3. **Una regla leyó un campo nuevo sin `.get()`** y rompió toda escritura sobre
   las tareas viejas: no se podía tachar nada.
4. **Se festejó antes de confirmar el guardado.** Confeti y felicitaciones por
   algo que no había pasado.
5. **Las escrituras fallaban en silencio.** Se apretaba "Anotar" y no pasaba
   nada. Ninguna acción puede terminar sin feedback.
6. **`api/` no la chequeaba ningún tsconfig**, así que un import sin extensión
   pasó el build y reventó en producción sin dar pistas.
7. **Se publicó un correo personal** en la política de privacidad, sin preguntar.
8. **Se afirmó en el login que "no la ve ni quien hizo esta app"**, que era
   falso: quien administra el proyecto tiene acceso técnico a la base. La
   interfaz no puede prometer lo que el sistema no cumple.
9. **Se editaron archivos con PowerShell y se rompió la codificación** (los
   acentos quedaron como `cuÃ¡nto`). Pasó dos veces. **Para editar archivos se
   usa la herramienta de edición, nunca `Set-Content`.** Si hay que hacerlo con
   PowerShell sí o sí, va con `System.IO.File` y UTF-8 sin BOM, y se verifica un
   acento después.
10. **Se mandó a configurar consolas de a pedazos** y con nombres que no
    coincidían con la pantalla real. Ver el punto 6b.

## 8. Dónde vive cada cosa

| Archivo | Qué tiene |
|---|---|
| `CLAUDE.md` (este) | Cómo se trabaja |
| `AGENTS.md` | El porqué de cada decisión tomada. **Se actualiza cada vez que se decide algo.** |
| `docs/pendientes.md` | Lo que falta. Lo que surge en el medio **se anota acá y se sigue con lo que se estaba haciendo**. |
| `README.md` | Qué es el proyecto y cómo levantarlo |

## 9. Comandos

```bash
bun run dev       # servidor local, http://localhost:5173
bun run check     # tipos (tsc -b) — el que sirve
bun run build     # chequeo + compilación de producción
bun run lint      # oxlint
bun run rules     # desplegar firestore.rules
bun run fb:login  # entrar a Firebase desde la terminal
```
