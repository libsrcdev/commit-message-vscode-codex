const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const realFs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const core = require('../core');

async function scenario({ edit = false, changeDiff = false, empty = false, repeat = false } = {}) {
  let command, calls = 0, generations = 0;
  const errors = [];
  const repository = { rootUri: { fsPath: '/repo', toString: () => 'file:///repo' }, inputBox: { value: '' } };
  const settings = { get(key) { return { language: 'English', conventionalCommits: true, executable: '/fake/codex', model: '' }[key]; } };
  const vscode = {
    workspace: { isTrusted: true, getConfiguration: () => settings },
    extensions: { getExtension: () => ({ activate: async () => ({ getAPI: () => ({ git: { path: 'git' }, repositories: [repository] }) }) }) },
    ProgressLocation: { Notification: 15 },
    window: {
      showWarningMessage: async () => 'Replace',
      showErrorMessage: message => errors.push(message),
      withProgress: (_options, fn) => fn({}, { isCancellationRequested: false })
    },
    commands: { registerCommand: (_id, fn) => { command = fn; return { dispose() {} }; } }
  };
  const mockedCore = { ...core, run: async (exe, args, options) => {
    if (exe === 'git') {
      calls++;
      return empty ? '' : changeDiff && calls > 1 ? 'changed diff' : 'original diff';
    }
    assert.equal(options.cwd.startsWith(os.tmpdir()), true);
    assert.ok(args.includes('read-only'));
    assert.ok(args.includes('--ignore-user-config'));
    assert.ok(args.includes('model_reasoning_effort="low"'));
    generations++;
    assert.match(options.input, /original diff/);
    await realFs.writeFile(args[args.indexOf('--output-last-message') + 1], 'feat: add login');
    if (edit) repository.inputBox.value = 'my manual edit';
    return '';
  } };
  const sandbox = { module: { exports: {} }, require: name => name === 'vscode' ? vscode : name === './core' ? mockedCore : require(name) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../extension.js'), 'utf8'), sandbox);
  sandbox.module.exports.activate({ subscriptions: [] });
  await command();
  if (repeat) await command();
  return { repository, errors, generations };
}

test('VS Code command fills the commit input after successful generation', async () => {
  const { repository, errors } = await scenario();
  assert.equal(repository.inputBox.value, 'feat: add login');
  assert.deepEqual(errors, []);
});

test('repeated generation with unchanged staged changes uses no additional Codex call', async () => {
  const result = await scenario({ repeat: true });
  assert.equal(result.generations, 1);
  assert.equal(result.repository.inputBox.value, 'feat: add login');
  assert.deepEqual(result.errors, []);
});

test('VS Code command preserves edits and refuses stale or empty staged diffs', async () => {
  const edited = await scenario({ edit: true });
  assert.equal(edited.repository.inputBox.value, 'my manual edit');
  assert.match(edited.errors[0], /edits were preserved/);
  const changed = await scenario({ changeDiff: true });
  assert.equal(changed.repository.inputBox.value, '');
  assert.match(changed.errors[0], /Staged changes changed/);
  const empty = await scenario({ empty: true });
  assert.match(empty.errors[0], /No staged changes/);
});
