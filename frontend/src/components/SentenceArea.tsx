import { useTranslation } from "../lib/i18n";

interface SentenceAreaProps {
  sentence: string;
  onSpace: () => void;
  onBackspace: () => void;
  onClear: () => void;
  onCopy: () => void;
}

export function SentenceArea({
  sentence,
  onSpace,
  onBackspace,
  onClear,
  onCopy,
}: SentenceAreaProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="panel-body">
        <div className="sentence" aria-live="polite">
          {sentence.length === 0 ? (
            <span className="sentence-placeholder">
              {t("sentence.placeholder")}
            </span>
          ) : (
            <>
              {sentence}
              <span className="caret" />
            </>
          )}
        </div>
        <div className="controls">
          <button onClick={onSpace}>
            {t("sentence.space")}<span className="kbd">␣</span>
          </button>
          <button onClick={onBackspace} disabled={sentence.length === 0}>
            ⌫ {t("sentence.backspace")}<span className="kbd">←</span>
          </button>
          <button
            className="danger"
            onClick={onClear}
            disabled={sentence.length === 0}
          >
            {t("sentence.clear")}<span className="kbd">Esc</span>
          </button>
          <button onClick={onCopy} disabled={sentence.length === 0}>
            {t("sentence.copy")}<span className="kbd">Ctrl+C</span>
          </button>
        </div>
      </div>
    </>
  );
}
