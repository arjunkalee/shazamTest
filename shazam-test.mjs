// shazam-test.mjs
// Node 18+
// Env:
// RAPIDAPI_KEY=... SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... SPOTIFY_REDIRECT_URI=http://localhost:3001/spotify/callback
// node shazam-test.mjs

import express from "express";
import multer from "multer";

const RAPIDAPI_KEY_FALLBACK = "afbad03ef5msh0cbf5447fa19661p1fb2ffjsn226d2ca11fb1";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || RAPIDAPI_KEY_FALLBACK;
const API_HOST = "shazam-song-recognition-api.p.rapidapi.com";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || "http://localhost:3001/spotify/callback";

const TARGET_USER_ID = "forzadaboss2004";

const app = express();
const upload = multer();
const PORT = process.env.PORT || 3001;

app.use(express.json());

const INDEX_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Listify - Music Recognition</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,Segoe UI,-apple-system,BlinkMacSystemFont,sans-serif;background:#1a1a2e;min-height:100vh;color:#f5f5f5}
.container{max-width:800px;margin:0 auto;padding:20px 20px 0 20px}header{text-align:center;margin-bottom:40px;color:#fff}
header h1{font-size:3rem;margin-bottom:10px}
main{background:rgba(26,26,46,.92);border-radius:24px 24px 0 0;padding:40px;box-shadow:0 25px 50px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.1);min-height:calc(100vh - 160px);display:flex;flex-direction:column}
.main-button{width:200px;height:200px;border-radius:50%;border:none;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;margin:20px auto;font-size:5rem}
.status{display:inline-block;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);margin:10px 0}
.song-item{display:flex;gap:16px;align-items:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px;margin-top:14px}
.song-item img{width:56px;height:56px;border-radius:10px}
.playlist{margin-top:10px;border:2px dashed rgba(255,255,255,.15);border-radius:14px;padding:14px;max-height:320px;overflow:auto}
.playlist-item{display:flex;gap:12px;align-items:center;background:rgba(255,255,255,.05);border-radius:10px;padding:10px;margin-bottom:10px;border-left:4px solid #667eea}
.export{width:100%;padding:14px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:#0f0f14;color:#fff;cursor:pointer;font-weight:700;margin-top:14px}
.hstack{display:none;justify-content:center}
/* Light mode variants (if body.light-mode is toggled elsewhere) */
body.light-mode .export{background:#ffffff;color:#333;border:1px solid rgba(0,0,0,.15)}
.playlist-modal{position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;background:transparent;pointer-events:none}
.playlist-modal.show{pointer-events:auto}
.playlist-modal-content{position:absolute;left:0;right:0;bottom:0;background:#1a1a2e;border-radius:20px 20px 0 0;padding:20px;max-height:80vh;overflow-y:auto;transform:translateY(100%);transition:transform .3s ease}
.playlist-modal.show .playlist-modal-content{transform:translateY(0)}
.light-mode .playlist-modal-content{background:#ffffff;color:#333}
.playlist-modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.1)}
.playlist-modal-header h2{font-size:1.8rem}
.close-btn{background:none;border:none;font-size:2.5rem;color:#fff;cursor:pointer;line-height:1}
.playlist-modal-content{max-width:800px;margin:0 auto}
</style></head><body>
<div class="container">
<header><h1>🎵 Listify</h1><p>Recognize music around you and export a Spotify playlist.</p></header>
<main>
  <div class="hstack"><span id="status" class="status">Idle</span></div>
  <button id="btn" class="main-button">▶</button>
  <div id="result"></div>
  <button id="openPlaylistBtn" class="export" disabled>View Playlist</button>
</main>
</div>
<div class="playlist-modal" id="playlistModal">
<div class="playlist-modal-content">
<div class="playlist-modal-header">
<h2>Your Playlist</h2>
<button class="close-btn" id="closeModal">&times;</button>
</div>
<div id="playlist" class="playlist"></div>
<button id="exportBtn" class="export" disabled>Export to Spotify</button>
</div>
</div>
<script>
const btn = document.getElementById('btn');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const playlistEl = document.getElementById('playlist');
const exportBtn = document.getElementById('exportBtn');
const openPlaylistBtn = document.getElementById('openPlaylistBtn');
const playlistModal = document.getElementById('playlistModal');
const closeModal = document.getElementById('closeModal');

let listening = false;
let last = null;
let list = [];

async function record(ms=8000){
  const stream = await navigator.mediaDevices.getUserMedia({audio:true});
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';
  const rec = new MediaRecorder(stream,{mimeType:mime});
  const chunks = [];
  rec.ondataavailable = e => chunks.push(e.data);
  rec.start();
  await new Promise(r=>setTimeout(r,ms));
  rec.stop(); await new Promise(r=>rec.onstop=r);
  stream.getTracks().forEach(t=>t.stop());
  return new Blob(chunks,{type:mime});
}

function renderSong(d){
  const t = d?.track || {};
  const title = t.title || 'Unknown';
  const artist = t.subtitle || 'Unknown';
  const img = t?.images?.coverart || '';
  resultEl.innerHTML =
    '<div class="song-item">' +
    (img?'<img src="'+img+'"/>':'')+
    '<div><div style="font-weight:700">'+title+'</div><div style="opacity:.7">'+artist+'</div></div></div>';
}

function addToList(d){
  const t = d?.track; if(!t) return;
  const key = (t.title||'')+'|'+(t.subtitle||'');
  if(list.find(x=>x.key===key)) return;
  list.unshift({ key, title:t.title||'Unknown', artist:t.subtitle||'Unknown', cover: t?.images?.coverart||null });
  exportBtn.disabled = list.length===0;
  openPlaylistBtn.disabled = list.length===0;
  playlistEl.innerHTML = list.map((s,i)=>(
    '<div class="playlist-item"><div style="font-weight:700">'+s.title+'</div><div style="opacity:.7">'+s.artist+'</div></div>'
  )).join('');
}

async function recognizeOnce(){
  statusEl.textContent='Listening ~8s...';
  const blob = await record(8000);
  statusEl.textContent='Recognizing...';
  const form = new FormData(); form.append('file', blob, 'clip.webm');
  const res = await fetch('/api/recognize',{method:'POST',body:form});
  const json = await res.json();
  if(json?.track){
    const curr = (json.track.title||'')+'|'+(json.track.subtitle||'');
    if(curr !== last){ last = curr; renderSong(json); addToList(json); statusEl.textContent='Found: '+json.track.title; }
    else { statusEl.textContent='Same song, continuing...'; }
  } else {
    statusEl.textContent='No match.';
  }
}

let loop = null;
btn.onclick = ()=>{
  listening = !listening;
  btn.textContent = listening ? '⏸' : '▶';
  if(listening){
    list = []; playlistEl.innerHTML=''; exportBtn.disabled=true; openPlaylistBtn.disabled=true;
    recognizeOnce();
    loop = setInterval(recognizeOnce, 5000);
  } else {
    clearInterval(loop); loop=null; statusEl.textContent = 'Stopped.';
  }
};

openPlaylistBtn.onclick = ()=>{
  playlistModal.classList.add('show');
};

closeModal.onclick = ()=>{
  playlistModal.classList.remove('show');
};

exportBtn.onclick = async ()=>{
  const payload = { playlist: list.map(({title,artist})=>({title,artist})), playlistName: 'Shazam Playlist - '+new Date().toLocaleDateString() };
  const r = await fetch('/api/export-spotify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const j = await r.json();
  if(j.success && j.hasOAuth && j.authUrl){ window.location.href = j.authUrl; }
  else if(j.success){ alert('Export prepared. Open the manual export page.'); window.open('/export/'+encodeURIComponent(j.playlistName)+'?data='+encodeURIComponent(JSON.stringify(j.songs)),'_blank'); }
  else { alert('Export failed: '+(j.error||'Unknown error')); }
};
</script>
</body></html>`;

// Home
app.get("/", (req, res) => res.type("html").send(INDEX_HTML));

// Shazam recognize
app.post("/api/recognize", upload.single("file"), async (req, res) => {
  try {
    if (!RAPIDAPI_KEY) return res.status(500).json({ error: "Missing RAPIDAPI_KEY" });
    if (!req.file?.buffer) return res.status(400).json({ error: "No audio file" });

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
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Recognition failed" });
  }
});

// Start OAuth – request scopes and force account chooser
app.get("/spotify/login", (req, res) => {
  if (!SPOTIFY_CLIENT_ID) {
    return res.status(400).json({ error: "Spotify not configured (missing SPOTIFY_CLIENT_ID)" });
  }
  const scope = "playlist-modify-public playlist-modify-private";
  const authUrl =
    "https://accounts.spotify.com/authorize?" +
    `client_id=${encodeURIComponent(SPOTIFY_CLIENT_ID)}&` +
    "response_type=code&" +
    `redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&` +
    `scope=${encodeURIComponent(scope)}&` +
    "show_dialog=true&" +
    `state=${req.query.state || ""}`;
  res.redirect(authUrl);
});

// OAuth callback – verify user, create playlist, add tracks
app.get("/spotify/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.send("Authorization failed.");

    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64")
      },
      body: `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}`
    });
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error("Failed to get access token");

    const meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const me = await meRes.json();
    if (!me?.id) throw new Error("Could not read profile");

    if (TARGET_USER_ID && me.id !== TARGET_USER_ID) {
      const back = state ? `?state=${encodeURIComponent(state)}` : "";
      return res.send(`
        <html><body style="font-family:Arial;padding:24px;background:#191414;color:white">
          <h2>Wrong Spotify account</h2>
          <p>You logged in as <b>${me.display_name || me.id}</b> (${me.id}). Please log in as <b>${TARGET_USER_ID}</b>.</p>
          <p><a style="color:#1db954" href="/spotify/login${back}">Try again</a></p>
        </body></html>
      `);
    }

    const payload = state ? JSON.parse(decodeURIComponent(state)) : null;
    const playlistName = payload?.name || `Listify ${new Date().toLocaleDateString()}`;
    const songs = payload?.songs || [];

    // Create playlist explicitly for this user
    const createResponse = await fetch(`https://api.spotify.com/v1/users/${encodeURIComponent(me.id)}/playlists`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: playlistName, description: "Created from Listify", public: false })
    });
    const playlist = await createResponse.json();
    const playlistId = playlist.id;

    // Resolve tracks
    const uris = [];
    for (const s of songs) {
      try {
        const q = `${s.title} artist:${s.artist}`;
        const sr = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const sd = await sr.json();
        const item = sd?.tracks?.items?.[0];
        if (item?.uri) uris.push(item.uri);
      } catch {}
    }

    if (uris.length) {
      await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris })
      });
    }

    res.send(`
      <html>
        <head><title>Playlist Created</title>
        <style>body{font-family:Arial;background:#191414;color:#fff;padding:40px;text-align:center}
        .box{background:#1db954;padding:24px;border-radius:10px;display:inline-block}
        a.btn{display:inline-block;margin-top:16px;background:#fff;color:#191414;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:700}
        </style></head>
        <body>
          <div class="box">
            <h2>✅ Playlist Created</h2>
            <p>"${playlistName}" added to ${me.display_name || me.id}.</p>
            <a class="btn" target="_blank" href="${playlist?.external_urls?.spotify || `https://open.spotify.com/user/${me.id}`}">Open in Spotify</a>
          </div>
        </body>
      </html>
    `);
  } catch (e) {
    console.error("OAuth error:", e);
    res.status(500).send("Error: " + e.message);
  }
});

// Prepare export – either OAuth (preferred) or manual page
app.post("/api/export-spotify", async (req, res) => {
  try {
    const { playlist, playlistName } = req.body || {};
    if (!Array.isArray(playlist) || !playlist.length) {
      return res.status(400).json({ error: "No playlist data provided" });
    }
    if (!SPOTIFY_CLIENT_ID) {
      return res.json({
        success: true,
        hasOAuth: false,
        playlistName,
        songsCount: playlist.length,
        songs: playlist.map(s => ({
          title: s.title,
          artist: s.artist,
          spotifySearchUrl: `https://open.spotify.com/search/${encodeURIComponent(`${s.title} ${s.artist}`)}`
        }))
      });
    }
    const state = encodeURIComponent(JSON.stringify({
      name: playlistName,
      songs: playlist.map(s => ({ title: s.title, artist: s.artist }))
    }));
    return res.json({
      success: true,
      hasOAuth: true,
      authUrl: `/spotify/login?state=${state}`,
      playlistName,
      songsCount: playlist.length,
      songs: playlist.map(s => ({
        title: s.title,
        artist: s.artist,
        spotifySearchUrl: `https://open.spotify.com/search/${encodeURIComponent(`${s.title} ${s.artist}`)}`
      }))
    });
  } catch (e) {
    console.error("Export error:", e);
    res.status(500).json({ error: "Export failed" });
  }
});

// Manual export helper
app.get("/export/:playlistName", (req, res) => {
  const n = req.params.playlistName;
  const exportHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${n}</title>
  <style>body{font-family:Arial;background:#191414;color:#fff;padding:24px}.item{background:#282828;border-radius:8px;padding:10px;margin:8px 0;display:flex;justify-content:space-between}
  a{color:#1db954;text-decoration:none}</style></head><body>
  <h2>Spotify Export – ${n}</h2><div id="list">Loading…</div>
  <script>
  const p=new URLSearchParams(location.search).get('data');let s=[];try{s=JSON.parse(decodeURIComponent(p)||'[]')}catch{}
  document.getElementById('list').innerHTML=s.map(x=>'<div class="item"><div><b>'+x.title+'</b><div style="opacity:.7">'+x.artist+'</div></div><a target="_blank" href="'+x.spotifySearchUrl+'">Search</a></div>').join('');
  </script></body></html>`;
  res.type("html").send(exportHtml);
});

// Vercel default export
export default app;

// Local dev server
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`\nShazam test running on http://localhost:${PORT}`);
    console.log(`Redirect URI: ${SPOTIFY_REDIRECT_URI}`);
  });
}
