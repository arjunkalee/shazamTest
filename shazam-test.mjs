// shazam-test.mjs
// Node 18+ required (built-in fetch/FormData/Blob/crypto)
// Run example:
// RAPIDAPI_KEY=YOUR_RAPID_KEY \
// SPOTIFY_CLIENT_ID=YOUR_CLIENT_ID \
// SPOTIFY_CLIENT_SECRET=YOUR_SECRET \
// SPOTIFY_REDIRECT_URI=http://localhost:3001/spotify/callback \
// node shazam-test.mjs

import express from "express";
import multer from "multer";
import session from "express-session";
import crypto from "crypto";

const RAPIDAPI_KEY_FALLBACK = "afbad03ef5msh0cbf5447fa19661p1fb2ffjsn226d2ca11fb1";

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || RAPIDAPI_KEY_FALLBACK;
if (!RAPIDAPI_KEY) {
  console.warn("\n[WARN] No RAPIDAPI_KEY set. Set env var RAPIDAPI_KEY or paste into RAPIDAPI_KEY_FALLBACK.\n");
}

const API_HOST = "shazam-song-recognition-api.p.rapidapi.com";
const app = express();
const upload = multer(); // in-memory
const PORT = process.env.PORT || 3001;

// ---------- Spotify config ----------
const SPOTIFY_CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";
const SPOTIFY_REDIRECT_URI  = process.env.SPOTIFY_REDIRECT_URI || ""; // e.g. http://localhost:3001/spotify/callback
const SPOTIFY_SCOPES = [
  "playlist-modify-public",
  "playlist-modify-private",
  "ugc-image-upload"
].join(" ");

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REDIRECT_URI) {
  console.warn("[WARN] Spotify env vars missing. Export-to-Spotify will 401 until configured.");
}

// ---------- Middleware ----------
app.use(express.json());
app.use(session({
  secret: crypto.randomBytes(32).toString("hex"),
  resave: false,
  saveUninitialized: true,
  cookie: { sameSite: "lax" }
}));

// --- Minimal web page with mic recording (unchanged UI except export flow) ---
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Shazam Test - Music Recognition</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;color:#333}
  .container{max-width:800px;margin:0 auto;padding:20px}
  header{text-align:center;margin-bottom:40px;color:#fff}
  header h1{font-size:3rem;margin-bottom:10px;text-shadow:2px 2px 4px rgba(0,0,0,.3)}
  header p{font-size:1.2rem;opacity:.9}
  main{background:#fff;border-radius:20px;padding:30px;box-shadow:0 20px 40px rgba(0,0,0,.1)}
  .control-panel{display:flex;gap:20px;justify-content:center;margin-bottom:30px}
  .btn{display:flex;align-items:center;gap:10px;padding:15px 30px;border:none;border-radius:50px;font-size:1.1rem;font-weight:600;cursor:pointer;transition:all .3s ease;min-width:180px;justify-content:center}
  .btn:disabled{opacity:.5;cursor:not-allowed}
  .btn-primary{background:linear-gradient(45deg,#ff6b6b,#ee5a24);color:#fff}
  .btn-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 20px rgba(255,107,107,.3)}
  .status-panel{text-align:center;margin-bottom:30px}
  .status{font-size:1.2rem;font-weight:600;margin-bottom:15px;padding:10px 20px;background:#f8f9fa;border-radius:25px;display:inline-block}
  .status.listening{background:linear-gradient(45deg,#00b894,#00a085);color:#fff;animation:pulse 2s infinite}
  .status.processing{background:linear-gradient(45deg,#fdcb6e,#e17055);color:#fff}
  .status.error{background:linear-gradient(45deg,#e74c3c,#c0392b);color:#fff}
  @keyframes pulse{0%{transform:scale(1)}50%{transform:scale(1.05)}100%{transform:scale(1)}}
  .playlist-section{margin-bottom:30px}
  .playlist-section h2{margin-bottom:20px;color:#2d3436;font-size:1.5rem}
  .playlist{min-height:200px;border:2px dashed #ddd;border-radius:10px;padding:20px;max-height:400px;overflow-y:auto}
  .empty-state{text-align:center;color:#636e72;font-style:italic;padding:40px 20px}
  .song-item{display:flex;align-items:center;padding:15px;background:#f8f9fa;border-radius:10px;margin-bottom:10px;transition:all .3s ease}
  .song-item img{flex-shrink:0;width:50px;height:50px;border-radius:8px;margin-right:15px}
  .song-item:hover{background:#e9ecef;transform:translateX(5px)}
  .song-info{flex:1}
  .song-title{font-weight:600;color:#2d3436;margin-bottom:5px}
  .song-artist{color:#636e72;font-size:.9rem}
  .song-links{margin-top:8px}
  .song-links a{color:#74b9ff;text-decoration:none;margin-right:10px}
  .song-links a:hover{text-decoration:underline}
  .playlist-item{display:flex;align-items:center;padding:12px;background:#f8f9fa;border-radius:8px;margin-bottom:8px;transition:all .3s ease;border-left:4px solid #74b9ff}
  .playlist-item:hover{background:#e9ecef;transform:translateX(3px)}
  .playlist-item img{flex-shrink:0;width:40px;height:40px;border-radius:6px;margin-right:12px}
  .playlist-item-info{flex:1}
  .playlist-item-title{font-weight:600;color:#2d3436;margin-bottom:3px;font-size:.95rem}
  .playlist-item-artist{color:#636e72;font-size:.85rem}
  .playlist-item-time{color:#74b9ff;font-size:.8rem;margin-top:3px}
  .debug-panel{background:#f8f9fa;border-radius:10px;padding:20px;margin-top:20px}
  .debug-panel h3{margin-bottom:15px;color:#2d3436;font-size:1.2rem}
  .debug-info p{margin-bottom:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9rem}
  pre{margin-top:12px;white-space:pre-wrap;background:#fafafa;padding:10px;border-radius:8px;max-height:240px;overflow:auto}
  @media (max-width:600px){.container{padding:10px}header h1{font-size:2rem}.control-panel{flex-direction:column;align-items:center}.btn{width:100%;max-width:300px}}
</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🎵 Shazam Test</h1>
      <p>Click "Start" to begin continuous listening. It will check every 5 seconds for different songs.</p>
    </header>
    <main>
      <div class="control-panel">
        <button id="btn" class="btn btn-primary"><span class="btn-icon">🎧</span><span class="btn-text">Start</span></button>
      </div>
      <div class="status-panel">
        <div id="status" class="status">Ready to listen</div>
      </div>
      <div class="result-section">
        <h2>Current Song</h2>
        <div id="result" class="result">
          <div class="empty-state"><p>No song detected yet. Start listening to see results.</p></div>
        </div>
      </div>
      <div class="playlist-section">
        <h2>Playlist (<span id="playlistCount">0</span> songs)</h2>
        <div style="text-align:center;margin-bottom:20px;">
          <button id="exportBtn" class="btn btn-primary" style="background:linear-gradient(45deg,#1db954,#1ed760);" disabled>
            <span class="btn-icon">🎵</span><span class="btn-text">Export to Spotify</span>
          </button>
        </div>
        <div id="playlist" class="playlist">
          <div class="empty-state"><p>No songs in playlist yet. Start listening to build your playlist.</p></div>
        </div>
      </div>
      <div class="debug-panel">
        <h3>Debug Info</h3>
        <div id="debugInfo" class="debug-info">
          <p>Status: <span id="debugStatus">Ready</span></p>
          <p>Last Activity: <span id="lastActivity">None</span></p>
        </div>
      </div>
    </main>
  </div>

<script>
const btn = document.getElementById('btn');
const exportBtn = document.getElementById('exportBtn');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const playlistEl = document.getElementById('playlist');
const playlistCountEl = document.getElementById('playlistCount');
const debugStatusEl = document.getElementById('debugStatus');
const lastActivityEl = document.getElementById('lastActivity');

let isListening = false;
let currentSong = null;
let recognitionInterval = null;
let playlist = [];

async function record(ms = 8000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';
  const rec = new MediaRecorder(stream, { mimeType: mime });
  const chunks = [];
  rec.ondataavailable = e => chunks.push(e.data);
  rec.start();
  await new Promise(r => setTimeout(r, ms));
  rec.stop();
  await new Promise(r => (rec.onstop = r));
  stream.getTracks().forEach(t => t.stop());
  return new Blob(chunks, { type: mime });
}

function renderResult(data) {
  if (!data || (!data.track && !data.matches)) {
    resultEl.innerHTML = '<div class="empty-state"><p>No match detected. Keep listening...</p></div>';
    return;
  }
  const t = (data && data.track) || {};
  const title = t.title || 'Unknown';
  const artist = t.subtitle || '';
  const art = t?.images?.coverart || '';
  const apple = t?.hub?.actions?.find(a => a.type === 'applemusicplay')?.uri;
  const sp = t?.hub?.providers?.find(p => p.type === 'SPOTIFY')?.actions?.[0]?.uri;

  resultEl.innerHTML = \`
    <div class="song-item">
      \${art ? '<img src="\'+art+\'" alt="Cover Art">' : ''}
      <div class="song-info">
        <div class="song-title">\${title}</div>
        <div class="song-artist">\${artist}</div>
        <div class="song-links">
          \${apple ? '<a target="_blank" href="'+apple+'">Play on Apple Music</a>' : ''}
          \${sp ? '<a target="_blank" href="'+sp+'">Open on Spotify</a>' : ''}
        </div>
      </div>
    </div>\`;
}

function isDifferentSong(newData) {
  if (!newData || !newData.track) return false;
  if (!currentSong) return true;
  const newTitle = newData.track.title || '';
  const newArtist = newData.track.subtitle || '';
  const currentTitle = currentSong.track?.title || '';
  const currentArtist = currentSong.track?.subtitle || '';
  return newTitle !== currentTitle || newArtist !== currentArtist;
}

function addToPlaylist(songData) {
  if (!songData || !songData.track) return;
  const song = {
    title: songData.track.title || 'Unknown',
    artist: songData.track.subtitle || 'Unknown Artist',
    coverArt: songData.track.images?.coverart || null,
    timestamp: new Date().toLocaleTimeString()
  };
  const exists = playlist.some(item => item.title === song.title && item.artist === song.artist);
  if (!exists) {
    playlist.unshift(song);
    updatePlaylistDisplay();
  }
}

function updatePlaylistDisplay() {
  playlistCountEl.textContent = playlist.length;
  exportBtn.disabled = playlist.length === 0;
  if (playlist.length === 0) {
    playlistEl.innerHTML = '<div class="empty-state"><p>No songs in playlist yet. Start listening to build your playlist.</p></div>';
    return;
  }
  playlistEl.innerHTML = playlist.map(song => \`
    <div class="playlist-item">
      \${song.coverArt ? \`<img src="\${song.coverArt}" alt="Cover Art">\` : '<div style="width:40px;height:40px;background:#ddd;border-radius:6px;margin-right:12px;"></div>'}
      <div class="playlist-item-info">
        <div class="playlist-item-title">\${song.title}</div>
        <div class="playlist-item-artist">\${song.artist}</div>
        <div class="playlist-item-time">Added at \${song.timestamp}</div>
      </div>
    </div>\`).join('');
}

async function recognizeSong() {
  try {
    statusEl.textContent = 'Listening for ~8 seconds…';
    statusEl.className = 'status listening';
    debugStatusEl.textContent = 'Recording';
    const blob = await record(8000);
    statusEl.textContent = 'Uploading & recognizing…';
    statusEl.className = 'status processing';
    debugStatusEl.textContent = 'Processing';
    const form = new FormData();
    form.append('file', blob, 'clip.webm');
    const res = await fetch('/api/recognize', { method: 'POST', body: form });
    const data = await res.json();
    if (isDifferentSong(data)) {
      currentSong = data;
      renderResult(data);
      addToPlaylist(data);
      statusEl.textContent = \`🎵 New Song: \${data.track?.title || 'Unknown'} by \${data.track?.subtitle || 'Unknown'}\`;
      statusEl.className = 'status listening';
      lastActivityEl.textContent = new Date().toLocaleTimeString();
    } else {
      statusEl.textContent = 'Same song playing, continuing to listen...';
      statusEl.className = 'status';
    }
    debugStatusEl.textContent = 'Complete';
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'Error: ' + (e?.message || e);
    statusEl.className = 'status error';
    debugStatusEl.textContent = 'Error';
  }
}

function startContinuousListening() {
  if (isListening) return;
  isListening = true;
  btn.textContent = 'Stop';
  btn.className = 'btn btn-primary';
  playlist = [];
  updatePlaylistDisplay();
  statusEl.textContent = 'Starting continuous listening...';
  statusEl.className = 'status listening';
  recognizeSong();
  recognitionInterval = setInterval(recognizeSong, 5000);
}

function stopContinuousListening() {
  if (!isListening) return;
  isListening = false;
  btn.textContent = 'Start';
  btn.className = 'btn btn-primary';
  if (recognitionInterval) {
    clearInterval(recognitionInterval);
    recognitionInterval = null;
  }
  statusEl.textContent = \`Stopped listening. Found \${playlist.length} songs in playlist.\`;
  statusEl.className = 'status';
  debugStatusEl.textContent = 'Stopped';
}

// NEW: Export playlist using backend Spotify integration
async function exportToSpotify() {
  if (playlist.length === 0) return;
  try {
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';
    statusEl.textContent = 'Exporting playlist to Spotify...';
    statusEl.className = 'status processing';

    const response = await fetch('/api/spotify/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playlistName: \`Shazam Playlist - \${new Date().toLocaleDateString()}\`,
        songs: playlist.map(s => ({ title: s.title, artist: s.artist }))
      })
    });

    if (response.status === 401) {
      const { loginUrl, message } = await response.json();
      statusEl.textContent = message || 'Spotify login required…';
      // Go authenticate, then user can click Export again
      window.location.href = loginUrl;
      return;
    }

    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Export failed');

    statusEl.textContent = \`✅ Exported \${result.added} songs to: \${result.playlistName}\`;
    statusEl.className = 'status';
    // Try to open playlist in app, then fallback to web
    setTimeout(() => {
      window.open(result.openUri, '_self');
      setTimeout(() => window.open(result.webUrl, '_blank'), 400);
    }, 250);
  } catch (error) {
    console.error('Export error:', error);
    statusEl.textContent = \`Export failed: \${error.message}\`;
    statusEl.className = 'status error';
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = 'Export to Spotify';
  }
}

btn.onclick = () => isListening ? stopContinuousListening() : startContinuousListening();
exportBtn.onclick = exportToSpotify;
btn.textContent = 'Start';
</script>
</body>
</html>`;

// --- Routes ---
app.get("/", (req, res) => res.type("html").send(INDEX_HTML));

// ---------- Shazam recognize (unchanged) ----------
app.post("/api/recognize", upload.single("file"), async (req, res) => {
  try {
    if (!RAPIDAPI_KEY) return res.status(500).json({ error: "Missing RAPIDAPI_KEY" });
    if (!req.file?.buffer) return res.status(400).json({ error: "No audio file received" });

    const form = new FormData();
    form.append("file", new Blob([req.file.buffer]), req.file.originalname || "clip.webm");

    const apiRes = await fetch(`https://${API_HOST}/recognize/file`, {
      method: "POST",
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": API_HOST
      },
      body: form
    });

    const json = await apiRes.json();
    res.status(apiRes.ok ? 200 : apiRes.status).json(json);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Recognition failed" });
  }
});

//
