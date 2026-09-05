const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veditbox-check-'))
process.env.VEDITBOX_DIR = dir

const store = require('../src/renderer/lib/media-index')

const escrever = (nome) => fs.writeFileSync(path.join(dir, nome), 'x')
const lerCru = () => JSON.parse(fs.readFileSync(store.INDEX_PATH, 'utf8'))

// --- reconciliacao adota orfaos ---
escrever('20260905T144341144Z.mp4')
escrever('20260905T144342000Z.png')
escrever('index.json') // nao-midia: deve ser ignorado
let r = store.reconcile()
assert.equal(r.adotados, 2, 'adotou os dois arquivos de midia')
assert.equal(r.arquivados, 0)
assert.equal(store.getAll().length, 2, 'index.json nao virou item')
assert.equal(store.get('20260905T144341144Z.mp4').url, '', 'orfao nasce sem url')
assert.deepEqual(
  store.get('20260905T144341144Z.mp4').tags,
  [],
  'app nao escreve em tags',
)

// --- derivacoes ---
const item = store.get('20260905T144341144Z.mp4')
assert.equal(item.category, 'video')
assert.equal(item.date.toISOString(), '2026-09-05T14:43:41.144Z')
assert.equal(item.domain, '', 'sem url -> sem dominio')
assert.equal(item.filePath, path.join(dir, '20260905T144341144Z.mp4'))

// --- ordenacao: mais novo primeiro ---
assert.equal(store.getAll()[0].name, '20260905T144342000Z.png')

// --- escrita e dominio derivado ---
store.setEntry('20260905T144341144Z.mp4', {
  url: 'https://www.facebook.com/reel/892819649954687',
  titulo: 'reel',
})
assert.equal(store.get('20260905T144341144Z.mp4').domain, 'www.facebook.com')
assert.equal(store.get('20260905T144341144Z.mp4').titulo, 'reel')

// --- §4.1 debounce: setEntry NAO grava no disco na hora ---
const cruAntesDoFlush = lerCru()
assert.equal(
  cruAntesDoFlush['20260905T144341144Z.mp4'].titulo,
  '',
  'debounce: disco ainda tem o valor antigo',
)
store.flush()
assert.equal(
  lerCru()['20260905T144341144Z.mp4'].titulo,
  'reel',
  'flush() gravou o pendente',
)

// --- flush sem nada pendente e no-op, nao explode ---
store.flush()
store.flush()

// --- §3.1: schema tem 4 campos, sem largura/altura ---
const campos = Object.keys(lerCru()['20260905T144341144Z.mp4']).sort()
assert.deepEqual(
  campos,
  ['notes', 'tags', 'titulo', 'url'],
  'schema so tem os 4 campos do §3 apos a emenda 3.1',
)

// --- patch com chave fora do schema e ignorado ---
store.setEntry('20260905T144341144Z.mp4', {
  category: 'audio',
  largura: 720,
  lixo: 1,
})
store.flush()
const cru2 = lerCru()['20260905T144341144Z.mp4']
assert.equal(cru2.category, undefined, 'derivavel nao entra')
assert.equal(cru2.largura, undefined, '§3.1: dimensao nao entra mais')
assert.equal(cru2.lixo, undefined)

// --- escrita atomica: nao sobra .tmp ---
assert.ok(
  !fs.existsSync(store.INDEX_PATH + '.tmp'),
  'o tmp foi renomeado, nao deixado para tras',
)

// --- §4.1 TOMBSTONE: entrada sem arquivo e arquivada, nao deletada ---
fs.unlinkSync(path.join(dir, '20260905T144342000Z.png'))
escrever('20260905T144343000Z.wav')
r = store.reconcile()
assert.equal(r.arquivados, 1)
assert.equal(r.adotados, 1)
assert.equal(
  store.get('20260905T144342000Z.png'),
  undefined,
  'tombstone nao aparece em get()',
)
assert.ok(
  !store.getAll().some((i) => i.name === '20260905T144342000Z.png'),
  'tombstone nao aparece no grid',
)
assert.ok(
  lerCru().arquivadas['20260905T144342000Z.png'],
  'mas continua no disco, na secao arquivadas',
)
assert.equal(
  store.get('20260905T144341144Z.mp4').titulo,
  'reel',
  'metadado do sobrevivente preservado',
)

// --- §4.1 RESTAURACAO: arquivo volta com o mesmo nome -> metadados voltam ---
store.setEntry('20260905T144343000Z.wav', { titulo: 'nota de voz', tags: ['ideia'] })
store.flush()
fs.unlinkSync(path.join(dir, '20260905T144343000Z.wav'))
store.reconcile()
assert.equal(store.get('20260905T144343000Z.wav'), undefined, 'arquivado')
escrever('20260905T144343000Z.wav')
r = store.reconcile()
assert.equal(r.restaurados, 1, 'reapareceu -> restaurado, nao adotado')
assert.equal(r.adotados, 0, 'nao conta como orfao novo')
assert.equal(
  store.get('20260905T144343000Z.wav').titulo,
  'nota de voz',
  'passeio no Finder NAO destroi metadado do usuario',
)
assert.deepEqual(store.get('20260905T144343000Z.wav').tags, ['ideia'])
assert.equal(
  lerCru().arquivadas['20260905T144343000Z.wav'],
  undefined,
  'saiu da secao arquivadas ao voltar',
)

// --- 'arquivadas' nunca vira item do grid ---
assert.ok(
  !store.getAll().some((i) => i.name === 'arquivadas'),
  'chave reservada nao e midia',
)

// --- filesystem vence: reconciliar nunca cria nem apaga arquivo ---
const antes = fs.readdirSync(dir).sort()
store.reconcile()
assert.deepEqual(fs.readdirSync(dir).sort(), antes, 'a pasta nao foi tocada')

// --- json corrompido nao derruba o app ---
fs.writeFileSync(store.INDEX_PATH, '{ isso nao e json')
r = store.reconcile()
assert.equal(r.adotados, 2, 'recomeca do zero adotando tudo que existe')

// --- removeEntry mexe no indice, NAO no arquivo ---
store.removeEntry('20260905T144341144Z.mp4')
store.flush()
assert.equal(store.get('20260905T144341144Z.mp4'), undefined)
assert.ok(
  fs.existsSync(path.join(dir, '20260905T144341144Z.mp4')),
  'removeEntry nao apaga midia',
)
assert.equal(
  (lerCru().arquivadas || {})['20260905T144341144Z.mp4'],
  undefined,
  'delete explicito da fase 2 nao vira tombstone — o usuario mandou apagar',
)

// --- addEntry: adota um arquivo novo sem varrer a pasta ---
escrever('20260905T144344000Z.jpg')
const novo = store.addEntry('20260905T144344000Z.jpg')
assert.equal(novo.category, 'image')
assert.equal(novo.url, '')

// --- addEntry tambem restaura de tombstone ---
escrever('20260905T144345000Z.png')
store.reconcile()
store.setEntry('20260905T144345000Z.png', { titulo: 'antes' })
store.flush()
fs.unlinkSync(path.join(dir, '20260905T144345000Z.png'))
store.reconcile()
escrever('20260905T144345000Z.png')
assert.equal(
  store.addEntry('20260905T144345000Z.png').titulo,
  'antes',
  'addEntry resgata o tombstone em vez de nascer vazio',
)

// --- arquivo de fora: data vem do mtime ---
escrever('foto-de-ferias.jpg')
store.reconcile()
const deFora = store.get('foto-de-ferias.jpg')
assert.ok(deFora.date instanceof Date && !Number.isNaN(deFora.date.getTime()))

// --- url invalida nao explode a derivacao de dominio ---
store.setEntry('foto-de-ferias.jpg', { url: 'nao e uma url' })
assert.equal(store.get('foto-de-ferias.jpg').domain, '')

// --- tags corrompidas no json nao viram crash ---
store.flush()
const sujo = lerCru()
sujo['foto-de-ferias.jpg'].tags = 'nao e array'
fs.writeFileSync(store.INDEX_PATH, JSON.stringify(sujo))
store.reconcile()
assert.deepEqual(store.get('foto-de-ferias.jpg').tags, [], 'normaliza tags')

store.flush()
fs.rmSync(dir, { recursive: true, force: true })
console.log('check-media-index: OK')
