# Hoy sí ✦

Una todo list pensada para **arrancar**, no para administrar tareas.

Anotás algo, apretás **Empecé**, y cuando lo tachás te dice cuánto tardó de
verdad. Casi siempre es menos de lo que imaginabas.

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
| `bun run build` | Chequeo de tipos + build de producción en `dist/` |
| `bun run preview` | Ver el build ya compilado |
| `bun run lint` | oxlint |
| `bun run fb:login` | Entrar a Firebase desde la terminal (abre el navegador) |
| `bun run rules` | Desplegar `firestore.rules` |

## Cómo está armado

- **React 19 + Vite + TypeScript**, sin framework de servidor. No hay rutas ni
  SEO que justifiquen algo más pesado.
- **zod** valida todo lo que entra desde afuera: si un documento viene roto se
  descarta esa tarea sola, en vez de romper la app entera.
- **Firestore** guarda las tareas en `users/{uid}/tasks`, con login de Google.
- **Storage enchufable**: si falta config de Firebase —o si la nube rechaza la
  conexión— cae solo a guardar en el navegador y te lo avisa. Un problema de
  infraestructura nunca deja la app inutilizable.

Mirá el badge de arriba a la derecha para saber dónde están tus cosas:
**"Guardado en la nube"** o **"Solo en esta compu"**.

## Seguridad

Las reglas de Firestore (`firestore.rules`) **se evalúan en los servidores de
Google**, no en el navegador: cada usuario entra solo a su propia carpeta, y se
valida la forma de cada documento. Aunque alguien reescriba el JavaScript del
cliente, no puede saltearlas.

La config `VITE_FIREBASE_*` viaja en el bundle y eso está bien: es pública por
diseño en toda app web de Firebase y no da acceso a nada.

> **Regla del proyecto:** ninguna clave privada toca el navegador. Todo lo que
> necesite un secreto va en el backend. Ver `AGENTS.md`.

## Desplegar

El proyecto está conectado a **Vercel** (las variables de entorno se configuran
ahí, con el prefijo `VITE_`). Vercel detecta Vite solo: build `vite build`,
salida `dist/`.

Después de conectar un dominio nuevo hay que **autorizarlo en Firebase**:
Console → Authentication → Settings → Authorized domains. Si no, el login con
Google falla en producción.

## El porqué de cada decisión

Está todo en [AGENTS.md](./AGENTS.md) — es la bitácora del proyecto y se
actualiza cada vez que se decide algo.
