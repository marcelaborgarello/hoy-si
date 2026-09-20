# Hoy sí

Una todo list pensada para **arrancar**, no para administrar tareas.

Anotás algo, apretás **Empecé**, y cuando lo tachás te dice cuánto tardó de
verdad. Casi siempre es menos de lo que imaginabas.

En producción: **[tareas.ginialtech.com](https://tareas.ginialtech.com)**

## Andar

```bash
bun install
bun run dev
```

Se abre en http://localhost:5173

Necesitás un archivo `.env` con la config de Firebase (copiá `.env.example`).
Sin él la app **igual funciona**: guarda en el navegador en vez de en la nube.

## Comandos

| Comando | Qué hace |
|---|---|
| `bun run dev` | Servidor de desarrollo |
| `bun run check` | **Chequeo de tipos.** Ver la advertencia de abajo |
| `bun run build` | Chequeo + build de producción en `dist/` |
| `bun run preview` | Ver el build ya compilado |
| `bun run lint` | oxlint |
| `bun run fb:login` | Entrar a Firebase desde la terminal (abre el navegador) |
| `bun run rules` | Desplegar `firestore.rules` |

> ⚠️ **No uses `tsc --noEmit` acá.** `tsconfig.json` tiene `"files": []` y solo
> referencias, así que ese comando no compila nada y **sale con éxito aunque el
> código esté roto**. El que sirve es `bun run check` (`tsc -b`), y es el mismo
> que corre `bun run build` por dentro.

## Cómo está armado

- **React 19 + Vite + TypeScript**, sin framework de servidor. No hay rutas ni
  SEO que justifiquen algo más pesado.
- **zod** valida todo lo que entra desde afuera: si un documento viene roto se
  descarta esa tarea sola, en vez de romper la app entera.
- **Firestore** guarda las tareas en `users/{uid}/tasks`, con login de Google.
- **Storage enchufable**: si falta config de Firebase —o si la nube rechaza la
  conexión— cae solo a guardar en el navegador y te lo avisa. Un problema de
  infraestructura nunca deja la app inutilizable.
- **La lista es una agenda**: bloques por día (En curso, Se pasaron, Hoy,
  Mañana, los días siguientes, Sin fecha, Terminadas).

Mirá el badge de arriba a la derecha para saber dónde están tus cosas:
**"Guardado en la nube"** o **"Solo en esta compu"**.

### Funciones de servidor (`api/`)

| Ruta | Qué hace |
|---|---|
| `api/log.ts` | Recibe los logs del navegador y los escribe con **pino**. Es lo único que aparece en los Runtime Logs de Vercel. |
| `api/telegram.ts` | Webhook del bot `@hoysi_tareas_bot`: vincula el chat con la cuenta. |
| `api/_firebase.ts` | Firestore del lado del servidor (cuenta de servicio). No es una ruta. |

> **En `api/` los imports relativos llevan `.js`**, aunque el archivo sea `.ts`.
> Es ESM y Node no resuelve sin extensión. Sin eso la función ni arranca y
> Vercel devuelve `FUNCTION_INVOCATION_FAILED` sin ninguna pista.

### Avisos

- **Google Calendar** — un link que abre el evento prellenado. Sin API, sin
  permisos sobre tu calendario, sin backend.
- **Telegram** — el bot te escribe. Se conecta desde **⚙️ Configuración** con un
  toque: no hay que copiar ni pegar códigos. ⏳ **Todavía no manda los avisos**:
  falta la tarea programada que despierte a la hora justa.

Los dos solo funcionan con tareas que tengan **hora**. Si no la tienen, el botón
se ve apagado y explica por qué.

## Seguridad

Las reglas de Firestore (`firestore.rules`) **se evalúan en los servidores de
Google**, no en el navegador: cada usuario entra solo a su propia carpeta, y se
valida la forma de cada documento. Aunque alguien reescriba el JavaScript del
cliente, no puede saltearlas.

> ⚠️ En las reglas, todo campo opcional se lee con `d.get('campo', default)`.
> Leer un campo que no existe hace fallar la regla **entera**. Ya rompió una vez:
> al agregar `dueTime`, las tareas viejas dejaron de poder tacharse.

La config `VITE_FIREBASE_*` viaja en el bundle y eso está bien: es pública por
diseño en toda app web de Firebase y no da acceso a nada.

> **Regla del proyecto:** ninguna clave privada toca el navegador. Las que
> importan (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
> `FIREBASE_SERVICE_ACCOUNT`) **no llevan prefijo `VITE_`** y viven solo en las
> variables de entorno del servidor.

## Desplegar

Conectado a **Vercel**: cada push a `main` publica. Las variables de entorno se
configuran ahí — las `VITE_*` como `config` (Vercel no deja marcarlas secretas,
justamente porque son públicas) y las del servidor como `sensitive`.

Las variables se compilan **dentro** del bundle: cambiarlas sin redeployar no
hace nada.

Después de conectar un dominio nuevo hay que **autorizarlo en Firebase**:
Console → Authentication → Settings → Authorized domains. Si no, el sitio carga
perfecto y el login con Google falla sin explicación.

## Documentación

| Archivo | Qué tiene |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | Cómo se trabaja en este proyecto |
| [AGENTS.md](./AGENTS.md) | El porqué de cada decisión ya tomada |
| [docs/pendientes.md](./docs/pendientes.md) | Lo que falta hacer |
