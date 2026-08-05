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
  | "word500-current"
  | "foximax-daily"
  | "verticle-current"
  | "four-by-three-current"
  | "full-circle-current"
  | "poople-current"
  | "custom-clear-all";

const puzzles: Puzzle[] = [
  {
    name: "Connections",
    publisher: "The New York Times",
    url: "https://www.nytimes.com/games/connections",
    color: "#b4a8ff",
    canEmbed: false,
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
  const [orderedPuzzles, setOrderedPuzzles] = useState(defaultPuzzles);
  const [customPuzzles, setCustomPuzzles] = useState<Puzzle[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAddGame, setShowAddGame] = useState(false);
  const [newGameUrl, setNewGameUrl] = useState("");
  const [addGameError, setAddGameError] = useState("");
  const [extensionStatus, setExtensionStatus] = useState<
    "checking" | "ready" | "missing"
  >("checking");
  const [showExtensionGuide, setShowExtensionGuide] = useState(false);
  const [registeredCustomHosts, setRegisteredCustomHosts] = useState<Set<string>>(
    new Set(),
  );
  const [customFrameRevision, setCustomFrameRevision] = useState(0);
  const pendingCustomHostsRef = useRef<string[]>([]);
  const activePuzzle = orderedPuzzles[activeIndex];
  const nextPuzzle = orderedPuzzles[activeIndex + 1];
  const extensionReady = extensionStatus === "ready";
  const canFramePuzzle = (puzzle: Puzzle) =>
    puzzle.custom
      ? extensionReady && registeredCustomHosts.has(customHost(puzzle))
      : puzzle.canEmbed !== false || extensionReady;
  const activePuzzleCanEmbed = canFramePuzzle(activePuzzle);
  const framedPuzzles = [
    ...(activePuzzleCanEmbed
      ? [{ puzzle: activePuzzle, isActive: true }]
      : []),
    ...(nextPuzzle && canFramePuzzle(nextPuzzle)
      ? [{ puzzle: nextPuzzle, isActive: false }]
      : []),
  ];

  const openInNewTab = useCallback((puzzle: Puzzle) => {
    const link = document.createElement("a");
    link.href = puzzle.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, []);

  useEffect(() => {
    const handleExtensionReady = () => setExtensionStatus("ready");
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
        openInNewTab(nextPuzzle);
      }
    },
    [extensionStatus, openInNewTab, orderedPuzzles],
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
      if (!extensionReady) openInNewTab(newPuzzle);
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
            <span>{activePuzzle.publisher}</span>
          </div>
        </div>

        <div className="header-actions">
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
            aria-label="Download or install the Puzzle Date extension"
            title="Extension download and instructions"
          >
            <span aria-hidden="true">↓</span>
            <span className="extension-help-label">Extension</span>
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
            <p className="eyebrow">Chrome extension · Version 1.0.8</p>
            <h2 id="extension-guide-title">Add Start Over to Puzzle Date</h2>
            <p>
              Install the extension once to embed supported games and let Puzzle
              Date reset them from inside the app.
            </p>
            <p>
              Version 1.0.8 also blocks common ads and trackers while games are
              embedded inside Puzzle Date. In recognized cookie-consent dialogs,
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
              Download extension 1.0.8
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
                  <li>Download and unzip version 1.0.8.</li>
                  <li>Load the new folder, then refresh Puzzle Date.</li>
                </ol>
              </section>
            </div>
            <p className="extension-reset-warning">
              <strong>Custom-game warning:</strong> Start Over clears all local
              storage for that added game’s website. This can erase its stats,
              tutorial state, settings, and saved progress.
            </p>
          </section>
        </div>
      )}

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
            <a href={activePuzzle.url} target="_blank" rel="noreferrer">
              Open {activePuzzle.name} <span aria-hidden="true">↗</span>
            </a>
          </div>
        )}
        {framedPuzzles.map(({ puzzle, isActive }) => (
          <iframe
            key={`${puzzle.url}:${puzzle.custom ? customFrameRevision : 0}`}
            className={isActive ? "game-frame active" : "game-frame preloaded"}
            src={puzzle.url}
            title={isActive ? puzzle.name : `${puzzle.name} (preloaded)`}
            aria-hidden={isActive ? undefined : true}
            tabIndex={isActive ? undefined : -1}
            loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="fullscreen; clipboard-read; clipboard-write; storage-access"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-presentation"
            data-custom-game={puzzle.custom ? "true" : undefined}
            onPointerLeave={
              isActive ? () => appShellRef.current?.focus() : undefined
            }
          />
        ))}
      </section>

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
            <p className="game-menu-title">Jump to a game</p>
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
