import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { prize, round } from "./testFactories";

const dir = mkdtempSync(join(tmpdir(), "vinlotteri-audit-"));
process.env.DB_PATH = join(dir, "test.sqlite");

const { db } = await import("./db");
const audit = await import("./audit");

afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("logAudit / getAuditLog", () => {
  it("lagrer linjer per runde, nyeste først, og overlever at runden mangler", () => {
    audit.logAudit({ roundId: 7, actor: " Kari ", ip: "10.0.0.5", action: "cellClear", summary: "første" });
    audit.logAudit({ roundId: 7, actor: null, ip: "ukjent", action: "cellPaid", summary: "andre" });
    audit.logAudit({ roundId: null, actor: "Ola", action: "mergeNames", summary: "global" });

    const round7 = audit.getAuditLog(7);
    expect(round7.map((e) => e.summary)).toEqual(["andre", "første"]);
    expect(round7[1]).toMatchObject({ actor: "Kari", ip: "10.0.0.5" });
    expect(round7[0]).toMatchObject({ actor: null, ip: null });
    expect(audit.getAuditLog().map((e) => e.summary)).toEqual(["global", "andre", "første"]);
  });
});

describe("beskrivelser", () => {
  it("skriver ruter kolonne-rad", () => {
    expect(audit.square({ row: 3, col: 5 })).toBe("Rute 5-3");
    expect(audit.squareWithBuyer({ row: 3, col: 5, buyer_name: "Kari", status: "sold", paid: 1 })).toBe(
      "Rute 5-3 (Kari, betalt)",
    );
    expect(audit.squareWithBuyer({ row: 1, col: 2, buyer_name: "Ola", status: "held", paid: 0 })).toBe(
      "Rute 2-1 (Ola, reservert)",
    );
  });

  it("tar bare med felt som faktisk endret seg", () => {
    const r = round({ vipps_number: "12345", ticket_price: 20, title: "Uke 3" });
    expect(audit.describeRoundPatch(r, { vipps_number: "12345", title: "Uke 3" })).toBeNull();
    const change = audit.describeRoundPatch(r, { vipps_number: "99999", ticket_price: 25, title: "Uke 3" });
    expect(change?.summary).toBe("Endret Vippsnummer 12345 → 99999, loddpris 20 kr → 25 kr");
    expect(change?.details).toEqual({ vipps_number: ["12345", "99999"], ticket_price: [20, 25] });
  });

  it("behandler tomt og null som det samme", () => {
    expect(audit.describeRoundPatch(round({ polet_cost: null }), { polet_cost: "" })).toBeNull();
  });

  it("beskriver premieendringer med navnet", () => {
    const p = prize({ name: "Barolo", price: 199 });
    expect(audit.describePrizePatch(p, { price: 229, name: "Barolo" })?.summary).toBe(
      "Endret premie «Barolo»: pris 199 kr → 229 kr",
    );
  });
});
