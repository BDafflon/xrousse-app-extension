class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.message = message;
  }
}

async function parseErrorMessage(response) {
  try {
    const data = await response.json();
    if (data?.detail) {
      return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
    }
  } catch {
    // response body wasn't JSON; fall back to the generic message below.
  }
  return `Request failed with status ${response.status}`;
}

async function postJson(path, body) {
  const baseUrl = await Storage.getApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response));
  }
  return response.json();
}

async function login(email, password) {
  return postJson('/auth/login', { email, password });
}

async function refresh(refreshToken) {
  return postJson('/auth/refresh', { refresh_token: refreshToken });
}

async function buildRequest(path, options, accessToken) {
  const baseUrl = await Storage.getApiBaseUrl();
  const headers = new Headers(options.headers || {});
  // FormData bodies (image upload) must NOT get a Content-Type here: fetch
  // needs to set its own multipart/form-data value with the boundary.
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

async function authedFetch(path, options = {}) {
  const { accessToken, refreshToken } = await Storage.getTokens();
  const response = await buildRequest(path, options, accessToken);

  if (response.status !== 401) {
    return response;
  }

  if (!refreshToken) {
    await Storage.clearTokens();
    return response;
  }

  try {
    const newTokens = await refresh(refreshToken);
    await Storage.setTokens(newTokens);
    return buildRequest(path, options, newTokens.access_token);
  } catch (error) {
    // Only an explicit rejection from the refresh endpoint itself (an
    // invalid/expired refresh token) means the session is actually over.
    // A network error (fetch throwing a bare TypeError, e.g. the backend is
    // briefly unreachable) is transient and must not log the user out.
    if (error instanceof ApiError) {
      await Storage.clearTokens();
    }
    return response;
  }
}

async function authedJson(path, options = {}) {
  const response = await authedFetch(path, options);
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response));
  }
  return response.json();
}

async function upsertDraft({ sourceUrl, titre, descriptionAppend }) {
  return authedJson('/drafts/upsert', {
    method: 'POST',
    body: JSON.stringify({
      source_url: sourceUrl,
      titre: titre ?? null,
      description_append: descriptionAppend ?? null,
    }),
  });
}

async function patchDraftTitle(draftId, titre) {
  return authedJson(`/drafts/${draftId}/title`, {
    method: 'PATCH',
    body: JSON.stringify({ titre }),
  });
}

async function appendDraftDescription(draftId, text) {
  return authedJson(`/drafts/${draftId}/append-description`, {
    method: 'PATCH',
    body: JSON.stringify({ text }),
  });
}

async function patchDraftSource(draftId, sourceUrl) {
  return authedJson(`/drafts/${draftId}/source`, {
    method: 'PATCH',
    body: JSON.stringify({ source_url: sourceUrl }),
  });
}

async function patchDraftImage(draftId, imageUrl) {
  return authedJson(`/drafts/${draftId}/image`, {
    method: 'PATCH',
    body: JSON.stringify({ image_url: imageUrl }),
  });
}

async function uploadImage(blob) {
  const formData = new FormData();
  formData.append('file', blob);
  const response = await authedFetch('/backoffice/uploads', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response));
  }
  return response.json();
}

const Api = {
  login,
  authedFetch,
  upsertDraft,
  patchDraftTitle,
  appendDraftDescription,
  patchDraftSource,
  patchDraftImage,
  uploadImage,
};
