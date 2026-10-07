const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { run, prompt, cleanMessage } = require('./core');
const busy = new Set();
const cache = new Map();

async function executable(settings) {
  const configured = settings.get('executable');
  if (configured) return configured;
  const openai = vscode.extensions.getExtension('openai.chatgpt');
  if (openai) {
    const bin = path.join(openai.extensionPath, 'bin');
    const platform = { darwin: 'macos', win32: 'windows', linux: 'linux' }[process.platform];
    const arch = { arm64: 'aarch64', x64: 'x86_64' }[process.arch];
    const candidate = path.join(bin, `${platform}-${arch}`, process.platform === 'win32' ? 'codex.exe' : 'codex');
    try { await fs.access(candidate); return candidate; } catch {}
  }
  return 'codex';
}

async function generate(sourceControl) {
  if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace before generating messages.');
  const gitExtension = vscode.extensions.getExtension('vscode.git');
  const git = (await gitExtension.activate()).getAPI(1);
  const repositories = git.repositories;
  if (!repositories.length) throw new Error('Open a folder containing a Git repository.');
  let repository = repositories.find(repo => sourceControl?.rootUri?.toString() === repo.rootUri.toString());
  if (!repository && repositories.length === 1) repository = repositories[0];
  if (!repository) {
    const choice = await vscode.window.showQuickPick(repositories.map(repo => ({ label: path.basename(repo.rootUri.fsPath), description: repo.rootUri.fsPath, repo })), { placeHolder: 'Choose the repository for this commit' });
    if (!choice) return;
    repository = choice.repo;
  }
  const root = repository.rootUri.fsPath;
  if (busy.has(root)) return;
  busy.add(root);
  let temp;
  try {
    const initial = repository.inputBox.value;
    if (initial.trim()) {
      const replace = await vscode.window.showWarningMessage('Replace the existing commit message?', 'Replace');
      if (replace !== 'Replace') return;
    }
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Codex: generating commit message', cancellable: true }, async (_progress, token) => {
      const gitPath = git.git.path;
      const diffArgs = ['diff', '--cached', '--no-ext-diff', '--no-textconv', '--no-color', '--unified=0', '--'];
      const diff = await run(gitPath, diffArgs, { cwd: root, token });
      if (!diff.trim()) throw new Error('No staged changes. Stage the files you want to commit first.');
      const settings = vscode.workspace.getConfiguration('codexCommit', repository.rootUri);
      const cli = await executable(settings);
      const input = prompt(diff, { language: settings.get('language'), conventionalCommits: settings.get('conventionalCommits'), maxDiffChars: settings.get('maxDiffChars') });
      const effort = settings.get('reasoningEffort') || 'low';
      const key = createHash('sha256').update(JSON.stringify([root, diff, input, cli, settings.get('model'), effort])).digest('hex');
      let message = cache.get(key);
      if (!message) {
        temp = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-commit-'));
        const output = path.join(temp, 'message.txt');
        const args = ['--ask-for-approval', 'never', 'exec', '--ignore-user-config', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '--color', 'never', '--output-last-message', output];
        if (effort !== 'default') args.push('-c', `model_reasoning_effort="${effort}"`);
        if (settings.get('model')) args.push('--model', settings.get('model'));
        args.push('-');
        await run(cli, args, { cwd: temp, token, input });
        if (token.isCancellationRequested) return;
        message = cleanMessage(await fs.readFile(output, 'utf8'));
        if (cache.size >= 20) cache.delete(cache.keys().next().value);
        cache.set(key, message);
      }
      if (token.isCancellationRequested) return;
      const currentDiff = await run(gitPath, diffArgs, { cwd: root, token });
      if (currentDiff !== diff) throw new Error('Staged changes changed during generation. Generate the message again.');
      if (repository.inputBox.value !== initial) throw new Error('The commit message changed during generation. Your edits were preserved; generate again when ready.');
      repository.inputBox.value = message;
    });
  } finally {
    busy.delete(root);
    if (temp) await fs.rm(temp, { recursive: true, force: true });
  }
}

function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('codexCommit.generate', async sourceControl => {
    try { await generate(sourceControl); }
    catch (error) { vscode.window.showErrorMessage(`Codex Commit Message: ${error.message}`); }
  }));
}
module.exports = { activate };
