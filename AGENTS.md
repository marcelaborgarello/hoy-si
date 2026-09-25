# AGENTS.md — memoria del proyecto

Bitácora de decisiones y contexto, para cualquier persona o agente que retome el
proyecto —incluido quien lo escribió, tres semanas después—. Acá va el **porqué**
de lo que ya está decidido; el *cómo se trabaja* está en
[`CLAUDE.md`](./CLAUDE.md) y lo que falta, en
[`docs/pendientes.md`](./docs/pendientes.md).

**Se actualiza cada vez que se decide algo.**

---

## 1. Qué es esto

Una lista de tareas cuyo objetivo real **no** es "gestionar tareas": es **vencer
la procrastinación**. Todo lo que se agregue tiene que servir a eso. Si una
función no ayuda a arrancar, o a sentir que avanzaste, sobra.

El pedido original fue explícito: que la app diera **la motivación para hacer las
cosas que se posponen mucho**. No que las ordenara mejor — ordenarlas ya lo hace
cualquiera.

El ejemplo que lo originó es doméstico y sirve de piedra de toque: una tarea que
da pereza sostenida, que hay que hacer igual, y que en el fondo son seis cosas
chicas disfrazadas de una grande.

## 2. Requisitos pedidos (checklist)

- [x] Título y descripción por tarea
- [x] Registrar **cuándo empecé** y **cuándo terminé**
- [x] Fecha (límite) opcional
- [x] Guardar de verdad (persistencia)
- [x] Notas dentro de cada tarea
- [x] React (Next.js solo si hiciera falta — no hizo falta)
- [x] Este AGENTS.md

## 3. Stack y decisiones

| Decisión | Elección | Por qué |
|---|---|---|
| Framework | **React 19 + Vite** | El pedido fue "mínimo React". No hay servidor ni SEO ni rutas: Next.js sería peso muerto. |
| Lenguaje | **TypeScript** | Pedido explícito. |
| Validación | **zod** | Pedido explícito. Valida lo que vuelve de Firestore/localStorage: si un doc viene roto, se descarta esa tarea en vez de romper la app entera. |
| Gestor de paquetes | **bun** | Pedido explícito. Usar `bun` / `bunx`, **nunca** `npm`. |
| Base de datos | **Firestore** | Pedido explícito ("para variar"). |
| Estilos | **CSS plano** con custom properties en `src/index.css` | Sin dependencias extra. Tema oscuro, todos los tokens arriba del archivo. |

### Decisión clave: storage enchufable

`src/lib/store.ts` define una interfaz `TaskStore` y elige el backend **en
tiempo de arranque**:

- Config de Firebase completa en el `.env` → **Firestore** (tiempo real, `onSnapshot`).
- Falta alguna variable, o Firestore falla al iniciar → **localStorage**.

Motivo: que la app nunca quede inutilizable por un tema de credenciales. Un error
de setup no puede ser la excusa para no usarla. El badge arriba a la derecha
siempre dice dónde se está guardando.

## 4. Estado de Firebase

Firebase se usa **solo para Auth + Firestore**. Los identificadores concretos del
proyecto viven en el `.env`, no acá.

- Si el proyecto de Firebase no tiene una **app web registrada**, faltan `apiKey`
  y `appId` y no arranca nada. No viene registrada por defecto, y es el primer
  lugar donde mirar si el `.env` parece incompleto.
- El `.env` usa prefijo **`VITE_`**. Sin ese prefijo Vite no expone las variables
  al navegador — era el segundo error del `.env` original.
- La `apiKey` web **no es un secreto** (viaja en el bundle de toda app web de
  Firebase). Lo que protege los datos son las **Reglas de Seguridad**.

### Seguridad

Se borró el JSON de **cuenta de servicio** (`*-firebase-adminsdk-*.json`) que
estaba en la raíz: contenía una clave privada y no se usa en una app de
navegador. Quedó en `.gitignore` por las dudas.

> ⚠️ **Borrar el archivo no revoca la clave.** La credencial sigue viva en Google
> Cloud hasta que se la revoca a mano, en IAM → Cuentas de servicio → Claves. Un
> archivo borrado da una falsa sensación de limpieza: lo que importa es el estado
> en la consola, no el del disco.

## 4b. Decisión de arquitectura: auth y reglas

Surgió esta duda, y vale dejarla escrita porque es un malentendido muy común:

> *"No se pueden cambiar las reglas, esas hay que manejarlas del backend. Sino
> por más login que tenga es un riesgo."*

**Las Security Rules de Firestore ya son backend.** `firestore.rules` no se
evalúa en el navegador: se despliega a Google y se ejecuta **en sus servidores,
en cada operación**. Un atacante puede reescribir todo el JS del cliente o pegar
requests con curl — no puede tocar las reglas. `request.auth` lo arma Google
verificando la firma del ID token, así que tampoco se puede falsear el uid.

Lo que **sí** era un riesgo real (y estaba bien desconfiar) eran las reglas
abiertas `allow read, write: if true` de la primera versión.

Un backend propio se justificaría si hiciera falta lógica que las reglas no
pueden expresar: llamar a otras APIs, guardar secretos, validaciones complejas,
tareas programadas. Para "cada usuario ve solo sus tareas", las reglas alcanzan.

**Decisión tomada: Firebase Auth con Google + reglas por `uid`. Sin backend propio.**

Consecuencias en el código:

- Las tareas viven en **`/users/{uid}/tasks/{taskId}`**, no en `/tasks`.
- El store dejó de ser un singleton: `createStore(uid)` lo crea **por usuario**,
  y `useTasks(uid)` lo recrea si cambia la sesión. Así las tareas de una cuenta
  no se filtran a otra al cambiar de usuario.
- Sin login no hay app (`App.tsx` muestra `<SignIn/>`). Excepción: si no hay
  config de Firebase, sigue el modo local sin login.
- Las reglas además **validan la forma** de cada documento en el servidor
  (tipos, largo del título, status dentro del enum, tope de notas), para que un
  cliente modificado no pueda escribir basura.

## 5. Modelo de datos

Colección `users/{uid}/tasks`, un documento por tarea (`src/types/task.ts`):

```ts
{
  id: string
  title: string
  description: string
  status: 'todo' | 'doing' | 'done'
  createdAt: number       // ms — cuándo la anotaste (mide cuánto la pateás)
  startedAt: number|null  // ms — botón "Empecé"
  finishedAt: number|null // ms — botón "Terminé"
  dueDate: string|null    // 'YYYY-MM-DD'
  notes: { id, text, createdAt }[]
}
```

Las fechas se guardan como **números (epoch ms)**, no como `Timestamp` de
Firestore: así el mismo objeto sirve para localStorage y para Firestore sin
convertir nada, y zod lo valida igual en los dos casos.

Las **notas van embebidas** en el documento, no en una subcolección. Son pocas y
cortas; una subcolección agregaría queries y complejidad sin beneficio.

## 6. Las tres decisiones anti-procrastinación

Esto es el corazón del proyecto, no decoración:

1. **Separar "empecé" de "terminé".** Una tarea tiene tres estados, no dos. El
   botón *Empecé* existe para que arrancar ya cuente como progreso — que es
   justo el paso que más cuesta.
2. **Mostrar la antigüedad.** Cada tarea abierta dice hace cuántos días espera
   (en ámbar a partir de 7). La culpa vaga no mueve; el número concreto sí.
3. **Devolver la evidencia.** Al tachar aparece cuánto tardó *de verdad*
   ("te llevó 12 min"), más confeti y un mensaje. Es la prueba de que casi
   siempre era menos terrible de lo imaginado. La racha 🔥 cuenta días
   consecutivos con al menos una tarea terminada.

El banner de arriba (`nudge()` en `src/lib/motivation.ts`) siempre sugiere **una
sola** acción concreta. Nunca una lista de pendientes en la cara.

## 7. Estructura

```
src/
  App.tsx                 gate de login + <Board/>: layout, filtros, orden, festejo
  types/task.ts           esquemas zod + tipos
  hooks/
    useAuth.ts            login con Google, estado de sesión
    useTasks.ts           suscripción al store + acciones (única fuente de verdad)
  lib/
    firebase.ts           init condicional; isFirebaseConfigured; getDb/getAuthInstance
    store.ts              interfaz TaskStore + createStore(uid)
    store.local.ts        adaptador localStorage
    store.firestore.ts    adaptador Firestore (onSnapshot sobre users/{uid}/tasks)
    factory.ts            buildTask/newId (módulo aparte para evitar ciclo de imports)
    time.ts               formateo de fechas y duraciones en es-AR
    motivation.ts         stats, racha, mensajes
  components/
    SignIn.tsx  TaskForm.tsx  TaskCard.tsx  TaskDetail.tsx  Celebration.tsx
firestore.rules           reglas por uid + validación de forma (se evalúan en Google)
```

### Dos bugs que hay que no repetir

**1. La app quedaba colgada en "Cargando…".** Si la nube rechazaba la lectura,
el `onSnapshot` fallaba y nadie bajaba el flag de `loading`. Por eso
`TaskStore.subscribe` acepta un segundo callback `onError`. Si se agrega otro
backend, **tiene que llamar a `onError`**.

**2. Las escrituras fallaban en silencio** (el peor de los dos). Apretabas
"Anotar" y no pasaba absolutamente nada: la promesa de Firestore se rechazaba,
nadie la agarraba, y la persona se quedaba mirando la pantalla sin saber si
había hecho algo mal. Arreglado así:

- Toda escritura pasa por el helper `run()` de `useTasks`, que captura el error
  y devuelve `true`/`false`.
- `TaskForm` **no borra lo que escribiste** si `add()` devolvió `false`, y el
  botón muestra "Guardando…" mientras tanto.
- **Regla:** ninguna acción del usuario puede terminar sin feedback. Si se
  agrega una acción nueva, va envuelta en `run()`.

### Modo local de emergencia

Si la nube rechaza la conexión, `useTasks` **cambia el store a localStorage**
(`modoLocalPara`, recordado por uid para no reintentar en loop) y avisa en
ámbar: *"No me pude conectar a la nube, así que guardo todo en esta compu"*.

El motivo es el del punto 1 del documento: un problema de infraestructura no
puede ser la excusa para no usar la app. Preferimos guardar en un lugar peor
antes que no guardar.

> ⚠️ **Pendiente conocido:** lo que se guarde en modo local **no migra solo** a
> la nube cuando la conexión vuelve. Si esto se usa seguido, hay que escribir
> esa migración. Hoy no existe: no prometer en la UI que se va a sincronizar.


## 7b. La app se va a compartir: reglas de redacción

Cambió un supuesto del punto 1. Arrancó como una app de uso personal, pero pasó
a **compartirse**, y quien la recibe la va a usar para cualquier otra cosa.

Dos consecuencias, y las dos son reglas firmes de ahora en más:

**1. Cero jerga de programación en pantalla.** Nadie tiene por qué leer
"Firestore", "localStorage", "uid", ni mucho menos un comando de terminal.
Se sacaron:

| Antes | Ahora |
|---|---|
| "Tus tareas quedan en `/users/tu-id/tasks`. Las reglas de Firestore…" | "Tu lista es tuya y de nadie más." |
| "Firestore rechazó la conexión: faltan desplegar las reglas de seguridad" + el comando `bunx …` | "No me puedo conectar para guardar tu lista. Lo que anotes ahora se puede perder." |
| "Guardando en Firestore" / "Guardando en este navegador" | "Guardado" / "Solo en esta compu" |
| "Falta habilitar Google como método de acceso en la consola…" | "No pudimos entrar con esa cuenta. Probá de nuevo." |

El detalle técnico **no se perdió**: va por `console.error`, y además la UI
muestra una pista extra envuelta en `import.meta.env.DEV`, que Vite elimina del
build de producción. O sea: quien desarrolla ve el comando exacto; quien recibe
la app compartida, no.

**2. Nada atado a limpieza.** Se sacó la escoba 🧹 del título y del favicon
(ahora es un ✦ neutro). Los textos ya eran genéricos ("¿Qué venís pateando?") y
así se quedan. Si se agrega copy nuevo, que sirva igual para estudiar, para
trámites o para limpiar.

**Regla derivada:** un mensaje de error tiene que decirle a la persona qué le
pasa a *sus datos*, no qué le pasa al sistema. Y el badge de estado **no puede
mentir**: si Firestore rechaza la conexión muestra "Sin guardar" en rojo, nunca
"Guardado".

### Corrección del 2026-09-20: el badge no se muestra siempre

**Decisión de producto.** El badge **deja de estar siempre en
pantalla**: aparece **solo cuando hay un problema** y no se ve cuando todo anda
bien. Silencio quiere decir que está guardado.

Casos en los que sí tiene que aparecer: error de conexión, o el celular sin
datos móviles activados.

Lo que se mantiene de la regla de arriba es el principio: **el badge no puede
mentir**. Lo que se cae es el supuesto de que para eso tenía que estar siempre
visible. Un cartel permanente que dice "todo bien" es ruido, y encima se deja de
leer — así que cuando un día dice otra cosa, tampoco se lee.

> ⚠️ Esa regla anterior se escribió **sin consultar**. Queda anotado como
> antecedente: lo que se decide sobre la interfaz no se da por decidido solo
> porque tenga una justificación linda escrita acá adentro. Si es una decisión
> de producto, se pregunta.

## 7c. Las fechas no aprietan

Apareció un "vence hoy" en rojo que generó alarma real al usarla. El dato era
correcto (la fecha límite era efectivamente ese día), pero la interfaz estaba mal
en dos cosas:

1. **El campo de fecha estaba siempre visible, pegado al botón Anotar.** Se
   ponía sin querer. Ahora hay que pedirlo con "📅 Ponerle fecha", y tiene una
   ✕ para sacarlo.
2. **"vence hoy" se pintaba de rojo** (`tone: 'late'` con `faltan <= 0`). Rojo
   ahora es **solo** `faltan < 0`, o sea cuando de verdad se pasó.

Y se cambió el vocabulario: "vence hoy" → **"para hoy"**, "vencida hace 3 días"
→ **"se pasó hace 3 días"**. Suena a información, no a reto.

> **Regla:** en esta app el rojo se reserva para lo que de verdad salió mal. Una
> lista que te reta produce más evitación, que es justo lo que venimos a
> combatir (punto 1). La antigüedad en ámbar a los 7 días es el único empujón
> por presión, y alcanza.

## 7d. Hora límite

Las tareas ahora tienen **`dueTime`** (`'HH:MM'`, 24 h) además de `dueDate`.

- La hora **solo aparece si hay fecha**; al sacar la fecha se borra la hora.
- **Sin hora, el límite es el final del día** (`dueMoment()` usa 23:59:59). Una
  tarea "para hoy" no está atrasada a las 9 de la mañana — eso sería volver al
  problema del punto 7c.
- Con hora sí se puede ser preciso: "se pasó a las 18:30".
- `dueTime` tiene `.default(null)` en el esquema zod, así las tareas guardadas
  antes de que esto existiera siguen cargando sin romper nada.

> Las reglas de Firestore validan la forma de cada documento, así que se agregó
> `dueTime` a `esTareaValida()`. **Hay que correr `bun run rules`** para que esa
> validación quede activa (sin eso igual funciona: las reglas viejas no
> rechazan campos que no conocen).

## 7e. Rumbo: infraestructura propia y secretos

Definiciones de producto e infraestructura que condicionan todo lo que viene:

- **Dominio:** la app vive en **`tareas.ginialtech.com`**. Hay otros dominios del
  mismo titular que **no se mezclan** con este proyecto.
- **Hosting: Vercel** (las variables de entorno ya están cargadas ahí).
  Cloudflare queda solo como **DNS**, no como hosting.
- **IA:** Groq SDK, **plan gratuito** por ahora.
- **Alertas por WhatsApp** cuando vence una tarea (de ahí la hora del punto 7d).
- **Firebase Hosting quedó descartado** a favor de Vercel. `firebase.json`
  conserva la config de hosting y existe el script `bun run publicar`, pero
  **nunca se ejecutó** y no es el camino elegido. Firebase se usa solo para
  **Auth + Firestore**.

### Conectar tareas.ginialtech.com (Vercel + Cloudflare)

1. **Vercel** → el proyecto → Settings → Domains → Add → `tareas.ginialtech.com`.
   Vercel devuelve el registro DNS que espera.
2. **Cloudflare** → `ginialtech.com` → DNS → Add record:
   - Type **CNAME**, Name **`tareas`**, Target **`cname.vercel-dns.com`**
   - **Proxy status: DNS only (nube GRIS, no naranja)**
3. Volver a Vercel y esperar la verificación. El certificado lo emite Vercel.

> ⚠️ **La nube naranja rompe esto.** Si Cloudflare proxea el subdominio, Vercel
> no puede validar el dominio ni emitir el certificado, y suele terminar en
> error 525/526 de SSL. Es el problema número uno de la combinación
> Vercel + Cloudflare. Tiene que quedar en **DNS only**.

> ⚠️ **Y falta un paso que no es de DNS:** hay que agregar
> `tareas.ginialtech.com` en Firebase Console → Authentication → Settings →
> **Authorized domains**. Firebase Auth rechaza el login desde cualquier dominio
> que no esté en esa lista, así que sin esto **el login con Google falla en
> producción** aunque el dominio resuelva perfecto.

### Requisito de seguridad

El requisito, tal como quedó fijado: **nada de lo que maneja el sistema puede
quedar a la vista desde el navegador**, ni siquiera frente a un script inyectado
en la página.

**Regla dura: ninguna clave privada toca el cliente.** Ni en el bundle, ni en
una variable `VITE_*`, ni en un fetch desde el navegador. Todo lo que necesite
un secreto (Groq, WhatsApp) se llama a través de un **Cloudflare Worker**, con
los secretos cargados vía `wrangler secret put` — que nunca salen del servidor.

Hay que tener presente la distinción, porque se presta a confusión:

| | ¿Visible en el navegador? | ¿Es un problema? |
|---|---|---|
| Config de Firebase (`VITE_FIREBASE_*`) | **Sí**, inevitable | No. Es pública por diseño en toda app web de Firebase; no da acceso a nada. Lo que protege los datos son las reglas (punto 4b). |
| API key de Groq | **Nunca** | Sí. Con esa clave cualquiera consume tu cuota. Va en el Worker. |
| Token de WhatsApp | **Nunca** | Sí. Con eso se mandan mensajes en tu nombre. Va en el Worker. |

> Si el requisito se interpreta al pie de la letra ("que el navegador no vea
> *nada*"), entonces el front tampoco debería hablar directo con Firestore y
> habría que proxear todo por el Worker. Esa es la opción "backend propio" que
> se descartó en el punto 4b — pero **ahora que va a existir un Worker igual
> para Groq y WhatsApp, el costo de esa opción bajó**. Decisión pendiente del
> usuario.

### Regla firme: nada se filtra del lado del cliente (2026-09-20)

Ratificada como regla del proyecto, y no depende de qué tan importante parezca
la app: que esto "sea solo una lista de tareas" no habilita a filtrar nada.
**La seguridad no se negocia por tamaño del proyecto.**

Son **dos cosas distintas** y conviene no mezclarlas:

**1. Secretos.** Ya está resuelto arriba: ninguna clave privada toca el
navegador. Sin `VITE_`, solo en el servidor.

**2. Datos de la persona guardados en el navegador.** Esto es lo que se agrega
ahora. `localStorage` es **modo de emergencia, no una opción de diseño**, porque:

- Es **texto plano**: lo lee cualquier script que llegue a correr en la página.
- **Sobrevive a cerrar sesión.** Queda ahí para quien use esa computadora después.
- No tiene fecha de vencimiento ni lo protege ninguna regla del servidor.

**Regla:** antes de persistir cualquier cosa nueva en el navegador, **se
pregunta**. La respuesta por defecto es que va al servidor, donde las reglas
deciden quién lo lee.

Lo que hoy vive en el navegador es **`todo-list:tasks:v1`** (el respaldo de
emergencia del punto 6) y está justificado: es la diferencia entre perder lo que
anotaste y no perderlo. Pero tiene un agujero abierto — **al cerrar sesión no se
borra**. Anotado en `docs/pendientes.md`.

> Lo que **no** entra en esta regla, para no confundir: las tareas dibujadas en
> pantalla y el caché que Firestore maneja solo. Eso es inevitable en cualquier
> app web. La regla es sobre lo que se **persiste a propósito** y sobre los
> secretos.

### Pendientes en orden

1. Variables de entorno.
2. Worker en Cloudflare + `tareas.ginialtech.com`.
3. Alertas de WhatsApp: **ojo**, para mandar mensajes proactivos (no como
   respuesta) la API de WhatsApp exige plantillas aprobadas por Meta y una
   cuenta de negocio verificada. Telegram no pide nada de eso — vale evaluarlo
   para tener alertas andando rápido.
4. Groq: las ideas que encajan con el punto 1 del documento son partir una
   tarea grande en pasos chicos y estimar cuánto lleva de verdad.

## 7e-bis. El dominio en la pantalla de Google (cerrado)

Se cambió el `authDomain` a `tareas.ginialtech.com` para que el login no
mostrara `todo-list-846e2.firebaseapp.com`. Funcionó, con tres piezas:

1. `vercel.json` proxea `/__/auth/*` a `todo-list-846e2.firebaseapp.com`.
2. En Google Cloud → Credenciales → cliente OAuth web hay que cargar **dos
   cosas distintas**, y confundirlas es el error típico:
   - *Orígenes autorizados de JavaScript*: solo el origen, **sin ruta**
     (`https://tareas.ginialtech.com`).
   - *URIs de redireccionamiento autorizados*: la ruta completa
     (`https://tareas.ginialtech.com/__/auth/handler`).
3. `VITE_FIREBASE_AUTH_DOMAIN=tareas.ginialtech.com` en Vercel + redeploy.
   **En el `.env` local NO se cambia**: `localhost` no proxea esas rutas.

Detalles que costaron:

- Vercel **no deja** marcar una variable `VITE_*` como `secret`, solo `config`:
  el prefijo es público por definición. Hubo que borrar la variable y crearla
  de nuevo para cambiar esa propiedad.
- Las variables se compilan dentro del bundle: **cambiarlas sin redeploy no
  hace nada**. Se verifica bajando el JS publicado y buscando el dominio.

> **Cerrado, no volver a intentarlo:** Google muestra siempre el **dominio
> registrable** (`ginialtech.com`) y descarta el subdominio. El campo "Dominios
> autorizados" de la pantalla de consentimiento **no acepta subdominios**. Lo
> único que puede reemplazar ese texto es el **nombre de la app** de la pantalla
> de consentimiento.

## 7f. Logs: pino, y cero `console`

Decisión: los logs de producción se escriben con **pino**, y **en ningún archivo
de la app se llama a `console`**. Se usa `log` de
`src/lib/logger.ts`. Hay una regla `no-console: error` en `.oxlintrc.json` que
lo hace fallar el lint, con excepción para el propio `logger.ts` y `api/`.

El detalle que hacía falta entender: **esta app corre entera en el navegador**,
y los Runtime Logs de Vercel solo muestran lo que loguea una **función de
servidor**. Un `log.error()` en el cliente se queda en la consola de quien usa
la app y no llega a Vercel. Por eso el logging tiene dos mitades:

| Archivo | Dónde corre | Para qué |
|---|---|---|
| `src/lib/logger.ts` | navegador | `pino` con `browser.transmit`: los niveles `warn` y superiores se mandan a `/api/log`. En desarrollo no transmite nada. |
| `api/log.ts` | servidor (Vercel Function) | Recibe y escribe con `pino`. **Esto es lo que se ve en los Runtime Logs.** |

Cuidados que ya están resueltos y conviene no romper:

- El envío usa `navigator.sendBeacon` (sobrevive al cierre de la pestaña) con
  `fetch` de respaldo. **Un log nunca puede frenar ni romper la app**: todo
  está envuelto en try/catch y los errores de envío se descartan.
- `/api/log` es **un endpoint público**: valida el tamaño (4 KB), la forma y el
  nivel, y recorta los textos. Asume que puede recibir basura.
- Solo viaja texto acotado, nunca objetos completos — para no mandar sin querer
  el contenido de las tareas de la persona a los logs.

## 7g. La lista es una agenda

Pedido: que una tarea puesta para un día futuro dejara de estar mezclada con
todo lo demás, para poder leer la lista **como una agenda**.

`src/lib/agenda.ts` agrupa las tareas en bloques con encabezado de día. El
orden de los bloques es fijo para que la pantalla no se reacomode sola:

1. **En curso** — siempre arriba. Es lo que estás haciendo ahora, y sostiene el
   "una cosa por vez" del punto 1.
2. **Se pasaron** — lo vencido, en ámbar.
3. **Hoy** · 4. **Mañana** · 5. los días siguientes, en orden cronológico
   (posición = `FUTURO + días que faltan`).
6. ~~**Sin fecha**~~ — ya no está acá: desde el 2026-09-21 las tareas sin fecha
   viven en **otra lista** (ver punto 7o).
7. **Terminadas** — último, y agrupadas por el día en que se tacharon.

Dentro de cada día: **primero lo que tiene hora**, en orden; lo demás va al
final, por antigüedad. Una agenda se lee por hora.

Detalle de zona horaria que ya mordió: las tareas puestas "para mañana" después
de medianoche aparecen en **Hoy**, porque el día cambió. Es correcto, y el
usuario lo confirmó. `dueMoment()` usa el fin del día cuando no hay hora, así
que nada se marca vencido antes de tiempo.

## 7h. Alertas

Sección **"Avisame"** en el panel de detalle. Regla: **sin hora no hay alerta**
(`puedeTenerAlerta()` exige `dueDate` **y** `dueTime`).

Cuando no se puede, el control **se muestra apagado, no se esconde**, con un
tooltip que explica por qué: *"Para que te avise, primero ponele una hora acá
arriba"*. Un botón que desaparece no enseña nada; uno gris con explicación sí.

> Detalle técnico del tooltip: `title` tarda demasiado en aparecer y sobre un
> botón `disabled` muchos navegadores ni disparan el hover. Por eso hay un
> tooltip propio con `[data-tip]` en CSS, **puesto en el contenedor** para que
> funcione igual con los controles deshabilitados.

**Las dos alertas no cuestan lo mismo**, y por eso una está y la otra no:

| | Cómo | Estado |
|---|---|---|
| **Google Calendar** | Link `calendar.google.com/render?action=TEMPLATE` con el evento prellenado. **Sin API, sin OAuth, sin backend**: Calendar maneja el recordatorio. | ✅ andando |
| **Telegram** | Necesita que algo despierte a la hora justa y escriba: servidor con tarea programada. | ⏳ apagado |

Se descartó la **API de Google Calendar**: el scope `calendar.events` es
sensible y obliga a pasar por la verificación de Google (semanas de trámite).
El link resuelve lo mismo para este caso.

### Lo que falta para Telegram

1. Bot con **@BotFather** → token (secreto, va solo en el Worker).
2. Vincular la cuenta: el bot necesita el `chat_id` de cada persona. Patrón
   habitual: deep link `t.me/<bot>?start=<código>` y el Worker asocia ese
   código con el `uid`.
3. **Cloudflare Worker con Cron Trigger** que cada pocos minutos busque tareas
   próximas a vencer y mande el mensaje.
4. El Worker tiene que leer Firestore → cuenta de servicio como secreto de
   Wrangler. **Nunca en el cliente** (punto 7e).
5. Marcar la tarea como "ya avisada" para no mandar el mismo aviso en loop.

## 7i. La carpeta `api/` también se chequea

Un bug de producción salió de acá: `api/` **no estaba incluida en ningún
tsconfig**, así que TypeScript no la miraba. Un import relativo sin extensión
(`'./_firebase'`) compilaba sin quejarse y después Vercel devolvía
`FUNCTION_INVOCATION_FAILED` sin ninguna pista, porque el módulo ni cargaba.

Ahora existe **`tsconfig.api.json`** con `module`/`moduleResolution` en
**NodeNext**, referenciado desde `tsconfig.json`. Con eso, ese mismo import es
un error de compilación (`TS2835`) y `bun run build` falla antes de desplegar.
Está verificado: se rompió a propósito y el build lo atrapó.

> **Regla: en `api/` los imports relativos llevan `.js`**, aunque el archivo
> sea `.ts`. Es ESM (`"type": "module"`), y Node no resuelve sin extensión.

Pista para depurar esto en el futuro: `/api/log` seguía funcionando porque es
la única función que **no importa ningún archivo propio**. Si una función
muere y otra no, mirar los imports relativos antes que cualquier otra cosa.

## 7j. Avisos: dónde se ven y cómo

Los mismos dos avisos aparecen en **el alta y en el detalle**, con el
componente `Avisos.tsx` para que no se desincronicen.

- En el **alta** son informativos (`soloInforma`): la tarea todavía no existe.
  Están para que se entienda, mientras la escribís, que **poner hora es lo que
  habilita los avisos**.
- En el **detalle** el de Calendar es un link real al evento.
- Apagados muestran el motivo exacto: falta la hora, o falta conectar Telegram.

**Marcas oficiales** en `components/iconos.tsx`, dibujadas como SVG: el avión
de Telegram sobre el degradé celeste y el calendario de Google. Nada de emoji
haciendo de logo.

## 7k. El header: menú, nombre propio y descubrir Telegram

Tres cosas que se hicieron juntas porque son el mismo pedazo de pantalla
(estaban anotadas en el punto 2b de `docs/pendientes.md`).

**Menú hamburguesa.** Reemplaza lo que estaba suelto en el header. Adentro van
el nombre, Configuración, el estado de Telegram y Salir. El botón mide
**44 × 44 px**, que es el mínimo cómodo para el pulgar: va en la dirección del
pendiente de mobile first, no en contra.

**Nombre propio.** Si está vacío se usa el de Google, que aparece como
sugerencia en gris.

> **Por qué vive en `users/{uid}/config/perfil` y no junto a los avisos:** las
> reglas no dejan que el navegador escriba `telegramChatId` —eso solo lo hace el
> servidor, que es el único que puede comprobar que ese chat le habló al bot—. Y
> en Firestore, `request.resource.data` es el documento **entero** resultante:
> si el nombre estuviera en el mismo documento, guardarlo implicaría mandar
> también el chat y la regla lo rechazaría. Por eso son dos documentos, con una
> regla cada uno.

**Cómo se entera la gente de que existe Telegram.** El problema era que, sin
conectarlo, no había forma de descubrir la función salvo chocarse con un botón
apagado. Tres señales, de menos a más:

1. Un **punto ámbar** sobre el botón del menú cuando falta conectarlo.
2. Dentro del menú, un cartelito **"Falta Telegram"** al lado de Configuración.
3. **El botón de Telegram de una tarea lleva a conectarlo.** Si la tarea tiene
   hora pero falta la cuenta, tocarlo abre Configuración en vez de no hacer
   nada. Es el que más sirve: aparece justo cuando la persona quiso usarlo.

> Ojo con la diferencia: **sin hora** el botón está deshabilitado de verdad (no
> hay nada que configurar, falta un dato de la tarea). **Sin Telegram** está
> apagado pero es clickeable, porque sí hay algo que hacer.

## 7l. El CSS es mobile first

Desde el **2026-09-20**, `src/index.css` está escrito al revés de como se suele:

> **Todo lo que está sin `@media` son los estilos del CELULAR.** Las pantallas
> grandes se agregan después, en **un solo** bloque `@media (min-width: 620px)`
> al final, con lo que cambia cuando hay lugar de sobra.

**No queda ningún `@media (max-width: …)`.** Si aparece uno, algo se escribió al
revés: en vez de parchear la pantalla chica, se corrige la base.

Por qué: esta app se usa parada, con el celular en la mano, que es justo el
momento en que se anota lo que se viene pateando. Si la pantalla chica es un
parche al final, ese momento se pierde.

Lo que cambia entre una medida y otra:

| | Celular (base) | `min-width: 620px` |
|---|---|---|
| Formulario | **fijo abajo**, al alcance del pulgar | arriba, en el flujo |
| Tarjeta | 2 columnas, botones en su propia fila | 3 columnas, botones al costado |
| Zonas de toque | 40–44 px | compactas |

**El círculo de tachar se ve de 26 px pero se toca en 44.** El truco es padding
con `background-clip: content-box`: agranda el área sin agrandar el dibujo. Si
se toca esa regla, no achicar el `width` para "arreglar" cómo se ve.

El formulario fijo usa `env(safe-area-inset-bottom)` para no quedar debajo de la
barra de gestos del iPhone, y `.app` lleva `padding-bottom` de sobra para que la
última tarea no quede tapada.

> ⚠️ **Lo que quedó sin verificar en pantalla real:** la ventana del navegador no
> se dejó achicar durante el trabajo, así que la comprobación fue leyendo las
> reglas CSS cargadas, no mirando el render. Falta probarlo en un teléfono de
> verdad y con el teclado abierto (ver `docs/pendientes.md`).

## 7m. Los dos avisos son independientes

Antes el aviso de la hora iba **siempre** y el anticipado era un extra. Estaba
mal: elegir el anticipado apagaba el de la hora, cuando en realidad son dos
opciones independientes y hay que poder tener las dos.

Ahora son **dos casillas separadas**, y se puede tener cualquier combinación:

| `notifyAtTime` | `notifyBeforeMin` | Qué pasa |
|---|---|---|
| ☑ | `null` | un aviso, a la hora |
| ☐ | `30` | un aviso, media hora antes **y nada a la hora** |
| ☑ | `30` | los dos |
| ☐ | `null` | ninguno → `notify` queda en `false` |

El caso que antes no se podía: **solo el anticipado**. Sirve para algo que hay
que preparar media hora antes y que a la hora ya no tiene sentido que suene.

**Destildar las dos apaga el aviso.** No hay botón de "no avisarme" ni cartel
que lo explique: el ícono de la tarjeta vuelve a gris, y eso ya lo dice. Un
texto avisando sería repetir con palabras algo que se ve.

`notifyAtTime` tiene default `true` en zod y se lee con `?? true` en el
servidor, así que las tareas que ya tenían aviso siguen funcionando igual.

### Se elige desde la tarjeta, no desde el detalle

Esto es lo importante, y costó tres repeticiones darse cuenta. **Tres veces
seguidas apareció el mismo problema**: la hora, los botones de aviso y la
anticipación estaban todos escondidos detrás de los tres puntitos, y nadie los
encontraba. La función existía y era exactamente igual a que no existiera.

Ahora el ícono de Telegram de la tarjeta **abre un globo con las dos casillas**.
El detalle sigue mostrando lo mismo (el componente es el mismo, con
`embebido`), pero dejó de ser el único camino.

> **Regla:** si algo se configura por tarea, tiene que poder configurarse
> **desde la lista**. El detalle es para profundizar, no para esconder.

> **Detalle técnico que costó un rato:** el globo se cerraba al tildar una
> casilla. Era el detector de "click afuera" hecho con `mousedown` en el
> documento preguntando `ref.contains(target)`. Se reemplazó por una **capa
> transparente** (`.pop-tapa`) detrás del globo: lo que la toca está afuera, y
> punto — sin ambigüedad. Y la tarjeta con el globo abierto se eleva con
> `.card:has(.avisos-pop)`, porque si no las tarjetas de abajo lo tapaban.

## 7n. Instalar la app y avisos en el celular (2026-09-20)

### El cartel de instalar hay que escribirlo

Los navegadores **no muestran nada solos**. Sin código propio, la única forma
de instalar es el menú del navegador, que nadie encuentra. `src/lib/instalable.ts`
ahora agarra el evento `beforeinstallprompt` y `src/components/Instalar.tsx`
muestra el cartel.

> **El evento se engancha al importar el módulo, no adentro de un hook.** Chrome
> lo dispara una sola vez y muy temprano: si React todavía no montó, se pierde
> y no vuelve más.

Dos mundos que no se parecen: en Android hay botón, en iPhone Safari no ofrece
nada y lo único posible es explicar *Compartir → Agregar a inicio*.

Posición: en el celular **arriba** (abajo está el formulario fijo) y en pantalla
grande **abajo a la derecha** (arriba está el estado de guardado). Se verificó
en el navegador: la primera versión tapaba el badge.

### ⚠️ El sonido de las notificaciones NO lo elige la app

Se propuso en 2014, ningún navegador lo implementó y **se sacó del estándar en
2018**. La opción `sound:` que estaba en `sw.js` no hacía nada: el navegador ni
la mira. El `public/sounds/notificacion.mp3` no lo reproduce nadie.

**Lo que sí se puede:** en Android el sonido se elige desde los ajustes del
teléfono, en el canal de notificaciones de este sitio. Lo elige la persona, no
la app. En iPhone no hay equivalente.

> La pantalla de Configuración prometía "sonido personalizado" dos veces. Se
> corrigió: ahora dice dónde se elige. Un texto que promete algo que no pasa es
> el mismo error que un badge que miente (punto 7b).

### La suscripción se guarda desde el navegador, no por `api/`

`/api/push-token` **aceptaba cualquier `uid` del cuerpo, sin verificar nada**.
Con el uid de otra persona se podían desviar sus avisos, que llevan el título
de sus tareas. Estuvo publicado así.

Ahora son dos candados:

- El navegador escribe **directo a Firestore** (`users/{uid}/config/push`), donde
  `request.auth.uid` lo verifica Google y no se puede falsear.
- La ruta `api/` sigue existiendo pero **exige el ID token** (`uidDeLaSesion()`
  en `api/_firebase.ts`) y saca el uid de ahí, nunca del cuerpo.

Otras dos cosas que estaban mal y ya no:

- **La suscripción se copiaba a `localStorage`.** Sobraba —el navegador ya la
  tiene, se pide con `pushManager.getSubscription()`— y hacía que la pantalla
  dijera "activado" con el permiso revocado.
- **Al celular le llegaba el texto de Telegram, con HTML.** Se leía
  `⏰ <b>Comprar pan</b>`. Ahora hay dos armadores: uno con etiquetas para
  Telegram y uno plano para la notificación.

### Las claves VAPID son un par y tienen que casar

La pública estaba **pegada en `api/avisar.ts`** y la misma iba en el `.env`. Si
se despegaban, el aviso salía, el celular lo descartaba y no se quejaba nadie.
Ahora las dos salen de variables:

| Variable | Prefijo | Dónde se ve |
|---|---|---|
| `VITE_VAPID_PUBLIC_KEY` | **lleva** `VITE_` | navegador **y** servidor |
| `VAPID_PRIVATE_KEY` | **ninguno** | solo el servidor |

> El prefijo no decide quién puede leerla en Vercel: decide si **además** se
> copia al navegador. Por eso una sola carga de la pública sirve para los dos
> lados. Y por eso la privada sin prefijo le llega igual a la función.

## 7o. Dos listas: Agenda y Sin agendar (2026-09-21)

Pedido: las tareas sin fecha se iban al fondo de la agenda y, con muchas,
dejaban de existir en la práctica. Y el uso real, que es lo que define todo lo
demás: volcar primero la lista completa de pendientes y **después** repartir los
días, poniéndole hora solo a lo que la necesita.

O sea que son **dos momentos distintos**: volcar todo sin pensar en cuándo, y
después repartir los días. El bloque "Sin fecha" al final de la agenda servía
mientras fueran tres; con treinta queda enterrado y deja de existir.

**La regla que decide todo es una sola línea**, en `esSuelta()` de
`src/lib/agenda.ts`:

```ts
task.status === 'todo' && !task.dueDate
```

Las dos excepciones son deliberadas, y las dos tienen motivo:

| Caso | Dónde va | Por qué |
|---|---|---|
| Sin fecha, **en curso** | Agenda, arriba de todo | Lo que estás haciendo ahora va primero. Es el "una cosa por vez" del punto 1. |
| Sin fecha, **terminada** | Agenda, en el día que la tachaste | Ese día **es** una fecha. Y deja "Sin agendar" como lo que tiene que ser: solo lo que falta hacer. |

### Los nombres

**"Agenda" y "Sin agendar"**, no "Con fecha / Sin fecha". Comparten raíz, así
que se leen como dos caras de lo mismo. Y "Agenda" es el nombre de un **lugar**,
no una afirmación sobre cada tarea de adentro: por las dos excepciones de arriba
ahí conviven cosas sin fecha, y un título que dijera "Con fecha" estaría
mintiendo. El badge que miente es un error viejo de este proyecto (punto 7b).

### Lo que se decidió alrededor

- **Los cinco chips de filtro se ven solo en la Agenda.** En "Sin agendar" todo
  es pendiente y sin fecha: cuatro de los cinco darían siempre vacío o lo mismo.
- **Sus números cuentan solo la agenda.** Si contaran todo, el chip diría un
  número y la lista mostraría otro.
- **"Sin agendar" ordena por antigüedad, las más viejas arriba.** Mismo criterio
  que la antigüedad en ámbar: lo que venís pateando hace rato queda a la vista.
- **La solapa elegida no se guarda**: al abrir siempre arranca en Agenda.
  Recordarla implicaría persistir algo nuevo en el navegador, y eso se pregunta
  (punto 7e).

### Que una tarea cambie de lista no puede ser mudo

Tres acciones mueven una tarea de lista, y en las tres **la tarjeta desaparece
de la pantalla**. Sin avisar, se lee como que se borró:

| Acción | Qué pasa |
|---|---|
| Anotar sin fecha estando en la Agenda | La pantalla **cambia sola** a "Sin agendar" (y al revés). Lo que acabás de escribir nunca queda fuera de vista. |
| Ponerle fecha desde la lista | Cartel: *"X quedó para el 23 de sept a las 18:30"*, con **Ver la agenda**. |
| Tocar **Empecé** en una sin fecha | Cartel: *"X pasó a la agenda: la estás haciendo"*. |

Es la misma regla de siempre: ninguna acción del usuario termina sin feedback
(punto 7 de `CLAUDE.md`).

### El globo de fecha (`PonerFecha.tsx`)

Ponerle fecha se hace **desde la tarjeta**, no desde el detalle: es la regla del
punto 7m, y acá es lo que hace que el repaso ("esto lo hago el martes") sea de
un toque en vez de tres.

> **Nada se guarda mientras elegís: recién al tocar "Agendar".** Si se guardara
> al cambiar el día, la tarea saltaría a la agenda en ese mismo instante, el
> globo se iría de la pantalla con ella y no habría forma de ponerle la hora.

El botón solo aparece en tareas **sin fecha**; si ya tiene día, se cambia en el
detalle como siempre. Reusa la capa `.pop-tapa` del globo de avisos.

## 7p. El agujero de `vinculos` (cerrado el 2026-09-25)

Salió en una revisión de seguridad del 2026-09-20 y quedó abierto cinco días. Es
el agujero más serio que tuvo el proyecto, así que conviene entender por qué
pasó.

La regla era esta:

```js
match /vinculos/{codigo} {
  allow get, create, delete: if request.auth != null;
}
```

Pedía estar logueado **y nada más**. Pero el `uid` que va adentro del documento
lo elige el cliente (`useConfig.ts:80` manda `{ uid, creadoEn }`), así que
cualquiera con una cuenta podía crear un código apuntando al `uid` de **otra
persona**, mandarle `/start <codigo>` al bot, y el servidor le ataba **su** chat
de Telegram a la cuenta ajena. A partir de ahí le llegaban los avisos con los
títulos de las tareas de la víctima y podía tacharlas desde los botones del
mensaje.

**La lección, que es la de siempre en este archivo:** *estar autenticado* no es
*ser el dueño*. `request.auth != null` responde "¿hay alguien?", no "¿es quien
dice ser?". Cada vez que un documento lleva un `uid` adentro, hay que comparar
ese campo contra `request.auth.uid` — si no, el dato que decide de quién es la
cosa lo está eligiendo el atacante.

Se cerraron **tres** puertas, no una:

| Antes | Ahora | Por qué |
|---|---|---|
| `create` para cualquier autenticado | `create` solo si `d.uid == request.auth.uid` | El agujero de verdad. |
| `get` abierto | `get: if false` | El cliente nunca lee vínculos —solo escribe—. Abierto, quien averiguara un código sabía de quién era. |
| `delete` abierto | `delete: if false` | El que los borra es el servidor. Abierto, se podía quemar el código de otra persona para que no pudiera vincularse. |

Además `esVinculoValido()` usa `keys().hasOnly(['uid','creadoEn'])`, así que no
se puede colar ningún campo extra.

> **Quién borra qué:** el servidor usa la cuenta de servicio (`api/telegram.ts`),
> que **se saltea las reglas por completo**. Por eso cerrarle `delete` y `get` al
> navegador no le saca nada: el que consume y borra el código sigue pudiendo.

**Verificado en producción**, no supuesto — contra la base real, con una sesión
de verdad y la regla ya desplegada:

| Prueba | Resultado |
|---|---|
| Crear un vínculo con el uid propio | `200` permitido — la vinculación legítima sigue andando |
| Crear un vínculo con el uid de otra persona | `403` rechazado |
| Leer un vínculo (`get`) | `403` rechazado |

> La prueba dejó **dos documentos sueltos** en `vinculos` (los dos casos que sí
> tenían que funcionar). Se borraron a mano desde la consola de Firebase el
> mismo día, uno por uno, y la colección quedó vacía.
>
> **Detalle a tener en cuenta la próxima vez que se pruebe esto:** la regla
> nueva le cierra el `delete` al navegador, así que lo que se crea probando
> **no se puede limpiar desde la app**. O se borra desde la consola, o se hace
> con la cuenta de servicio, que es la única que se saltea las reglas.

## 8. Convenciones

- **UI y comentarios en español rioplatense.** Nombres de código en inglés
  (`status`, `createdAt`), textos al usuario en castellano y **sin jerga**
  (ver punto 7b).
- Nada de `window.confirm` / `alert`: confirmación en dos pasos dentro del panel.
- **Nunca `console.*`**: se usa `log` de `src/lib/logger.ts` (ver punto 7f).
- Se respeta `prefers-reduced-motion` (el confeti se apaga).
- Comandos: `bun run dev`, `bun run build`, `bun run lint`.

## 9. Ideas que quedaron en el tintero

No están hechas. Si se retoman, revisar primero si sirven al objetivo del punto 1.

- Migrar a la nube lo guardado en modo local de emergencia (ver 6b).
- Subtareas / checklist adentro de una tarea grande — bueno para "limpiar",
  que en realidad son 6 cosas chicas. Candidato natural para Groq.
- Tareas recurrentes (limpiar es semanal).
- Modo "5 minutos": timer corto para arrancar sin comprometerse a terminar.
- Vista de historial: qué tachaste esta semana.

## 10. Registro

- **2026-09-19** — Arranque del proyecto. Scaffolding Vite+React+TS, bun, zod.
  Se registró la app web de Firebase que faltaba y se completó el `.env` con
  prefijos `VITE_`. Se borró el JSON de cuenta de servicio. App funcionando
  punta a punta con festejo, racha y notas (verificada en el navegador contra el
  fallback de localStorage).
- **2026-09-19** — Se discutió si las reglas de Firestore alcanzan o hace falta
  un backend propio (ver punto 4b). Se decidió **Auth con Google + reglas por
  uid**. Los datos se movieron a `users/{uid}/tasks`, el store pasó a crearse por
  usuario y se agregó validación de forma en las reglas.

- **2026-09-25** — Se cerró el agujero de `/vinculos` (punto 7p), que permitía
  quedarse con los avisos de Telegram de otra cuenta. Reglas desplegadas con
  `bun run rules` y **verificadas contra producción**: la vinculación propia
  sigue dando `200` y la falsificación ahora da `403`. Salió al revisar el repo
  para hacerlo público — la decisión fue arreglarlo igual, porque estaba mal
  aunque el repo siguiera privado.

- **2026-09-21** — La lista se partió en dos: **Agenda** y **Sin agendar**
  (punto 7o), con el botón 📅 para ponerle fecha desde la tarjeta misma.
  Verificado en el navegador contra la base real: anotar sin fecha cambia solo
  de solapa, agendar mueve la tarea al día correcto (bloque "Miércoles, 23 de
  septiembre") y *Empecé* la manda a "En curso" con su cartel. Las dos tareas
  de prueba se borraron. **Sin verificar: el render en pantalla chica** — la
  ventana del navegador no se dejó achicar, igual que la vez anterior.

- **2026-09-19** — El login con Google quedó funcionando (verificado en el
  navegador: sesión iniciada y nombre en el header). Se reescribió todo el copy
  para sacar jerga técnica, porque la app se va a compartir (punto 7b).

- **2026-09-19** — Se agregó hora límite (`dueTime`) y se hicieron visibles los
  campos de fecha/hora, que estaban transparentes e invisibles.
  **Primer deploy a producción**: push a `main`, que Vercel publica en
  **https://tareas.ginialtech.com** (DNS por Cloudflare, en DNS only).
  Verificado: el sitio carga con HTTPS y las variables `VITE_*` de Vercel
  llegan bien (se ve la pantalla de login, no el modo local).

### Lo que dependió de configuración manual en consolas

**1. Autorizar el dominio de producción — BLOQUEANTE.** Sin esto el login con
Google falla en `tareas.ginialtech.com` aunque el sitio cargue perfecto
(`auth/unauthorized-domain`):

Firebase Console → Authentication → Settings → **Authorized domains** → Add →
`tareas.ginialtech.com`

Chequeado el 2026-09-19: la lista tenía solo `localhost`,
`todo-list-846e2.firebaseapp.com` y `todo-list-846e2.web.app`. Se puede
verificar sin credenciales, porque la `apiKey` es pública:

```
https://identitytoolkit.googleapis.com/v1/projects?key=<VITE_FIREBASE_API_KEY>
```

**2. Reglas con el campo `dueTime`** (no bloqueante, las viejas no lo rechazan):

```bash
bun run fb:login   # abre el navegador, hay que entrar con la cuenta de Google
bun run rules      # despliega firestore.rules al proyecto
```

`firebase-tools` está como devDependency **a propósito**: invocarlo con
`bunx firebase-tools` usa un caché aparte que en esta máquina quedó corrupto
(`Cannot find module 'semver'`) y falla. Usar siempre los scripts de arriba.

> **Error de secuencia que costó caro:** la cuenta de servicio original servía
> para desplegar las reglas sin intervención humana. Se usó para registrar la
> app web y **se borró antes de desplegar las reglas**. Si vuelve a aparecer una
> credencial así: **primero dejar la infraestructura lista, después borrarla.**

Sin eso, Firestore responde `Missing or insufficient permissions`. **La app
igual funciona**: cae al modo local de emergencia y guarda en la computadora.
Lo que no hay hasta desplegar las reglas es sincronización entre dispositivos.

Nota: los errores de *"change in the order of Hooks"* que aparecieron durante el
refactor de auth eran de **Fast Refresh con estado viejo**, no un bug real. Se
van con una recarga completa. Si reaparecen después de mover hooks entre
componentes, recargar antes de salir a buscar el problema.
