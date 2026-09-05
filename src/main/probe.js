// Aparato de verificacao do design doc §12: mede o app RODANDO, nao compilando.
//
// Inerte sem a variavel de ambiente. Nao e codigo de teste solto no main: e um
// modulo proprio, plugado via `app.on('browser-window-created')` — que nao
// precisa da variavel `win` do index.js, que nao e exportada. Isso mantem
// `src/main/index.js` append-only, como manda o §10.1 do contrato.
//
//   VEDITBOX_PROBE=chrome-metrics yarn start
//
// Ver tools/probes/README.md.

if (process.env.VEDITBOX_PROBE) {
  const fs = require('fs')
  const path = require('path')
  const { app } = require('electron')

  const nome = process.env.VEDITBOX_PROBE
  const arquivo = path.join(__dirname, '..', '..', 'tools', 'probes', `${nome}.js`)

  app.on('browser-window-created', (_evento, win) => {
    const erros = []
    win.webContents.on('console-message', (_e, nivel, msg) => {
      // nivel: 0 verbose, 1 info, 2 warning, 3 error
      if (nivel >= 2) erros.push(`[${nivel}] ${msg}`)
    })

    win.webContents.once('did-finish-load', async () => {
      try {
        const script = fs.readFileSync(arquivo, 'utf8')
        // 400ms: da tempo do Lit registrar os custom elements e do layout assentar
        await new Promise((r) => setTimeout(r, 400))
        const resultado = await win.webContents.executeJavaScript(script)
        const img = await win.capturePage()
        fs.writeFileSync(`/tmp/veditbox-probe-${nome}.png`, img.toPNG())
        console.log(`PROBE ${nome} ${JSON.stringify({ ...resultado, erros }, null, 2)}`)
        app.exit(0)
      } catch (erro) {
        console.error(`PROBE ${nome} FALHOU: ${erro.stack}`)
        app.exit(1)
      }
    })
  })
}
