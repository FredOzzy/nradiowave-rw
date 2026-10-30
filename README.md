# Nradiowave R/W

Árbol genealógico y wiki de personajes con vínculos de distinta cercanía.

- **Sitio publicado:** https://fredozzy.github.io/nradiowave-rw/
- **Sin cuentas:** quien tenga el enlace puede leer y editar el mismo árbol.
- Los cambios se sincronizan entre dispositivos en tiempo real mediante Firebase Realtime Database.
- Cada dispositivo conserva además una copia local (`localStorage`) y funciona sin conexión.
- Instalable como app (PWA) y con soporte sin conexión.


## Estructura

- `index.html` — estructura de la interfaz.
- `styles.css` — estilos, temas y adaptación móvil.
- `app.js` — estado, almacenamiento, sincronización, editor de fotos y dibujo del árbol.
- `manifest.webmanifest` y `service-worker.js` — soporte PWA.
- `icons/` — iconos de la aplicación.
