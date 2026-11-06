# Backend Unit Tests (node:test)

These tests use Node.js's **built-in `node:test` runner**, not Jest.

## Run them with:

```bash
node --test test/galeShapleyManyToOne.test.js
node --test test/topsis.test.js
```

Or run all at once:

```bash
node --test test/*.test.js
```

## Why separate from `tests/`?

The `tests/` folder uses **Jest** (via `npm test`). These files test pure utility
functions (`galeShapleyManyToOne.js`, `topsis.js`) using only the Node.js standard
library — no extra setup needed.

Do **not** move these into `tests/` without converting the `node:test` syntax to
Jest's `describe/it` API first.
