# WG Social Studio

Windows-desktopapp voor het maken van vastgoedposts, het schrijven van bijschriften en het knippen van video's.

## Openen op Windows

Pak de Windows-zip volledig uit en open **WG Social Studio.exe**. Houd de bestanden uit de zip bij elkaar. Deze versie is gebouwd voor Windows x64.

## Werkruimte

- **Post ontwerpen** · kies een onderwerp, upload een woningfoto en pas uitsnede, helderheid en tekst aan. Exporteer de post als PNG.
- **Templates** · importeer een Canva-PNG met een transparante fotozone. De app zet de foto achter het ontwerp. Geïmporteerde tekst en vormgeving zitten vast in de PNG. Een gewoon beeldvoorbeeld levert een basiskleur en een passend standaardformaat voor het WG-ontwerp. De bibliotheek wordt lokaal opgeslagen.
- **ChatGPT** · geef een opdracht en voeg eventueel een voorbeeldtekst per onderwerp toe. Gebruik een OpenAI API-sleutel met API-toegang. De sleutel wordt tijdens de sessie gebruikt en niet opgeslagen door de app.
- **Video-editor** · open een compatibele video, markeer de begin- en eindtijd, zet het geluid zo nodig uit en exporteer het fragment als MP4.

## Ontwikkelen

Gebruik Node.js 24. Installeer met `npm ci` en start met `npm start`. Met `npm run build:win` maak je de Windows-zip in `dist`.
