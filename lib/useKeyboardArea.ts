"use client";

import { useEffect, useState } from "react";

/**
 * The part of the screen the on-screen keyboard leaves free, or null while it's closed.
 * A bottom sheet stays anchored behind the keyboard on phones (iOS doesn't resize the layout
 * for it), so while typing the sheet is placed in this area instead.
 */
export function useKeyboardArea(active: boolean) {
  const [area, setArea] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) {
      setArea(null);
      return;
    }
    const update = () => {
      const covered = window.innerHeight - vv.height;
      setArea(covered > 120 ? { top: vv.offsetTop, height: vv.height } : null);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);
  return area;
}
