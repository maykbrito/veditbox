require('@electron/remote/main').initialize()

const { app, ipcMain, BrowserWindow, clipboard, globalShortcut } = require('electron')

const { webpToGif } = require('../utils/webp-to-gif')

const fs = require('fs')
const path = require('path')
let win

ipcMain.on('dragstart', async (event, options) => {
  fs.writeFileSync(options.name, options.buffer)

  let file = await webpToGif(options.name)

  event.sender.startDrag({
    file,
    icon: path.join(__dirname, '..', '..', 'build/icon.png'),
  })
})

function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    width: 600,
    height: 480,
    vibrancy: 'hud',
    backgroundColor: '#121214',
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
