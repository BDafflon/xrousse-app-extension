const params = new URLSearchParams(window.location.search);
const selectionText = params.get('selectionText') || '';
const field = params.get('field'); // 'date' or 'date-fin'

document.getElementById('selection-text').textContent = selectionText;

document.getElementById('action-cancel').addEventListener('click', () => {
  window.close();
});

document.getElementById('confirm-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = document.getElementById('date-input').value; // "YYYY-MM-DDTHH:MM"
  if (!value) return;
  browser.runtime.sendMessage({
    type: 'rcx-date-confirmed',
    field,
    isoDate: `${value}:00`,
  });
  window.close();
});
