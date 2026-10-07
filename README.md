# Codex Commit Message

Generate commit messages from staged changes using the Codex you already use in VS Code.

Stage your changes, click the sparkle in Source Control, and review the message before committing. Small codebase, no runtime npm dependencies, and token usage kept in mind.

## Why I built this

I wanted a commit-message generator, but I didn't want to hand my code to a random extension just to save a little typing. When I looked around, I couldn't find one clear community choice that I felt comfortable trusting.

GitKraken wasn't working for me either. I already had Codex installed and was using it in VS Code. Adding another tool for this one job felt unnecessary.

So I built the missing button: take my staged changes, ask Codex for a message, and put it in the commit box. That's the whole idea.

The code is here for you to read and decide whether it fits your workflow. Trust should come from being able to inspect what runs and what gets sent.

## What it does

- Generates a message from staged changes, with Conventional Commits enabled by default.
- Reuses your existing Codex authentication.
- Fills VS Code's commit-message box for you to review and edit.
- Trims the input and reuses cached results to avoid unnecessary AI requests.
- Supports multiple repositories, cancellation, and different message languages.

You stay in control of staging and committing. The extension only writes the message and preserves edits you make while generation is running.

## Install

In VS Code, open Extensions, click **… → Install from VSIX…**, and select `codex-commit-message-0.1.2.vsix`. Reload VS Code if prompted. Release packages will be available on the [GitHub releases page](https://github.com/libsrcdev/commit-message-vscode-codex/releases).

The publisher is `libsrcdev`, giving the extension the ID `libsrcdev.codex-commit-message`. If you installed an earlier development package under `local-tools`, uninstall that version first: VS Code treats the new publisher as a separate extension.

Install and sign in to the OpenAI Codex VS Code extension, or install the Codex CLI and run `codex login`. The generator automatically finds the Codex executable bundled with the OpenAI extension on supported platforms; otherwise it uses `codex` on PATH. Set **Codex Commit: Executable** to an absolute executable path if necessary. Requires a recent CLI supporting `--ignore-user-config` and `--ephemeral`.

## Use

1. Open your Git repository and stage the changes for one commit.
2. Click the sparkle in Source Control or run **Codex: Generate Commit Message**.
3. Review or edit the message, then commit using VS Code.

For multiple repositories, use the repository's button or select a repository when prompted. Existing messages require confirmation before replacement. Edits to the message or staged diff during generation are preserved and require generating again. Generation can be cancelled and times out after two minutes.

## Settings

- `codexCommit.executable`: optional absolute Codex executable path (machine setting).
- `codexCommit.model`: optional model; empty uses Codex's default model.
- `codexCommit.conventionalCommits`: use `feat:`, `fix:`, etc. (default true).
- `codexCommit.language`: message language (default English).
- `codexCommit.maxDiffChars`: compact diff budget (default 12,000 characters; range 1,000–50,000). Lower it to save more input tokens, with less detail available for the message.
- `codexCommit.reasoningEffort`: default `low` to reduce reasoning work. Choose `default` if your model does not support low effort.

## Keeping token usage low

The extension requests zero context lines from Git, removes redundant patch headers, and skips lockfile, source-map, and minified-file contents while keeping their file summaries. Other files share the detail budget so one large file does not consume it all. Trimmed sections are marked. The shorter prompt asks for a subject and at most two short body lines.

The default compact diff is capped at 12,000 characters. This is a character budget, not an exact token limit; Codex also adds its own instructions and may use reasoning tokens. Up to 20 generated messages are cached in memory: the same repository, full staged diff, and settings reuse the result without another Codex request until the extension reloads. Cached entries contain a hash and the message, not the diff.

## What gets sent and stored

The extension sends the compact staged diff to Codex's configured service using your existing Codex authentication. It runs Codex in a temporary directory with a read-only sandbox, without loading user configuration, and removes the temporary output afterward. Custom providers and MCP servers from your user config are therefore not loaded. There is no separate API key field or telemetry. Raw diffs above 2 MB are rejected before compaction. It never stages files or creates commits.

Trimming is not secret detection or redaction: staged credentials or private code can be included in the request. Review what you stage before generating a message.

The prompt tells Codex not to use tools, but this is an instruction, not an enforced tool restriction. A read-only sandbox restricts writes; it does not prevent all file reads. Running in a temporary directory reduces project context but does not isolate Codex from every readable file. Codex manages its own authentication, service-side data handling, and any CLI diagnostics; the extension's temporary-file cleanup does not control those.

## Develop and verify

No runtime npm dependencies or build step are required. You need Node.js to run the tests and Python 3 to use the packaging script. Open this folder in VS Code and press F5 to launch an Extension Development Host. Open a Git repository there, stage a change, and run the generator. Run `npm test` for process handling, cancellation, prompting, and real Git staged-diff checks. A signed-in generation request is needed to verify your account and model end to end.

Package with `python3 scripts/package.py`. This builds a dependency-free VSIX using the VS Code package manifest format.

References: [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode), [VS Code Source Control API](https://code.visualstudio.com/api/extension-guides/scm-provider).

## License

[MIT](LICENSE).

The extension icon adapts Phosphor Icons' [git-commit duotone icon](https://github.com/phosphor-icons/core/blob/main/assets/duotone/git-commit-duotone.svg), with green colors and a PNG export. Its upstream MIT notice is included in [images/LICENSE.phosphor](images/LICENSE.phosphor).
