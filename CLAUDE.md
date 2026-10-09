@AGENTS.md

# Vinlotteri

Kollegialt vinlotteri som erstatter Excel-arket. Se `PRODUCT.md` for brukere og prinsipper, `README.md` for drift og rundeflyt.

## Kommandoer

- `npm run dev` starter på port 3000. Uten `SITE_PIN` i `.env` er siden åpen.
- `npm run seed` lager en demorunde. Demodataene er anonymisert.
- Det finnes ingen tester eller lint. Sjekk endringer med `npx tsc --noEmit` og i nettleseren.
- Produksjon er Docker (Unraid) bak SWAG. GitHub Actions bygger imaget ved hver push til `main`.

## Domene

- Rutenettet er 6×6 og vises alltid **kolonne-rad** ("Rute 5-3" = kolonne 5, rad 3). Interne nøkler som `${row},${col}` er rad først og skal ikke endres.
- Vinneren av 1. premie arrangerer neste runde. Regnskapet er `inn + lodd solgt − kost på polet = videreført` og må alltid gå opp.
- Vipps er manuelt. Vippsnummeret er personlig og byttes hver runde, og deltaker bekrefter at han har betalt. Ikke lov automatisk betalingsbekreftelse, forhåndsfylt beløp eller prisfelt fra Vinmonopolet-nøkkelen (den gir bare navn).
- Alt brukervendt er norsk bokmål. Navnet er "Vinlotteri".
- Én felles `SITE_PIN` låser hele siden, og alle forbi den kan administrere. Det finnes ingen egen admin-innlogging.

## Fallgruver

- Databasen er innebygde `node:sqlite`, ikke `better-sqlite3`. Rader har null-prototype, så bruk `plain()`/`plainAll()` i `lib/repo.ts` før de sendes til klientkomponenter.
- `PublicCell.mine` henger én oppdatering etter en ny reservasjon. Fjern aldri en lokal reservasjon bare fordi `mine` mangler. Fjern den først når serveren aktivt motsier den (ledig, solgt eller reservert på et annet navn).
- Reservasjoner utløper ikke. De varer til de betales eller en arrangør frigjør dem i admin.
- I `components/Grid.tsx`: ikke legg Tailwind-bakgrunn/tekstfarge oppå `STATUS_STYLES`. Velg ett komplett fargesett, ellers kan stilarkrekkefølgen gi uleselige kombinasjoner.
- Repoet er offentlig: ikke committ ekte navn, Vippsnumre, databaser eller `scripts/loddark-*.json`.
- Ved testing mot en gjenbrukt port: sjekk at serverloggen ikke viser EADDRINUSE, ellers svarer en gammel server.
