# MMXLVIII — 2048

## High-level design

- Deliver one self-contained `index.html` with inline CSS and plain JavaScript. No dependencies, network requests, build step, or server are needed.
- Represent the board as sixteen numbers in row-major order; zero means empty. Start with two random tiles. Each valid move compresses the selected rows or columns, merges equal neighbors once, adds the merged values to the score, and spawns a 2 (90%) or 4 (10%) in an empty cell. Moves that do not change the board do not spawn tiles.
- Use a square 4 × 4 board. The keyboard arrow keys move the whole board. Horizontal and vertical swipes starting within the grid also move the board; the dominant axis determines direction, and movements shorter than 24 pixels are ignored. Native buttons support mouse, touch, and keyboard focus/activation.
- Size the entire composition against both viewport dimensions, preserving its proportions and keeping all controls visible without scrolling. Use a warm paper palette, clearly differentiated tiles, and prominent current/best scores.
- Save a versioned board, score, and all-time best in local storage immediately after every valid move and new game. Validate restored data before using it. Preserve the best when starting over; if storage is unavailable, keep playing and provide a screen-reader notice.
- Keep the area below the board free of instructions and controls. Announce game-over and reaching 2048 to screen readers while allowing play beyond 2048. Place New game immediately left of Score and Best, with matching box dimensions and its dark background. Offer inline confirmation while a game is active.
- Keep movement calculation independent of rendering and persistence so merge rules can be tested with deterministic boards.

## Run

Open `index.html` directly in a modern browser. Everything runs locally. Browser storage belongs to that browser/profile and page origin; private browsing, clearing site data, or moving the file can remove or separate saved progress. Some browsers restrict storage for local files; a screen-reader notice reports when saving is unavailable.

## Verification

Run `node --test tests/game.test.cjs` for deterministic movement, score, game-over, saved-state validation, and persistence checks. The tests use Node's built-in test runner; the game itself does not require Node.
