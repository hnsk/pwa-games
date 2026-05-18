// Tic-tac-toe rules (PLAN.md §Game). Pure: no DOM, no storage, no
// mutation of inputs — so the @unit tier can exercise win/draw paths
// with zero browser. The UI (index.ts) owns all state; this module
// only answers "what does this board mean / what does this move yield".

export type Player = "X" | "O";
export type Cell = Player | null;
/** Row-major 3×3, length 9. Index 0 = top-left, 8 = bottom-right. */
export type Board = Cell[];

export const emptyBoard = (): Board => Array(9).fill(null);

const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // cols
  [0, 4, 8],
  [2, 4, 6], // diagonals
];

/** The three indices of the winning line, or null if no winner. */
export function winningLine(board: Board): readonly number[] | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v !== null && v === board[b] && v === board[c]) return line;
  }
  return null;
}

export function winner(board: Board): Player | null {
  const line = winningLine(board);
  return line ? (board[line[0]] as Player) : null;
}

export function isDraw(board: Board): boolean {
  return winner(board) === null && board.every((c) => c !== null);
}

/**
 * Apply `player`'s mark at `i`. Returns a NEW board, or null if the move
 * is illegal: out of range, cell taken, or the game is already decided.
 */
export function move(board: Board, i: number, player: Player): Board | null {
  if (i < 0 || i > 8 || !Number.isInteger(i)) return null;
  if (board[i] !== null) return null;
  if (winner(board) !== null || isDraw(board)) return null;
  const next = board.slice();
  next[i] = player;
  return next;
}
