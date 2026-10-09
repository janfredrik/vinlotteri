# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Buyers:** colleagues at one office, on phone or desktop in roughly equal measure. They open the round (often via the QR poster's magic link), look at the prizes, pick one or more free squares on the 6×6 grid, type their name or initials, and pay the organiser with Vipps.
- **Organiser:** whoever won 1st prize last round arranges the next one. They set the Vippsnummer and prizes, tick off payments as they arrive, and register the draw results after rolling physical dice (or run the digital draw). Nobody watches the app on a shared screen; the draw happens in the room and the organiser types in the outcome.

## Product Purpose

Replace the office wine-lottery spreadsheet. One weekly round: 36 squares at a fixed ticket price, prizes bought at Vinmonopolet, winners drawn Friday afternoon. Success is that buying a square takes seconds, the organiser never has to reconcile money by hand, and the history (money carried forward, who wins, which squares win) builds itself.

## Positioning

A private, self-hosted ritual tool for one office, not a product for sale. It knows this lottery's actual rules: col-row squares, the winner arranges next week, the money carried forward reconciles exactly against the old spreadsheet.

## Operating Context

- Weekly rhythm: the round opens early in the week, the square limit per person lifts Friday 14:30, sales close Friday 15:00, then the draw.
- Payment is manual Vipps to a personal number that changes every round; there is no Vipps API. The organiser ticks off payments.
- Prizes are Vinmonopolet products (item number → image, name via API; price and volume entered by hand).
- Draw is physical dice (column, row; an empty square means roll again) or a digital draw with a verifiable seed.
- Whole site behind one shared PIN; anyone past it can also administer.

## Capabilities and Constraints

- Next.js 16 App Router, Tailwind 4, `node:sqlite`, self-hosted in Docker on Unraid behind SWAG.
- Live grid via Server-Sent Events; squares held for the buyer until paid.
- Squares are always shown as **kolonne-rad** ("Rute 5-3" = column 5, row 3).
- Routes: `/runde/[id]` (buy, and winners once drawn), `/historikk` (history, stats, win heatmap), `/admin` + `/admin/runde/[id]` (settings, prizes, sales, draw, settle), `/apne` (PIN unlock).

## Brand Commitments

- The name is **Vinlotteri**.
- All user-facing copy is Norwegian bokmål.
- The Vipps payment button is the official `<vipps-mobilepay-button>`, unmodified.
- Everything else (colours, emoji, type) is open.

## Evidence on Hand

- Real history lives only in the organiser's local database (imported from the old spreadsheet); none of it is in the repo.
- Prize images come from Vinmonopolet at runtime.
- No logo or other brand assets exist.

## Product Principles

1. Buying a square is a few seconds' work on any device.
2. The organiser's weekly chores (payments, draw entry, settling) should be quick and hard to get wrong.
3. The money must always add up, and the app shows how.
4. It's a Friday office ritual among colleagues, so it should feel warm and a bit fun, never like a bank or a casino.
