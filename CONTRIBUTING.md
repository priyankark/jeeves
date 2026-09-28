# Contributing to Jeeves

Jeeves is a local-first desktop app released under the Apache License 2.0. No Jeeves account is required to run, build, or exchange workflows. Contributions to the app use the same license. Dependencies and third-party skills keep their own licenses and notices.

## Develop

Use Node.js 22.12+ and npm. Run `npm ci`, then `npm run dev`. `npm run desktop:dev` opens Electron with hot reload. `npm run build` builds the web UI, standalone server, and portable skill runner. `npm run package:desktop` creates an unsigned desktop distribution for the current platform under `release/`.

Before submitting code, run `npm test`, `npm run build`, and `npm run test:e2e` (requires installed Google Chrome). Tests use temporary workspaces and mock providers. Do not commit `.env`, `.jeeves`, run outputs, downloaded private data, or build artifacts.

## Contribute a workflow

1. Build and test your workflow in Demo mode and, where appropriate, with your own live providers.
2. Open **Share / Export → Marketplace contribution**. Set the author and workflow license. Leave example input excluded unless it is intentionally public.
3. Review prompts, action URLs, and bundled skills. A credential scan helps catch common secrets but cannot determine whether all text is public. Preserve third-party skill licenses and verify redistribution rights.
4. Download the contribution ZIP. It includes the complete workflow, nested workflows, assigned skill resources, a checksummed manifest entry, and contribution instructions.
5. For this repository, add `workflows/<name>.json` to `marketplace/workflows/`, and update the root `jeeves-marketplace.json` entry path to `marketplace/workflows/<name>.json`. Recalculate its SHA-256 digest if the JSON bytes change. Run `npm run check:catalog`.
6. Send the package to a maintainer through an existing channel or submit a pull request. Publishing on GitHub uses GitHub's own account system; Jeeves itself has no account requirement.

You can host a separate community catalog in any public GitHub repository. Put `jeeves-marketplace.json` at its root with `{ "version": 1, "workflows": [...] }`. Each entry contains `id`, `name`, `description`, `author`, `license`, `tags`, `path`, `sha256`, `nodeCount`, and `providers`. The contribution export creates a ready-to-use one-workflow index. For an existing index, append the supplied entry instead of replacing it. Users connect your `owner/repository` from **Explore → Connect a community repository**.

Installing a marketplace workflow makes a new local copy with remapped IDs. It never executes a workflow or overwrites the user's existing graph. Marketplace maintainers should review prompts, executable skill resources, licenses, and external actions before accepting a contribution.

## Portable skills

**Share / Export → Portable skill** packages `SKILL.md`, a workflow graph, bundled resources, and the same execution engine used by Jeeves. Validate it outside the app with `node scripts/run.cjs --check`, then run with test inputs in Demo mode. Live runs require the listed provider keys, models, action allowlists, and tools. A skill-capable harness must be permitted to launch Node and write results. Codex nodes require Codex CLI authentication. No npm install or Jeeves background service is needed for an export.
