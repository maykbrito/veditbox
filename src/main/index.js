require('@electron/remote/main').initialize()

const { app, ipcMain, BrowserWindow, globalShortcut } = require('electron')

const { webpToGif } = require('../utils/webp-to-gif')

const path = require('path')
let win

ipcMain.on('dragfile', async (event, filePath) => {
  event.sender.startDrag({
    file: await webpToGif(filePath),
    icon: path.join(__dirname, '..', '..', 'build/icon.png'),
  })
})

function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    width: 600,
    height: 480,
    vibrancy: 'hud',
    titleBarStyle: 'hiddenInset',
    // botoes tem 12px: y=12 centra em 18, igual ao centro do #topBar (36px de altura)
    // x=13 centra o grupo (52px) na sidebar de 78px
    trafficLightPosition: { x: 13, y: 12 },
    backgroundColor: '#121214',
    // <remove frame>
    // transparent: true,
    // frame: false,
    // titleBarStyle: "customButtonsOnHover",
    // </remove-frame>
    acceptFirstMouse: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  })

  // and load the index.html of the app.
  win.loadFile('src/renderer/index.html')

  require("@electron/remote/main").enable(win.webContents)
}

let isRecording = false
function createShortcuts() {
  globalShortcut.register('Alt+Shift+Control+a', () =>
    win.webContents.send('screenRecorderSelectSource'),
  )

  globalShortcut.register('Alt+Shift+Control+s', () => {
    if (!isRecording) {
      win.webContents.send('startScreenRecorder')
    } else {
      win.webContents.send('stopScreenRecorder')
    }
    isRecording = !isRecording
  })
}

app.whenReady().then(createWindow).then(createShortcuts)

// Probe de verificacao (design doc §12) — inerte sem VEDITBOX_PROBE
require('./probe')
