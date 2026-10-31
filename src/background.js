importScripts('../vendor/browser-polyfill.js', 'storage.js', 'api.js');

const MENU_CREATE_DRAFT = 'rcx-create-draft';
const MENU_COPY_AS_TITLE = 'rcx-copy-as-title';
const MENU_APPEND_DESCRIPTION = 'rcx-append-description';
const MENU_SET_SOURCE = 'rcx-set-source';

function registerContextMenus() {
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
}

browser.runtime.onInstalled.addListener(registerContextMenus);
registerContextMenus();

async function ensureCurrentDraftId(tab) {
  const existing = await Storage.getCurrentDraftId();
  if (existing !== null) {
    return existing;
  }
  const draft = await Api.upsertDraft({ sourceUrl: tab.url, titre: null });
  await Storage.setCurrentDraftId(draft.id);
  return draft.id;
}

function notify(title, message) {
  browser.notifications.create({
    type: 'basic',
    iconUrl: browser.runtime.getURL('icons/icon-48.png'),
    title,
    message,
  });
}

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === MENU_CREATE_DRAFT) {
      const draft = await Api.upsertDraft({ sourceUrl: tab.url, titre: info.selectionText });
      await Storage.setCurrentDraftId(draft.id);
      notify('Reco Croix-Rousse', 'Brouillon créé.');
      return;
    }

    const draftId = await ensureCurrentDraftId(tab);

    if (info.menuItemId === MENU_COPY_AS_TITLE) {
      await Api.patchDraftTitle(draftId, info.selectionText);
      notify('Reco Croix-Rousse', 'Titre mis à jour.');
    } else if (info.menuItemId === MENU_APPEND_DESCRIPTION) {
      await Api.appendDraftDescription(draftId, info.selectionText);
      notify('Reco Croix-Rousse', 'Description mise à jour.');
    } else if (info.menuItemId === MENU_SET_SOURCE) {
      await Api.patchDraftSource(draftId, tab.url);
      notify('Reco Croix-Rousse', 'Source mise à jour.');
    }
  } catch (error) {
    notify('Reco Croix-Rousse — erreur', error.message || String(error));
  }
});
