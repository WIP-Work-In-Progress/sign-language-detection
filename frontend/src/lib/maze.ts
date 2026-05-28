export interface Cell {
  walls: { n: boolean; e: boolean; s: boolean; w: boolean };
}

export type Maze = Cell[][];

export interface Pos {
  x: number;
  y: number;
}

export type Dir = "U" | "D" | "L" | "R";

export interface MazeOptions {
  width: number;
  height: number;
}

export function generateMaze({ width, height }: MazeOptions): Maze {
  const visited: boolean[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => false),
  );
  const maze: Maze = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({
      walls: { n: true, e: true, s: true, w: true },
    })),
  );

  const stack: Pos[] = [{ x: 0, y: 0 }];
  visited[0][0] = true;

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const candidates: { pos: Pos; dir: Dir }[] = [];
    if (cur.y > 0 && !visited[cur.y - 1][cur.x])
      candidates.push({ pos: { x: cur.x, y: cur.y - 1 }, dir: "U" });
    if (cur.x < width - 1 && !visited[cur.y][cur.x + 1])
      candidates.push({ pos: { x: cur.x + 1, y: cur.y }, dir: "R" });
    if (cur.y < height - 1 && !visited[cur.y + 1][cur.x])
      candidates.push({ pos: { x: cur.x, y: cur.y + 1 }, dir: "D" });
    if (cur.x > 0 && !visited[cur.y][cur.x - 1])
      candidates.push({ pos: { x: cur.x - 1, y: cur.y }, dir: "L" });

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const next = candidates[Math.floor(Math.random() * candidates.length)];
    if (next.dir === "U") {
      maze[cur.y][cur.x].walls.n = false;
      maze[next.pos.y][next.pos.x].walls.s = false;
    } else if (next.dir === "D") {
      maze[cur.y][cur.x].walls.s = false;
      maze[next.pos.y][next.pos.x].walls.n = false;
    } else if (next.dir === "L") {
      maze[cur.y][cur.x].walls.w = false;
      maze[next.pos.y][next.pos.x].walls.e = false;
    } else {
      maze[cur.y][cur.x].walls.e = false;
      maze[next.pos.y][next.pos.x].walls.w = false;
    }
    visited[next.pos.y][next.pos.x] = true;
    stack.push(next.pos);
  }
  return maze;
}

export function canMove(maze: Maze, from: Pos, dir: Dir): boolean {
  const cell = maze[from.y]?.[from.x];
  if (!cell) return false;
  if (dir === "U") return !cell.walls.n && from.y > 0;
  if (dir === "D") return !cell.walls.s && from.y < maze.length - 1;
  if (dir === "L") return !cell.walls.w && from.x > 0;
  return !cell.walls.e && from.x < maze[0].length - 1;
}

export function applyDir(pos: Pos, dir: Dir): Pos {
  if (dir === "U") return { x: pos.x, y: pos.y - 1 };
  if (dir === "D") return { x: pos.x, y: pos.y + 1 };
  if (dir === "L") return { x: pos.x - 1, y: pos.y };
  return { x: pos.x + 1, y: pos.y };
}

// Maze rotates clockwise by `rotationDeg` (multiples of 90). The player signs
// in the screen frame (U = "up on screen"), so we translate that to the maze's
// internal frame. Worked example: at 90° CW the maze's left edge is now at the
// top of the screen, so "U" on screen maps to "L" in the maze.
export function rotateDir(dir: Dir, rotationDeg: number): Dir {
  const r = ((rotationDeg % 360) + 360) % 360;
  const tables: Record<number, Record<Dir, Dir>> = {
    0: { U: "U", D: "D", L: "L", R: "R" },
    90: { U: "L", D: "R", L: "D", R: "U" },
    180: { U: "D", D: "U", L: "R", R: "L" },
    270: { U: "R", D: "L", L: "U", R: "D" },
  };
  return tables[r][dir];
}

// BFS from `from` toward `to`. Returns the first direction the chaser should
// step in, or null if already on the target / unreachable.
export function pathfindStep(maze: Maze, from: Pos, to: Pos): Dir | null {
  if (from.x === to.x && from.y === to.y) return null;
  const W = maze[0].length;
  const H = maze.length;
  const prev: ({ pos: Pos; dir: Dir } | null)[][] = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => null),
  );
  const visited: boolean[][] = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => false),
  );
  visited[from.y][from.x] = true;
  const queue: Pos[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.x === to.x && cur.y === to.y) {
      let cursor: Pos = cur;
      let firstDir: Dir | null = null;
      while (!(cursor.x === from.x && cursor.y === from.y)) {
        const p = prev[cursor.y][cursor.x]!;
        firstDir = p.dir;
        cursor = p.pos;
      }
      return firstDir;
    }
    const dirs: Dir[] = ["U", "R", "D", "L"];
    for (const d of dirs) {
      if (!canMove(maze, cur, d)) continue;
      const n = applyDir(cur, d);
      if (visited[n.y][n.x]) continue;
      visited[n.y][n.x] = true;
      prev[n.y][n.x] = { pos: cur, dir: d };
      queue.push(n);
    }
  }
  return null;
}
