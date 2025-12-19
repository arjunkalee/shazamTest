// shazam-test.mjs
// Node 18+
// Env (Vercel Project Settings -> Environment Variables):
// RAPIDAPI_KEY=... 
// SPOTIFY_CLIENT_ID=...
// SPOTIFY_CLIENT_SECRET=...
// SPOTIFY_REDIRECT_URI=https://YOUR-VERCEL-DOMAIN/spotify/callback
//
// Deployed on Vercel as a serverless function (export default app).

import express from "express";
import multer from "multer";
import { randomBytes } from "crypto";

// ----------- Config ----------
const RAPIDAPI_KEY_FALLBACK = "afbad03ef5msh0cbf5447fa19661p1fb2ffjsn226d2ca11fb1";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || RAPIDAPI_KEY_FALLBACK;
const API_HOST = "shazam-song-recognition-api.p.rapidapi.com";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";
const SPOTIFY_REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI || "https://shazam-test.vercel.app/spotify/callback";

// Lock to a single Spotify account (set "" to allow any user)
const TARGET_USER_ID = "forzadaboss2004";

// ---------- App ----------
const app = express();
const upload = multer();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// ---------- Cookie helpers (serverless-safe state) ----------
function setCookie(res, name, value, { maxAgeSec = 600 } = {}) {
  const cookie = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
  res.setHeader("Set-Cookie", cookie);
}
function getCookie(req, name) {
  const h = req.headers.cookie || "";
  const m = h.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

// ---------- UI ----------
const INDEX_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Listify - Music Recognition</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,Segoe UI,-apple-system,BlinkMacSystemFont,sans-serif;background:#1a1a2e;min-height:100vh;color:#f5f5f5}
.container{max-width:800px;margin:0 auto;padding:20px 20px 0 20px}header{text-align:center;margin-bottom:40px;color:#fff}
header h1{font-size:3rem;margin-bottom:10px}
main{background:rgba(26,26,46,.92);border-radius:24px 24px 0 0;padding:40px;box-shadow:0 25px 50px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.1);min-height:calc(100vh - 160px);display:flex;flex-direction:column}
.main-button{width:200px;height:200px;border-radius:0;border:none;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;margin:20px auto;font-size:5rem}
body.light-mode .main-button{background:linear-gradient(135deg,#4a5568 0%,#2d3748 100%)}
.status{display:inline-block;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);margin:10px 0}
.song-item{display:flex;gap:16px;align-items:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px;margin-top:14px}
.song-item img{width:56px;height:56px;border-radius:10px}
.playlist{margin-top:10px;border:2px dashed rgba(255,255,255,.15);border-radius:14px;padding:14px;max-height:320px;overflow:auto}
.playlist-item{display:flex;gap:12px;align-items:center;background:rgba(255,255,255,.05);border-radius:10px;padding:10px;margin-bottom:10px;border-left:4px solid #667eea}
.export{width:100%;padding:20px;border-radius:999px;border:none;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;cursor:pointer;font-weight:700;margin-top:40px}
.hstack{display:none;justify-content:center}
body.light-mode{background:#f5f5f5;color:#333}
body.light-mode header{color:#333}
body.light-mode main{background:#ffffff;box-shadow:0 25px 50px rgba(0,0,0,.1),0 0 0 1px rgba(0,0,0,.08)}
body.light-mode .status{background:rgba(0,0,0,.06);border:1px solid rgba(0,0,0,.12);color:#333}
body.light-mode .song-item{background:rgba(0,0,0,.04);border:1px solid rgba(0,0,0,.1)}
body.light-mode .playlist{border:2px dashed rgba(0,0,0,.15)}
body.light-mode .playlist-item{background:rgba(0,0,0,.04);border-left:4px solid #667eea}
body.light-mode .export{background:#000000;color:#ffffff;border:1px solid rgba(0,0,0,.3)}
body.light-mode .settings-button{background:rgba(0,0,0,.06);border:1px solid rgba(0,0,0,.12);color:#333}
body.light-mode .settings-button:hover{background:rgba(0,0,0,.1)}
.settings-button{position:fixed;top:16px;right:16px;width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:1100}
.settings-button:hover{background:rgba(255,255,255,.15)}
.settings-dropdown{position:fixed;top:72px;right:16px;min-width:220px;background:#1a1a2e;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:14px;display:none;z-index:1100}
.settings-dropdown.show{display:block}
body.light-mode .settings-dropdown{background:#ffffff;border:1px solid rgba(0,0,0,.15);color:#333}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.toggle{position:relative;width:54px;height:30px}
.toggle input{opacity:0;width:0;height:0}
.slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#888;border-radius:999px;transition:.3s}
.slider:before{content:"";position:absolute;height:24px;width:24px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.3s}
.toggle input:checked + .slider{background:#667eea}
.toggle input:checked + .slider:before{transform:translateX(24px)}
.playlist-modal{position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;background:transparent;pointer-events:none}
.playlist-modal.show{pointer-events:auto}
.playlist-modal-content{position:absolute;left:0;right:0;bottom:0;background:#1a1a2e;border-radius:20px 20px 0 0;padding:20px;max-height:80vh;overflow-y:auto;transform:translateY(100%);transition:transform .3s ease;max-width:800px;margin:0 auto}
.playlist-modal.show .playlist-modal-content{transform:translateY(0)}
body.light-mode .playlist-modal-content{background:#ffffff;color:#333}
.playlist-modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.1)}
body.light-mode .playlist-modal-header{border-bottom:1px solid rgba(0,0,0,.1)}
.playlist-modal-header h2{font-size:1.8rem}
.close-btn{background:none;border:none;font-size:2.5rem;color:#fff;cursor:pointer;line-height:1}
body.light-mode .close-btn{color:#333}
</style></head><body>
<button id="settingsBtn" class="settings-button" title="Settings">⚙️</button>
<div id="settingsDropdown" class="settings-dropdown">
  <div class="row"><span>Dark Mode</span>
    <label class="toggle">
      <input id="themeToggle" type="checkbox" checked>
      <span class="slider"></span>
    </label>
  </div>
  <div style="margin-top:10px;font-size:.85rem;opacity:.8">Your preference is saved.</div>
</div>
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
const settingsBtn = document.getElementById('settingsBtn');
const settingsDropdown = document.getElementById('settingsDropdown');
const themeToggle = document.getElementById('themeToggle');

let listening = false;
let last = null;
let list = [
  { key: 'Blinding Lights|The Weeknd', title: 'Blinding Lights', artist: 'The Weeknd', cover: null },
  { key: 'Shape of You|Ed Sheeran', title: 'Shape of You', artist: 'Ed Sheeran', cover: null },
  { key: 'Someone Like You|Adele', title: 'Someone Like You', artist: 'Adele', cover: null },
  { key: 'Bad Guy|Billie Eilish', title: 'Bad Guy', artist: 'Billie Eilish', cover: null },
  { key: 'As It Was|Harry Styles', title: 'As It Was', artist: 'Harry Styles', cover: null }
];

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

function updatePlaylistDisplay(){
  exportBtn.disabled = list.length===0;
  openPlaylistBtn.disabled = list.length===0;
  playlistEl.innerHTML = list.map((s)=>
    '<div class="playlist-item"><div style="font-weight:700">'+s.title+'</div><div style="opacity:.7">'+s.artist+'</div></div>'
  ).join('');
}

function addToList(d){
  const t = d?.track; if(!t) return;
  const key = (t.title||'')+'|'+(t.subtitle||'');
  if(list.find(x=>x.key===key)) return;
  list.unshift({ key, title:t.title||'Unknown', artist:t.subtitle||'Unknown', cover: t?.images?.coverart||null });
  updatePlaylistDisplay();
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
    recognizeOnce();
    loop = setInterval(recognizeOnce, 5000);
  } else {
    clearInterval(loop); loop=null; statusEl.textContent = 'Stopped.';
  }
};

openPlaylistBtn.onclick = ()=>{ playlistModal.classList.add('show'); };
closeModal.onclick = ()=>{ playlistModal.classList.remove('show'); };

// Settings dropdown
settingsBtn.onclick = (e)=>{ e.stopPropagation(); settingsDropdown.classList.toggle('show'); };
document.addEventListener('click',(e)=>{ if(!e.target.closest('#settingsDropdown') && !e.target.closest('#settingsBtn')) settingsDropdown.classList.remove('show'); });

// Theme toggle with persistence
const savedTheme = localStorage.getItem('theme');
if(savedTheme === 'light'){ document.body.classList.add('light-mode'); themeToggle.checked = false; } else { themeToggle.checked = true; }
themeToggle.onchange = ()=>{ const dark = themeToggle.checked; document.body.classList.toggle('light-mode', !dark); localStorage.setItem('theme', dark ? 'dark' : 'light'); };

exportBtn.onclick = async ()=>{
  const payload = { playlist: list.map(({title,artist})=>({title,artist})), playlistName: 'Listify playlist - '+new Date().toLocaleDateString() };
  const r = await fetch('/api/export-spotify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const j = await r.json();
  if(j.success && j.hasOAuth && j.authUrl){ window.location.href = j.authUrl; }
  else if(j.success){ alert('Export prepared. Open the manual export page.'); window.open('/export/'+encodeURIComponent(j.playlistName)+'?data='+encodeURIComponent(JSON.stringify(j.songs)),'_blank'); }
  else { alert('Export failed: '+(j.error||'Unknown error')); }
};

// Initialize playlist display on page load
updatePlaylistDisplay();
</script>
</body></html>`;

// ---------- Routes ----------

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

// Prepare export – prefer OAuth when Spotify env present; store payload in cookie
app.post("/api/export-spotify", async (req, res) => {
  try {
    const { playlist, playlistName } = req.body || {};
    if (!Array.isArray(playlist) || !playlist.length) {
      return res.status(400).json({ error: "No playlist data provided" });
    }

    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REDIRECT_URI) {
      // Fallback: manual export page
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

    // NEW: short state token + HttpOnly cookie with payload (10 min)
    const stateKey = randomBytes(16).toString("hex");
    const payload = {
      name: playlistName,
      songs: playlist.map(s => ({ title: s.title, artist: s.artist }))
    };
    setCookie(res, "listify_payload", JSON.stringify({ stateKey, payload }), { maxAgeSec: 600 });

    return res.json({
      success: true,
      hasOAuth: true,
      authUrl: `/spotify/login?state=${stateKey}`,
      playlistName,
      songsCount: playlist.length
    });
  } catch (e) {
    console.error("Export error:", e);
    res.status(500).json({ error: "Export failed" });
  }
});

// Start OAuth – forward short state
app.get("/spotify/login", (req, res) => {
  if (!SPOTIFY_CLIENT_ID) {
    return res.status(400).json({ error: "Spotify not configured (missing SPOTIFY_CLIENT_ID)" });
  }
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const scope = "playlist-modify-public playlist-modify-private";
  const authUrl =
    "https://accounts.spotify.com/authorize?" +
    `client_id=${encodeURIComponent(SPOTIFY_CLIENT_ID)}&` +
    "response_type=code&" +
    `redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&` +
    `scope=${encodeURIComponent(scope)}&` +
    "show_dialog=true&" +
    `state=${encodeURIComponent(state)}`;
  res.redirect(authUrl);
});

// OAuth callback – verify state, create playlist, add tracks, redirect to Spotify
app.get("/spotify/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).send("Authorization failed.");

    // Validate state from cookie
    const cookieJson = getCookie(req, "listify_payload");
    if (!cookieJson) throw new Error("Missing playlist cookie (expired). Try export again.");
    const { stateKey, payload } = JSON.parse(cookieJson);
    if (!state || state !== stateKey) throw new Error("State mismatch.");

    // Exchange code for token
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

    // Identify user
    const meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const me = await meRes.json();
    if (!me?.id) throw new Error("Could not read profile");

    // Optional account lock
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

    const playlistName = payload?.name || `Listify ${new Date().toLocaleDateString()}`;
    const songs = Array.isArray(payload?.songs) ? payload.songs : [];

    // Create playlist under this user
    const createResponse = await fetch(`https://api.spotify.com/v1/me/playlists`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: playlistName, description: "Created from Listify", public: false })
    });
    const playlist = await createResponse.json();
    const playlistId = playlist.id;
    if (!playlistId) {
      throw new Error("Failed to create playlist: " + (playlist?.error?.message || JSON.stringify(playlist)));
    }

    // Resolve tracks -> URIs
    const uris = [];
    const found = [];
    const notFound = [];
    
    for (const s of songs) {
      try {
        // Try exact match first
        let q = `${s.title} artist:${s.artist}`;
        let sr = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=5`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        let sd = await sr.json();
        let item = sd?.tracks?.items?.[0];
        
        // If no exact match, try title only
        if (!item && s.title) {
          q = s.title;
          sr = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=5`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          sd = await sr.json();
          // Try to find match with artist in results
          item = sd?.tracks?.items?.find(t => 
            t.artists?.some(a => a.name?.toLowerCase().includes(s.artist?.toLowerCase() || ''))
          ) || sd?.tracks?.items?.[0];
        }
        
        if (item?.uri) {
          uris.push(item.uri);
          found.push(s.title);
        } else {
          notFound.push(`${s.title} - ${s.artist}`);
          console.log(`Track not found: ${s.title} by ${s.artist}`);
        }
      } catch (err) {
        notFound.push(`${s.title} - ${s.artist}`);
        console.error(`Error searching for ${s.title}:`, err.message);
      }
    }
    
    console.log(`Found ${found.length}/${songs.length} tracks. Missing: ${notFound.join(', ')}`);

    // Add tracks in chunks of 100
    for (let i = 0; i < uris.length; i += 100) {
      const chunk = uris.slice(i, i + 100);
      try {
        const addRes = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ uris: chunk })
        });
        if (!addRes.ok) {
          const error = await addRes.json();
          console.error(`Failed to add chunk ${i}-${i+chunk.length}:`, error);
        }
      } catch (err) {
        console.error(`Error adding chunk ${i}-${i+chunk.length}:`, err.message);
      }
    }

    // Return HTML page that opens Spotify in new tab
    // Return HTML page that opens Spotify in new tab
const appUrl = `spotify:playlist:${playlistId}`;

return res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Playlist Created</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      padding: 40px; 
      text-align: center; 
      background: #1a1a2e; 
      color: #fff; 
    }
    .success { 
      background: rgba(29,185,84,0.2); 
      border: 2px solid #1db954; 
      border-radius: 12px; 
      padding: 24px; 
      margin: 20px auto; 
      max-width: 500px; 
    }
  </style>
</head>
<body>
  <div class="success">
    <h2>✅ Playlist Created Successfully!</h2>
    <p>Opening Spotify…</p>
  </div>

  <script>
    // Automatically launch Spotify app without user interaction
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = '${appUrl}';
    document.body.appendChild(iframe);

    // If the browser blocks the iframe attempt, fallback to direct navigation
    setTimeout(() => {
      window.location.href = '${appUrl}';
    }, 300);
  </script>
</body>
</html>
`);



  } catch (e) {
    console.error("OAuth error:", e);
    res.status(500).send("Error: " + e.message);
  }
});

// Manual export helper (fallback)
app.get("/export/:playlistName", (req, res) => {
  const n = req.params.playlistName;
  const exportHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${n}</title>
  <style>body{font-family:Arial;background:#191414;color:#fff;padding:24px}.item{background:#282828;border-radius:8px;padding:10px;margin:8px 0;display:flex;justify-content:space-between}
  a{color:#1db954;text-decoration:none}</style></head><body>
  <h2>Spotify Export – ${n}</h2><div id="list">Loading…</div>
  <script>
  const p=new URLSearchParams(location.search).get('data');let s=[];try{s=JSON.parse(decodeURIComponent(p)||'[]')}catch{}
  document.getElementById('list').innerHTML=s.map(x=>'<div class="item"><div><b>'+x.title+'</b><div style="opacity:.7">'+x.artist+'</div></div><a target="_blank" href="https://open.spotify.com/search/'+encodeURIComponent(x.title+' '+x.artist)+'">Search</a></div>').join('');
  </script></body></html>`;
  res.type("html").send(exportHtml);
});

// Vercel default export
export default app;

// Local dev server (optional)
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`\nShazam test running on https://shazam-test.vercel.app/`);
    console.log(`Redirect URI: ${SPOTIFY_REDIRECT_URI}`);
  });
}
