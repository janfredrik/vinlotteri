import { defineConfig, devices } from "@playwright/test";

// Ende-til-ende mot en produksjonsbygg på egen port og egen database (.e2e/data).
// `next build` skriver til .next, mens `npm run dev` bruker .next/dev, så de kan kjøre samtidig.
const PORT = 3100;
export const E2E_PIN = "e2e-pin";

export default defineConfig({
  testDir: "e2e",
  // Testene deler én seedet runde, så de kjører etter hverandre.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "nb-NO",
    timezoneId: "Europe/Oslo",
    trace: "retain-on-failure",
  },
  // Lokalt brukes Chrome som allerede er installert; CI installerer Playwrights Chromium.
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" } },
    { name: "mobil", use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "chrome" } },
  ],
  webServer: {
    command: `node e2e/prepare.mjs && next build && next start -p ${PORT}`,
    url: `http://localhost:${PORT}/apne`,
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: "pipe",
    env: {
      DATA_DIR: ".e2e/data",
      SITE_PIN: E2E_PIN,
      // Tomme verdier går foran .env, så testen aldri poster til Teams eller kaller eksterne API-er.
      SUPERADMIN_PIN: "",
      TEAMS_WEBHOOK_URL: "",
      VINMONOPOLET_API_KEY: "",
      OCR_API_KEY: "",
      APP_URL: `http://localhost:${PORT}`,
      TZ: "Europe/Oslo",
    },
  },
});
