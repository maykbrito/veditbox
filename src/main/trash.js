// Lixeira do sistema e restauracao. Vive no main porque shell.trashItem e
// main-only. Modulo proprio: o §10.1 torna src/main/index.js append-only, entao
// a logica fica aqui e o index.js ganha UMA linha de require no fim.
//
// CORRECAO AO CONTRATO §7 — medido, nao suposto:
// §7 afirma "trashItem coloca o arquivo em ~/.Trash com o mesmo nome". O "mesmo
// nome" confere; o "~/.Trash" NAO, para a biblioteca real desta maquina.
// ~/veditbox e symlink pro Google Drive (§4.1 ja registrava o symlink), e um
// arquivo de la vai parar em
//   ~/Library/CloudStorage/GoogleDrive-<conta>/.Trash/<mesmo nome>
// Medido: arquivo em pasta local -> ~/.Trash (true); arquivo em ~/veditbox ->
// ~/.Trash (false), Drive/.Trash (true).
//
// Por isso nao ha diretorio de Lixeira fixo aqui. O caminho para onde o arquivo
// FOI e descoberto na hora do delete e devolvido a quem chamou, que o guarda na
// pilha de undo. Undo vira um rename de caminho conhecido, sem adivinhacao.
const fs = require('fs')
const os = require('os')
const path = require('path')

const { ipcMain, shell } = require('electron')

const HOME_TRASH = path.join(os.homedir(), '.Trash')

// Nota: readdir em ~/.Trash e EPERM (TCC do macOS) mesmo para o app, mas
// existsSync/statSync num caminho especifico funciona — verificado. Por isso
// tudo aqui e por caminho exato, nunca listagem.

// Candidatas onde o macOS pode ter posto o arquivo, da mais provavel (o
// ancestral mais proximo) pra menos. Cobre volume proprio (.Trashes/<uid>),
// container de nuvem (Drive/.Trash) e a Lixeira do usuario.
function candidatasDeLixeira(filePath) {
  const lista = []
  let dir = path.dirname(realOuMesmo(filePath))
  const raiz = path.parse(dir).root

  while (true) {
    lista.push(path.join(dir, '.Trash'))
    lista.push(path.join(dir, '.Trashes', String(process.getuid())))
    if (dir === raiz) break
    dir = path.dirname(dir)
  }

  lista.push(HOME_TRASH)
  return [...new Set(lista)]
}

function realOuMesmo(p) {
  try {
    return fs.realpathSync(p)
  } catch (erro) {
    return p
  }
}

// Descobre pra onde o arquivo foi: so aceita a candidata que GANHOU o nome
// agora. Sem o retrato anterior, um homonimo velho em outra Lixeira poderia
// ser restaurado no lugar do arquivo certo.
function ondeCaiu(candidatas, tinhaAntes, nome) {
  for (const dir of candidatas) {
    const alvo = path.join(dir, nome)
    if (!tinhaAntes.has(alvo) && fs.existsSync(alvo)) return alvo
  }
  return null
}

// Relata por item: um lote pode falhar pela metade e a UI precisa saber quais.
// Nao lanca. ok = [{ path, trashedPath }] — trashedPath pode ser null se o
// arquivo foi pra Lixeira mas nao achamos onde (undo daquele item vai falhar e
// AVISAR, que e o comportamento pedido por §7).
const trashFiles = async (filePaths) => {
  const ok = []
  const fail = []

  for (const filePath of filePaths) {
    try {
      if (!filePath) throw new Error('caminho vazio')

      const nome = path.basename(filePath)
      const candidatas = candidatasDeLixeira(filePath)
      const tinhaAntes = new Set(
        candidatas.map((d) => path.join(d, nome)).filter((p) => fs.existsSync(p)),
      )

      await shell.trashItem(filePath)

      ok.push({ path: filePath, trashedPath: ondeCaiu(candidatas, tinhaAntes, nome) })
    } catch (erro) {
      fail.push({ path: filePath, error: erro.message })
    }
  }

  return { ok, fail }
}

// Undo best-effort (§7): Lixeira esvaziada ou arquivo renomeado la dentro =>
// falha e AVISA. Nunca finge sucesso.
// items = [{ name, trashedPath }]
const untrashFiles = async (items, destDir) => {
  const ok = []
  const fail = []

  for (const { name, trashedPath } of items) {
    const destino = path.join(destDir, name)

    try {
      if (!trashedPath) throw new Error('nao sabemos pra onde foi na Lixeira')
      if (!fs.existsSync(trashedPath)) throw new Error('nao esta mais na Lixeira')
      if (fs.existsSync(destino)) {
        throw new Error('ja existe um arquivo com esse nome na pasta')
      }

      try {
        fs.renameSync(trashedPath, destino)
      } catch (erro) {
        // Lixeira em outro volume que a pasta: rename nao atravessa, copia sim
        if (erro.code !== 'EXDEV') throw erro
        fs.copyFileSync(trashedPath, destino)
        fs.unlinkSync(trashedPath)
      }

      ok.push(name)
    } catch (erro) {
      fail.push({ name, error: erro.message })
    }
  }

  return { ok, fail }
}

// Handlers ipc sao wrappers finos de proposito: a logica fica nas funcoes acima
// pra que scripts/check-trash-roundtrip.js possa chama-las sem simular renderer.
ipcMain.handle('trash-files', (_evento, filePaths) => trashFiles(filePaths))
ipcMain.handle('untrash-files', (_evento, items, destDir) => untrashFiles(items, destDir))

module.exports = { HOME_TRASH, candidatasDeLixeira, trashFiles, untrashFiles }
