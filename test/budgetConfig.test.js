// test/budgetConfig.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DEFAULT_BUDGETS, loadBudgetConfig, saveBudgetConfig } = require('../src/shared/budgetConfig');

test('DEFAULT_BUDGETS has all four periods', () => {
  assert.ok(DEFAULT_BUDGETS.session.tokens > 0);
  assert.ok(DEFAULT_BUDGETS.day.tokens > 0);
  assert.ok(DEFAULT_BUDGETS.week.tokens > 0);
  assert.ok(DEFAULT_BUDGETS.month.tokens > 0);
});

test('loadBudgetConfig creates the file with defaults if missing', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'budget-test-'));
  const configPath = path.join(tmpDir, 'budgets.json');

  const loaded = await loadBudgetConfig(configPath);
  assert.deepEqual(loaded, DEFAULT_BUDGETS);

  const fileContents = await fs.readFile(configPath, 'utf8');
  assert.deepEqual(JSON.parse(fileContents), DEFAULT_BUDGETS);
});

test('loadBudgetConfig returns the saved values on a second load', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'budget-test-'));
  const configPath = path.join(tmpDir, 'budgets.json');

  await saveBudgetConfig(configPath, { ...DEFAULT_BUDGETS, session: { tokens: 999 } });
  const loaded = await loadBudgetConfig(configPath);
  assert.equal(loaded.session.tokens, 999);
});

test('loadBudgetConfig returns an independent copy, not the shared DEFAULT_BUDGETS reference', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'budget-test-'));
  const configPath = path.join(tmpDir, 'budgets.json');

  const first = await loadBudgetConfig(configPath);
  assert.notEqual(first, DEFAULT_BUDGETS);
  first.session.tokens = 999999999;

  // A second load from a DIFFERENT missing-config path must still see the true defaults,
  // proving the first call's mutation didn't corrupt the shared DEFAULT_BUDGETS constant.
  const tmpDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'budget-test-'));
  const configPath2 = path.join(tmpDir2, 'budgets.json');
  const second = await loadBudgetConfig(configPath2);
  assert.equal(second.session.tokens, DEFAULT_BUDGETS.session.tokens);
});

test('loadBudgetConfig returns defaults and does not overwrite a malformed JSON file', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'budget-test-'));
  const configPath = path.join(tmpDir, 'budgets.json');
  const malformed = '{ this is not valid json ';
  await fs.writeFile(configPath, malformed, 'utf8');

  const loaded = await loadBudgetConfig(configPath);
  assert.deepEqual(loaded, DEFAULT_BUDGETS);

  const fileContents = await fs.readFile(configPath, 'utf8');
  assert.equal(fileContents, malformed);
});

test('loadBudgetConfig substitutes defaults for a missing or invalid period while preserving valid ones', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'budget-test-'));
  const configPath = path.join(tmpDir, 'budgets.json');
  await fs.writeFile(
    configPath,
    JSON.stringify({ session: { tokens: 12345 }, day: { tokens: -1 }, week: { tokens: 'a lot' } }),
    'utf8'
  );

  const loaded = await loadBudgetConfig(configPath);
  assert.equal(loaded.session.tokens, 12345);
  assert.equal(loaded.day.tokens, DEFAULT_BUDGETS.day.tokens);
  assert.equal(loaded.week.tokens, DEFAULT_BUDGETS.week.tokens);
  assert.equal(loaded.month.tokens, DEFAULT_BUDGETS.month.tokens);
});

test('saveBudgetConfig creates parent directories if they do not exist', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'budget-test-'));
  const configPath = path.join(tmpDir, 'nested', 'deeper', 'budgets.json');
  const testBudgets = { ...DEFAULT_BUDGETS, session: { tokens: 777 } };

  await saveBudgetConfig(configPath, testBudgets);

  const fileContents = await fs.readFile(configPath, 'utf8');
  assert.deepEqual(JSON.parse(fileContents), testBudgets);
});
