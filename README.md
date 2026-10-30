# Nradiowave R/W

Árbol genealógico y wiki de personajes con vínculos de distinta cercanía.

- **Sitio publicado:** https://fredozzy.github.io/nradiowave-rw/
- **Sin cuentas:** quien tenga el enlace puede leer y editar el mismo árbol.
- Los cambios se sincronizan entre dispositivos en tiempo real mediante Firebase Realtime Database.
- Cada dispositivo conserva además una copia local (`localStorage`) y funciona sin conexión.
- Instalable como app (PWA) y con soporte sin conexión.

## Características

- Fichas de personaje con foto recortable (editor de encuadre y zoom).
- Grupos de familia independientes: cada uno con su propio árbol, personajes y vínculos.
- Contactos y conocidos a un vistazo al pasar el cursor sobre una tarjeta en modo Familia.
- Disposición radial tipo mapa mental al seleccionar un personaje: enfoca solo a su familia y a sus propios contactos (omitiendo conocidos ajenos sin relación con él), con tarjetas dinámicas (héroe para el protagonista, tamaño medio para vínculos directos y compacto para familiares secundarios) para mayor claridad visual; al deseleccionar se restaura el árbol original.
- En modo Todo, los conocidos se agrupan en una franja compacta bajo la familia para no mezclarse con las generaciones.
- Nombre personalizado para cada vínculo («Prima», «Compañero de trabajo», «Vecina»…) manteniendo el color y el grosor del tipo elegido.
- Búsqueda de personajes y vínculos con distinto grosor según la cercanía.
- Árbol organizable, zoom y desplazamiento.
- Temas claro y oscuro automáticos.
- Tipografía del título: [Fredoka](https://github.com/hafontia/Fredoka-One) (SIL Open Font License, incluida en `fonts/`).
- Exportación e importación de respaldos en JSON.

## Sincronización

El árbol compartido vive en una base de datos pública de Firebase. La URL no es
secreta: la seguridad se basa en que solo se comparte el enlace con quien deba
editar. Cualquier persona con la URL puede leer, editar y borrar, así que conviene
exportar respaldos de vez en cuando.

Para configurarla:

1. Crea un proyecto en <https://console.firebase.google.com/>.
2. Abre **Realtime Database** y crea la base de datos.
3. En la pestaña **Rules**, usa lectura y escritura públicas:

   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```

4. Copia la URL de la base de datos (por ejemplo
   `https://mi-proyecto-default-rtdb.firebaseio.com`) en `SYNC_URL`, al principio
   de `app.js`.

Con `SYNC_URL` vacía la aplicación funciona solo en local. El árbol remoto es la
fuente principal al abrir la página; los cambios propios se envían por rutas
concretas y se conservan en una cola si se pierde la conexión.

## Estructura

- `index.html` — estructura de la interfaz.
- `styles.css` — estilos, temas y adaptación móvil.
- `app.js` — fuente legible: estado, almacenamiento, sincronización, editor de fotos y dibujo del árbol.
- `app.min.js` — versión minificada que carga la aplicación.
- `manifest.webmanifest` y `service-worker.js` — soporte PWA.
- `icons/` — iconos de la aplicación.
- `fonts/` — Fredoka (título) y su licencia OFL.

Para regenerar `app.min.js` después de modificar `app.js`, ejecuta desde esta
carpeta:

```sh
npx --yes terser app.js --compress --mangle --comments false --output app.min.js
```

Después, incrementa la versión de caché en `service-worker.js` para que las
instalaciones PWA descarguen el archivo actualizado.
