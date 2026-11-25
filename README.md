# WG Social Studio

Windows-desktopapp van WG Makelaars voor vastgoedposts, video en publicatie op social media.

## Openen op Windows

Open het [Windows-installatiebestand](https://github.com/maxkruijdenberg-maker/WG_Social_App/releases/latest/download/WG-Social-Studio-Setup.exe) op Windows x64. De installatie maakt automatisch de snelkoppeling **WG Social Studio** op je bureaublad en in het Startmenu.

Je kunt ook de [Windows-zip](https://github.com/maxkruijdenberg-maker/WG_Social_App/releases/latest/download/WG-Social-Studio-Windows.zip) volledig uitpakken en **WG Social Studio.exe** openen. Houd dan de uitgepakte bestanden bij elkaar.

## Werkruimte

- **Post ontwerpen** · upload een woningfoto, kies formaat en onderwerp, stel uitsnede en helderheid in en exporteer als PNG. Gebruik het compositieraster voor uitlijning en **F11** voor volledig scherm.
- **Templates** · importeer een Canva-PNG met een transparante fotozone. De app zet de foto achter het ontwerp. Geïmporteerde tekst en vormgeving zitten vast in de PNG. Een gewoon beeldvoorbeeld levert een basiskleur en passend formaat voor het WG-ontwerp. De bibliotheek wordt lokaal opgeslagen.
- **ChatGPT** · schrijf bijschriften met optionele voorbeeldteksten per onderwerp. Gebruik een OpenAI API-sleutel met API-toegang. De app bewaart de ingevoerde sleutel alleen tijdens de sessie.
- **Video-editor** · open bron en voorbeeld, voeg eventueel een prompt toe en kies **Maak AI-montage**. Geselecteerde frames, tijdcodes en scèneovergangen gaan naar OpenAI. FFmpeg monteert lokaal vanuit de bronvideo. De AI kan hard cuts maken, fragmenten herordenen, de verhouding wijzigen, kleuren licht corrigeren en bronaudio behouden of dempen. Het WG-logo is optioneel. Bekijk de montage en sla haar op als MP4. Handmatig knippen blijft beschikbaar.

## Facebook en Instagram

1. Koppel een professioneel Instagram-account aan je Facebook-pagina. Gebruik een Meta-paginatoegangstoken dat die pagina mag beheren en publiceren, inclusief `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic` en `instagram_content_publish` waar vereist door je Meta-app. Meta kan aanvullende goedkeuring of een app-rol vereisen.
2. Vul op het tabblad **Publiceren** het Facebook-pagina-ID en paginatoegangstoken in. Kies **Accounts koppelen** en controleer beide namen. Het token blijft in het geheugen tot je de app sluit.
3. Vul je Cloudinary-cloudnaam en een **unsigned** afbeeldingsuploadpreset in. De app uploadt de uiteindelijke afbeelding als openbare JPEG, zodat Instagram die zelf kan ophalen. De afbeelding blijft in je Cloudinary-account staan.
4. Controleer de preview en het bijschrift en kies **Publiceer op beide**. Kies een Instagram-feedformaat van 4:5, vierkant of 1,91:1. De app toont het resultaat voor elk account. Als één platform faalt, controleer beide accounts voordat je de post elders opnieuw plaatst.

## Ontwikkelen

Gebruik Node.js 24. Installeer met `npm ci` en start met `npm start`. Met `npm run build:win` maak je het installatiebestand en de Windows-zip in `dist`.
