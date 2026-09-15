// electron/main.js — Windowsデスクトップアプリのエントリポイント
const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: '#16151c',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'icons', 'icon-512.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // file:// から localhost 上のローカルLLMサーバーへ fetch するためCORSを無効化する。
      // このウィンドウは自アプリの index.html しか読み込まないため、リモートの信頼できないコンテンツを
      // 実行するリスクはない。
      webSecurity: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'index.html'));

  // 外部リンクは既定のブラウザで開く(アプリ内には表示しない)
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
