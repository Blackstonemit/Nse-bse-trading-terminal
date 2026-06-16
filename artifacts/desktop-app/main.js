process.env.TZ = 'Asia/Kolkata';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const net = require('net');

let serverProcess = null;
let mainWindow = null;

// Find a free port starting from 3001
function getFreePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      resolve(getFreePort(startPort + 1));
    });
    server.listen(startPort, '127.0.0.1', () => {
      server.close(() => {
        resolve(startPort);
      });
    });
  });
}

// Poll backend health check until it responds
async function waitForServer(port) {
  const url = `http://127.0.0.1:${port}/api/healthz`;
  let attempts = 0;
  const maxAttempts = 50;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch (err) {
      // Ignore connection errors during startup
    }
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Server failed to start in time.");
}

async function startServerAndApp() {
  const port = await getFreePort(3001);
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'database.db');

  console.log(`Starting backend on port ${port}...`);
  console.log(`Database path: ${dbPath}`);

  const serverPath = app.isPackaged 
    ? path.join(__dirname, 'app-dist/artifacts/api-server/dist/index.mjs')
    : path.resolve(__dirname, '../api-server/dist/index.mjs');

  const env = {
    ...process.env,
    PORT: String(port),
    DATABASE_URL: `file:${dbPath}`,
    NODE_ENV: 'production',
    TZ: 'Asia/Kolkata'
  };

  serverProcess = fork(serverPath, [], {
    env,
    stdio: 'inherit'
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start server process:', err);
  });

  serverProcess.on('exit', (code) => {
    console.log(`Server process exited with code ${code}`);
    if (code !== 0 && code !== null) {
      app.quit();
    }
  });

  await waitForServer(port);
  createWindow(port);
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false, // Show once maximized
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.maximize();
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock
const additionalData = { myKey: 'nse-bse-trading-terminal' };
const gotTheLock = app.requestSingleInstanceLock(additionalData);

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(startServerAndApp);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
