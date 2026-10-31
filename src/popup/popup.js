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

function updateDraftDisplay({ titre, source_url }) {
  draftTitleEl.textContent = titre || '(aucun titre)';
  draftSourceEl.textContent = source_url || '';
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

async function init() {
  apiBaseUrlInput.value = await Storage.getApiBaseUrl();
  const { accessToken } = await Storage.getTokens();
  if (accessToken) {
    showDraftPanel();
  } else {
    showLoginPanel();
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
  } catch (error) {
    showLoginError(error.message || String(error));
  }
});

document.getElementById('action-logout').addEventListener('click', async () => {
  await Storage.clearTokens();
  showLoginPanel();
});

document.getElementById('action-new-draft').addEventListener('click', async () => {
  clearDraftError();
  try {
    const tab = await getActiveTab();
    const selectionText = await getSelectedText(tab.id);
    const draft = await Api.upsertDraft({ sourceUrl: tab.url, titre: selectionText || null });
    await Storage.setCurrentDraftId(draft.id);
    updateDraftDisplay(draft);
  } catch (error) {
    showDraftError(error.message || String(error));
  }
});

document.getElementById('action-copy-title').addEventListener('click', async () => {
  clearDraftError();
  try {
    const tab = await getActiveTab();
    const selectionText = await getSelectedText(tab.id);
    let draftId = await Storage.getCurrentDraftId();
    if (draftId === null) {
      const draft = await Api.upsertDraft({ sourceUrl: tab.url, titre: null });
      draftId = draft.id;
      await Storage.setCurrentDraftId(draftId);
    }
    const draft = await Api.patchDraftTitle(draftId, selectionText);
    updateDraftDisplay(draft);
  } catch (error) {
    showDraftError(error.message || String(error));
  }
});

document.getElementById('action-append-description').addEventListener('click', async () => {
  clearDraftError();
  try {
    const tab = await getActiveTab();
    const selectionText = await getSelectedText(tab.id);
    let draftId = await Storage.getCurrentDraftId();
    if (draftId === null) {
      const draft = await Api.upsertDraft({ sourceUrl: tab.url, titre: null });
      draftId = draft.id;
      await Storage.setCurrentDraftId(draftId);
    }
    const draft = await Api.appendDraftDescription(draftId, selectionText);
    updateDraftDisplay(draft);
  } catch (error) {
    showDraftError(error.message || String(error));
  }
});

document.getElementById('action-set-source').addEventListener('click', async () => {
  clearDraftError();
  try {
    const tab = await getActiveTab();
    let draftId = await Storage.getCurrentDraftId();
    if (draftId === null) {
      const draft = await Api.upsertDraft({ sourceUrl: tab.url, titre: null });
      draftId = draft.id;
      await Storage.setCurrentDraftId(draftId);
    }
    const draft = await Api.patchDraftSource(draftId, tab.url);
    updateDraftDisplay(draft);
  } catch (error) {
    showDraftError(error.message || String(error));
  }
});

init();
