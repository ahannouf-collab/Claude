import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs/promises';
import { downloadDocument } from './src/downloader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const TOKEN_TTL_MS = 10 * 60 * 1000;

// token -> { filePath, fileName }
const tokens = new Map();

function scheduleCleanup(token) {
  setTimeout(async () => {
    const entry = tokens.get(token);
    if (!entry) return;
    tokens.delete(token);
    try {
      await fs.unlink(entry.filePath);
    } catch {
      // déjà supprimé, rien à faire
    }
  }, TOKEN_TTL_MS);
}

app.post('/api/download', async (req, res) => {
  const { url, email, password } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL manquante.' });
  }

  let result;
  try {
    result = await downloadDocument(url, { email, password }, DOWNLOAD_DIR);
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: err.message || 'Échec du téléchargement.' });
  }

  if (!result.ok) {
    return res.status(422).json({ error: result.reason });
  }

  const token = crypto.randomBytes(16).toString('hex');
  tokens.set(token, { filePath: result.filePath, fileName: result.fileName });
  scheduleCleanup(token);

  res.json({ token, fileName: result.fileName });
});

app.get('/api/file/:token', (req, res) => {
  const entry = tokens.get(req.params.token);
  if (!entry) {
    return res.status(404).json({ error: 'Lien expiré ou invalide.' });
  }
  res.download(entry.filePath, entry.fileName);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));
