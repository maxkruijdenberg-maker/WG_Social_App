# WG Social Studio

Windows-desktopapp van WG Makelaars voor het maken van vastgoedposts, documenten en video’s.

## Openen op Windows

Open het [Windows-installatiebestand](https://github.com/maxkruijdenberg-maker/WG_Social_App/releases/latest/download/WG-Social-Studio-Setup.exe) op Windows x64. De installatie maakt automatisch de snelkoppeling **WG Social Studio** met het WG-logo op je bureaublad en in het Startmenu. De app opent gemaximaliseerd binnen het Windows-bureaublad, met de taakbalk en de standaard vensterknoppen.

Je kunt ook de [Windows-zip](https://github.com/maxkruijdenberg-maker/WG_Social_App/releases/latest/download/WG-Social-Studio-Windows.zip) volledig uitpakken en **WG Social Studio.exe** openen. Houd dan de uitgepakte bestanden bij elkaar.

## Werkruimte

- **Post ontwerpen** · upload een woningfoto, kies formaat en onderwerp, stel uitsnede en helderheid in en exporteer als PNG. Gebruik het compositieraster voor uitlijning.
- **Templatebibliotheek** · vind posttemplates onder Verkoop, Verkocht, Open huis en Overig. In diezelfde categorieën kun je eigen bijschriftprompts opslaan, wijzigen en opnieuw gebruiken. Beheer hier ook je videotemplates en AI-documentprompts. Importeer een Canva-PNG met een transparante fotozone. De app zet de foto achter het ontwerp. Geïmporteerde tekst en vormgeving zitten vast in de PNG. Een gewoon beeldvoorbeeld levert een basiskleur en passend formaat voor het WG-ontwerp. De bibliotheek wordt lokaal opgeslagen.
- **ChatGPT** · schrijf bijschriften met optionele voorbeeldteksten per onderwerp. Gebruik de opgeslagen OpenAI API-sleutel uit **Instellingen**.
- **AI-documenten** · kies een prompt voor een woningbrochure, verkoopvoorstel, bezichtigingsverslag of openhuisdraaiboek, of bewaar je eigen prompt. Voeg je gegevens en notities toe, bewerk het gegenereerde concept en sla het op als Word-compatibel RTF-bestand.
- **Video-editor** · voeg je voorbeeldvideo toe via **Templatebibliotheek → Video** en klik bij het gewenste template op **Gebruiken**. De app bewaart een lokale kopie zodat je die opnieuw kunt gebruiken. Laad in de **Video-editor** het bestand dat je wilt bewerken via **Video inladen**. Voeg eventueel een prompt toe en kies **Maak AI-montage**. Met **Vast WG-woningtourtemplate toepassen** blijven de eerste twee seconden en de laatste camerabeweging op normale snelheid. De AI gebruikt frames en tijdcodes om tussenliggende versnellingen te sturen. Bij voldoende bronmateriaal mikt de app op 26,6 seconden. De adresbalk krimpt tot een huisje linksonder en hetzelfde huisje groeit tijdens de laatste beweging uit tot een contactkaart van 2,6 seconden. De MP4 heeft geen audiospoor. Vul het adres, de plaats en contactregels in en gebruik woningbeelden zonder ingebakken titels. Voor de analyse gebruikt de app standaard GPT‑6.2 Astra. In Instellingen kun je ook GPT‑6.2 Sol kiezen. Bekijk de montage en klik naast **Maak AI-montage** op **Download MP4**. Handmatig knippen blijft beschikbaar.

## OpenAI instellen

Ga naar **Instellingen**, plak je OpenAI API-sleutel en klik op **Sleutel opslaan**. Windows versleutelt de sleutel voor je gebruikersaccount. ChatGPT, documenten en videomontage gebruiken hem na een herstart automatisch opnieuw. Een opgeslagen sleutel krijgt een vinkje en het invoerveld wordt vergrendeld. Kies **Sleutel verwijderen** om een nieuwe sleutel in te voeren.

Onder **OpenAI-model** kun je Astra of Sol kiezen voor alle AI-functies. In de automatische stand gebruikt de app GPT‑6.2 Sol voor tekst en GPT‑6.2 Astra voor video. Bij ontbrekende modeltoegang probeert de app een terugvalmodel en vermeldt het gebruikte model bij het resultaat. Controleer bij OpenAI of het API-project modeltoegang en voldoende API-tegoed heeft. [OpenAI API-sleutels](https://platform.openai.com/api-keys)

## Ontwikkelen

Gebruik Node.js 24. Installeer met `npm ci` en start met `npm start`. Met `npm run build:win` maak je de Windows-zip in `dist`. GitHub Actions bouwt het installatiebestand met Inno Setup vanuit `scripts/windows-setup.iss`.
