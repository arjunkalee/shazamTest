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

const RAPIDAPI_KEY_FALLBACK = "afbad03ef5msh0cbf5447fa19661p1fb2ffjsn226d2ca11fb1";

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || RAPIDAPI_KEY_FALLBACK;
if (!RAPIDAPI_KEY) {
  console.warn("\n[WARN] No RAPIDAPI_KEY set. Set env var RAPIDAPI_KEY or paste into RAPIDAPI_KEY_FALLBACK.\n");
}

const API_HOST = "shazam-song-recognition-api.p.rapidapi.com";
const app = express();
const upload = multer(); // in-memory
const PORT = process.env.PORT || 3001;

// Add JSON parsing middleware
app.use(express.json());

// --- Minimal web page with mic recording ---
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Listify - Music Recognition</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #1a1a2e;
            min-height: 100vh;
            color: #f5f5f5;
        }

        body.light-mode {
            background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
            color: #333;
        }

        body.light-mode main {
            background: rgba(255, 255, 255, 0.95);
        }

        body.light-mode .song-title,
        body.light-mode .playlist-item-title {
            color: #2d3436;
        }

        body.light-mode .song-artist,
        body.light-mode .playlist-item-artist {
            color: #636e72;
        }

        body.light-mode .song-item,
        body.light-mode .playlist-item {
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(0, 0, 0, 0.1);
        }

        body.light-mode .song-item:hover,
        body.light-mode .playlist-item:hover {
            background: rgba(255, 255, 255, 1);
        }

        body.light-mode .empty-state {
            color: #636e72;
        }

        body.light-mode .playlist {
            background: rgba(255, 255, 255, 0.5);
        }

        body.light-mode .status {
            background: rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(0, 0, 0, 0.2);
            color: #2d3436;
        }

        @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }

        header {
            text-align: center;
            margin-bottom: 40px;
            color: white;
        }

        header h1 {
            font-size: 3.5rem;
            margin-bottom: 15px;
            text-shadow: 2px 2px 8px rgba(0,0,0,0.4);
            background: linear-gradient(45deg, #fff, #f0f8ff, #e6f3ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: titleGlow 3s ease-in-out infinite alternate;
        }

        @keyframes titleGlow {
            from { filter: brightness(1); }
            to { filter: brightness(1.2); }
        }

        header p {
            font-size: 1.3rem;
            opacity: 0.95;
            text-shadow: 1px 1px 3px rgba(0,0,0,0.3);
            font-weight: 300;
        }

        main {
            background: rgba(26, 26, 46, 0.9);
            border-radius: 24px 24px 0 0;
            padding: 40px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.1);
            position: relative;
            padding-bottom: 70px;
            color: #f5f5f5;
        }

        .home-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 60vh;
            justify-content: center;
        }

        .main-button-container {
            display: flex;
            justify-content: center;
            margin: 40px 0;
        }

        .main-button {
            width: 200px;
            height: 200px;
            border-radius: 50%;
            border: none;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            cursor: pointer;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 20px 40px rgba(102, 126, 234, 0.3);
        }

        .main-button:hover:not(:disabled) {
            transform: scale(1.05);
            box-shadow: 0 25px 50px rgba(102, 126, 234, 0.4);
        }

        .main-button:active:not(:disabled) {
            transform: scale(0.95);
        }

        .main-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .button-content {
            text-align: center;
            z-index: 2;
        }

        .button-icon {
            font-size: 5rem;
            font-weight: bold;
        }

        .button-ring {
            position: absolute;
            top: -10px;
            left: -10px;
            right: -10px;
            bottom: -10px;
            border-radius: 50%;
            border: 3px solid rgba(255, 255, 255, 0.3);
            animation: pulse-ring 2s infinite;
        }

        @keyframes pulse-ring {
            0% {
                transform: scale(1);
                opacity: 1;
            }
            100% {
                transform: scale(1.1);
                opacity: 0;
            }
        }

        .current-song-section {
            margin-top: 30px;
            width: 100%;
            max-width: 500px;
        }

        .btn {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 15px 30px;
            border: none;
            border-radius: 50px;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            min-width: 180px;
            justify-content: center;
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            position: relative;
            overflow: hidden;
        }

        .btn-primary:hover:not(:disabled) {
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 15px 30px rgba(102, 126, 234, 0.4);
            background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
        }

        .btn-primary:active:not(:disabled) {
            transform: translateY(-1px) scale(0.98);
        }

        .btn-primary::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s;
        }

        .btn-primary:hover::before {
            left: 100%;
        }

        .btn-icon {
            font-size: 1.3rem;
        }

        .status-panel {
            text-align: center;
            margin-bottom: 30px;
        }

        .status {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 15px;
            padding: 12px 24px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 30px;
            display: inline-block;
            border: 1px solid rgba(255,255,255,0.2);
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            color: #f5f5f5;
        }

        .status.listening {
            background: linear-gradient(45deg, #00b894, #00a085);
            color: white;
            animation: pulse 2s infinite;
        }

        .status.processing {
            background: linear-gradient(45deg, #fdcb6e, #e17055);
            color: white;
        }

        .status.error {
            background: linear-gradient(45deg, #e74c3c, #c0392b);
            color: white;
        }

        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        .container {
            animation: fadeInUp 0.8s ease-out;
        }

        .song-item, .playlist-item {
            animation: slideIn 0.5s ease-out;
        }

        .playlist-section {
            margin-bottom: 30px;
        }

        .playlist-section h2 {
            margin-bottom: 20px;
            color: #2d3436;
            font-size: 1.5rem;
        }

        .playlist {
            min-height: 200px;
            border: 2px dashed #ddd;
            border-radius: 10px;
            padding: 20px;
        }

        .empty-state {
            text-align: center;
            color: #b3b3b3;
            font-style: italic;
            padding: 40px 20px;
        }

        .song-item {
            display: flex;
            align-items: center;
            padding: 20px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            margin-bottom: 12px;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            position: relative;
            overflow: hidden;
        }

        .song-item::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transform: scaleX(0);
            transition: transform 0.3s ease;
        }

        .song-item:hover::before {
            transform: scaleX(1);
        }

        .song-item img {
            flex-shrink: 0;
            width: 60px;
            height: 60px;
            border-radius: 12px;
            margin-right: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            transition: transform 0.3s ease;
        }

        .song-item:hover {
            background: rgba(255, 255, 255, 0.1);
            transform: translateX(8px) translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.4);
        }

        .song-item:hover img {
            transform: scale(1.05);
        }

        .song-info {
            flex: 1;
        }

        .song-title {
            font-weight: 600;
            color: #f5f5f5;
            margin-bottom: 5px;
        }

        .song-artist {
            color: #b3b3b3;
            font-size: 0.9rem;
        }

        .song-links {
            margin-top: 8px;
        }

        .song-links a {
            color: #74b9ff;
            text-decoration: none;
            margin-right: 10px;
        }

        .song-links a:hover {
            text-decoration: underline;
        }

        .playlist {
            min-height: 200px;
            border: 2px dashed rgba(102, 126, 234, 0.3);
            border-radius: 16px;
            padding: 20px;
            max-height: 400px;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.2);
        }

        .playlist::-webkit-scrollbar {
            width: 8px;
        }

        .playlist::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.05);
            border-radius: 4px;
        }

        .playlist::-webkit-scrollbar-thumb {
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 4px;
        }

        .playlist::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(135deg, #764ba2, #667eea);
        }

        .playlist-item {
            display: flex;
            align-items: center;
            padding: 16px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            margin-bottom: 10px;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            border-left: 4px solid #667eea;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            position: relative;
        }

        .playlist-item:hover {
            background: rgba(255, 255, 255, 0.1);
            transform: translateX(5px) translateY(-1px);
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            border-left-color: #764ba2;
        }

        .delete-btn {
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            color: white;
            border: none;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 1.2rem;
            transition: all 0.3s ease;
            margin-left: 12px;
            opacity: 0.7;
        }

        .delete-btn:hover {
            opacity: 1;
            transform: scale(1.1);
            box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
        }

        .playlist-item img {
            flex-shrink: 0;
            width: 40px;
            height: 40px;
            border-radius: 6px;
            margin-right: 12px;
        }

        .playlist-item-info {
            flex: 1;
        }

        .playlist-item-title {
            font-weight: 600;
            color: #f5f5f5;
            margin-bottom: 3px;
            font-size: 0.95rem;
        }

        .playlist-item-artist {
            color: #b3b3b3;
            font-size: 0.85rem;
        }

        .playlist-item-time {
            color: #74b9ff;
            font-size: 0.8rem;
            margin-top: 3px;
        }

        .playlist-handle-container {
            width: 100%;
            margin-top: 0;
            margin-bottom: 0;
            pointer-events: none;
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 0 40px 0 40px;
        }

        .playlist-handle {
            background: #000000;
            border-radius: 20px 20px 0 0;
            padding: 16px 24px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
            pointer-events: all;
            position: relative;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 10px;
        }

        .playlist-handle:hover {
            transform: translateY(-2px);
            box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.4);
        }

        .handle-indicator {
            width: 40px;
            height: 4px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 2px;
            margin: 0 auto 0;
        }


        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
        }

        .modal-content {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(26, 26, 46, 0.98);
            border-radius: 24px 24px 0 0;
            padding: 0;
            max-height: 80vh;
            animation: slideUp 0.3s ease-out;
            box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
        }

        @keyframes slideUp {
            from {
                transform: translateY(100%);
            }
            to {
                transform: translateY(0);
            }
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 24px 24px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .modal-header h2 {
            margin: 0;
            color: #f5f5f5;
            font-size: 1.5rem;
        }

        .close-btn {
            background: none;
            border: none;
            font-size: 2rem;
            cursor: pointer;
            color: #b3b3b3;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.2s ease;
        }

        .close-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #f5f5f5;
        }

        .modal-body {
            padding: 0 24px;
            max-height: 50vh;
            overflow-y: auto;
        }

        .modal-footer {
            padding: 16px 24px 24px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .export-btn {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 16px 24px;
            background: linear-gradient(135deg, #1db954, #1ed760);
            color: white;
            border: none;
            border-radius: 50px;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 8px 25px rgba(29, 185, 84, 0.3);
        }

        .export-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 12px 35px rgba(29, 185, 84, 0.4);
        }

        .export-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .debug-panel h3 {
            margin-bottom: 15px;
            color: #2d3436;
            font-size: 1.2rem;
        }

        .debug-info p {
            margin-bottom: 8px;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
        }

        .debug-info span {
            font-weight: 600;
            color: #0984e3;
        }

        pre {
            margin-top: 12px;
            white-space: pre-wrap;
            background: #fafafa;
            padding: 10px;
            border-radius: 8px;
            max-height: 240px;
            overflow: auto;
        }

        .settings-button {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid rgba(255, 255, 255, 0.2);
            color: white;
            font-size: 1.5rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            z-index: 200;
        }

        .settings-button:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: scale(1.1);
        }

        .settings-dropdown {
            position: fixed;
            top: 80px;
            right: 20px;
            background: rgba(26, 26, 46, 0.95);
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            display: none;
            z-index: 200;
            min-width: 200px;
        }

        body.light-mode .settings-dropdown {
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .settings-dropdown.show {
            display: block;
        }

        .theme-toggle-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
        }

        .theme-toggle-label {
            color: #f5f5f5;
            font-weight: 600;
        }

        body.light-mode .theme-toggle-label {
            color: #2d3436;
        }

        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 60px;
            height: 34px;
        }

        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 34px;
        }

        .toggle-slider:before {
            position: absolute;
            content: "";
            height: 26px;
            width: 26px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }

        input:checked + .toggle-slider {
            background-color: #667eea;
        }

        input:checked + .toggle-slider:before {
            transform: translateX(26px);
        }

        @media (max-width: 600px) {
            .container {
                padding: 10px;
            }
            
            header h1 {
                font-size: 2rem;
            }
            
            .control-panel {
                flex-direction: column;
                align-items: center;
            }
            
            .btn {
                width: 100%;
                max-width: 300px;
            }
        }
    </style>
</head>
<body>
    <button id="settingsBtn" class="settings-button" title="Settings">⚙️</button>
    
    <div id="settingsDropdown" class="settings-dropdown">
        <div class="theme-toggle-container">
            <span class="theme-toggle-label">Dark Mode</span>
            <label class="toggle-switch">
                <input type="checkbox" id="themeToggle" checked>
                <span class="toggle-slider"></span>
            </label>
        </div>
    </div>
    
    <div class="container">
        <header>
            <h1>🎵 Listify</h1>
        </header>

        <main>
            <div class="home-container">
            <div class="status-panel">
                <div id="status" class="status"></div>
            </div>

                <div class="main-button-container">
                    <button id="btn" class="main-button">
                        <div class="button-content">
                            <div class="button-icon">▶</div>
                        </div>
                        <div class="button-ring"></div>
                    </button>
                </div>

                <div class="current-song-section">
                <div id="result" class="result">
                    </div>
                </div>
            </div>

            <!-- Playlist Handle -->
            <div class="playlist-handle-container" id="playlistHandle">
                <div class="playlist-handle" id="playlistHandleBar">
                    <div class="handle-indicator"></div>
                </div>
            </div>

            <!-- Playlist Modal -->
            <div id="playlistModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Your Playlist</h2>
                        <button id="closeModal" class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="playlist" class="playlist">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="exportBtn" class="export-btn" disabled>
                            <span class="btn-icon">🎵</span>
                            <span class="btn-text">Export to Spotify</span>
                        </button>
                    </div>
                </div>
            </div>
        </main>
    </div>

<script>
const btn = document.getElementById('btn');
const exportBtn = document.getElementById('exportBtn');
const playlistHandle = document.getElementById('playlistHandle');
const playlistHandleBar = document.getElementById('playlistHandleBar');
const playlistModal = document.getElementById('playlistModal');
const closeModal = document.getElementById('closeModal');
const settingsBtn = document.getElementById('settingsBtn');
const settingsDropdown = document.getElementById('settingsDropdown');
const themeToggle = document.getElementById('themeToggle');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const playlistEl = document.getElementById('playlist');

let isListening = false;
let currentSong = null;
let recognitionInterval = null;
let playlist = [];

// Touch/swipe functionality for playlist handle
let startY = 0;
let currentY = 0;
let isDragging = false;

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
    </div>
  \`;
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
    timestamp: new Date().toLocaleTimeString(),
    appleMusic: songData.track.hub?.actions?.find(a => a.type === 'applemusicplay')?.uri,
    spotify: songData.track.hub?.providers?.find(p => p.type === 'SPOTIFY')?.actions?.[0]?.uri
  };
  
  // Check if song already exists in playlist
  const exists = playlist.some(item => 
    item.title === song.title && item.artist === song.artist
  );
  
  if (!exists) {
    playlist.unshift(song); // Add to beginning
    updatePlaylistDisplay();
  }
}

function updatePlaylistDisplay() {
  // Enable/disable buttons based on playlist content
  playlistHandle.style.opacity = playlist.length === 0 ? '0.5' : '1';
  playlistHandle.style.pointerEvents = playlist.length === 0 ? 'none' : 'all';
  exportBtn.disabled = playlist.length === 0;
  
  if (playlist.length === 0) {
    playlistEl.innerHTML = '';
    return;
  }
  
  playlistEl.innerHTML = playlist.map((song, index) => \`
    <div class="playlist-item" data-index="\${index}">
      \${song.coverArt ? \`<img src="\${song.coverArt}" alt="Cover Art">\` : '<div style="width: 40px; height: 40px; background: #ddd; border-radius: 6px; margin-right: 12px;"></div>'}
      <div class="playlist-item-info">
        <div class="playlist-item-title">\${song.title}</div>
        <div class="playlist-item-artist">\${song.artist}</div>
        <div class="playlist-item-time">Added at \${song.timestamp}</div>
      </div>
      <button class="delete-btn" onclick="deleteFromPlaylist(\${index})" title="Remove from playlist">×</button>
    </div>
  \`).join('');
}

function deleteFromPlaylist(index) {
  playlist.splice(index, 1);
  updatePlaylistDisplay();
}

async function recognizeSong() {
  try {
    statusEl.textContent = 'Listening for ~8 seconds…';
    statusEl.className = 'status listening';
    
    const blob = await record(8000);
    statusEl.textContent = 'Uploading & recognizing…';
    statusEl.className = 'status processing';
    
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
    } else {
      statusEl.textContent = 'Same song playing, continuing to listen...';
      statusEl.className = 'status';
    }
    
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'Error: ' + (e?.message || e);
    statusEl.className = 'status error';
  }
}

function startContinuousListening() {
  if (isListening) return;
  
  isListening = true;
  btn.querySelector('.button-icon').textContent = '⏸';
  
  // Clear previous playlist
  playlist = [];
  updatePlaylistDisplay();
  
  statusEl.textContent = 'Starting continuous listening...';
  statusEl.className = 'status listening';
  
  // Start immediate recognition
  recognizeSong();
  
  // Then continue every 5 seconds
  recognitionInterval = setInterval(recognizeSong, 5000);
}

function stopContinuousListening() {
  if (!isListening) return;
  
  isListening = false;
  btn.querySelector('.button-icon').textContent = '▶';
  
  if (recognitionInterval) {
    clearInterval(recognitionInterval);
    recognitionInterval = null;
  }
  
  statusEl.textContent = \`Stopped listening. Found \${playlist.length} songs in playlist.\`;
  statusEl.className = 'status';
}

async function exportToSpotify() {
  if (playlist.length === 0) return;
  
  try {
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';
    statusEl.textContent = 'Exporting playlist to Spotify...';
    statusEl.className = 'status processing';
    
    const response = await fetch('/api/export-spotify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        playlist: playlist,
        playlistName: \`Shazam Playlist - \${new Date().toLocaleDateString()}\`
      })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      statusEl.textContent = \`✅ Playlist exported! \${result.songsCount} songs ready for Spotify.\`;
      statusEl.className = 'status';
      
      // Create the export page URL with playlist data
      const playlistName = encodeURIComponent(result.playlistName);
      const playlistData = encodeURIComponent(JSON.stringify(result.songs));
      const exportUrl = \`/export/\${playlistName}?data=\${playlistData}\`;
      
      // Open the export page in a new tab
      window.open(exportUrl, '_blank');
    } else {
      throw new Error(result.error || 'Export failed');
    }
  } catch (error) {
    console.error('Export error:', error);
    statusEl.textContent = \`Export failed: \${error.message}\`;
    statusEl.className = 'status error';
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = 'Export to Spotify';
  }
}

// Touch/swipe functionality for playlist handle
playlistHandleBar.addEventListener('touchstart', (e) => {
  if (playlist.length === 0) return;
  startY = e.touches[0].clientY;
  isDragging = true;
});

playlistHandleBar.addEventListener('touchmove', (e) => {
  if (!isDragging || playlist.length === 0) return;
  currentY = e.touches[0].clientY;
  const deltaY = startY - currentY;
  
  // If swiping up significantly, open modal
  if (deltaY > 50) {
    playlistModal.style.display = 'block';
    isDragging = false;
  }
});

playlistHandleBar.addEventListener('touchend', () => {
  isDragging = false;
});

// Modal functionality
playlistHandleBar.onclick = () => {
  if (playlist.length > 0) {
    playlistModal.style.display = 'block';
  }
};

closeModal.onclick = () => {
  playlistModal.style.display = 'none';
};

// Close modal when clicking outside
window.onclick = (event) => {
  if (event.target === playlistModal) {
    playlistModal.style.display = 'none';
  }
  // Close settings dropdown when clicking outside
  if (!event.target.closest('.settings-button') && !event.target.closest('.settings-dropdown')) {
    settingsDropdown.classList.remove('show');
  }
};

// Main button functionality
btn.onclick = () => {
  if (isListening) {
    stopContinuousListening();
  } else {
    startContinuousListening();
  }
};

exportBtn.onclick = exportToSpotify;

// Initialize button icon
btn.querySelector('.button-icon').textContent = '▶';

// Settings functionality
settingsBtn.onclick = () => {
  settingsDropdown.classList.toggle('show');
};

// Theme toggle functionality
themeToggle.onchange = () => {
  const isDark = themeToggle.checked;
  document.body.classList.toggle('light-mode', !isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

// Load saved theme preference on page load
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
  document.body.classList.add('light-mode');
  themeToggle.checked = false;
} else {
  themeToggle.checked = true;
}
</script>
</body>
</html>`;

// --- Routes ---
app.get("/", (req, res) => res.type("html").send(INDEX_HTML));

app.post("/api/recognize", upload.single("file"), async (req, res) => {
  try {
    if (!RAPIDAPI_KEY) return res.status(500).json({ error: "Missing RAPIDAPI_KEY" });
    if (!req.file?.buffer) return res.status(400).json({ error: "No audio file received" });

    // Forward the uploaded clip to Shazam API via RapidAPI
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

    // Forward exact JSON back to the client
    const json = await apiRes.json();
    res.status(apiRes.ok ? 200 : apiRes.status).json(json);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Recognition failed" });
  }
});

app.post("/api/export-spotify", async (req, res) => {
  try {
    const { playlist, playlistName } = req.body;
    
    if (!playlist || !Array.isArray(playlist) || playlist.length === 0) {
      return res.status(400).json({ error: "No playlist data provided" });
    }

    // Return JSON response with export data
    const exportData = {
      success: true,
      playlistName: playlistName,
      songsCount: playlist.length,
      songs: playlist.map(song => ({
        title: song.title,
        artist: song.artist,
        spotifySearchUrl: `https://open.spotify.com/search/${encodeURIComponent(`${song.title} ${song.artist}`)}`
      }))
    };

    res.json(exportData);
    
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: "Export failed" });
  }
});

// Export page route
app.get("/export/:playlistName", (req, res) => {
  const playlistName = req.params.playlistName;
  
  const exportHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Spotify Export - ${playlistName}</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #191414; color: white; }
            .header { text-align: center; margin-bottom: 30px; }
            .playlist-info { background: #1db954; padding: 15px; border-radius: 10px; margin-bottom: 20px; }
            .song-list { display: grid; gap: 10px; }
            .song-item { background: #282828; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
            .song-info { flex: 1; }
            .song-title { font-weight: bold; color: #1db954; }
            .song-artist { color: #b3b3b3; }
            .spotify-btn { background: #1db954; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; text-decoration: none; }
            .spotify-btn:hover { background: #1ed760; }
            .instructions { background: #282828; padding: 15px; border-radius: 8px; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🎵 ${playlistName}</h1>
            <p>Export your playlist to Spotify</p>
        </div>
        
        <div class="playlist-info">
            <h3>📋 Export Instructions:</h3>
            <p>1. Click "Search on Spotify" for each song to find it</p>
            <p>2. Add each song to a new playlist in Spotify</p>
            <p>3. Name your playlist "${playlistName}"</p>
        </div>

        <div id="song-list" class="song-list">
            <p>Loading songs...</p>
        </div>

        <div class="instructions">
            <h3>💡 Pro Tip:</h3>
            <p>For automatic playlist creation, you would need Spotify Web API integration with OAuth authentication. This export provides direct links to search for each song on Spotify.</p>
        </div>

        <script>
            // Get playlist data from URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            const playlistData = urlParams.get('data');
            
            if (playlistData) {
                try {
                    const songs = JSON.parse(decodeURIComponent(playlistData));
                    const songListEl = document.getElementById('song-list');
                    
                    songListEl.innerHTML = songs.map(song => \`
                        <div class="song-item">
                            <div class="song-info">
                                <div class="song-title">\${song.title}</div>
                                <div class="song-artist">\${song.artist}</div>
                            </div>
                            <a href="\${song.spotifySearchUrl}" target="_blank" class="spotify-btn">
                                Search on Spotify
                            </a>
                        </div>
                    \`).join('');
                } catch (e) {
                    document.getElementById('song-list').innerHTML = '<p>Error loading playlist data.</p>';
                }
            }
        </script>
    </body>
    </html>`;

    res.type('html').send(exportHtml);
});

// For Vercel deployment
export default app;

// For local development
if (process.env.NODE_ENV !== 'production') {
app.listen(PORT, () => {
  console.log(`\nShazam test running on http://localhost:${PORT}\n`);
  console.log(`Press Ctrl+C to stop.`);
});
}