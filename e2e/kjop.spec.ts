import { expect, test, type Page } from "@playwright/test";
import { E2E_PIN } from "../playwright.config";

// Demorunden fra scripts/seed.mjs: runde 1, 15 kr per lodd, maks 2 per person før fredag 14:30.
const ROUND = "/runde/1";

/** Ledige ruter akkurat nå, som "kolonne-rad". */
async function freeSquares(page: Page, n: number): Promise<string[]> {
  const cells = page.locator('[data-cell][data-status="available"]');
  await expect(cells.first()).toBeVisible();
  const all = await cells.evaluateAll((els) => els.map((el) => el.getAttribute("data-cell")!));
  expect(all.length).toBeGreaterThanOrEqual(n);
  return all.slice(0, n);
}

const cell = (page: Page, coord: string) => page.locator(`[data-cell="${coord}"]`);

test("kjøper to ruter, betaler, og en kollega ser det live", async ({ page, browser }, testInfo) => {
  // Hvert prosjekt (desktop, mobil) bruker sitt eget navn, så loggen viser hvem som kjøpte hva.
  const name = testInfo.project.name === "mobil" ? "E2E mob" : "E2E pc";

  // Magisk lenke fra QR-plakaten: ?k= låser opp og fjernes fra adressen.
  await page.goto(`${ROUND}?k=${E2E_PIN}`);
  await expect(page).toHaveURL(new RegExp(`${ROUND}$`));
  const [first, second] = await freeSquares(page, 2);

  // En kollega har siden åpen på en annen enhet.
  const other = await browser.newContext({ locale: "nb-NO" });
  const colleague = await other.newPage();
  await colleague.goto(`${ROUND}?k=${E2E_PIN}`);
  await expect(cell(colleague, first)).toHaveAttribute("data-status", "available");

  // Første rute: velg, skriv navn, reserver.
  await cell(page, first).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: `Rute ${first}` })).toBeVisible();
  await dialog.getByPlaceholder("F.eks. Ola N").fill(name);
  await dialog.getByRole("button", { name: "Reserver ruten" }).click();
  await expect(dialog.getByRole("heading", { name: "Rute reservert ✓" })).toBeVisible();

  // Kollegaen ser reservasjonen uten å laste siden på nytt (SSE).
  await expect(cell(colleague, first)).toHaveAttribute("data-status", "held");

  // Andre rute: navnet er kjent, så ett trykk reserverer direkte. Maks to per person, så så er det stopp.
  await dialog.getByRole("button", { name: "+ Legg til en rute til" }).click();
  await cell(page, second).click();
  await expect(dialog.getByRole("heading", { name: "Rute reservert ✓" })).toBeVisible();
  await expect(dialog.getByText(`Dine ruter: ${first}, ${second}`)).toBeVisible();
  await expect(dialog.getByText("Maks 2 lodd per person nå.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "+ Legg til en rute til" })).toHaveCount(0);

  // Betaling: Vippsnummeret står der, beløpet er 2 × 15 kr, og kjøperen bekrefter selv.
  await dialog.getByRole("button", { name: "Gå til betaling (Kr 30,-)" }).click();
  await expect(dialog.getByRole("heading", { name: "Betal" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "12 34 56 78" })).toBeVisible();
  await expect(dialog.getByText("Betal til Kari")).toBeVisible();
  await dialog.getByRole("button", { name: "Jeg har betalt Kr 30,-" }).click();
  await expect(page.getByText("2 lodd registrert!")).toBeVisible();

  for (const coord of [first, second]) {
    await expect(cell(page, coord)).toHaveAttribute("data-status", "sold");
    await expect(cell(colleague, coord)).toHaveAttribute("data-status", "sold");
  }

  // Kollegaen kan ikke ta en rute som er solgt.
  await cell(colleague, first).click();
  await expect(colleague.getByRole("button", { name: "Reserver ruten" })).toHaveCount(0);
  await other.close();

  // Arrangøren ser kjøpet i endringsloggen.
  // Veiviseren åpner seg første gang en enhet besøker admin; den er ikke det vi tester her.
  await page.evaluate(() => localStorage.setItem("vinlotteri:arrangor-veiviser", "1"));
  await page.goto("/admin/runde/1");
  await page.getByText(/^Endringslogg/).click();
  for (const coord of [first, second]) await expect(page.getByText(`${name} reserverte Rute ${coord}`)).toBeVisible();
  await expect(page.getByText(new RegExp(`bekreftet betaling for Rute ${first}`))).toBeVisible();
});

test("en rute kan ikke reserveres av to samtidig", async ({ page, browser }) => {
  await page.goto(`${ROUND}?k=${E2E_PIN}`);
  const [coord] = await freeSquares(page, 1);

  const other = await browser.newContext({ locale: "nb-NO" });
  const rival = await other.newPage();
  await rival.goto(`${ROUND}?k=${E2E_PIN}`);

  // Begge åpner samme ledige rute, men rivalen reserverer først.
  await cell(page, coord).click();
  await cell(rival, coord).click();
  const rivalDialog = rival.getByRole("dialog");
  await rivalDialog.getByPlaceholder("F.eks. Ola N").fill("Rival");
  await rivalDialog.getByRole("button", { name: "Reserver ruten" }).click();
  await expect(rivalDialog.getByRole("heading", { name: "Rute reservert ✓" })).toBeVisible();

  // Den andre får beskjed i stedet for å overskrive reservasjonen.
  await expect(page.getByRole("dialog").getByText("Noen rakk å ta ruten før deg.", { exact: false })).toBeVisible();
  await expect(cell(page, coord)).toHaveAttribute("data-status", "held");
  await other.close();
});
