# Repository Guidelines

## Project Structure

- `core/` is the CommonJS Node.js backend. `core/client.js` starts the admin server and worker runtime. HTTP handlers live in `core/src/controllers/`, worker management in `core/src/runtime/`, and feature logic in `core/src/services/`.
- `web/` is the Vue 3, TypeScript, and Vite dashboard. Find pages in `web/src/views/`, reusable UI in `web/src/components/`, Pinia stores in `web/src/stores/`, and the API client in `web/src/api/`.
- Static assets live in `web/public/` and `core/src/gameConfig/`. Protobuf definitions live in `core/src/proto/`.

## Build and Development

Run commands from the repository root with Node.js 20.19+ on the 20.x line or Node.js 22.12+, and pnpm 10.30.2.

- `pnpm install --frozen-lockfile` installs workspace dependencies using the CI lockfile settings.
- `pnpm dev` builds the dashboard and starts the backend at `http://localhost:3000`. For frontend hot reload, run `pnpm dev:core` and `pnpm dev:web` in separate terminals. Vite proxies API and Socket.IO traffic to port 3000.
- `pnpm build:web` runs Vue type checking and writes the production bundle to `web/dist/`.
- `pnpm lint` runs ESLint with autofix in both packages. Review the resulting diff.
- `pnpm package:win` builds the dashboard and packages the Windows executable in `core/dist/`.

## Coding Style

Use two spaces and single quotes in web code and omit semicolons. Name Vue components and views in PascalCase, such as `BagPanel.vue`, and follow the `useBagStore` pattern for Pinia store exports. Match the surrounding indentation and punctuation in `core/`, where styles vary. Use camelCase for backend functions and kebab-case for multiword module filenames, such as `worker-manager.js`.

## Verification

CI checks ESLint and the web build. The core `test` script is a placeholder, and the repo has no configured automated test suite or coverage threshold. Smoke-test the affected dashboard or API flow locally and record the steps in your PR.

## Commits and Pull Requests

Create a new branch for each task by default. Develop and commit on that branch. Do not develop or commit directly on `main`.

Follow common commit prefixes from history, such as `feat(bag-panel):` or `fix:`. Describe the behavior change and checks run, link relevant issues, and include screenshots for visible UI changes.

## Local Configuration and Agents

Keep credentials, `.env` files, and runtime data out of Git. Use PowerShell on this Windows workspace and ask the user before creating any subagent.
