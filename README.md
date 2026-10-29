# Nradiowave R/W

Árbol genealógico y wiki de personajes con vínculos de distinta cercanía.

- **Sitio publicado:** https://fredozzy.github.io/nradiowave-rw/
- **Sin cuentas:** quien tenga el enlace puede leer y editar el mismo árbol.
- Los cambios se sincronizan entre dispositivos en tiempo real mediante Firebase Realtime Database.
- Cada dispositivo conserva además una copia local (`localStorage`) y funciona sin conexión.
- Instalable como app (PWA) y con soporte sin conexión.

## Características

- Fichas de personaje con foto recortable (editor de encuadre y zoom).
- Secciones, búsqueda y filtros por familia/amistades.
- Vínculos con distinto grosor según la cercanía.
- Árbol organizable, zoom y desplazamiento.
- Temas claro y oscuro automáticos.
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

## Desarrollo local

Abre `index.html` en el navegador o sirve la carpeta con cualquier servidor estático:

```bash
python3 -m http.server 8123
```

Luego visita <http://127.0.0.1:8123>.

## Estructura

- `index.html` — estructura de la interfaz.
- `styles.css` — estilos, temas y adaptación móvil.
- `app.js` — estado, almacenamiento, sincronización, editor de fotos y dibujo del árbol.
- `manifest.webmanifest` y `service-worker.js` — soporte PWA.
- `icons/` — iconos de la aplicación.
