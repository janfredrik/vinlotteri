// Vinmonopolet's product photos are JPEGs on white. To let a bottle stand on any surface (the dark
// halloween page, the big screen), the white that touches the edge of the photo is made transparent.
// White inside the bottle (labels, highlights) isn't connected to the edge and stays.

/** Near-white and nearly grey: the studio backdrop, not a pale label. */
function backdrop(px: Uint8Array, i: number): boolean {
  const r = px[i * 4];
  const g = px[i * 4 + 1];
  const b = px[i * 4 + 2];
  const lo = Math.min(r, g, b);
  return lo >= 232 && Math.max(r, g, b) - lo <= 20;
}

/** Clears the backdrop of an RGBA image in place and softens the rim so no white halo is left. */
export function removeBackground(px: Uint8Array, w: number, h: number): void {
  const n = w * h;
  const bg = new Uint8Array(n);
  const stack: number[] = [];
  const visit = (i: number) => {
    if (!bg[i] && backdrop(px, i)) {
      bg[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    visit(x);
    visit((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    visit(y * w);
    visit(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) visit(i - 1);
    if (x < w - 1) visit(i + 1);
    if (i >= w) visit(i - w);
    if (i < n - w) visit(i + w);
  }

  for (let i = 0; i < n; i++) {
    if (bg[i]) {
      px[i * 4 + 3] = 0;
      continue;
    }
    const x = i % w;
    const rim = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (i >= w && bg[i - w]) || (i < n - w && bg[i + w]);
    if (!rim) continue;
    // A rim pixel is part bottle, part white: keep the part that isn't white, and take the white
    // back out of its colour.
    const lo = Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
    const a = Math.min(1, (255 - lo) / 60);
    if (a >= 1) continue;
    px[i * 4 + 3] = Math.round(a * px[i * 4 + 3]);
    if (a > 0) {
      for (let c = 0; c < 3; c++) {
        px[i * 4 + c] = Math.max(0, Math.min(255, Math.round((px[i * 4 + c] - (1 - a) * 255) / a)));
      }
    }
  }
}
