// Chrome (MV3 service worker) loads storage.js/api.js via importScripts here.
// Firefox (MV3 background event page, no importScripts) loads them instead
// via manifest.json's background.scripts array, before this file.
if (typeof importScripts === 'function') {
  importScripts('../vendor/browser-polyfill.js', 'storage.js', 'api.js', 'dateParser.js');
}

const MENU_CREATE_DRAFT = 'rcx-create-draft';
const MENU_COPY_AS_TITLE = 'rcx-copy-as-title';
const MENU_APPEND_DESCRIPTION = 'rcx-append-description';
const MENU_SET_SOURCE = 'rcx-set-source';
const MENU_SET_IMAGE = 'rcx-set-image';
const MENU_SET_DATE = 'rcx-set-date';
const MENU_SET_DATE_FIN = 'rcx-set-date-fin';

async function registerContextMenus() {
  // Service workers (Chrome) and event pages (Firefox) can both restart and
  // re-run this top-level registration; clear first so re-registering the
  // same ids doesn't log "duplicate id" errors.
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({
    id: MENU_CREATE_DRAFT,
    title: 'Ajouter cet événement',
    contexts: ['selection'],
  });
  browser.contextMenus.create({
    id: MENU_COPY_AS_TITLE,
    title: 'Copier comme titre',
    contexts: ['selection'],
  });
  browser.contextMenus.create({
    id: MENU_APPEND_DESCRIPTION,
    title: 'Append à la description',
    contexts: ['selection'],
  });
  browser.contextMenus.create({
    id: MENU_SET_SOURCE,
    title: 'Source : capturer cette page',
    contexts: ['page'],
  });
  browser.contextMenus.create({
    id: MENU_SET_IMAGE,
    title: 'Utiliser cette image',
    contexts: ['image'],
  });
  browser.contextMenus.create({
    id: MENU_SET_DATE,
    title: 'Utiliser la sélection comme date',
    contexts: ['selection'],
  });
  browser.contextMenus.create({
    id: MENU_SET_DATE_FIN,
    title: 'Utiliser la sélection comme date de fin',
    contexts: ['selection'],
  });
}

registerContextMenus();

function notify(title, message) {
  browser.notifications.create({
    type: 'basic',
    iconUrl: browser.runtime.getURL('icons/icon-48.png'),
    title,
    message,
  });
}

// A current-draft id that 404s (deleted) or 409s (published, no longer a
// draft) can never succeed again until the stale reference is cleared — the
// caller should create a fresh draft and retry once.
function isStaleDraftError(error) {
  return error instanceof ApiError && (error.status === 404 || error.status === 409);
}

async function ensureCurrentDraft(tab) {
  const existing = await Storage.getCurrentDraft();
  if (existing !== null) {
    return existing;
  }
  const draft = await Api.upsertDraft({ sourceUrl: tab.url, titre: null });
  await Storage.setCurrentDraft(draft);
  return draft;
}

async function withStaleDraftRecovery(tab, action) {
  const draft = await ensureCurrentDraft(tab);
  try {
    return await action(draft.id);
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

class ImageFetchError extends Error {}

async function applyDateToField(tab, field, isoDate) {
  const updated = await withStaleDraftRecovery(
    tab,
    (draftId) => (field === 'date' ? Api.patchDraftDate(draftId, isoDate) : Api.patchDraftDateFin(draftId, isoDate)),
  );
  await Storage.setCurrentDraft(updated);
  notify('Reco Croix-Rousse', field === 'date' ? 'Date mise à jour.' : 'Date de fin mise à jour.');
}

async function openDateConfirmWindow(field, selectionText) {
  const url = browser.runtime.getURL(
    `src/confirm-date/confirm-date.html?field=${encodeURIComponent(field)}&selectionText=${encodeURIComponent(selectionText || '')}`,
  );
  await browser.windows.create({ url, type: 'popup', width: 360, height: 260 });
}

async function handleDateSelection(tab, field, selectionText) {
  const isoDate = parseDateString(selectionText || '');
  if (isoDate !== null) {
    await applyDateToField(tab, field, isoDate);
    return;
  }
  // Parsing failed: remember which tab/draft this confirmation is for, then
  // let the user pick the date in a small popup window. The actual PATCH
  // happens in the 'rcx-date-confirmed' runtime.onMessage listener below,
  // once that window reports back what the user chose (or closes without
  // submitting, in which case nothing happens).
  pendingDateConfirmTab = tab;
  await openDateConfirmWindow(field, selectionText);
}

// Set right before opening the confirm-date popup window and read by the
// 'rcx-date-confirmed' message handler below. A single module-level slot is
// enough because only one confirm-date window can be meaningfully open at a
// time from the user's perspective (each context-menu click opens a new
// one), and MV3 background pages are event-driven / effectively
// single-flow between a menu click and the resulting message.
let pendingDateConfirmTab = null;

browser.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'rcx-date-confirmed') return;
  const tab = pendingDateConfirmTab;
  pendingDateConfirmTab = null;
  if (!tab) return;
  applyDateToField(tab, message.field, message.isoDate).catch((error) => {
    if (error instanceof ApiError && error.status === 401) {
      notify('Reco Croix-Rousse — session expirée', 'Reconnectez-vous via le popup de l\'extension.');
    } else {
      notify('Reco Croix-Rousse — erreur', error.message || String(error));
    }
  });
});

async function fetchImageBlob(srcUrl) {
  let response;
  try {
    response = await fetch(srcUrl);
  } catch (error) {
    throw new ImageFetchError(`Impossible de récupérer l'image : ${error.message || error}`);
  }
  if (!response.ok) {
    throw new ImageFetchError(`Impossible de récupérer l'image (statut ${response.status}).`);
  }
  return response.blob();
}

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === MENU_CREATE_DRAFT) {
      const draft = await Api.upsertDraft({ sourceUrl: tab.url, titre: info.selectionText });
      await Storage.setCurrentDraft(draft);
      if (draft.statut !== 'brouillon') {
        notify('Reco Croix-Rousse', 'Cette page est déjà associée à un événement publié — impossible de le modifier ici.');
      } else if (draft.titre !== info.selectionText) {
        notify('Reco Croix-Rousse', 'Un brouillon existait déjà pour cette page ; il est repris sans changer son titre.');
      } else {
        notify('Reco Croix-Rousse', 'Brouillon créé.');
      }
      return;
    }

    if (info.menuItemId === MENU_COPY_AS_TITLE) {
      const updated = await withStaleDraftRecovery(tab, (draftId) => Api.patchDraftTitle(draftId, info.selectionText));
      await Storage.setCurrentDraft(updated);
      notify('Reco Croix-Rousse', 'Titre mis à jour.');
    } else if (info.menuItemId === MENU_APPEND_DESCRIPTION) {
      const updated = await withStaleDraftRecovery(tab, (draftId) => Api.appendDraftDescription(draftId, info.selectionText));
      await Storage.setCurrentDraft(updated);
      notify('Reco Croix-Rousse', 'Description mise à jour.');
    } else if (info.menuItemId === MENU_SET_SOURCE) {
      const updated = await withStaleDraftRecovery(tab, (draftId) => Api.patchDraftSource(draftId, tab.url));
      await Storage.setCurrentDraft(updated);
      notify('Reco Croix-Rousse', 'Source mise à jour.');
    } else if (info.menuItemId === MENU_SET_IMAGE) {
      const blob = await fetchImageBlob(info.srcUrl);
      const { url } = await Api.uploadImage(blob);
      const updated = await withStaleDraftRecovery(tab, (draftId) => Api.patchDraftImage(draftId, url));
      await Storage.setCurrentDraft(updated);
      notify('Reco Croix-Rousse', 'Image mise à jour.');
    } else if (info.menuItemId === MENU_SET_DATE) {
      await handleDateSelection(tab, 'date', info.selectionText);
    } else if (info.menuItemId === MENU_SET_DATE_FIN) {
      await handleDateSelection(tab, 'date-fin', info.selectionText);
    }
  } catch (error) {
    if (error instanceof ImageFetchError) {
      notify('Reco Croix-Rousse — erreur', error.message);
    } else if (error instanceof ApiError && error.status === 401) {
      notify('Reco Croix-Rousse — session expirée', 'Reconnectez-vous via le popup de l\'extension.');
    } else {
      notify('Reco Croix-Rousse — erreur', error.message || String(error));
    }
  }
});
