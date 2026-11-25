# WG Social Studio

Windows-desktopapp van WG Makelaars voor vastgoedposts, video en publicatie op social media.

## Openen op Windows

Open het [Windows-installatiebestand](https://github.com/maxkruijdenberg-maker/WG_Social_App/releases/latest/download/WG-Social-Studio-Setup.exe) op Windows x64. De installatie maakt automatisch de snelkoppeling **WG Social Studio** met het WG-logo op je bureaublad en in het Startmenu. De app opent gemaximaliseerd binnen het Windows-bureaublad, met de taakbalk en de standaard vensterknoppen.

Je kunt ook de [Windows-zip](https://github.com/maxkruijdenberg-maker/WG_Social_App/releases/latest/download/WG-Social-Studio-Windows.zip) volledig uitpakken en **WG Social Studio.exe** openen. Houd dan de uitgepakte bestanden bij elkaar.

## Werkruimte

- **Post ontwerpen** · upload een woningfoto, kies formaat en onderwerp, stel uitsnede en helderheid in en exporteer als PNG. Gebruik het compositieraster voor uitlijning.
- **Templatebibliotheek** · vind posttemplates onder Verkoop, Verkocht, Open huis en Overig. Beheer hier ook je videotemplates en AI-documentprompts. Importeer een Canva-PNG met een transparante fotozone. De app zet de foto achter het ontwerp. Geïmporteerde tekst en vormgeving zitten vast in de PNG. Een gewoon beeldvoorbeeld levert een basiskleur en passend formaat voor het WG-ontwerp. De bibliotheek wordt lokaal opgeslagen.
- **ChatGPT** · schrijf bijschriften met optionele voorbeeldteksten per onderwerp. Gebruik een OpenAI API-sleutel met API-toegang. De app bewaart de ingevoerde sleutel alleen tijdens de sessie.
- **AI-documenten** · kies een prompt voor een woningbrochure, verkoopvoorstel, bezichtigingsverslag of openhuisdraaiboek, of bewaar je eigen prompt. Voeg je gegevens en notities toe, bewerk het gegenereerde concept en sla het op als Word-compatibel RTF-bestand.
- **Video-editor** · voeg je voorbeeldvideo toe via **Templatebibliotheek → Video** en klik bij het gewenste template op **Gebruiken**. De app bewaart een lokale kopie zodat je die opnieuw kunt gebruiken. Laad in de **Video-editor** het bestand dat je wilt bewerken via **Video inladen**. Voeg eventueel een prompt toe en kies **Maak AI-montage**. Geselecteerde frames, tijdcodes en scèneovergangen gaan naar OpenAI. FFmpeg monteert lokaal vanuit de bronvideo. De AI kan hard cuts maken, fragmenten herordenen, de verhouding wijzigen, kleuren licht corrigeren en bronaudio behouden of dempen. Het WG-logo is optioneel. Bekijk de montage en sla haar op als MP4. Handmatig knippen blijft beschikbaar.

## Facebook en Instagram

1. Koppel in **Meta Business Suite → Instellingen** je professionele Instagram-account (Business of Creator) aan je Facebook-pagina. Gebruik een account met toegang om content op die pagina te plaatsen. [Meta Business Suite](https://business.facebook.com/)
2. Open **Graph API Explorer**, selecteer je Meta-app die Facebook Login en Instagram API met Facebook Login gebruikt, en genereer een **gebruikerstoken** met `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic` en `instagram_content_publish`. Je Meta-app kan een app-rol of aanvullende goedkeuring nodig hebben. [Graph API Explorer](https://developers.facebook.com/tools/explorer/) · [Instagram API met Facebook Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/)
3. Voer in de Explorer een **GET** uit op `/me/accounts?fields=id,name,access_token`. Zoek de juiste Facebook-pagina. Kopieer haar `id` en het `access_token` dat bij die pagina staat. Dit is het **paginatoegangstoken** dat WG Social Studio nodig heeft. Bewaar en deel het token als een wachtwoord.
4. Ga in WG Social Studio naar **Publiceren → Accounts koppelen**. Vul het **Facebook-pagina-ID** en **Meta-paginatoegangstoken** in. Klik op **Accounts koppelen** en controleer de paginanaam en Instagram-gebruikersnaam. De app bewaart het token in het geheugen tot je de app sluit.
5. Vul voor het publiceren van afbeeldingsposts je **Cloudinary-cloudnaam** en een **unsigned** afbeeldingsuploadpreset in. Instagram haalt de JPEG op via een openbare HTTPS-link. De afbeelding blijft in je Cloudinary-account staan. [Cloudinary-uploadpresets](https://cloudinary.com/documentation/upload_presets)
6. Controleer de preview en het bijschrift en klik op **Publiceer op beide**. Gebruik een Instagram-feedformaat van 4:5, vierkant of 1,91:1. Controleer het resultaat per account.

## Ontwikkelen

Gebruik Node.js 24. Installeer met `npm ci` en start met `npm start`. Met `npm run build:win` maak je de Windows-zip in `dist`. GitHub Actions bouwt het installatiebestand met Inno Setup vanuit `scripts/windows-setup.iss`.
