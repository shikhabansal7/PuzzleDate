"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Puzzle = {
  name: string;
  publisher: string;
  url: string;
  color: string;
  canEmbed?: boolean;
  resetStrategy?: ResetStrategy;
  saturdayOnly?: boolean;
  custom?: boolean;
};

type ResetStrategy =
  | "connections-current"
  | "word500-current"
  | "foximax-daily"
  | "verticle-current"
  | "four-by-three-current"
  | "full-circle-current"
  | "poople-current"
  | "custom-clear-all";

const EXPECTED_EXTENSION_VERSION = "1.0.20";

const validExtensionVersion = (value: unknown) =>
  typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value)
    ? value
    : null;

const puzzles: Puzzle[] = [
  {
    name: "Connections",
    publisher: "The New York Times",
    url: "https://www.nytimes.com/games/connections",
    color: "#b4a8ff",
    canEmbed: false,
    resetStrategy: "connections-current",
  },
  {
    name: "Word 500",
    publisher: "Daily word challenge",
    url: "https://word500.com/game?mode=daily",
    color: "#f3c96b",
    resetStrategy: "word500-current",
  },
  {
    name: "FoxiMax",
    publisher: "Daily puzzle",
    url: "https://foximax.com/",
    color: "#f39c81",
    canEmbed: false,
    resetStrategy: "foximax-daily",
  },
  {
    name: "Verticle",
    publisher: "Daily word ladder",
    url: "https://verticle.netlify.app/",
    color: "#9cc8a7",
    resetStrategy: "verticle-current",
  },
  {
    name: "Waffle",
    publisher: "Daily word puzzle",
    url: "https://wafflegame.net/daily",
    color: "#e9b949",
    canEmbed: false,
  },
  {
    name: "Unwordle",
    publisher: "Daily reverse Wordle",
    url: "https://unwordle.org/?daily=1",
    color: "#88b8dc",
  },
  {
    name: "4 × 3",
    publisher: "Hank Green",
    url: "https://www.hankgreen.com/fourbythree/",
    color: "#e893bd",
    canEmbed: false,
    resetStrategy: "four-by-three-current",
  },
  {
    name: "Chain It",
    publisher: "Puzzlit daily word chain",
    url: "https://www.puzzlitapp.com/game/ChainIt",
    color: "#a995d6",
  },
  {
    name: "Word Salad",
    publisher: "Daily themed word puzzle",
    url: "https://wordsalad.online/",
    color: "#8fc9bd",
  },
  {
    name: "Full Circle Friday",
    publisher: "Weekly Friday word puzzle",
    url: "https://fullcirclefriday.com/fullcircle.html",
    color: "#f08b62",
    saturdayOnly: true,
    resetStrategy: "full-circle-current",
  },
  {
    name: "Poople",
    publisher: "Daily guessing game",
    url: "https://poople.io/",
    color: "#d5a47a",
    resetStrategy: "poople-current",
  },
];

// Only these games expose the puzzle date in their URL. Everything else in the
// rotation either has no archive or reaches it through in-page UI we cannot
// address, so a global date deliberately leaves them on today's puzzle.
const ARCHIVE_URLS: Record<string, (date: string) => string> = {
  "https://www.nytimes.com/games/connections": (date) =>
    `https://www.nytimes.com/games/connections/${date}`,
  "https://word500.com/game?mode=daily": (date) =>
    `https://word500.com/game?mode=archive&date=${date}`,
  "https://www.hankgreen.com/fourbythree/": (date) =>
    `https://www.hankgreen.com/fourbythree/#d=${date}`,
};

// These games have no dated URL, but each derives its puzzle from the client
// clock, so the extension can shift the clock inside their frame instead.
// Chain It (Firestore-backed) and Full Circle Friday (server-fetched) cannot be
// reached this way and stay on today.
const CLOCK_SHIM_URLS = new Set([
  "https://verticle.netlify.app/",
  "https://foximax.com/",
  "https://poople.io/",
  "https://unwordle.org/?daily=1",
  "https://wafflegame.net/daily",
  "https://wordsalad.online/",
]);

const ARCHIVE_STORAGE_KEY = "puzzle-date-archive-date";
const LOOKUP_COLLAPSED_KEY = "puzzle-date-lookup-collapsed";

const isoToday = () => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};

// Word 500 rejects today and anything later, so "today" always means live play.
const isArchiveDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && value < isoToday();

const hasArchiveUrl = (puzzle: Puzzle) => Boolean(ARCHIVE_URLS[puzzle.url]);

const puzzleUrl = (puzzle: Puzzle, date: string) =>
  (date && ARCHIVE_URLS[puzzle.url]?.(date)) || puzzle.url;

const puzzlesForDay = (day: number) =>
  puzzles.filter((puzzle) => !puzzle.saturdayOnly || day === 6);

const defaultPuzzles = puzzlesForDay(-1);
const MAX_CUSTOM_GAMES = 100;

const customHost = (puzzle: Puzzle) => {
  try {
    return new URL(puzzle.url).hostname.toLowerCase();
  } catch {
    return "";
  }
};

const normalizeCustomHosts = (value: unknown) => {
  if (!Array.isArray(value) || value.length > MAX_CUSTOM_GAMES) return null;
  const hostnames: string[] = [];
  for (const part of value) {
    if (typeof part !== "string" || part !== part.toLowerCase()) return null;
    try {
      const parsed = new URL(`https://${part}`);
      if (parsed.hostname !== part || parsed.host !== part || parsed.pathname !== "/") {
        return null;
      }
    } catch {
      return null;
    }
    hostnames.push(part);
  }
  return [...new Set(hostnames)].sort();
};

type DictionarySense = {
  partOfSpeech: string;
  definitions: Array<{ definition: string; example?: string }>;
};

// Wiktionary returns definitions as HTML fragments, so they are flattened to
// text. DOMParser documents are inert, so nothing here can execute or reach
// the live page.
const plainText = (html: string) =>
  new DOMParser()
    .parseFromString(html, "text/html")
    .body.textContent?.replace(/\s+/g, " ")
    .trim() ?? "";

const readEnglishSenses = (payload: unknown): DictionarySense[] => {
  const english = (payload as Record<string, unknown> | null)?.en;
  if (!Array.isArray(english)) return [];

  return english.flatMap((sense) => {
    const partOfSpeech = plainText(String(sense?.partOfSpeech ?? ""));
    const rawDefinitions: unknown[] = Array.isArray(sense?.definitions)
      ? sense.definitions
      : [];

    const definitions = rawDefinitions.flatMap((raw) => {
      const entry = raw as { definition?: unknown; examples?: unknown };
      const definition = plainText(String(entry?.definition ?? ""));
      if (!definition) return [];
      const example = Array.isArray(entry?.examples)
        ? plainText(String(entry.examples[0] ?? ""))
        : "";
      return [{ definition, example: example || undefined }];
    });

    if (!partOfSpeech || definitions.length === 0) return [];
    return [{ partOfSpeech, definitions }];
  });
};

const DICTIONARY_ENDPOINT =
  "https://en.wiktionary.org/api/rest_v1/page/definition/";

const googleSearchUrl = (word: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(`define ${word}`)}`;

const shuffle = (items: Puzzle[]) => {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
};

export default function Home() {
  const appShellRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [orderedPuzzles, setOrderedPuzzles] = useState(defaultPuzzles);
  const [customPuzzles, setCustomPuzzles] = useState<Puzzle[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAddGame, setShowAddGame] = useState(false);
  const [newGameUrl, setNewGameUrl] = useState("");
  const [addGameError, setAddGameError] = useState("");
  const [extensionStatus, setExtensionStatus] = useState<
    "checking" | "ready" | "missing"
  >("checking");
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [showExtensionGuide, setShowExtensionGuide] = useState(false);
  const [registeredCustomHosts, setRegisteredCustomHosts] = useState<Set<string>>(
    new Set(),
  );
  const [customFrameRevision, setCustomFrameRevision] = useState(0);
  const [archiveDate, setArchiveDate] = useState("");
  const [registeredClockDate, setRegisteredClockDate] = useState<string | null>("");
  const [clockRevision, setClockRevision] = useState(0);
  const [lookupWord, setLookupWord] = useState("");
  const [lookupTerm, setLookupTerm] = useState("");
  const [lookupStatus, setLookupStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [lookupSenses, setLookupSenses] = useState<DictionarySense[]>([]);
  const [lookupError, setLookupError] = useState("");
  const [lookupCollapsed, setLookupCollapsed] = useState(false);
  const lookupRequestRef = useRef<AbortController | null>(null);
  const pendingCustomHostsRef = useRef<string[]>([]);
  const activePuzzle = orderedPuzzles[activeIndex];
  const nextPuzzle = orderedPuzzles[activeIndex + 1];
  const nextPuzzleUrl = nextPuzzle && puzzleUrl(nextPuzzle, archiveDate);
  const activePuzzleUrl = puzzleUrl(activePuzzle, archiveDate);
  const extensionReady = extensionStatus === "ready";
  // The clock shim only counts once the extension has confirmed this exact date.
  const clockShimActive =
    Boolean(archiveDate) && extensionReady && registeredClockDate === archiveDate;
  const followsDate = (puzzle: Puzzle) =>
    hasArchiveUrl(puzzle) || (clockShimActive && CLOCK_SHIM_URLS.has(puzzle.url));
  const archiveMissing = Boolean(archiveDate) && !followsDate(activePuzzle);
  const extensionHealth = !extensionReady
    ? "missing"
    : extensionVersion === EXPECTED_EXTENSION_VERSION
      ? "current"
      : "outdated";
  const extensionHealthText =
    extensionHealth === "current"
      ? `Extension ${EXPECTED_EXTENSION_VERSION} is installed and up to date`
      : extensionHealth === "outdated"
        ? extensionVersion
          ? `Extension ${extensionVersion} is installed but version ${EXPECTED_EXTENSION_VERSION} is available`
          : `Extension is installed but its version could not be verified; version ${EXPECTED_EXTENSION_VERSION} is available`
        : "Extension is not installed or is not responding";
  const canFramePuzzle = (puzzle: Puzzle) =>
    puzzle.custom
      ? extensionReady && registeredCustomHosts.has(customHost(puzzle))
      : puzzle.canEmbed !== false || extensionReady;
  const activePuzzleCanEmbed = canFramePuzzle(activePuzzle);

  useEffect(() => {
    if (!nextPuzzleUrl) return;

    let nextUrl: URL;
    try {
      nextUrl = new URL(nextPuzzleUrl);
    } catch {
      return;
    }
    if (!["http:", "https:"].includes(nextUrl.protocol)) return;

    const hints = [
      { rel: "preconnect", href: nextUrl.origin, crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: nextUrl.origin },
      { rel: "prefetch", href: nextUrl.href, as: "document" },
    ].flatMap(({ rel, href, crossOrigin, as }) => {
      const selector = `link[data-puzzle-date-hint="${rel}"][href="${CSS.escape(href)}"]`;
      if (document.head.querySelector(selector)) return [];

      const link = document.createElement("link");
      link.rel = rel;
      link.href = href;
      link.dataset.puzzleDateHint = rel;
      if (crossOrigin) link.crossOrigin = crossOrigin;
      if (as) link.as = as;
      document.head.appendChild(link);
      return [link];
    });

    return () => hints.forEach((link) => link.remove());
  }, [nextPuzzleUrl]);

  const openInNewTab = useCallback((url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, []);

  useEffect(() => {
    const handleExtensionReady = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      const version =
        detail && typeof detail === "object" && "version" in detail
          ? validExtensionVersion((detail as { version?: unknown }).version)
          : null;
      setExtensionVersion(version);
      setExtensionStatus("ready");
    };
    window.addEventListener(
      "PUZZLE_DATE_EXTENSION_READY",
      handleExtensionReady,
    );
    window.dispatchEvent(new CustomEvent("PUZZLE_DATE_EXTENSION_PING"));

    // ponytail: allow document_idle content scripts a moment to announce themselves.
    const readinessTimer = window.setTimeout(() => {
      setExtensionStatus((status) =>
        status === "checking" ? "missing" : status,
      );
    }, 800);

    return () => {
      window.clearTimeout(readinessTimer);
      window.removeEventListener(
        "PUZZLE_DATE_EXTENSION_READY",
        handleExtensionReady,
      );
    };
  }, []);

  useEffect(() => {
    const handleRegistrationResult = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail?.ok) {
        console.error("Puzzle Date custom-game registration failed:", detail?.error);
        return;
      }
      const hostnames = normalizeCustomHosts(detail?.hostnames);
      if (
        !hostnames ||
        JSON.stringify(hostnames) !== JSON.stringify(pendingCustomHostsRef.current)
      ) return;
      setRegisteredCustomHosts(new Set(hostnames));
      setCustomFrameRevision((revision) => revision + 1);
    };
    window.addEventListener(
      "PUZZLE_DATE_CUSTOM_GAMES_RESULT",
      handleRegistrationResult,
    );
    return () =>
      window.removeEventListener(
        "PUZZLE_DATE_CUSTOM_GAMES_RESULT",
        handleRegistrationResult,
      );
  }, []);

  useEffect(() => {
    if (!extensionReady) {
      setRegisteredCustomHosts(new Set());
      return;
    }
    const hostnames = normalizeCustomHosts(customPuzzles.map(customHost).filter(Boolean));
    if (!hostnames) return;
    pendingCustomHostsRef.current = hostnames;
    window.dispatchEvent(
      new CustomEvent("PUZZLE_DATE_REGISTER_CUSTOM_GAMES", {
        detail: { hostnames },
      }),
    );
  }, [customPuzzles, extensionReady]);

  useEffect(() => {
    let savedCustomPuzzles: Puzzle[] = [];
    const customGames = window.localStorage.getItem("puzzle-date-custom-games");

    if (customGames) {
      try {
        const savedGames = JSON.parse(customGames) as Array<{
          name: string;
          url: string;
        }>;

        savedCustomPuzzles = savedGames.slice(0, MAX_CUSTOM_GAMES).flatMap(({ name, url }) => {
          try {
            if (typeof name !== "string" || typeof url !== "string") return [];
            const parsedUrl = new URL(url);
            if (
              !["http:", "https:"].includes(parsedUrl.protocol) ||
              !parsedUrl.hostname
            ) return [];
            return [{
              name,
              publisher: "Your added game",
              url: parsedUrl.href,
              color: "#72b6a7",
              custom: true,
              canEmbed: false,
              resetStrategy: "custom-clear-all",
            }];
          } catch {
            return [];
          }
        });
      } catch {
        window.localStorage.removeItem("puzzle-date-custom-games");
      }
    }

    setCustomPuzzles(savedCustomPuzzles);
    const availablePuzzles = [
      ...puzzlesForDay(new Date().getDay()),
      ...savedCustomPuzzles,
    ];
    const stored = window.localStorage.getItem("puzzle-date-order");

    if (stored) {
      try {
        const puzzleIds = JSON.parse(stored) as string[];
        const restored = puzzleIds
          .map((puzzleId) =>
            availablePuzzles.find(
              (puzzle) =>
                puzzle.url === puzzleId || puzzle.name === puzzleId,
            ),
          )
          .filter((puzzle): puzzle is Puzzle => Boolean(puzzle));

        if (
          restored.length === availablePuzzles.length &&
          restored[0].name === "Connections"
        ) {
          setOrderedPuzzles(restored);
          return;
        }
      } catch {
        window.localStorage.removeItem("puzzle-date-order");
      }
    }

    setOrderedPuzzles(availablePuzzles);
  }, []);

  const goToPuzzle = useCallback(
    (nextIndex: number, openExternal = true) => {
      if (nextIndex < 0 || nextIndex >= orderedPuzzles.length) return;
      const nextPuzzle = orderedPuzzles[nextIndex];

      setActiveIndex(nextIndex);
      if (
        openExternal &&
        nextPuzzle.canEmbed === false &&
        extensionStatus !== "ready"
      ) {
        openInNewTab(puzzleUrl(nextPuzzle, archiveDate));
      }
    },
    [archiveDate, extensionStatus, openInNewTab, orderedPuzzles],
  );

  const goPrevious = useCallback(() => {
    goToPuzzle(activeIndex - 1);
  }, [activeIndex, goToPuzzle]);

  const goNext = useCallback(() => {
    goToPuzzle(activeIndex + 1);
  }, [activeIndex, goToPuzzle]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches("input, textarea, select") ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.key === "ArrowLeft") goPrevious();
      if (event.key === "ArrowRight") goNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrevious]);


  const reloadGame = () => {
    if (extensionStatus !== "ready") {
      setShowExtensionGuide(true);
      return;
    }

    window.dispatchEvent(
      new CustomEvent("RESET_ACTIVE_IFRAME", {
        detail: { strategy: activePuzzle.resetStrategy },
      }),
    );
  };

  const shuffleRest = () => {
    const nextOrder = [
      orderedPuzzles[0],
      ...shuffle(orderedPuzzles.slice(1)),
    ];
    setOrderedPuzzles(nextOrder);
    setActiveIndex(0);
    window.localStorage.setItem(
      "puzzle-date-order",
      JSON.stringify(nextOrder.map(({ url }) => url)),
    );
  };

  const runLookup = useCallback(async (rawWord: string) => {
    const word = rawWord.replace(/\s+/g, " ").trim();
    if (!word) return;

    lookupRequestRef.current?.abort();
    const request = new AbortController();
    lookupRequestRef.current = request;

    setLookupTerm(word);
    setLookupStatus("loading");
    setLookupError("");
    setLookupSenses([]);

    try {
      const response = await fetch(
        `${DICTIONARY_ENDPOINT}${encodeURIComponent(word)}`,
        { signal: request.signal },
      );
      if (response.status === 404) {
        setLookupStatus("error");
        setLookupError(`No English entry for “${word}”.`);
        return;
      }
      if (!response.ok) throw new Error(`status ${response.status}`);

      const senses = readEnglishSenses(await response.json());
      if (senses.length === 0) {
        setLookupStatus("error");
        setLookupError(`No English entry for “${word}”.`);
        return;
      }

      setLookupSenses(senses);
      setLookupStatus("done");
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      setLookupStatus("error");
      setLookupError("Lookup failed. Check your connection, or try Google.");
    }
  }, []);

  const lookUpWord = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runLookup(lookupWord);
  };

  // A focused cross-origin game frame swallows arrow keys, so the extension
  // relays the unhandled ones back to Puzzle Date.
  useEffect(() => {
    const handleFrameArrowKey = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const message = event.data as
        | { source?: unknown; type?: unknown; key?: unknown; text?: unknown }
        | null;
      if (message?.source !== "puzzle-date-extension") return;

      if (message.type === "PUZZLE_DATE_ARROW_KEY") {
        if (message.key === "ArrowLeft") goPrevious();
        if (message.key === "ArrowRight") goNext();
        return;
      }

      // Right-clicking a selection inside a game looks it up here.
      if (message.type === "PUZZLE_DATE_LOOKUP_SELECTION") {
        const text = typeof message.text === "string" ? message.text : "";
        if (!text.trim() || text.length > 60) return;
        setLookupWord(text);
        setLookupCollapsed(false);
        window.localStorage.setItem(LOOKUP_COLLAPSED_KEY, "false");
        runLookup(text);
      }
    };

    window.addEventListener("message", handleFrameArrowKey);
    return () => window.removeEventListener("message", handleFrameArrowKey);
  }, [goNext, goPrevious, runLookup]);

  useEffect(() => () => lookupRequestRef.current?.abort(), []);

  useEffect(() => {
    if (window.localStorage.getItem(LOOKUP_COLLAPSED_KEY) === "true") {
      setLookupCollapsed(true);
    }
  }, []);

  const toggleLookup = () => {
    setLookupCollapsed((collapsed) => {
      const next = !collapsed;
      window.localStorage.setItem(LOOKUP_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  useEffect(() => {
    const saved = window.localStorage.getItem(ARCHIVE_STORAGE_KEY) ?? "";
    // A stored date goes stale the moment it stops being in the past.
    if (isArchiveDate(saved)) setArchiveDate(saved);
    else if (saved) window.localStorage.removeItem(ARCHIVE_STORAGE_KEY);
  }, []);

  useEffect(() => {
    const handleClockResult = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail?.ok) {
        console.error("Puzzle Date clock shim failed:", detail?.error);
        setRegisteredClockDate(null);
        return;
      }
      setRegisteredClockDate(typeof detail.date === "string" ? detail.date : null);
      // Remount the frame only now, so the game reads the shifted clock.
      setClockRevision((revision) => revision + 1);
    };
    window.addEventListener("PUZZLE_DATE_SET_CLOCK_RESULT", handleClockResult);
    return () =>
      window.removeEventListener("PUZZLE_DATE_SET_CLOCK_RESULT", handleClockResult);
  }, []);

  useEffect(() => {
    if (!extensionReady) return;
    window.dispatchEvent(
      new CustomEvent("PUZZLE_DATE_SET_CLOCK", { detail: { date: archiveDate } }),
    );
  }, [archiveDate, extensionReady]);

  const changeArchiveDate = (value: string) => {
    const next = isArchiveDate(value) ? value : "";
    setArchiveDate(next);
    if (next) window.localStorage.setItem(ARCHIVE_STORAGE_KEY, next);
    else window.localStorage.removeItem(ARCHIVE_STORAGE_KEY);
  };

  const addCustomGame = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const parsedUrl = new URL(newGameUrl.trim());
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("unsupported protocol");
      }

      if (orderedPuzzles.some((puzzle) => puzzle.url === parsedUrl.href)) {
        setAddGameError("That game is already in your rotation.");
        return;
      }
      if (!parsedUrl.hostname || customPuzzles.length >= MAX_CUSTOM_GAMES) {
        setAddGameError("Puzzle Date supports up to 100 added game links.");
        return;
      }

      const domainName = parsedUrl.hostname
        .replace(/^www\./, "")
        .split(".")[0]
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
      const newPuzzle: Puzzle = {
        name: domainName || "Custom Game",
        publisher: "Your added game",
        url: parsedUrl.href,
        color: "#72b6a7",
        custom: true,
        canEmbed: false,
        resetStrategy: "custom-clear-all",
      };
      const nextCustomPuzzles = [...customPuzzles, newPuzzle];
      const nextOrder = [...orderedPuzzles, newPuzzle];

      setCustomPuzzles(nextCustomPuzzles);
      setOrderedPuzzles(nextOrder);
      setActiveIndex(nextOrder.length - 1);
      if (!extensionReady) openInNewTab(newPuzzle.url);
      window.localStorage.setItem(
        "puzzle-date-custom-games",
        JSON.stringify(
          nextCustomPuzzles.map(({ name, url }) => ({ name, url })),
        ),
      );
      window.localStorage.setItem(
        "puzzle-date-order",
        JSON.stringify(nextOrder.map(({ url }) => url)),
      );
      setNewGameUrl("");
      setAddGameError("");
      setShowAddGame(false);
    } catch {
      setAddGameError("Enter a complete link beginning with https://");
    }
  };

  return (
    <main className="app-shell" ref={appShellRef} tabIndex={-1}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <div>
            <p className="eyebrow">Your daily rotation</p>
            <h1>Puzzle Date</h1>
          </div>
        </div>

        <div className="puzzle-title" aria-live="polite">
          <span
            className="title-dot"
            style={{ backgroundColor: activePuzzle.color }}
            aria-hidden="true"
          />
          <div>
            <strong>{activePuzzle.name}</strong>
            <span>
              {archiveDate
                ? archiveMissing
                  ? CLOCK_SHIM_URLS.has(activePuzzle.url)
                    ? "Needs the extension for archives"
                    : "No archive — today's puzzle"
                  : `Archive · ${archiveDate}`
                : activePuzzle.publisher}
            </span>
          </div>
        </div>

        <div className="header-actions">
          <div className="date-control">
            <label className="visually-hidden" htmlFor="archive-date">
              Puzzle date
            </label>
            <input
              id="archive-date"
              type="date"
              max={isoToday()}
              value={archiveDate}
              onChange={(event) => changeArchiveDate(event.target.value)}
              title="Play an earlier day's puzzles"
            />
            {archiveDate && (
              <button
                className="utility-button"
                type="button"
                onClick={() => changeArchiveDate("")}
              >
                Today
              </button>
            )}
          </div>
          <button className="utility-button" type="button" onClick={shuffleRest}>
            Shuffle rest
          </button>
          {activePuzzle.resetStrategy && canFramePuzzle(activePuzzle) && (
            <button
              className="utility-button"
              type="button"
              onClick={reloadGame}
            >
              Start Over
            </button>
          )}
          <button
            className="extension-help-button"
            type="button"
            onClick={() => setShowExtensionGuide(true)}
            aria-label={`${extensionHealthText}. Open extension download and instructions`}
            title={extensionHealthText}
          >
            <span aria-hidden="true">↓</span>
            <span className="extension-help-label">Extension</span>
            <span
              className={`extension-health-light extension-health-light--${extensionHealth}`}
              aria-hidden="true"
            />
            <span className="visually-hidden" aria-live="polite">
              {extensionHealthText}
            </span>
          </button>
          <button
            className="add-game-button"
            type="button"
            onClick={() => {
              setAddGameError("");
              setShowAddGame(true);
            }}
            aria-label="Add a game"
            title="Add a game"
          >
            +
          </button>
        </div>
      </header>

      {showAddGame && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="add-game-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-game-title"
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setShowAddGame(false)}
              aria-label="Close add game"
            >
              ×
            </button>
            <p className="eyebrow">Your rotation</p>
            <h2 id="add-game-title">Add a game</h2>
            <p>Paste the game’s full web address.</p>
            <form onSubmit={addCustomGame}>
              <label htmlFor="new-game-url">Game link</label>
              <input
                id="new-game-url"
                type="url"
                inputMode="url"
                placeholder="https://example.com/game"
                value={newGameUrl}
                onChange={(event) => {
                  setNewGameUrl(event.target.value);
                  setAddGameError("");
                }}
                autoFocus
                required
              />
              {addGameError && (
                <span className="form-error" role="alert">
                  {addGameError}
                </span>
              )}
              <button type="submit">Add to Puzzle Date</button>
            </form>
          </section>
        </div>
      )}

      {showExtensionGuide && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="add-game-modal extension-guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="extension-guide-title"
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setShowExtensionGuide(false)}
              aria-label="Close extension installation message"
            >
              ×
            </button>
            <p className="eyebrow">Chrome extension · Version 1.0.20</p>
            <h2 id="extension-guide-title">Add Start Over to Puzzle Date</h2>
            <p>
              Install the extension once to embed supported games and let Puzzle
              Date reset them from inside the app.
            </p>
            <p>
              Version 1.0.20 adds right-click lookup: highlight a word inside a
              game and right-click it to search it in the word lookup panel.
              It also restores ad blocking on the embedded games, which
              added new advertising partners the old list did not cover. The
              blocklist grew from 23 audited domains to 78.
              It also lets Verticle, FoxiMax, Poople, Unwordle, Waffle,
              and Word Salad follow the title-bar date picker. They have no
              archive link, so the extension shifts the clock inside those game
              frames only, while an earlier day is selected.
              It also makes Start Over reset the puzzle you are actually
              looking at when the title-bar date picker is set to a past day.
              It keeps the ← and → keys working even while a game
              iframe has keyboard focus, by relaying arrow presses the game
              itself does not use back to Puzzle Date.
              It expands audited ad blocking across the embedded games,
              including verified Word 500 services and narrow game-specific ad paths.
              Next-game preload now warms network resources without creating the next
              iframe, so timers do not begin before you reach a game. It also reopens Connections automatically after Start Over
              instead of leaving the iframe on the Play screen. In recognized cookie-consent dialogs,
              it rejects or declines optional cookies, or limits consent to
              necessary cookies. If no privacy-preserving choice exists, it
              dismisses or hides the recognized banner. This is best-effort, not
              universal, and never chooses “Accept all.” Ordinary browsing is
              unaffected.
            </p>
            <a
              className="extension-download-link"
              href="/PuzzleDate/downloads/puzzle-date-game-reset.zip"
              download
            >
              Download extension 1.0.20
            </a>
            <div className="extension-guide-steps">
              <section aria-labelledby="new-install-title">
                <h3 id="new-install-title">Install in Chrome</h3>
                <ol>
                  <li>Download the ZIP above, then unzip it.</li>
                  <li>
                    Open <code>chrome://extensions</code> and turn on Developer
                    mode.
                  </li>
                  <li>
                    Choose <strong>Load unpacked</strong> and select the unzipped
                    folder.
                  </li>
                  <li>Refresh Puzzle Date.</li>
                </ol>
              </section>
              <section aria-labelledby="update-install-title">
                <h3 id="update-install-title">Already installed?</h3>
                <ol>
                  <li>Remove the old Puzzle Date extension in Chrome.</li>
                  <li>Download and unzip version 1.0.20.</li>
                  <li>Load the new folder, then refresh Puzzle Date.</li>
                </ol>
              </section>
            </div>
            <p>
              The light beside Extension is red when it is missing, yellow when
              an update is available, and green when version 1.0.20 is ready.
            </p>
            <p className="extension-reset-warning">
              <strong>Custom-game warning:</strong> Start Over clears all local
              storage for that added game’s website. This can erase its stats,
              tutorial state, settings, and saved progress.
            </p>
            <p>
              Connections Start Over keeps its saved puzzle, archive mode,
              statistics, and settings while resetting only the current
              puzzle&apos;s guesses, solved categories, mistakes, and completion
              flags.
            </p>
          </section>
        </div>
      )}

      <div className="stage">
        {/* ponytail: always-on panel. Add a collapse toggle if it crowds the games. */}
        <aside
          className="lookup"
          data-collapsed={lookupCollapsed ? "true" : undefined}
          aria-label="Word lookup"
        >
          <button
            className="lookup-toggle"
            type="button"
            onClick={toggleLookup}
            aria-expanded={!lookupCollapsed}
            aria-controls="lookup-body"
            title={lookupCollapsed ? "Show word lookup" : "Hide word lookup"}
          >
            <span className="lookup-toggle-label">Look up a word</span>
            <span aria-hidden="true">{lookupCollapsed ? "›" : "‹"}</span>
          </button>

          <div className="lookup-body" id="lookup-body" hidden={lookupCollapsed}>
          <form onSubmit={lookUpWord}>
            <label className="visually-hidden" htmlFor="lookup-word">
              Look up a word
            </label>
            <div className="lookup-field">
              <input
                id="lookup-word"
                type="search"
                autoComplete="off"
                placeholder="e.g. cleave"
                value={lookupWord}
                onChange={(event) => setLookupWord(event.target.value)}
              />
              <button type="submit" aria-label="Look up word">
                →
              </button>
            </div>
          </form>

          <div className="lookup-results" aria-live="polite">
            {lookupStatus === "idle" && (
              <p className="lookup-hint">
                Definitions appear here without leaving your game.
              </p>
            )}
            {lookupStatus === "loading" && (
              <p className="lookup-hint">Looking up “{lookupTerm}”…</p>
            )}
            {lookupStatus === "error" && (
              <p className="lookup-hint lookup-hint--error">{lookupError}</p>
            )}
            {lookupStatus === "done" && (
              <article className="lookup-entry">
                <h3>{lookupTerm}</h3>
                {lookupSenses.map((sense, senseIndex) => (
                  <div
                    className="lookup-meaning"
                    key={`${sense.partOfSpeech}-${senseIndex}`}
                  >
                    <p className="lookup-part">{sense.partOfSpeech}</p>
                    <ol>
                      {sense.definitions
                        .slice(0, 3)
                        .map(({ definition, example }, index) => (
                          <li key={`${index}-${definition.slice(0, 24)}`}>
                            {definition}
                            {example && (
                              <span className="lookup-example">
                                “{example}”
                              </span>
                            )}
                          </li>
                        ))}
                    </ol>
                  </div>
                ))}
              </article>
            )}
          </div>

          {lookupTerm && (
            <a
              className="lookup-google"
              href={googleSearchUrl(lookupTerm)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Search Google for “{lookupTerm}” <span aria-hidden="true">↗</span>
            </a>
          )}
          </div>
        </aside>

        <section className="frame-wrap" aria-label={`${activePuzzle.name} puzzle`}>
        {!activePuzzleCanEmbed && (
          <div className="external-game">
            <span
              className="external-dot"
              style={{ backgroundColor: activePuzzle.color }}
              aria-hidden="true"
            />
            <p className="eyebrow">Opened in a new tab</p>
            <h2>{activePuzzle.name}</h2>
            <p>
              This game does not allow embedding. Playing it on its own site
              also gives it the best chance to keep your progress.
            </p>
            <a href={activePuzzleUrl} target="_blank" rel="noreferrer">
              Open {activePuzzle.name} <span aria-hidden="true">↗</span>
            </a>
          </div>
        )}
        {activePuzzleCanEmbed && (
          <iframe
            ref={frameRef}
            key={`${activePuzzleUrl}:${activePuzzle.custom ? customFrameRevision : 0}:${clockRevision}`}
            className="game-frame active"
            src={activePuzzleUrl}
            title={activePuzzle.name}
            loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="fullscreen; clipboard-read; clipboard-write; storage-access"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-presentation"
            data-custom-game={activePuzzle.custom ? "true" : undefined}
            onPointerLeave={() => appShellRef.current?.focus()}
          />
        )}
        </section>
      </div>

      <nav
        className="controls"
        aria-label="Puzzle navigation"
        onPointerEnter={() => appShellRef.current?.focus()}
      >
        {activeIndex > 0 ? (
          <button type="button" onClick={goPrevious} aria-label="Previous puzzle">
            <span aria-hidden="true">←</span>
            <span className="button-label">Previous</span>
          </button>
        ) : (
          <span className="control-placeholder" aria-hidden="true" />
        )}

        <div className="progress">
          <div className="game-menu" aria-label="Choose a game">
            <p className="game-menu-title">
              {archiveDate ? `Archive · ${archiveDate}` : "Jump to a game"}
            </p>
            <div className="game-menu-list">
              {orderedPuzzles.map((puzzle, index) => (
                <button
                  key={`menu-${puzzle.url}`}
                  type="button"
                  className={index === activeIndex ? "active" : ""}
                  onClick={() => goToPuzzle(index)}
                  aria-current={index === activeIndex ? "page" : undefined}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {puzzle.name}
                  {archiveDate && !followsDate(puzzle) && (
                    <em className="game-menu-note">
                      {CLOCK_SHIM_URLS.has(puzzle.url)
                        ? "needs extension"
                        : "today only"}
                    </em>
                  )}
                </button>
              ))}
            </div>
          </div>
          <span className="count">
            {String(activeIndex + 1).padStart(2, "0")}
            <span aria-hidden="true"> / </span>
            {String(orderedPuzzles.length).padStart(2, "0")}
          </span>
          <div className="steps">
            {orderedPuzzles.map((puzzle, index) => (
              <button
                key={puzzle.url}
                type="button"
                className={index === activeIndex ? "active" : ""}
                onClick={() => goToPuzzle(index)}
                aria-label={`Go to ${puzzle.name}`}
                aria-current={index === activeIndex ? "step" : undefined}
              />
            ))}
          </div>
          <span className="shortcut">Use ← → keys</span>
        </div>

        {activeIndex < orderedPuzzles.length - 1 ? (
          <button type="button" onClick={goNext} aria-label="Next puzzle">
            <span className="button-label">Next</span>
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <span className="control-placeholder" aria-hidden="true" />
        )}
      </nav>
    </main>
  );
}
