(async () => {
  const fs = require('fs'), path = require('path'), os = require('os')
  const { ipcRenderer, shell } = require('electron')
  const LIB = path.join(os.homedir(), 'veditbox')
  const out = {}

  const criar = (nome) => {
    const p = path.join(LIB, nome)
    fs.writeFileSync(p, 'diagnostico')
    return p
  }
  const tentar = async (rotulo, fn) => {
    try { const r = await fn(); out[rotulo] = 'OK' + (r === undefined ? '' : ' ' + JSON.stringify(r)) }
    catch (e) { out[rotulo] = 'FALHOU: ' + (e && e.message ? e.message : String(e)) }
  }

  // 1) escrita simples na biblioteca
  let a
  await tentar('1_criar_arquivo', () => { a = criar('zz-diag-a.txt'); return fs.existsSync(a) })

  // 2) rename dentro da biblioteca (mesmo volume)
  await tentar('2_rename_local', () => {
    const b = path.join(LIB, 'zz-diag-b.txt')
    fs.renameSync(a, b); fs.renameSync(b, a); return true
  })

  // 3) unlink direto (apagar permanente)
  const c = criar('zz-diag-c.txt')
  await tentar('3_unlink_direto', () => { fs.unlinkSync(c); return !fs.existsSync(c) })

  // 4) shell.trashItem chamado do RENDERER
  const d = criar('zz-diag-d.txt')
  await tentar('4_trashItem_renderer', async () => { await shell.trashItem(d); return !fs.existsSync(d) })

  // 5) o caminho REAL do app: ipc pro main
  const e = criar('zz-diag-e.txt')
  await tentar('5_ipc_trash_files_ARQUIVO_NOVO', () => ipcRenderer.invoke('trash-files', [e]))

  // 6) o caso que falha pro usuario: arquivo JA sincronizado pelo Drive
  const alvo = path.join(LIB, 'zz-PODE-APAGAR-teste1.jpeg')
  out['6_alvo_existe'] = fs.existsSync(alvo)
  if (fs.existsSync(alvo)) {
    await tentar('6_ipc_trash_files_ARQUIVO_SINCRONIZADO', () => ipcRenderer.invoke('trash-files', [alvo]))
    out['6_sumiu'] = !fs.existsSync(alvo)
  }

  // limpeza do que sobrou
  for (const n of ['zz-diag-a.txt','zz-diag-b.txt','zz-diag-c.txt','zz-diag-d.txt','zz-diag-e.txt']) {
    const p = path.join(LIB, n); try { if (fs.existsSync(p)) fs.unlinkSync(p) } catch {}
  }
  out['_processo'] = process.execPath
  return out
})()
