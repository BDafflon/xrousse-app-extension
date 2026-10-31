const loginPanel = document.getElementById('login-panel');
const draftPanel = document.getElementById('draft-panel');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const apiBaseUrlInput = document.getElementById('api-base-url');
const draftTitleEl = document.getElementById('draft-title');
const draftSourceEl = document.getElementById('draft-source');
const draftError = document.getElementById('draft-error');

function showLoginPanel() {
  loginPanel.hidden = false;
  draftPanel.hidden = true;
}

function showDraftPanel() {
  loginPanel.hidden = true;
  draftPanel.hidden = false;
}

function showLoginError(message) {
  loginError.textContent = message;
  loginError.hidden = false;
}

function showDraftError(message) {
  draftError.textContent = message;
  draftError.hidden = false;
}

function clearDraftError() {
  draftError.hidden = true;
}

function updateDraftDisplay(draft) {
  const label = draft.titre || '(aucun titre)';
  draftTitleEl.textContent = draft.id ? `#${draft.id} — ${label}` : label;
  draftSourceEl.textContent = draft.source_url || '';
}

async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getSelectedText(tabId) {
  const results = await browser.scripting.executeScript({
    target: { tabId },
    func: () => window.getSelection().toString(),
  });
  return results[0]?.result ?? '';
}

function isStaleDraftError(error) {
  return error instanceof ApiError && (error.status === 404 || error.status === 409);
}

async function ensureDraftId(tab) {
  const existing = await Storage.getCurrentDraft();
  if (existing !== null) {
    return existing.id;
  }
  const draft = await Api.upsertDraft({ sourceUrl: tab.url, titre: null });
  await Storage.setCurrentDraft(draft);
  updateDraftDisplay(draft);
  return draft.id;
}

async function withStaleDraftRecovery(tab, action) {
  const draftId = await ensureDraftId(tab);
  try {
    return await action(draftId);
  } catch (error) {
    if (!isStaleDraftError(error)) {
      throw error;
    }
    await Storage.clearCurrentDraft();
    const freshDraft = await Api.upsertDraft({ sourceUrl: tab.url, titre: null });
    await Storage.setCurrentDraft(freshDraft);
    return action(freshDraft.id);
  }
}

async function runDraftAction(action) {
  clearDraftError();
  try {
    const tab = await getActiveTab();
    await action(tab);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      showLoginPanel();
      return;
    }
    showDraftError(error.message || String(error));
  }
}

async function init() {
  apiBaseUrlInput.value = await Storage.getApiBaseUrl();
  const { accessToken } = await Storage.getTokens();
  if (!accessToken) {
    showLoginPanel();
    return;
  }
  showDraftPanel();
  const current = await Storage.getCurrentDraft();
  if (current) {
    updateDraftDisplay(current);
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  const apiBaseUrl = apiBaseUrlInput.value.trim();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    await Storage.setApiBaseUrl(apiBaseUrl || 'http://localhost:8000');
    const tokens = await Api.login(email, password);
    await Storage.setTokens(tokens);
    showDraftPanel();
    const current = await Storage.getCurrentDraft();
    if (current) {
      updateDraftDisplay(current);
    }
  } catch (error) {
    showLoginError(error.message || String(error));
  }
});

document.getElementById('action-logout').addEventListener('click', async () => {
  await Storage.clearTokens();
  showLoginPanel();
});

document.getElementById('action-new-draft').addEventListener('click', () => runDraftAction(async (tab) => {
  const selectionText = await getSelectedText(tab.id);
  const draft = await Api.upsertDraft({ sourceUrl: tab.url, titre: selectionText || null });
  await Storage.setCurrentDraft(draft);
  updateDraftDisplay(draft);
}));

document.getElementById('action-copy-title').addEventListener('click', () => runDraftAction(async (tab) => {
  const selectionText = await getSelectedText(tab.id);
  if (!selectionText) {
    showDraftError('Aucune sélection sur la page.');
    return;
  }
  const draft = await withStaleDraftRecovery(tab, (draftId) => Api.patchDraftTitle(draftId, selectionText));
  await Storage.setCurrentDraft(draft);
  updateDraftDisplay(draft);
}));

document.getElementById('action-append-description').addEventListener('click', () => runDraftAction(async (tab) => {
  const selectionText = await getSelectedText(tab.id);
  if (!selectionText) {
    showDraftError('Aucune sélection sur la page.');
    return;
  }
  const draft = await withStaleDraftRecovery(tab, (draftId) => Api.appendDraftDescription(draftId, selectionText));
  await Storage.setCurrentDraft(draft);
  updateDraftDisplay(draft);
}));

document.getElementById('action-set-source').addEventListener('click', () => runDraftAction(async (tab) => {
  const draft = await withStaleDraftRecovery(tab, (draftId) => Api.patchDraftSource(draftId, tab.url));
  await Storage.setCurrentDraft(draft);
  updateDraftDisplay(draft);
}));

init();
