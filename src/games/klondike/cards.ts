// A self-contained, offline-safe SVG playing-card deck. Each face is a
// single inline <svg> with a fixed 250×350 viewBox, so every glyph sits
// at an exact coordinate and nothing can collide the way CSS-positioned
// spans did. Suits are vector paths (no font/network dependency); ranks
// use the system serif. The shell scales the <svg> to the card size via
// CSS `width/height: 100%`.

import type { Card, Suit } from "./logic.ts";

const RANK_LABEL = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "J", "Q", "K"];

/** Suit silhouette in a 0..100 box, fill = currentColor (the .sol-card
 *  colour, red for H/D). */
const SUIT_SHAPE: Record<Suit, string> = {
  S: '<path d="M50 7C50 7 90 40 90 62C90 76 78 82 67 78C62 76 58 72 56 67' +
     'C56 79 60 88 70 94L30 94C40 88 44 79 44 67C42 72 38 76 33 78' +
     'C22 82 10 76 10 62C10 40 50 7 50 7Z"/>',
  H: '<path d="M50 86C20 63 8 45 8 29C8 16 18 8 30 8C40 8 47 14 50 22' +
     'C53 14 60 8 70 8C82 8 92 16 92 29C92 45 80 63 50 86Z"/>',
  D: '<path d="M50 5L90 50L50 95L10 50Z"/>',
  C: '<g><circle cx="50" cy="31" r="19"/><circle cx="29" cy="60" r="19"/>' +
     '<circle cx="71" cy="60" r="19"/><path d="M44 58L37 95L63 95L56 58Z"/></g>',
};

/** Place a suit shape: a 100-unit box scaled by `s`, centred at (cx,cy),
 *  optionally rotated 180° (for the lower half of a pip layout / the
 *  mirrored corner). */
function suitAt(suit: Suit, cx: number, cy: number, s: number,
  flip = false): string {
  const t = `translate(${cx - 50 * s} ${cy - 50 * s}) scale(${s})` +
    (flip ? ` rotate(180 50 50)` : "");
  return `<g transform="${t}">${SUIT_SHAPE[suit]}</g>`;
}

// Classic pip columns (x) and rows (y) inside the centre well. col:
// 0=left 1=centre 2=right; the layout lists [colKey,row] with colKey in
// {0,0.5,1} and row 0..6 top→bottom; rows past the mid-line are flipped.
const COL_X = (k: number) => 72 + k * 106; // 0→72, .5→125, 1→178
const ROW_Y = (r: number) => 100 + (r / 6) * 150; // 0→100 … 6→250
const PIPS: Record<number, [number, number][]> = {
  2: [[0.5, 0], [0.5, 6]],
  3: [[0.5, 0], [0.5, 3], [0.5, 6]],
  4: [[0, 0], [1, 0], [0, 6], [1, 6]],
  5: [[0, 0], [1, 0], [0.5, 3], [0, 6], [1, 6]],
  6: [[0, 0], [1, 0], [0, 3], [1, 3], [0, 6], [1, 6]],
  7: [[0, 0], [1, 0], [0.5, 1.5], [0, 3], [1, 3], [0, 6], [1, 6]],
  8: [[0, 0], [1, 0], [0.5, 1.5], [0, 3], [1, 3], [0.5, 4.5], [0, 6], [1, 6]],
  9: [[0, 0], [1, 0], [0, 2], [1, 2], [0.5, 3], [0, 4], [1, 4], [0, 6], [1, 6]],
  10: [[0, 0], [1, 0], [0.5, 1.5], [0, 2], [1, 2], [0, 4], [1, 4],
    [0.5, 4.5], [0, 6], [1, 6]],
};

/** One corner index (rank over a small suit), pinned hard into a corner;
 *  the bottom-right copy is the same group rotated 180° about centre. */
function corner(label: string, suit: Suit, br: boolean): string {
  // Bigger rank, smaller suit tucked tight beneath it so the corner
  // reads as one unit and never looks like a stray extra pip.
  const inner =
    `<text x="22" y="50" text-anchor="middle" font-size="58" ` +
    `font-weight="700" font-family="var(--card-serif)">${label}</text>` +
    suitAt(suit, 22, 70, 0.2);
  const g = `<g transform="translate(13 10)">${inner}</g>`;
  return br ? `<g transform="rotate(180 125 175)">${g}</g>` : g;
}

function buildSvg(card: Card): string {
  const label = RANK_LABEL[card.rank];
  const { suit, rank } = card;
  let centre = "";
  if (rank === 1) {
    centre = suitAt(suit, 125, 175, 1.5); // Ace: one big pip
  } else if (rank >= 11) {
    // Court: big serif monogram framed by a suit above and below.
    centre =
      suitAt(suit, 125, 92, 0.5) +
      `<text x="125" y="210" text-anchor="middle" font-size="140" ` +
      `font-weight="700" font-family="var(--card-serif)">${label}</text>` +
      suitAt(suit, 125, 258, 0.5, true);
  } else {
    centre = PIPS[rank]
      .map(([k, r]) => suitAt(suit, COL_X(k), ROW_Y(r), 0.46, r > 3))
      .join("");
  }
  return (
    `<svg viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" ` +
    `class="sol-card__face">` +
    centre +
    corner(label, suit, false) +
    corner(label, suit, true) +
    `</svg>`
  );
}

/** Parse the card's SVG string into an element ready to append. */
export function cardFace(card: Card): SVGElement {
  const doc = new DOMParser().parseFromString(
    buildSvg(card),
    "image/svg+xml",
  );
  return doc.documentElement as unknown as SVGElement;
}
