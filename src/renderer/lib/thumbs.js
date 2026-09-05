const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile } = require('child_process')

const { path: ffmpegPath } = require('@ffmpeg-installer/ffmpeg')

// §5: fora de ~/veditbox de proposito. A biblioteca e sincronizada (aqui e
// symlink pro Google Drive) e thumb e regeneravel — nao vale gastar cota
// sincronizando MBs que o ffmpeg refaz. O macOS limpa /tmp periodicamente;
// aceito, porque a geracao e preguicosa e a mediana medida e 0,022s.
const CACHE_DIR = path.join(os.tmpdir(), 'veditbox')

const MAX_SIMULTANEOS = 4

let rodando = 0
const fila = []
const emVoo = new Map() // nome -> Promise, evita gerar o mesmo thumb duas vezes

const thumbPath = (nome) => path.join(CACHE_DIR, nome + '.jpg')

// §5: thumb mais velho que o arquivo -> regenera. Usa mtime, sem guardar estado.
function estaFresco(item) {
  try {
    return (
      fs.statSync(thumbPath(item.name)).mtimeMs >= fs.statSync(item.filePath).mtimeMs
    )
  } catch (error) {
    return false
  }
}

// Medido nos 84 arquivos reais da pasta, nesta maquina:
//   -ss 1 (seek)  -> 27/84. Falha em TODA imagem parada: buscar 1s num PNG nao
//                    devolve frame nenhum e o ffmpeg escreve arquivo vazio.
//   thumbnail     -> 80/84, mediana 0,024s.
//   hibrido       -> 80/84, mediana 0,022s, pior caso 0,710s.
// Dai o ramo: imagem parada nao tem frame a escolher, so escala; video usa o
// filtro `thumbnail`, que pega um quadro representativo e nunca depende da
// duracao (um -ss fixo devolveria vazio em clipe curto ou frame preto).
const argumentosPara = (item, destino) => {
  const comum = ['-v', 'error', '-i', item.filePath]
  const filtro =
    item.category === 'video' ? 'thumbnail,scale=320:-1' : 'scale=320:-1'
  return [...comum, '-vf', filtro, '-frames:v', '1', '-y', destino]
}

function proximo() {
  if (rodando >= MAX_SIMULTANEOS || !fila.length) return
  rodando++
  const { item, resolver } = fila.shift()
  const destino = thumbPath(item.name)

  execFile(ffmpegPath, argumentosPara(item, destino), (erro) => {
    rodando--
    let deuCerto = !erro
    try {
      deuCerto = deuCerto && fs.statSync(destino).size > 0
    } catch (naoExiste) {
      deuCerto = false
    }
    // Falha esperada em dois casos reais desta pasta: webp animado (o decoder
    // do ffmpeg nao le, mas o Chromium le) e .mp4 de 0 byte (bug antigo do
    // yt-dlp, §7). Devolver o proprio arquivo resolve o primeiro e mostra
    // honestamente que o segundo esta quebrado.
    resolver(deuCerto ? destino : item.filePath)
    proximo()
  })
}

// Nunca rejeita: em qualquer falha resolve com o caminho do arquivo original.
// Quem chama poe direto no src de um <img> sem try/catch.
function getThumb(item) {
  // audio nao tem quadro; a celula usa o icone ♪ (§6)
  if (!item || item.category === 'audio') return Promise.resolve('')

  if (estaFresco(item)) return Promise.resolve(thumbPath(item.name))
  if (emVoo.has(item.name)) return emVoo.get(item.name)

  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  } catch (error) {
    return Promise.resolve(item.filePath)
  }

  const promessa = new Promise((resolver) => {
    fila.push({ item, resolver })
    proximo()
  }).then((caminho) => {
    emVoo.delete(item.name)
    return caminho
  })

  emVoo.set(item.name, promessa)
  return promessa
}

// §10: a Fase 2 chama isto ao apagar, em vez de montar o caminho a mao.
// Se o padrao de nome mudar, quem muda e a dona.
function deleteThumb(nome) {
  try {
    fs.unlinkSync(thumbPath(nome))
  } catch (error) {
    // thumb nao existia: nada a fazer
  }
}

module.exports = { CACHE_DIR, thumbPath, getThumb, deleteThumb }
