const form = document.getElementById('download-form');
const submitBtn = document.getElementById('submit-btn');
const statusEl = document.getElementById('status');

function setStatus(kind, html) {
  statusEl.hidden = false;
  statusEl.className = `status ${kind}`;
  statusEl.innerHTML = html;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const url = document.getElementById('url').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  submitBtn.disabled = true;
  setStatus('loading', 'Recherche du bouton de téléchargement…');

  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, email: email || undefined, password: password || undefined }),
    });

    const data = await res.json();

    if (!res.ok) {
      setStatus('error', data.error || 'Une erreur est survenue.');
      return;
    }

    setStatus(
      'success',
      `PDF prêt : <a href="/api/file/${data.token}" download>${escapeHtml(data.fileName)}</a>`
    );
  } catch (err) {
    setStatus('error', "Impossible de contacter le serveur.");
  } finally {
    submitBtn.disabled = false;
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
