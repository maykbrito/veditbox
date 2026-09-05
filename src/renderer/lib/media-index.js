const fs = require('fs')
const path = require('path')

const { CONSTANTS } = require('../../utils/constants')
const { categoryOf, dateFromName } = require('../../utils/media-kinds')

// VEDITBOX_DIR existe para os scripts de verificacao rodarem numa pasta
// descartavel. Em producao ninguem define, e vale a pasta real.
const LIB_DIR = process.env.VEDITBOX_DIR || CONSTANTS.destDownloadFolder
const META_DIR = path.join(LIB_DIR, '.veditbox')
const INDEX_PATH = path.join(META_DIR, 'index.json')

// §2.4 + §3.1: so entra aqui o que NAO da pra derivar. Tipo, data e dominio
// ficam de fora porque sao derivaveis; largura/altura sairam por nao terem
// consumidor e o @ffmpeg-installer nao embarcar ffprobe.
const CAMPOS = ['url', 'titulo', 'tags', 'notes']

// §4.1: tombstones vivem sob esta chave. Ela nunca colide com um nome de
// arquivo porque a chave do indice inclui a extensao, e `arquivadas` sem
// extensao nunca passa por categoryOf().
const ARQUIVADAS = 'arquivadas'

// §4.1: ~/veditbox ja e symlink pro Google Drive. Sem debounce, editar tags
// viraria um upload por tecla digitada.
const DEBOUNCE_MS = 500

const entradaVazia = () => ({ url: '', titulo: '', tags: [], notes: '' })

let dados = {} // { nome: entradaCrua }  — so o que existe na pasta
let arquivadas = {} // { nome: entradaCrua }  — tombstones
let timer = null

function ler() {
  try {
    const cru = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'))
    return cru && typeof cru === 'object' && !Array.isArray(cru) ? cru : {}
  } catch (error) {
    // arquivo ausente ou corrompido. O filesystem e a fonte de verdade
    // (§2.1), entao perder o indice custa metadado, nunca midia.
    return {}
  }
}

// §4: tmp + rename. rename e atomico no mesmo volume, entao uma queda no meio
// preserva o indice anterior em vez de deixar um json pela metade.
function gravarAgora() {
  const saida = { ...dados }
  if (Object.keys(arquivadas).length) saida[ARQUIVADAS] = arquivadas

  fs.mkdirSync(META_DIR, { recursive: true })
  const tmp = INDEX_PATH + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(saida, null, 2))
  fs.renameSync(tmp, INDEX_PATH)
}

function agendarGravacao() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    gravarAgora()
  }, DEBOUNCE_MS)
  // nao segura o processo vivo so por causa de uma gravacao pendente
  if (timer.unref) timer.unref()
}

// Forca a gravacao pendente. Sem isso, fechar o app dentro dos 500ms de
// debounce perderia a ultima edicao em silencio.
function flush() {
  if (!timer) return
  clearTimeout(timer)
  timer = null
  gravarAgora()
}

const normalizar = (entrada) => {
  const saida = entradaVazia()
  CAMPOS.forEach((campo) => {
    if (entrada && entrada[campo] !== undefined) saida[campo] = entrada[campo]
  })
  if (!Array.isArray(saida.tags)) saida.tags = []
  return saida
}

const dominioDe = (url) => {
  try {
    return new URL(url).hostname
  } catch (error) {
    return ''
  }
}

function derivar(nome) {
  const filePath = path.join(LIB_DIR, nome)
  let date = dateFromName(nome)
  if (!date) {
    // arquivo que o usuario trouxe de fora: sem timestamp no nome
    try {
      date = fs.statSync(filePath).mtime
    } catch (error) {
      date = new Date(0)
    }
  }
  return {
    name: nome,
    filePath,
    category: categoryOf(nome),
    date,
    domain: dominioDe(dados[nome].url),
    ...dados[nome],
  }
}

const arquivosDeMidia = () => {
  try {
    return fs.readdirSync(LIB_DIR).filter((nome) => categoryOf(nome))
  } catch (error) {
    return []
  }
}

// §4: roda so na abertura. Sem watcher. A pasta sempre vence sobre o que e
// EXIBIDO — mas metadado de arquivo sumido vira tombstone, nao lixo (§4.1).
function reconcile() {
  const cru = ler()
  arquivadas = {}
  Object.entries(cru[ARQUIVADAS] || {}).forEach(([nome, entrada]) => {
    arquivadas[nome] = normalizar(entrada)
  })

  const anteriores = {}
  Object.entries(cru).forEach(([nome, entrada]) => {
    if (nome !== ARQUIVADAS) anteriores[nome] = normalizar(entrada)
  })

  dados = {}
  let adotados = 0
  let restaurados = 0
  let arquivados = 0

  arquivosDeMidia().forEach((nome) => {
    if (anteriores[nome]) {
      dados[nome] = anteriores[nome]
    } else if (arquivadas[nome]) {
      // §4.1: o arquivo voltou com o mesmo nome — titulo, tags e notas voltam
      // com ele. E o passeio no Finder que motivou a emenda.
      dados[nome] = arquivadas[nome]
      delete arquivadas[nome]
      restaurados++
    } else {
      // orfao: adota com url vazia. NAO recebe tag automatica — o app nunca
      // escreve em tags, senao o usuario apagar a tag viraria disputa.
      dados[nome] = entradaVazia()
      adotados++
    }
  })

  Object.keys(anteriores).forEach((nome) => {
    if (dados[nome]) return
    arquivadas[nome] = anteriores[nome]
    arquivados++
  })

  // boot: grava sincrono, sem debounce. E uma vez so.
  if (adotados || arquivados || restaurados) gravarAgora()
  return { adotados, arquivados, restaurados }
}

// O nome e timestamp, mas arquivo trazido de fora nao tem. A data derivada
// cobre os dois casos; o nome so desempata.
const getAll = () =>
  Object.keys(dados)
    .map(derivar)
    .sort((a, b) => b.date - a.date || b.name.localeCompare(a.name))

const get = (nome) => (dados[nome] ? derivar(nome) : undefined)

function setEntry(nome, patch) {
  if (!dados[nome]) dados[nome] = entradaVazia()
  CAMPOS.forEach((campo) => {
    if (patch && patch[campo] !== undefined) dados[nome][campo] = patch[campo]
  })
  if (!Array.isArray(dados[nome].tags)) dados[nome].tags = []
  agendarGravacao()
  return derivar(nome)
}

function addEntry(nome) {
  if (!dados[nome]) {
    // se o arquivo ja teve metadado antes, resgata em vez de nascer vazio
    dados[nome] = arquivadas[nome] || entradaVazia()
    delete arquivadas[nome]
    agendarGravacao()
  }
  return derivar(nome)
}

// Exclusao explicita (Fase 2). Diferente da reconciliacao: aqui o usuario
// mandou apagar, entao nao vira tombstone.
function removeEntry(nome) {
  if (!dados[nome]) return
  delete dados[nome]
  agendarGravacao()
}

// O debounce so e seguro se alguem fechar a torneira ao sair.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flush)
}

module.exports = {
  INDEX_PATH,
  reconcile,
  getAll,
  get,
  setEntry,
  addEntry,
  removeEntry,
  flush,
}
