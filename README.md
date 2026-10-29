# Nradiowave R/W

Árbol genealógico y wiki de personajes con vínculos de distinta cercanía.

- **Sitio publicado:** https://fredozzy.github.io/nradiowave-rw/
- Aplicación estática, sin dependencias ni backend.
- Los datos se guardan en el navegador (`localStorage`) y se pueden exportar/importar en JSON.
- Instalable como app (PWA) y con soporte sin conexión.

## Características

- Fichas de personaje con foto recortable (editor de encuadre y zoom).
- Secciones, búsqueda y filtros por familia/amistades.
- Vínculos con distinto grosor según la cercanía.
- Árbol organizable, zoom y desplazamiento.
- Temas claro y oscuro automáticos.
- Exportación e importación de respaldos.

## Desarrollo local

Abre `index.html` en el navegador o sirve la carpeta con cualquier servidor estático:

```bash
python3 -m http.server 8123
```

Luego visita <http://127.0.0.1:8123>.

## Estructura

- `index.html` — estructura de la interfaz.
- `styles.css` — estilos, temas y adaptación móvil.
- `app.js` — estado, almacenamiento, editor de fotos y dibujo del árbol.
- `manifest.webmanifest` y `service-worker.js` — soporte PWA.
- `icons/` — iconos de la aplicación.
