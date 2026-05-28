import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyDir,
  canMove,
  generateMaze,
  pathfindStep,
  rotateDir,
  type Dir,
  type Maze,
  type Pos,
} from "../lib/maze";
import { useTranslation } from "../lib/i18n";

const MAZE_W = 8;
const MAZE_H = 8;
const CELL_PX = 44;
const ROTATION_MIN_MS = 5000;
const ROTATION_MAX_MS = 8000;
const CHASER_INTERVAL_MS = 1700;
const CHASER_START_DELAY_MS = 4000;
const HIGHSCORE_KEY = "maze-highscores-v1";

type Status = "idle" | "playing" | "won" | "lost";

interface Score {
  ms: number;
  ts: number;
}

function loadScores(): Score[] {
  try {
    const raw = localStorage.getItem(HIGHSCORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Score[];
  } catch {
    return [];
  }
}

function saveScores(scores: Score[]) {
  localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(scores));
}

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

export interface MazeCommand {
  letter: Dir;
  ts: number;
}

interface MazeGameProps {
  /** Latest U/D/L/R commit from the hold-to-commit tracker. */
  command: MazeCommand | null;
}

export function MazeGame({ command }: MazeGameProps) {
  const { t } = useTranslation();
  const [maze, setMaze] = useState<Maze>(() =>
    generateMaze({ width: MAZE_W, height: MAZE_H }),
  );
  const [player, setPlayer] = useState<Pos>({ x: 0, y: 0 });
  const goal = useMemo(() => ({ x: MAZE_W - 1, y: MAZE_H - 1 }), []);
  const [chaser, setChaser] = useState<Pos>({ x: MAZE_W - 1, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const startedAtRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [scores, setScores] = useState<Score[]>(() => loadScores());
  const lastCommandTs = useRef<number | null>(null);
  const [rotationEnabled, setRotationEnabled] = useState(false);
  const [chaserEnabled, setChaserEnabled] = useState(false);

  const start = useCallback(() => {
    setMaze(generateMaze({ width: MAZE_W, height: MAZE_H }));
    setPlayer({ x: 0, y: 0 });
    setChaser({ x: MAZE_W - 1, y: 0 });
    setRotation(0);
    setElapsed(0);
    startedAtRef.current = performance.now();
    lastCommandTs.current = null;
    setStatus("playing");
  }, []);

  // Apply incoming U/D/L/R commands (screen-frame → maze-frame via rotation).
  useEffect(() => {
    if (!command || status !== "playing") return;
    if (lastCommandTs.current === command.ts) return;
    lastCommandTs.current = command.ts;
    const mazeDir = rotateDir(command.letter, rotation);
    setPlayer((p) => (canMove(maze, p, mazeDir) ? applyDir(p, mazeDir) : p));
  }, [command, status, rotation, maze]);

  // Win condition.
  useEffect(() => {
    if (status !== "playing") return;
    if (player.x !== goal.x || player.y !== goal.y) return;
    const startedAt = startedAtRef.current ?? performance.now();
    const finishMs = performance.now() - startedAt;
    setStatus("won");
    setElapsed(finishMs);
    setScores((prev) => {
      const next = [...prev, { ms: finishMs, ts: Date.now() }]
        .sort((a, b) => a.ms - b.ms)
        .slice(0, 10);
      saveScores(next);
      return next;
    });
  }, [player, goal, status]);

  // Lose condition — only when chaser is active.
  useEffect(() => {
    if (status !== "playing" || !chaserEnabled) return;
    if (chaser.x === player.x && chaser.y === player.y) {
      setStatus("lost");
    }
  }, [chaser, player, status, chaserEnabled]);

  // Snap rotation back to 0 when the rotation option is turned off so the
  // board looks normal and signs map 1:1.
  useEffect(() => {
    if (!rotationEnabled) setRotation(0);
  }, [rotationEnabled]);

  // Timer.
  useEffect(() => {
    if (status !== "playing") return;
    const id = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsed(performance.now() - startedAtRef.current);
      }
    }, 60);
    return () => window.clearInterval(id);
  }, [status]);

  // Rotation cycle — picks a fresh delay after each turn so it stays surprising.
  useEffect(() => {
    if (status !== "playing" || !rotationEnabled) return;
    let cancelled = false;
    let timeoutId: number;
    const schedule = () => {
      const delay =
        ROTATION_MIN_MS + Math.random() * (ROTATION_MAX_MS - ROTATION_MIN_MS);
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        const steps = [90, 180, 270];
        const step = steps[Math.floor(Math.random() * steps.length)];
        const sign = Math.random() < 0.5 ? 1 : -1;
        setRotation((r) => r + sign * step);
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [status, rotationEnabled]);

  // Chaser — pauses for a few seconds at the start so the player can get going.
  useEffect(() => {
    if (status !== "playing" || !chaserEnabled) return;
    const id = window.setInterval(() => {
      const startedAt = startedAtRef.current;
      if (startedAt === null) return;
      if (performance.now() - startedAt < CHASER_START_DELAY_MS) return;
      setChaser((c) => {
        const step = pathfindStep(maze, c, player);
        return step ? applyDir(c, step) : c;
      });
    }, CHASER_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [status, maze, player, chaserEnabled]);

  // Visual rotation snapped to ±N·90°; pass raw value to CSS so animation can
  // pick the short direction (e.g. -90 not +270).
  const visualRotation = rotation;
  const boardSize = useMemo(
    () => ({ w: MAZE_W * CELL_PX, h: MAZE_H * CELL_PX }),
    [],
  );

  return (
    <div className="maze">
      <div className="maze-hud">
        <div className="maze-hud-cell">
          <span className="maze-hud-label">{t("maze.time")}</span>
          <span className="maze-hud-value">{formatTime(elapsed)}</span>
        </div>
        <div className="maze-toggles" role="group">
          <button
            type="button"
            aria-pressed={rotationEnabled}
            className={`maze-toggle ${rotationEnabled ? "on" : ""}`}
            onClick={() => setRotationEnabled((v) => !v)}
          >
            {t("maze.rotation")}: {rotationEnabled ? t("maze.on") : t("maze.off")}
          </button>
          <button
            type="button"
            aria-pressed={chaserEnabled}
            className={`maze-toggle ${chaserEnabled ? "on" : ""}`}
            onClick={() => setChaserEnabled((v) => !v)}
          >
            {t("maze.chaser")}: {chaserEnabled ? t("maze.on") : t("maze.off")}
          </button>
        </div>
        <button className="maze-start" onClick={start}>
          {status === "idle" ? t("maze.start") : t("maze.restart")}
        </button>
      </div>

      <div className="maze-stage">
        <div
          className="maze-board"
          style={{
            transform: `rotate(${visualRotation}deg)`,
            width: boardSize.w,
            height: boardSize.h,
          }}
        >
          <svg
            width={boardSize.w}
            height={boardSize.h}
            viewBox={`0 0 ${boardSize.w} ${boardSize.h}`}
            className="maze-svg"
          >
            <rect
              x={0}
              y={0}
              width={boardSize.w}
              height={boardSize.h}
              className="maze-bg"
            />
            <rect
              x={goal.x * CELL_PX + 4}
              y={goal.y * CELL_PX + 4}
              width={CELL_PX - 8}
              height={CELL_PX - 8}
              className="maze-goal"
              rx={6}
            />
            {maze.map((row, y) =>
              row.map((cell, x) => (
                <g key={`${x}-${y}`} className="maze-walls">
                  {cell.walls.n && (
                    <line x1={x * CELL_PX} y1={y * CELL_PX} x2={(x + 1) * CELL_PX} y2={y * CELL_PX} />
                  )}
                  {cell.walls.w && (
                    <line x1={x * CELL_PX} y1={y * CELL_PX} x2={x * CELL_PX} y2={(y + 1) * CELL_PX} />
                  )}
                  {(cell.walls.s || y === MAZE_H - 1) && (
                    <line x1={x * CELL_PX} y1={(y + 1) * CELL_PX} x2={(x + 1) * CELL_PX} y2={(y + 1) * CELL_PX} />
                  )}
                  {(cell.walls.e || x === MAZE_W - 1) && (
                    <line x1={(x + 1) * CELL_PX} y1={y * CELL_PX} x2={(x + 1) * CELL_PX} y2={(y + 1) * CELL_PX} />
                  )}
                </g>
              )),
            )}
            {chaserEnabled && (
              <circle
                cx={chaser.x * CELL_PX + CELL_PX / 2}
                cy={chaser.y * CELL_PX + CELL_PX / 2}
                r={CELL_PX * 0.32}
                className="maze-chaser"
              />
            )}
            <circle
              cx={player.x * CELL_PX + CELL_PX / 2}
              cy={player.y * CELL_PX + CELL_PX / 2}
              r={CELL_PX * 0.28}
              className="maze-player"
            />
          </svg>
        </div>
        {/* Fixed compass overlay – only useful when the board rotates. */}
        {rotationEnabled && (
          <div className="maze-compass" aria-hidden>
            <span className="maze-compass-u">↑</span>
            <span className="maze-compass-d">↓</span>
            <span className="maze-compass-l">←</span>
            <span className="maze-compass-r">→</span>
          </div>
        )}
      </div>

      {status === "won" && (
        <div className="maze-banner ok">
          {t("maze.won", { time: formatTime(elapsed) })}
        </div>
      )}
      {status === "lost" && (
        <div className="maze-banner err">{t("maze.lost")}</div>
      )}
      {status === "idle" && <p className="maze-hint">{t("maze.hint")}</p>}

      <div className="maze-leaderboard">
        <h3>{t("maze.bestTimes")}</h3>
        {scores.length === 0 ? (
          <p className="maze-leaderboard-empty">{t("maze.noScores")}</p>
        ) : (
          <ol>
            {scores.slice(0, 5).map((s, i) => (
              <li key={`${s.ts}-${i}`}>
                <span>{formatTime(s.ms)}</span>
                <span className="maze-leaderboard-date">
                  {new Date(s.ts).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
