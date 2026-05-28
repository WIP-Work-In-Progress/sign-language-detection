import type { TopKEntry } from "../lib/api";
import { useTranslation } from "../lib/i18n";

interface PredictionPanelProps {
  currentLabel: string | null;
  confidence: number;
  candidate: string | null;
  progress: number;
  inFlight: boolean;
  inReleaseGate?: boolean;
  topk?: TopKEntry[];
  letterToDirection?: Record<string, string>;
}

export function PredictionPanel({
  currentLabel,
  confidence,
  candidate,
  progress,
  inFlight,
  inReleaseGate,
  topk,
  letterToDirection,
}: PredictionPanelProps) {
  const { t } = useTranslation();
  const directionMode = !!letterToDirection;
  const pct = Math.round(progress * 100);

  const mappedCurrent =
    directionMode && currentLabel ? letterToDirection![currentLabel] : null;
  const mappedCandidate =
    directionMode && candidate ? letterToDirection![candidate] : null;

  const isBlank = !currentLabel || currentLabel === "Blank";
  const displayMain = directionMode
    ? mappedCurrent ?? "—"
    : isBlank
      ? "—"
      : currentLabel;
  const isPlaceholder = displayMain === "—";

  const activeKeys = directionMode
    ? Object.entries(letterToDirection!)
        .map(([letter, arrow]) => `${letter}${arrow}`)
        .join(" / ")
    : "";

  let confLine: string;
  if (directionMode) {
    if (mappedCurrent && currentLabel) {
      confLine = `${currentLabel} → ${mappedCurrent} · ${(confidence * 100).toFixed(1)}%`;
    } else if (isBlank) {
      confLine = t("panel.noHand");
    } else if (currentLabel) {
      confLine = t("panel.detectedNotDirection", {
        letter: currentLabel,
        pct: (confidence * 100).toFixed(1),
        keys: activeKeys,
      });
    } else {
      confLine = t("panel.signKeys", { keys: activeKeys });
    }
  } else {
    confLine = isBlank
      ? t("panel.noHand")
      : t("panel.confidence", { pct: (confidence * 100).toFixed(1) });
  }

  let hint: string;
  if (inReleaseGate && candidate) {
    const what = mappedCandidate ?? `"${candidate}"`;
    hint = t("panel.releaseGate", { what });
  } else if (mappedCandidate) {
    hint = t("panel.holdProgressArrow", {
      letter: candidate ?? "",
      arrow: mappedCandidate,
      pct,
    });
  } else if (candidate) {
    hint = t("panel.holdProgress", { letter: candidate, pct });
  } else if (directionMode) {
    hint = t("panel.holdToMove", { keys: activeKeys });
  } else {
    hint = t("panel.holdToCommit");
  }

  const visibleTopk = topk?.filter((e) => e.label !== "Blank").slice(0, 3) ?? [];
  const maxConf = visibleTopk.reduce((m, e) => Math.max(m, e.confidence), 0);

  return (
    <div className="prediction">
      <div className="panel-header">
        <span>
          {directionMode ? t("panel.direction") : t("panel.detection")}
        </span>
        <span className={`status ${inFlight ? "warn" : "ok"}`}>
          <span className="dot" />
          {inFlight ? t("status.predicting") : t("status.ready")}
        </span>
      </div>
      <div className="panel-body">
        <div className={`letter ${isPlaceholder ? "blank" : ""}`}>{displayMain}</div>
        <div className="conf">{confLine}</div>
        <div
          className={`hold-bar ${inReleaseGate ? "gated" : ""}`}
          aria-label="hold progress"
        >
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className={`hold-hint ${inReleaseGate ? "gated" : ""}`}>{hint}</div>

        {visibleTopk.length > 0 && (
          <div className="topk">
            <div className="topk-label">{t("panel.topGuesses")}</div>
            {visibleTopk.map((entry) => {
              const arrow = letterToDirection?.[entry.label];
              const barPct = maxConf > 0 ? (entry.confidence / maxConf) * 100 : 0;
              return (
                <div key={entry.label} className="topk-row">
                  <span className="topk-letter">
                    {entry.label}
                    {arrow ? ` ${arrow}` : ""}
                  </span>
                  <div className="topk-bar">
                    <div style={{ width: `${barPct}%` }} />
                  </div>
                  <span className="topk-pct">
                    {(entry.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
