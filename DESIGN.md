---
name: Vinlotteri
description: Kollegialt vinlotteri for ett kontor; en varm fredagsritual i vin, plomme og gull rundt et 6×6 rutenett.
colors:
  cream: "#fbf6ef"
  parchment: "#f3e9db"
  paper: "#ffffff"
  wine: "#7b1e3b"
  wine-dark: "#5a1029"
  plum: "#2c0a14"
  cellar: "#1c060d"
  gold: "#c2933a"
  gold-soft: "#e7cf9c"
  sage: "#4c6b52"
typography:
  display:
    fontFamily: "Georgia, \"Iowan Old Style\", \"Palatino Linotype\", \"Times New Roman\", serif"
    fontSize: "clamp(4.5rem, 30cqmin, 15rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Georgia, \"Iowan Old Style\", \"Palatino Linotype\", \"Times New Roman\", serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Georgia, \"Iowan Old Style\", \"Palatino Linotype\", \"Times New Roman\", serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.025em"
  coordinate:
    fontFamily: "Georgia, \"Iowan Old Style\", \"Palatino Linotype\", \"Times New Roman\", serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "\"lnum\" 1, \"tnum\" 1"
  wrapped-headline:
    fontFamily: "Georgia, \"Iowan Old Style\", \"Palatino Linotype\", \"Times New Roman\", serif"
    fontSize: "clamp(1.6rem, 9.5cqmin, 4.5rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  wrapped-name:
    fontFamily: "Georgia, \"Iowan Old Style\", \"Palatino Linotype\", \"Times New Roman\", serif"
    fontSize: "clamp(2.2rem, 15cqmin, 7rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
  wrapped-body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "clamp(1rem, 4.6cqmin, 1.9rem)"
    fontWeight: 400
    lineHeight: 1.4
  wrapped-note:
    fontFamily: "Georgia, \"Iowan Old Style\", \"Palatino Linotype\", \"Times New Roman\", serif"
    fontSize: "clamp(1.05rem, 5cqmin, 2.2rem)"
    fontWeight: 400
    lineHeight: 1.3
  wrapped-caps:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "clamp(0.7rem, 3.2cqmin, 1.3rem)"
    fontWeight: 600
    letterSpacing: "0.32em"
rounded:
  square: "0.375rem"
  control: "0.5rem"
  panel: "1rem"
  stage: "1.25rem"
  pill: "9999px"
spacing:
  hairline: "4px"
  grid-gap-wide: "6px"
  tight: "8px"
  inset: "16px"
  inset-wide: "20px"
  section: "24px"
  page-max: "64rem"
components:
  button-primary:
    backgroundColor: "{colors.wine}"
    textColor: "{colors.cream}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.wine-dark}"
    textColor: "{colors.cream}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.wine}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "44px"
  button-quiet:
    textColor: "{colors.plum}"
    rounded: "{rounded.square}"
    padding: "0 8px"
    height: "36px"
  button-danger:
    backgroundColor: "{colors.wine-dark}"
    textColor: "{colors.cream}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "44px"
  button-danger-hover:
    backgroundColor: "{colors.plum}"
  input-text:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.plum}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  square-available:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.plum}"
    typography: "{typography.coordinate}"
    rounded: "{rounded.square}"
    height: "48px"
  square-sold:
    backgroundColor: "{colors.wine}"
    textColor: "{colors.cream}"
    rounded: "{rounded.square}"
    height: "48px"
  square-won:
    backgroundColor: "{colors.gold-soft}"
    textColor: "{colors.plum}"
    rounded: "{rounded.square}"
    height: "48px"
  grid-tray:
    backgroundColor: "{colors.parchment}"
    rounded: "{rounded.panel}"
    padding: "8px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.plum}"
    rounded: "{rounded.panel}"
    padding: "16px"
  dialog:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.plum}"
    rounded: "{rounded.panel}"
  nav-chip:
    textColor: "{colors.plum}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  wrapped-band:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.cream}"
    rounded: "{rounded.panel}"
    padding: "20px"
  wrapped-card-plum:
    backgroundColor: "{colors.plum}"
    textColor: "{colors.cream}"
  wrapped-card-wine:
    backgroundColor: "{colors.wine-dark}"
    textColor: "{colors.cream}"
  wrapped-card-red:
    backgroundColor: "{colors.wine}"
    textColor: "{colors.cream}"
  wrapped-pill:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.plum}"
    rounded: "{rounded.pill}"
    height: "48px"
---

# Design System: Vinlotteri

## Overview

**Creative North Star: "The Office Wine Cellar"**

Vinlotteri is a weekly ritual among colleagues, set in the colours of a wine cellar: a cream table, parchment trays, wine-red squares, gold for anything that won, and deep plum for ink. The 6×6 board is the object everyone gathers around, so the whole system speaks in squares. Squares are free (white), held (gold hatch), sold (wine) or won (gold), and the same square stands in for you (your initials on a sold square), for the PIN slots, the 404 dice and the Wrapped illustrations. It is warm and a little playful, never a bank and never a casino.

The everyday surfaces are light and calm: cream ground, white cards with hairline plum borders, a Georgia serif for headings and grid coordinates, and a system sans for everything you read or press. Delight lives in small, authored motion: a locked square shakes its head, a wine glass fills as you type the PIN, the first-prize square glows, the winner surfaces out of a blur. Every one of these switches off under reduced motion.

Wrapped ("Årgang") is the same world, poured dark. The year is a bottle: plum and wine fields fill whole cards, gold is the label print, cream is the text, and the board comes back as the illustration. It is a section of this system, not a second identity.

**Key Characteristics:**
- Cream ground, plum ink, wine as the action colour, gold reserved for wins, "mine" and label print.
- Georgia display serif for headings, coordinates and tasting notes; system sans for body and controls.
- One square language everywhere, always read kolonne-rad.
- Soft, plum-tinted depth; no neutral grey shadows in the light app.
- Small authored motions with an ease-out-expo feel, all off under reduced motion.

## Colors

A warm cellar palette: two reds and a near-black plum carry the weight, gold marks what is special, and cream and parchment keep the light surfaces soft.

### Primary
- **Wine** (#7b1e3b): the action colour. Primary buttons, sold squares, page titles, links on hover, the focus ring, caret and native accent colour. In Wrapped it is the brightest card field.
- **Wine Dark** (#5a1029): hover for primary, the danger button, the border of sold squares, and the middle Wrapped card field.

### Secondary
- **Cellar Gold** (#c2933a): wins and "mine". The gold ring around your own squares, the won-square border, the first-prize glow, the "Deg!" chip, the scan line, and the label print on plum and wine-dark Wrapped cards.
- **Pale Gold** (#e7cf9c): the soft side of gold. Won-square fill, the held-square hatch base, selection highlight, shimmer, and the print colour on the wine card where full gold would be too close in value.

### Tertiary
- **Sage** (#4c6b52): confirmation only. Success toasts, ticked payment steps in the guide, filled link fields.

### Neutral
- **Plum Ink** (#2c0a14): all text on light surfaces, at 60–75% for secondary text and 10–20% for hairline borders. The darkest Wrapped field and the Årgang band in /superadmin.
- **Cream** (#fbf6ef): the page ground, the theme colour, dialogs and popovers; text on every dark field.
- **Parchment** (#f3e9db): the tray the grid sits in (at 70%), blocked squares, table header rows.
- **Paper White** (#ffffff): cards, inputs, free squares, secondary buttons.
- **Cellar Black** (#1c060d): the Wrapped stage behind the card, lit from above by a wine radial glow.

### Named Rules
**The One Complete Set Rule.** Each square state owns a full background, text and border set. Never layer another background or text colour on top of a state; pick a different complete set instead.

**The Gold Means Yours Rule.** Gold marks what won, what is yours, or label print. It is not a general accent, not body text on cream, and never a fill for a whole Wrapped card.

**The Season Stays Inside Rule.** Seasonal themes are picked by hand per round, never by date. Jul and påske re-tint wine, wine-dark, gold, gold-soft and sage only inside the round's own wrapper; the header and site chrome keep the house palette. Halloween is the one exception: night falls over the whole page, chrome included, by inverting the palette tokens. Each visitor can turn a theme off beside Regler.

## Typography

**Display Font:** Georgia (with Iowan Old Style, Palatino Linotype, Times New Roman, serif)
**Body Font:** system sans (ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto)

**Character:** A bookish, wine-list serif against a plain working sans. The serif carries names, headings, numbers on the board and tasting notes; the sans keeps forms, prices and buttons quick to read.

### Hierarchy
- **Display** (600, clamp to 15rem, line-height 1, −0.04em): only the year on the Wrapped label, set huge as if letterpressed.
- **Headline** (600, 1.875rem, −0.01em, wine): page titles such as "Historikk", "Arrangør" and the round title.
- **Title** (600, 1.25rem, plum): section headings inside a page ("Alle runder", "Dine tall"), dialog and prize titles.
- **Body** (400, 1rem, sans): reading text and controls; secondary lines at 0.875rem in plum at 60%.
- **Label** (600, 0.875rem, 0.025em, uppercase, plum at 60%): the quiet section heading over the buyer grid and accounts ("Velg en ledig rute", "Betaling"). It is the heading itself, never a line stacked above another heading.
- **Coordinate** (600, 0.75rem, serif, lining tabular figures, wine at 80%): grid row and column numbers and the "5-3" inside free squares.

### Named Rules
**The Serif Speaks, Sans Works Rule.** Headings, names, coordinates and notes are Georgia; anything you fill in, tap or scan for a price is sans.

**The Lining Board Rule.** Numbers on the buying grid use lining, tabular figures so columns line up. Wrapped deliberately keeps Georgia's old-style figures, because they read like a printed label.

## Layout

The app is a single centred column, 64rem wide at most, with 16px gutters and 24px between sections. Pages stack: header with title and one status line, then the grid, then prizes, payment and accounts. Wider screens add a second column only in history (`1fr auto` from 1024px). Content is dense but never cramped: 16px inside cards, 4px between grid squares (6px from 640px), 8px around the grid inside its parchment tray.

The grid is a 6×6 board with a narrow row-number column on the left and column numbers along the top. Squares are 48px tall on phones and 64px from 640px, 36px in the compact variant. The sticky header blurs over cream at 80%.

Wrapped is a full-screen stage. On phones the card fills the viewport; from 640px it is a 9:16 card up to 58rem tall with rounded corners and side arrows; the big-screen mode (`?vis=storskjerm`) widens to a 5:4 field. Everything inside a card is sized from the card in `cqmin`, so the same card reads on a phone, a laptop and a projector. Cards pad generously (about 11% top, 8% sides) and push the illustration to the vertical middle, with the tasting note at the foot.

## Elevation & Depth

Mostly flat, with soft plum-tinted shadows used to lift what you can touch or what just happened. Cards sit on cream with a hairline plum border and the smallest shadow. Sold squares and PIN slots get a faint inner top highlight so they read as pressed tiles. Dialogs and popovers float on long, low plum shadows over a plum scrim at 45%. Gold glows belong only to winning squares and the prize scan.

### Shadow Vocabulary
- **Resting square** (`box-shadow: 0 1px 0 rgba(44,10,20,0.06)`): free squares.
- **Sold tile** (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 1px 2px rgba(44,10,20,0.25)`): sold squares and your profile square.
- **Pickable hover** (`box-shadow: 0 3px 8px rgba(123,30,59,0.15)`): a free square lifting 1px under the pointer.
- **Won square** (`box-shadow: 0 2px 4px rgba(194,147,58,0.35)`): non-first winners; first prize pulses with the winner glow.
- **Dialog** (`box-shadow: 0 20px 50px -12px rgba(44,10,20,0.45)`): buy and prize dialogs.
- **Popover** (`box-shadow: 0 12px 32px -8px rgba(44,10,20,0.28), 0 2px 6px rgba(44,10,20,0.08)`): the rules panel.
- **Band** (`box-shadow: 0 18px 40px -22px rgba(44,10,20,0.9)`): the dark Årgang band in history.
- **Stage card** (`box-shadow: 0 30px 80px -24px rgba(0,0,0,0.75)`): the Wrapped card on desktop, over cellar black.

### Named Rules
**The Plum Shadow Rule.** On light surfaces shadows are tinted with plum, never neutral grey or black. Only the Wrapped stage, already near-black, uses a black shadow.

## Shapes

Gently rounded throughout, never sharp and never blobby. Squares and small controls use 6px corners, buttons and inputs 8px, cards, trays and dialogs 16px, the Wrapped card frame 20px. Pills (fully round) are for navigation chips, the "Deg!" chip, the overtime pill and the Wrapped call-to-action. Hatching is a shape language of its own: a 45° stripe means "in limbo" (held squares, the overtime pill), a faint plum hatch means blocked or empty. Dashed borders mean "not yet chosen" (the empty profile square, empty PIN slots). The crown, a small filled SVG, marks first prize everywhere.

### Named Rules
**The Square Language Rule.** When something stands for a lodd, a person or a count, draw it as a square in the grid's own states. The board is always 6×6 and always read kolonne-rad.

## Components

### Buttons
Confident but unshowy, sized for thumbs.
- **Shape:** gently curved (8px), at least 44px tall.
- **Primary:** wine fill, cream text, semibold, 8px × 20px padding; hover deepens to wine-dark; disabled turns plum at 25% with plum text at 70%.
- **Secondary:** white fill, wine text, wine border at 40% that goes full on hover.
- **Quiet:** text-only plum at 70%, 36px tall; hover turns wine and underlines.
- **Danger:** wine-dark fill, hover to plum. Irreversible actions use a two-step confirm button instead of the native confirm dialog.
- **Focus:** a 2px wine outline offset by 2px, everywhere.

### Chips
- **Navigation chip:** pill with a plum hairline at 15%, plum text at 70%, hover to wine border and text.
- **"Deg!" chip:** gold pill, plum 10px semibold uppercase, marking your own wins in lists.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** paper white for content cards; parchment at 70% for the grid tray; pale gold at 20–40% with a gold border for "for deg" notices; plum for the Årgang band.
- **Shadow Strategy:** resting card shadow only (see Elevation).
- **Border:** plum hairline at 10%.
- **Internal Padding:** 16px, 20px from 640px.

### Inputs / Fields
- **Style:** white fill, plum hairline at 20%, 8px corners, 8px × 12px padding, 16px text so phones do not zoom.
- **Focus:** the global wine focus ring; caret and native accent in wine.
- **Placeholder:** plum at 62% mixed with white.
- **Error:** a wine semibold line under the field, announced as an alert.

### Navigation
A sticky cream header with a hairline bottom border and backdrop blur. The wordmark "Vinlotteri" is the serif in wine; links are small sans in plum at 70% that turn wine on hover; the profile shows as your square.

### The Grid
The signature component. A parchment tray holding a 6×6 board of squares with serif coordinates. Free squares show "kolonne-rad" in small serif and swap to a "+" on hover, lifting 1px. Held squares are pale gold with a gold hatch; sold squares are wine with the buyer's name in cream; won squares are pale gold with a 2px gold border and a wine rank dot; first prize gets a gold gradient, the crown and a slow glow. Your own squares carry a 2px gold ring. Tapping a locked square shakes it. A legend under the grid repeats each state as a 12px swatch.

### Profile Square
You are your square: a sold-state square with your initials, or a dashed empty square with "?" when no one is chosen. It fills from the bottom the first time it is set.

### Wrapped: Årgang
Wrapped is a deck of full-bleed cards in three fields: plum, wine-dark ("wine") and wine ("red"). Cream is the ink, cream at 72% the soft line, and gold the print; on the wine field the print switches to pale gold. The cover is a wine label: a double gold frame that prints in from the top, "VINLOTTERI" in spaced caps over a crown between two rules, a hairline engraving of the board with the year's best square inked in, the year huge in the serif with "årgang" in italic under it, then rounds, lodd and premier and "Tappet på kontoret". The engraving hides on landscape cards.

Inner cards open with a serif headline, put a square-based illustration in the middle (one square per colleague, one per lodd with winners inked, or the 6×6 board shaded by wins with the top square ringed and crowned), state counts inside serif sentences, and close with a one-line italic serif tasting note in the print colour ("Balansert helt ned til siste krone."). The money card is set as a dotted-leader ledger ending in a gold rule and the carried sum in the serif. Progress is a row of thin cream segments; controls are 44px round icon buttons. Calls to action are print-coloured pills with plum text; the secondary one is a cream-outlined pill. Entry motion: the label prints in, the year inks in from a blur, parts rise in reading order, numbers count up. Reduced motion shows every card static.

### Named Rules
**The Tasting Note Rule.** Each tasting card in the shared vintage ends with one line of italic serif in the print colour, and the label and title cards close on the same italic voice.

**The No Tiles Rule.** Counts are drawn as squares or written into serif sentences. Never a big number stacked over a small label.

**The One Caps Line Rule.** The only tracked-caps line in Wrapped is "VINLOTTERI" at the top of the label.

## Do's and Don'ts

### Do:
- **Do** show every square as kolonne-rad ("Rute 5-3" is column 5, row 3), in the grid, in copy and in Wrapped.
- **Do** pick one complete colour set per square state from the shared status styles, and reuse it wherever a square appears.
- **Do** use gold only for wins, your own squares and label print; use sage only for confirmation.
- **Do** tint shadows with plum (rgba(44,10,20,…)) on light surfaces.
- **Do** keep headings, coordinates and notes in Georgia and controls in the system sans.
- **Do** give every animation a reduced-motion fallback that shows the final state.
- **Do** in Wrapped, fill each card with plum, wine-dark or wine, print in gold or pale gold, and size everything in `cqmin` from the card.
- **Do** keep Georgia's old-style figures in Wrapped and lining tabular figures on the buying grid.
- **Do** keep all user-facing copy in Norwegian bokmål.

### Don't:
- **Don't** layer a Tailwind background or text colour over a square's state styles.
- **Don't** use a pale-gold or gold field for a whole Wrapped card; gold is print only.
- **Don't** put a tracked-caps eyebrow or kicker line above a heading.
- **Don't** draw big-number-over-label stat tiles; draw squares or write the number into a sentence.
- **Don't** let seasonal re-tints reach the header or site chrome (halloween's night mode is the one sanctioned exception).
- **Don't** use photos or emoji on Wrapped cards; the board is the illustration.
- **Don't** restyle the official Vipps button.
