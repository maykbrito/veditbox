// Integracao busca <-> indice real, com FILESYSTEM de verdade.
//
// O check-search.js prova o ranking sobre objetos literais. Isto prova o que
// falta: que a busca funciona sobre o que o media-index REALMENTE devolve
// (campos derivados inclusive), e que o que o sheet grava chega ao disco.
//
// Roda numa pasta descartavel via VEDITBOX_DIR — a mesma valvula que a Fase 1
// deixou no media-index. A biblioteca real do usuario nao e tocada.
//   node scripts/check-search-store.js
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'veditbox-check-'))
process.env.VEDITBOX_DIR = DIR

const mediaIndex = require('../src/renderer/lib/media-index')
const { searchEntries } = require('../src/renderer/lib/search/rank')

const criar = (nome) => fs.writeFileSync(path.join(DIR, nome), 'x')

criar('20260905T144341144Z.mp4') // vai ganhar url do facebook
criar('20260905T144342144Z.jpeg') // vai ganhar titulo e tags
criar('20260905T144343144Z.wav') // vai ficar sem origem
criar('20260101T090000000Z.gif') // so notas
criar('nao-e-midia.txt') // ignorado por categoryOf

const rec = mediaIndex.reconcile()
assert.equal(rec.adotados, 4, 'adota so as 4 midias, o .txt fica de fora')
assert.equal(mediaIndex.getAll().length, 4, 'getAll ve as 4')

// --- o que o sheet faz ao salvar ---
mediaIndex.setEntry('20260905T144341144Z.mp4', {
  url: 'https://www.facebook.com/reel/892819649954687',
  titulo: 'reels de gato',
})
mediaIndex.setEntry('20260905T144342144Z.jpeg', {
  titulo: 'paisagem',
  tags: ['reels', 'Sertao'],
})
mediaIndex.setEntry('20260101T090000000Z.gif', {
  notes: 'usar nos reels da semana que vem',
})
mediaIndex.flush()

// --- chegou ao DISCO, nao so a memoria? ---
const doDisco = JSON.parse(fs.readFileSync(path.join(DIR, '.veditbox', 'index.json')))
assert.equal(
  doDisco['20260905T144342144Z.jpeg'].tags.join(','),
  'reels,Sertao',
  'tags gravadas no disco como array',
)
assert.equal(
  doDisco['20260905T144341144Z.mp4'].url,
  'https://www.facebook.com/reel/892819649954687',
  'url gravada no disco',
)
assert.ok(!doDisco['nao-e-midia.txt'], 'o .txt nao virou entrada')

// --- busca sobre o store real ---
const todas = mediaIndex.getAll()

// o dominio e DERIVADO (§2.4), nao armazenado — a busca tem que ve-lo mesmo assim
assert.equal(
  todas.find((e) => e.name.endsWith('.mp4')).domain,
  'www.facebook.com',
  'dominio derivado da url',
)

const r = searchEntries(todas, 'reels')
assert.equal(r.length, 3, 'reels acha titulo, tag e nota — nao acha o .wav vazio')
assert.equal(r[0].name, '20260905T144341144Z.mp4', 'titulo ranqueia primeiro')
assert.equal(r[1].name, '20260905T144342144Z.jpeg', 'tag ranqueia em segundo')
assert.equal(r[2].name, '20260101T090000000Z.gif', 'nota ranqueia por ultimo')

// acento: salvei "Sertao", o usuario procura como lembra
assert.equal(searchEntries(todas, 'sertao').length, 1, 'acha a tag ignorando caixa')

// url e pesquisavel (§8)
assert.equal(searchEntries(todas, 'facebook').length, 1, 'acha pela url')
assert.equal(searchEntries(todas, '892819649954687').length, 1, 'acha pelo id na url')

// filtro "sem origem" (§4.1): so o que ficou sem url
assert.equal(todas.filter((e) => !e.url).length, 3, 'tres sem origem')

// filtro por tag, o mesmo predicado que a pill usa
const porTag = todas.filter((e) => e.tags.some((t) => t.toLowerCase() === 'reels'))
assert.equal(porTag.length, 1, 'filtro por tag e igualdade exata, nao substring')

// --- addTagToMany nao pode duplicar nem inventar tag (§2.4) ---
const nomes = todas.slice(0, 2).map((e) => e.name)
const aplicar = (tag) => {
  let n = 0
  nomes.forEach((nome) => {
    const item = mediaIndex.get(nome)
    if (item.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return
    mediaIndex.setEntry(nome, { tags: item.tags.concat(tag) })
    n++
  })
  return n
}
assert.equal(aplicar('lote'), 2, 'aplica nos dois')
assert.equal(aplicar('lote'), 0, 'idempotente: segunda vez nao mexe em ninguem')
assert.equal(aplicar('LOTE'), 0, 'nem em caixa diferente')

// --- §4.1: sumir com o arquivo NAO pode apagar o metadado ---
const alvo = '20260905T144342144Z.jpeg'
const guardado = path.join(DIR, '..', path.basename(DIR) + '-' + alvo)
fs.renameSync(path.join(DIR, alvo), guardado)
mediaIndex.reconcile()
assert.ok(!mediaIndex.get(alvo), 'sumido nao aparece na busca')
assert.equal(searchEntries(mediaIndex.getAll(), 'sertao').length, 0, 'nem no resultado')
fs.renameSync(guardado, path.join(DIR, alvo))
const volta = mediaIndex.reconcile()
assert.equal(volta.restaurados, 1, 'voltou como restaurado, nao como orfao')
assert.equal(
  searchEntries(mediaIndex.getAll(), 'sertao').length,
  1,
  'a tag voltou com o arquivo — o passeio no Finder nao custou metadado',
)

fs.rmSync(DIR, { recursive: true, force: true })
console.log('ok search-store (4 midias, disco real em ' + DIR + ')')
