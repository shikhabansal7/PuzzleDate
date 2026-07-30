"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Puzzle = {
  name: string;
  publisher: string;
  url: string;
  color: string;
  canEmbed?: boolean;
  canReset?: boolean;
  resetStorageKeys?: string[];
  fridayOnly?: boolean;
  custom?: boolean;
};

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
    canReset: true,
    resetStorageKeys: [],
  },
  {
    name: "FoxiMax",
    publisher: "Daily puzzle",
    url: "https://foximax.com/",
    color: "#f39c81",
    canEmbed: false,
  },
  {
    name: "Verticle",
    publisher: "Daily word ladder",
    url: "https://verticle.netlify.app/",
    color: "#9cc8a7",
    canReset: true,
    resetStorageKeys: ["gameofthedaystate", "gamestate"],
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
    canReset: false,
  },
  {
    name: "4 × 3",
    publisher: "Hank Green",
    url: "https://www.hankgreen.com/fourbythree/",
    color: "#e893bd",
    canEmbed: false,
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
    fridayOnly: true,
  },
  {
    name: "Poople",
    publisher: "Daily guessing game",
    url: "https://poople.io/",
    color: "#d5a47a",
    canReset: true,
    resetStorageKeys: ["guesses"],
  },
];

const puzzlesForDay = (day: number) =>
  puzzles.filter((puzzle) => !puzzle.fridayOnly || day === 5);

const defaultPuzzles = puzzlesForDay(-1);

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
  const activePuzzle = orderedPuzzles[activeIndex];

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
    let savedCustomPuzzles: Puzzle[] = [];
    const customGames = window.localStorage.getItem("puzzle-date-custom-games");

    if (customGames) {
      try {
        const savedGames = JSON.parse(customGames) as Array<{
          name: string;
          url: string;
        }>;

        savedCustomPuzzles = savedGames.flatMap(({ name, url }) => {
          try {
            const parsedUrl = new URL(url);
            if (!["http:", "https:"].includes(parsedUrl.protocol)) return [];
            return [{
              name,
              publisher: "Your added game",
              url: parsedUrl.href,
              color: "#72b6a7",
              custom: true,
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
      if (openExternal && nextPuzzle.canEmbed === false) {
        openInNewTab(nextPuzzle);
      }
    },
    [openInNewTab, orderedPuzzles],
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
    window.dispatchEvent(
      new CustomEvent("RESET_ACTIVE_IFRAME", {
        detail: { keys: activePuzzle.resetStorageKeys ?? [] },
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
      };
      const nextCustomPuzzles = [...customPuzzles, newPuzzle];
      const nextOrder = [...orderedPuzzles, newPuzzle];

      setCustomPuzzles(nextCustomPuzzles);
      setOrderedPuzzles(nextOrder);
      setActiveIndex(nextOrder.length - 1);
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
          {activePuzzle.canEmbed !== false && activePuzzle.canReset === true && (
            <button
              className="utility-button"
              type="button"
              onClick={reloadGame}
            >
              Start Over
            </button>
          )}
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

      <section className="frame-wrap" aria-label={`${activePuzzle.name} puzzle`}>
        {activePuzzle.canEmbed === false ? (
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
        ) : (
          <iframe
            key={activePuzzle.url}
            src={activePuzzle.url}
            title={activePuzzle.name}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="fullscreen; clipboard-read; clipboard-write; storage-access"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-presentation"
            onPointerLeave={() => appShellRef.current?.focus()}
          />
        )}
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
          <span className="count">
            {String(activeIndex + 1).padStart(2, "0")}
            <span aria-hidden="true"> / </span>
            {String(orderedPuzzles.length).padStart(2, "0")}
          </span>
          <div className="steps" aria-hidden="true">
            {orderedPuzzles.map((puzzle, index) => (
              <button
                key={puzzle.url}
                type="button"
                className={index === activeIndex ? "active" : ""}
                onClick={() => goToPuzzle(index)}
                tabIndex={-1}
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
