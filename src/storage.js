const DEFAULT_API_BASE_URL = 'http://localhost:8000';

const KEYS = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  apiBaseUrl: 'apiBaseUrl',
  currentDraft: 'currentDraft',
};

async function getTokens() {
  const stored = await browser.storage.local.get([KEYS.accessToken, KEYS.refreshToken]);
  return {
    accessToken: stored[KEYS.accessToken] ?? null,
    refreshToken: stored[KEYS.refreshToken] ?? null,
  };
}

async function setTokens({ access_token, refresh_token }) {
  await browser.storage.local.set({
    [KEYS.accessToken]: access_token,
    [KEYS.refreshToken]: refresh_token,
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

async function getCurrentDraft() {
  const stored = await browser.storage.local.get(KEYS.currentDraft);
  return stored[KEYS.currentDraft] ?? null;
}

async function setCurrentDraft({ id, titre, source_url, statut }) {
  await browser.storage.local.set({ [KEYS.currentDraft]: { id, titre, source_url, statut } });
}

async function clearCurrentDraft() {
  await browser.storage.local.remove(KEYS.currentDraft);
}

const Storage = {
  getTokens,
  setTokens,
  clearTokens,
  getApiBaseUrl,
  setApiBaseUrl,
  getCurrentDraft,
  setCurrentDraft,
  clearCurrentDraft,
};
