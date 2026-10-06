# ¿Adónde vamos? — notas para Claude

Web estática (sin build) publicada en GitHub Pages: https://josedavide.github.io/donde-vamos/
Ideas de salidas en autocaravana (7 m, familia con niños) desde Mataró, radio ~5 h de coche.

## Estructura
- `index.html` — marcado; carga Leaflet 1.9.4 desde cdnjs, `assets/icons.js`, `assets/app.js`.
- `assets/app.js` — toda la lógica (vanilla JS). Los puntos se pintan en un único canvas
  (`SymLayer`, sprites pre-renderizados) por rendimiento: no usar marcadores DOM ni clusters.
- `assets/app.css` — estilos; tokens de color en `:root` (claro/oscuro).
- `data/places.json` — `{"actualizado":"YYYY-MM-DD","items":[...]}`, un punto por línea.
- `data/photos.json` — `{id:{img,src,site,fecha}}` generado por `scripts/fetch_photos.py`
  (GitHub Action semanal `photos.yml`). No editar a mano.
- Datos del usuario (favoritos, vistos, salidas) viven en `localStorage` del navegador
  (`dv-est`, `dv-ui`); hay exportar/importar JSON en Guardados.

## Actualizar datos
1. Editar `data/places.json` (mantener un objeto por línea, ids estables: cambiar un id pierde favoritos/vistos).
2. Actualizar `actualizado`.
3. Eventos pasados (`fecha_fin` < hoy) se pueden borrar; la app ya los oculta.
4. Validar: `python3 -c "import json;json.load(open('data/places.json'))"`.
5. Commit + push a `main` → se publica solo (`pages.yml`). Las fotos de puntos nuevos se buscan solas.

## Esquema de un punto
```
id            slug único con prefijo ev- | vi- | na- | pe- | ru-
nombre, capa  capa: evento | visita | naturaleza | pernocta | ruta
tipos         vocabulario cerrado: feria, fiesta, mercado, medieval, festival, gastronomia, musica,
              navidad, ciudad, pueblo, castillo, museo, monumento, parque-animales, parque-tematico,
              playa, montana, paseo, lago, rio, cueva, mirador, tren, area-ac, camping, parking
lat, lng      WGS84
municipio, zona, pais (ES | FR | AD)
fecha_inicio, fecha_fin   YYYY-MM-DD (solo eventos; si es un día, iguales)
horario, temporada        texto breve o null
ninos         bool
ac7m          si | cerca | no | desconocido  (acceso/aparcamiento con autocaravana de 7 m)
precio        gratis | pago | desconocido;  precio_txt opcional
descripcion   ≤ ~220 caracteres, redactada con palabras propias (no copiar la fuente)
consejo       opcional, consejo práctico (foros/opiniones) con palabras propias
url, fuente   fuente principal (oficial si existe)
verificado    YYYY-MM-DD
```
Capa `ruta` añade: `dias`, `km_total`, `paradas:[{nombre,lat,lng,dia,tipo,nota}]`, `fuentes:[{nombre,url}]`.

## Fuentes habituales
Agenda: agenda.cat / turismo comarcales / Tourisme Occitanie / Pyrénées-Orientales / Aragón, Andorra.
Pernocta: park4night, Caramaps, áreas municipales. Rutas: foros y blogs de autocaravanas.

## Probar en local
`python3 -m http.server` en la raíz y abrir http://localhost:8000
