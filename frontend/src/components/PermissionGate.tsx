import { useTranslation } from "../lib/i18n";

interface PermissionGateProps {
  state: "idle" | "requesting" | "active" | "denied" | "error";
  error: string | null;
  onStart: () => void;
}

export function PermissionGate({ state, error, onStart }: PermissionGateProps) {
  const { t } = useTranslation();
  if (state === "active") return null;
  return (
    <div className="camera-placeholder">
      {state === "denied" ? (
        <>
          <p>{t("camera.denied")}</p>
          <button onClick={onStart}>{t("camera.start")}</button>
        </>
      ) : state === "error" ? (
        <>
          <p className="camera-placeholder-error">
            {t("camera.error", { message: error ?? "" })}
          </p>
          <button onClick={onStart}>{t("camera.start")}</button>
        </>
      ) : state === "requesting" ? (
        <p>…</p>
      ) : (
        <>
          <p>{t("camera.askPermission")}</p>
          <button onClick={onStart}>{t("camera.start")}</button>
        </>
      )}
    </div>
  );
}
