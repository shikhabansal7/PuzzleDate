"use client";

import { useCallback, useEffect, useState } from "react";

const puzzles = [
  {
    name: "Connections",
    publisher: "The New York Times",
    url: "https://www.nytimes.com/games/connections",
    color: "#b4a8ff",
  },
  {
    name: "Word 500",
    publisher: "Daily word challenge",
    url: "https://word500.com/",
    color: "#f3c96b",
  },
  {
    name: "FoxiMax",
    publisher: "Daily puzzle",
    url: "https://foximax.com/",
    color: "#f39c81",
  },
  {
    name: "Verticle",
    publisher: "Daily word ladder",
    url: "https://verticle.netlify.app/",
    color: "#9cc8a7",
  },
  {
    name: "Waffle",
    publisher: "Daily word puzzle",
    url: "https://wafflegame.net/daily",
    color: "#e9b949",
  },
  {
    name: "Unwordle",
    publisher: "Daily reverse Wordle",
    url: "https://unwordle.org/?daily=1",
    color: "#88b8dc",
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
];

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activePuzzle = puzzles[activeIndex];

  const goPrevious = useCallback(() => {
    setActiveIndex((current) => (current - 1 + puzzles.length) % puzzles.length);
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((current) => (current + 1) % puzzles.length);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") goPrevious();
      if (event.key === "ArrowRight") goNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrevious]);

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

        <a
          className="open-link"
          href={activePuzzle.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${activePuzzle.name} in a new tab`}
        >
          Open directly <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="frame-wrap" aria-label={`${activePuzzle.name} puzzle`}>
        <iframe
          key={activePuzzle.url}
          src={activePuzzle.url}
          title={activePuzzle.name}
          referrerPolicy="strict-origin-when-cross-origin"
          allow="fullscreen; clipboard-read; clipboard-write"
        />
      </section>

      <nav className="controls" aria-label="Puzzle navigation">
        <button type="button" onClick={goPrevious} aria-label="Previous puzzle">
          <span aria-hidden="true">←</span>
          <span className="button-label">Previous</span>
        </button>

        <div className="progress">
          <span className="count">
            {String(activeIndex + 1).padStart(2, "0")}
            <span aria-hidden="true"> / </span>
            {String(puzzles.length).padStart(2, "0")}
          </span>
          <div className="steps" aria-hidden="true">
            {puzzles.map((puzzle, index) => (
              <button
                key={puzzle.name}
                type="button"
                className={index === activeIndex ? "active" : ""}
                onClick={() => setActiveIndex(index)}
                tabIndex={-1}
              />
            ))}
          </div>
          <span className="shortcut">Use ← → keys</span>
        </div>

        <button type="button" onClick={goNext} aria-label="Next puzzle">
          <span className="button-label">Next</span>
          <span aria-hidden="true">→</span>
        </button>
      </nav>
    </main>
  );
}
