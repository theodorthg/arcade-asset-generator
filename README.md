# Arcade Asset Generator

**Online:** https://theodorthg.github.io/arcade-asset-generator/

Prozedurale Pixelgrafik und Sounds für MakeCode Arcade (16-Farben-Palette): Parallax-Hintergründe,
Tiles, Spielfigur, Gegner, Boss, Items, Soundeffekte und Melodien. Gleicher Seed = gleiches Ergebnis.

- `index.html` – Website (Vorschau, Einstellungen, Code kopieren, PNG, „Alles als assets.ts“)
- `assetgen.js` – Grafik-Kern, läuft im Browser und in Node (`require('./assetgen.js')`)
- `soundgen.js` – Sound-Kern (Effekte → `music.createSoundEffect`, Melodien → `music.Melody`)
- `tools/sheet.js` – rendert eine Übersicht als PNG: `node tools/sheet.js out.png <seed>`

Website lokal starten (wegen des Script-Imports über einen kleinen Server):

    python3 -m http.server 8090 --directory generator

und http://localhost:8090 öffnen. Die Seite kommt ohne Build und ohne externe Abhängigkeiten aus
und lässt sich auf jeden statischen Webspace kopieren.

Wird u. a. von [pxt-pixelquest](https://github.com/theodorthg/pxt-pixelquest) genutzt.

## Lizenz

MIT
