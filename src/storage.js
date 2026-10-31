const DEFAULT_API_BASE_URL = 'http://localhost:8000';

const KEYS = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  apiBaseUrl: 'apiBaseUrl',
  currentDraftId: 'currentDraftId',
};

async function getTokens() {
  const stored = await browser.storage.local.get([KEYS.accessToken, KEYS.refreshToken]);
  return {
    accessToken: stored[KEYS.accessToken] ?? null,
    refreshToken: stored[KEYS.refreshToken] ?? null,
  };
}

async function setTokens({ accessToken, refreshToken }) {
  await browser.storage.local.set({
    [KEYS.accessToken]: accessToken,
    [KEYS.refreshToken]: refreshToken,
  });
}

async function clearTokens() {
  await browser.storage.local.remove([KEYS.accessToken, KEYS.refreshToken]);
}

async function getApiBaseUrl() {
  const stored = await browser.storage.local.get(KEYS.apiBaseUrl);
  return stored[KEYS.apiBaseUrl] ?? DEFAULT_API_BASE_URL;
}

async function setApiBaseUrl(url) {
  await browser.storage.local.set({ [KEYS.apiBaseUrl]: url });
}

async function getCurrentDraftId() {
  const stored = await browser.storage.local.get(KEYS.currentDraftId);
  return stored[KEYS.currentDraftId] ?? null;
}

async function setCurrentDraftId(id) {
  await browser.storage.local.set({ [KEYS.currentDraftId]: id });
}

async function clearCurrentDraftId() {
  await browser.storage.local.remove(KEYS.currentDraftId);
}

const Storage = {
  getTokens,
  setTokens,
  clearTokens,
  getApiBaseUrl,
  setApiBaseUrl,
  getCurrentDraftId,
  setCurrentDraftId,
  clearCurrentDraftId,
};
