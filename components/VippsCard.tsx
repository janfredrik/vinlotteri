"use client";

import { useState } from "react";
import Script from "next/script";
import type { VippsPresentation } from "@/lib/types";

export default function VippsCard({
  vipps,
  organizer,
  ticketPrice,
  compact,
}: {
  vipps: VippsPresentation;
  organizer: string;
  ticketPrice: number;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const pretty = vipps.number.replace(/(\d{3})(\d{2})(\d{3})/, "$1 $2 $3");

  async function copy() {
    try {
      await navigator.clipboard.writeText(vipps.number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-xl border border-plum/10 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="rounded bg-[#ff5b24] px-1.5 py-0.5 text-xs font-bold text-white">Vipps</span>
        <span className="text-sm font-medium text-plum/70">Betal til {organizer || "arrangør"}</span>
      </div>

      <div className={`mt-3 flex ${compact ? "flex-row items-center" : "flex-col items-center"} gap-4`}>
        {vipps.qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vipps.qr}
            alt="Vipps QR"
            className={compact ? "h-28 w-28 rounded-lg border border-plum/10" : "h-44 w-44 rounded-lg border border-plum/10"}
          />
        ) : (
          <p className="text-sm text-plum/60">Legg inn Vippsnummer for QR.</p>
        )}

        <div className={compact ? "" : "text-center"}>
          <button
            onClick={copy}
            className="font-display text-2xl font-semibold text-wine hover:underline"
            title="Kopier nummer"
          >
            {pretty || "—"}
          </button>
          {copied && <span className="ml-2 text-xs text-sage">kopiert</span>}
          <p className="mt-1 text-sm text-plum/70">
            Kr {ticketPrice},- per lodd{" "}
          </p>
          {vipps.link && (
            <>
              <Script src="https://cdn.vippsmobilepay.com/js/button/button.js" strategy="lazyOnload" />
              <a
                href={vipps.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block"
                aria-label="Åpne Vipps"
              >
                <vipps-mobilepay-button
                  brand="vipps"
                  language="no"
                  variant="primary"
                  rounded="true"
                  verb="pay"
                  stretched="false"
                  compact="false"
                >
                  {/* Fallback shown until the web component upgrades (or if the CDN is blocked). */}
                  <span className="rounded-full bg-[#ff5b24] px-4 py-1.5 text-sm font-semibold text-white">
                    Åpne Vipps
                  </span>
                </vipps-mobilepay-button>
              </a>
            </>
          )}
        </div>
      </div>

     
    </div>
  );
}
