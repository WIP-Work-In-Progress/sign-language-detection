import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "pl" | "en";

type Dict = Record<string, string>;

const en: Dict = {
  "app.title.sentence": "ASL Sentence Builder",
  "app.title.maze": "ASL Maze",
  "app.subtitle.sentence":
    "Show signs to your camera. Hold a letter for {seconds}s to add it to the sentence.",
  "app.subtitle.maze":
    "Sign B↑ / Q↓ / H← / G→ to navigate. {seconds}s per move.",
  "app.mode.sentence": "Sentence",
  "app.mode.maze": "Maze",
  "app.footnote.sentence":
    "Letters J and Z are dynamic in ASL but the model treats them statically. Confidence threshold {pct}%.",
  "app.footnote.maze":
    "Only B/Q/H/G register in maze mode (hand orientation matches the arrow). Use the toggles to enable rotation and/or chaser.",
  "status.backendOffline": "backend offline",
  "status.checkingBackend": "checking backend",
  "status.loadingModel": "loading model",
  "status.mediapipeError": "mediapipe error",
  "status.cameraOff": "camera off",
  "status.live": "live",
  "status.predicting": "predicting",
  "status.ready": "ready",
  "error.backend":
    "Could not reach the backend at {host}. Start it with {cmd} and refresh.",
  "error.mediapipe": "MediaPipe error: {message}",
  "error.prediction": "Prediction error: {message}",
  "camera.label": "Camera",
  "camera.stop": "stop",
  "camera.askPermission": "Allow camera to start signing",
  "camera.start": "Enable camera",
  "camera.denied":
    "Camera access denied. Update your browser permissions and reload.",
  "camera.error": "Camera error: {message}",
  "panel.detection": "Detection",
  "panel.direction": "Direction",
  "panel.topGuesses": "Top guesses",
  "panel.noHand": "No hand detected",
  "panel.confidence": "{pct}% confidence",
  "panel.detectedNotDirection": "Detected {letter} ({pct}%) — sign {keys}",
  "panel.signKeys": "Sign {keys}",
  "panel.holdToCommit": "Hold a sign steady to add it to the sentence",
  "panel.holdToMove": "Hold {keys} steady to move",
  "panel.holdProgress": "Hold \"{letter}\" — {pct}%",
  "panel.holdProgressArrow": "Hold {letter} ({arrow}) — {pct}%",
  "panel.releaseGate": "Lift / change sign to commit {what} again",
  "sentence.placeholder": "Show signs to start typing…",
  "sentence.space": "Space",
  "sentence.backspace": "Backspace",
  "sentence.clear": "Clear",
  "sentence.copy": "Copy",
  "sentence.added": "Added \"{letter}\"",
  "sentence.copied": "Copied",
  "sentence.copiedClipboard": "Copied to clipboard",
  "sentence.copyFailed": "Copy failed",
  "maze.time": "Time",
  "maze.start": "Start",
  "maze.restart": "Restart",
  "maze.rotation": "Rotation",
  "maze.chaser": "Chaser",
  "maze.on": "on",
  "maze.off": "off",
  "maze.hint":
    "Sign to move toward the green tile. Toggle Rotation to make the board spin every few seconds, or Chaser to add a red pursuer.",
  "maze.won": "🏁 Reached the goal in {time}",
  "maze.lost": "The chaser caught you. Press Restart and try again.",
  "maze.bestTimes": "Best times",
  "maze.noScores": "No scores yet — finish a run.",
};

const pl: Dict = {
  "app.title.sentence": "Układanie zdań ASL",
  "app.title.maze": "Labirynt ASL",
  "app.subtitle.sentence":
    "Pokaż znaki kamerze. Przytrzymaj literę przez {seconds}s, aby dodać ją do zdania.",
  "app.subtitle.maze":
    "Pokazuj B↑ / Q↓ / H← / G→ żeby się poruszać. {seconds}s na ruch.",
  "app.mode.sentence": "Zdania",
  "app.mode.maze": "Labirynt",
  "app.footnote.sentence":
    "Litery J i Z są w ASL dynamiczne, ale model traktuje je statycznie. Próg pewności {pct}%.",
  "app.footnote.maze":
    "W trybie labiryntu liczą się tylko B/Q/H/G (orientacja ręki = kierunek strzałki). Przełącznikami włączysz obracanie i goniącego.",
  "status.backendOffline": "backend offline",
  "status.checkingBackend": "sprawdzam backend",
  "status.loadingModel": "ładuję model",
  "status.mediapipeError": "błąd mediapipe",
  "status.cameraOff": "kamera wyłączona",
  "status.live": "na żywo",
  "status.predicting": "przewiduję",
  "status.ready": "gotowe",
  "error.backend":
    "Brak połączenia z backendem ({host}). Uruchom go komendą {cmd} i odśwież stronę.",
  "error.mediapipe": "Błąd MediaPipe: {message}",
  "error.prediction": "Błąd predykcji: {message}",
  "camera.label": "Kamera",
  "camera.stop": "stop",
  "camera.askPermission": "Zezwól na dostęp do kamery, żeby zacząć",
  "camera.start": "Włącz kamerę",
  "camera.denied":
    "Odmówiono dostępu do kamery. Zmień uprawnienia w przeglądarce i odśwież.",
  "camera.error": "Błąd kamery: {message}",
  "panel.detection": "Detekcja",
  "panel.direction": "Kierunek",
  "panel.topGuesses": "Najlepsze typy",
  "panel.noHand": "Brak ręki w kadrze",
  "panel.confidence": "{pct}% pewności",
  "panel.detectedNotDirection":
    "Wykryto {letter} ({pct}%) — pokaż {keys}",
  "panel.signKeys": "Pokaż {keys}",
  "panel.holdToCommit": "Przytrzymaj znak żeby dodać do zdania",
  "panel.holdToMove": "Przytrzymaj {keys} żeby się ruszyć",
  "panel.holdProgress": "Trzymaj \"{letter}\" — {pct}%",
  "panel.holdProgressArrow": "Trzymaj {letter} ({arrow}) — {pct}%",
  "panel.releaseGate":
    "Opuść rękę lub zmień znak, by ponownie dodać {what}",
  "sentence.placeholder": "Pokaż znaki, by zacząć pisać…",
  "sentence.space": "Spacja",
  "sentence.backspace": "Usuń znak",
  "sentence.clear": "Wyczyść",
  "sentence.copy": "Kopiuj",
  "sentence.added": "Dodano \"{letter}\"",
  "sentence.copied": "Skopiowano",
  "sentence.copiedClipboard": "Skopiowano do schowka",
  "sentence.copyFailed": "Kopiowanie nie powiodło się",
  "maze.time": "Czas",
  "maze.start": "Start",
  "maze.restart": "Zacznij od nowa",
  "maze.rotation": "Obrót",
  "maze.chaser": "Goniący",
  "maze.on": "wł",
  "maze.off": "wył",
  "maze.hint":
    "Pokazuj znaki, żeby dotrzeć do zielonego pola. Przełącz Obrót, by plansza co kilka sekund się przekręcała, albo Goniącego, by dodać czerwonego prześladowcę.",
  "maze.won": "🏁 Dotarłeś do mety w {time}",
  "maze.lost":
    "Goniący Cię złapał. Naciśnij Zacznij od nowa i spróbuj jeszcze raz.",
  "maze.bestTimes": "Najlepsze czasy",
  "maze.noScores": "Brak wyników — skończ pierwszą rozgrywkę.",
};

const dicts: Record<Lang, Dict> = { en, pl };

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "pl",
  setLang: () => {},
});

const STORAGE_KEY = "asl-lang";

function loadLang(): Lang {
  if (typeof window === "undefined") return "pl";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "pl") return stored;
  return "pl";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => loadLang());

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore quota errors */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function interpolate(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    Object.prototype.hasOwnProperty.call(params, k) ? String(params[k]) : `{${k}}`,
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const dict = dicts[ctx.lang];
      const template = dict[key] ?? dicts.en[key] ?? key;
      return interpolate(template, params);
    },
    [ctx.lang],
  );
  return { t, lang: ctx.lang, setLang: ctx.setLang };
}
