"use client";

import { useCallback, useEffect, useState } from "react";

type Puzzle = {
  name: string;
  publisher: string;
  url: string;
  color: string;
  canEmbed?: boolean;
  canReset?: boolean;
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
    canReset: false,
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
    name: "Lin.io",
    publisher: "Hank Green 4×3",
    url: "https://playlin.io/game/hank-green-4x3/",
    color: "#e893bd",
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
    name: "Poople",
    publisher: "Daily guessing game",
    url: "https://poople.io/",
    color: "#d5a47a",
  },
];

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
  const [orderedPuzzles, setOrderedPuzzles] = useState(puzzles);
  const [activeIndex, setActiveIndex] = useState(0);
  const [frameVersion, setFrameVersion] = useState(0);
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
    const stored = window.localStorage.getItem("puzzle-date-order");

    if (stored) {
      try {
        const names = JSON.parse(stored) as string[];
        const restored = names
          .map((name) => puzzles.find((puzzle) => puzzle.name === name))
          .filter((puzzle): puzzle is Puzzle => Boolean(puzzle));

        if (
          restored.length === puzzles.length &&
          restored[0].name === "Connections"
        ) {
          setOrderedPuzzles(restored);
        }
      } catch {
        window.localStorage.removeItem("puzzle-date-order");
      }
    }
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
      if (event.key === "ArrowLeft") goPrevious();
      if (event.key === "ArrowRight") goNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrevious]);

  const reloadGame = () => {
    setFrameVersion((version) => version + 1);
  };

  const shuffleRest = () => {
    const nextOrder = [puzzles[0], ...shuffle(puzzles.slice(1))];
    setOrderedPuzzles(nextOrder);
    setActiveIndex(0);
    window.localStorage.setItem(
      "puzzle-date-order",
      JSON.stringify(nextOrder.map(({ name }) => name)),
    );
  };

  return (
    <main className="app-shell">
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
          <a
            className="open-link"
            href={activePuzzle.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${activePuzzle.name} in a new tab`}
          >
            Open directly <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

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
            key={`${activePuzzle.url}-${frameVersion}`}
            src={activePuzzle.url}
            title={activePuzzle.name}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="fullscreen; clipboard-read; clipboard-write; storage-access"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-presentation"
          />
        )}
      </section>

      <nav className="controls" aria-label="Puzzle navigation">
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
                key={puzzle.name}
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
