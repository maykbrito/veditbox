// Logica pura da Fase 3 (design doc §12): roda em node, sem Electron e sem DOM.
// Rode: node scripts/check-search.js
const assert = require('assert')
const { isTypingTarget } = require('../src/utils/is-typing-target')

const el = (tagName, extra = {}) => ({ tagName, isContentEditable: false, ...extra })

assert.equal(isTypingTarget(el('INPUT')), true, 'input digita')
assert.equal(isTypingTarget(el('TEXTAREA')), true, 'textarea digita')
assert.equal(isTypingTarget(el('SELECT')), true, 'select captura teclas')
assert.equal(
  isTypingTarget(el('DIV', { isContentEditable: true })),
  true,
  'contenteditable digita',
)
assert.equal(isTypingTarget(el('DIV')), false, 'div comum nao digita')
assert.equal(isTypingTarget(el('BODY')), false, 'body nao digita')
assert.equal(isTypingTarget(null), false, 'alvo nulo nao quebra')
assert.equal(isTypingTarget(undefined), false, 'alvo indefinido nao quebra')

// O <uk-input-tag> do Franken e um custom element: o input real vive no shadow
// DOM, entao e.target no window vira o HOST, nao o <input>. Sem isto, digitar
// uma tag no sheet dispara a gravacao de audio.
assert.equal(
  isTypingTarget(el('UK-INPUT-TAG')),
  true,
  'custom element de input do franken digita',
)

console.log('ok is-typing-target')

const { searchEntries, scoreEntry, normalizar } = require('../src/renderer/lib/search/rank')

const entrada = (over) => ({ name: 'x.mp4', url: '', titulo: '', tags: [], notes: '', ...over })

const porTitulo = entrada({ name: 'a.mp4', titulo: 'reels de gato' })
const porTag = entrada({ name: 'b.mp4', tags: ['reels'] })
const porNota = entrada({ name: 'c.mp4', notes: 'usar nos reels da semana' })
const porUrl = entrada({ name: 'd.mp4', url: 'https://facebook.com/reel/892819649954687' })
const nada = entrada({ name: 'e.mp4', titulo: 'paisagem' })

// §8: ranking titulo > tag > nota, e url e o menor peso
assert.ok(scoreEntry(porTitulo, 'reels') > scoreEntry(porTag, 'reels'), 'titulo bate tag')
assert.ok(scoreEntry(porTag, 'reels') > scoreEntry(porNota, 'reels'), 'tag bate nota')
assert.ok(scoreEntry(porNota, 'reel') > scoreEntry(porUrl, 'reel'), 'nota bate url')
assert.equal(scoreEntry(nada, 'reels'), 0, 'sem casamento pontua zero')

const r = searchEntries([porNota, porUrl, nada, porTitulo, porTag], 'reels')
assert.deepEqual(r.map((e) => e.name), ['a.mp4', 'b.mp4', 'c.mp4'], 'ordem por relevancia, sem os que nao casam')

// substring, nao prefixo
assert.ok(scoreEntry(entrada({ titulo: 'meus reels' }), 'eel') > 0, 'casa no meio da palavra')
// case e acento: o usuario digita a tag como lembra, nao como salvou
assert.ok(scoreEntry(entrada({ tags: ['Sertao'] }), 'sertao') > 0, 'ignora caixa')
assert.ok(scoreEntry(entrada({ tags: ['Sert\u00e3o'] }), 'sertao') > 0, 'ignora acento')
assert.ok(scoreEntry(entrada({ tags: ['sertao'] }), 'Sert\u00e3o') > 0, 'acento na query tambem')

// query vazia devolve tudo: Cmd+K abre mostrando a biblioteca
assert.equal(searchEntries([porTitulo, porTag], '   ').length, 2, 'query vazia devolve tudo')
assert.equal(searchEntries([porTitulo, porTag], '')[0].name, 'a.mp4', 'query vazia preserva a ordem original')

// varios termos: AND entre eles, cada um pode casar em campo diferente
assert.equal(searchEntries([entrada({ titulo: 'reels de gato' })], 'reels gato').length, 1, 'AND entre termos')
assert.equal(searchEntries([entrada({ titulo: 'reels de gato' })], 'reels cachorro').length, 0, 'termo ausente elimina')
assert.equal(
  searchEntries([entrada({ titulo: 'reels', tags: ['gato'] })], 'reels gato').length,
  1,
  'termos podem casar em campos diferentes',
)

// robustez: o indice real tem entradas com campos ausentes (orfao adotado)
assert.equal(scoreEntry({ name: 'z.mp4' }, 'x'), 0, 'entrada sem campos nao quebra')
assert.equal(searchEntries([{ name: 'z.mp4' }], 'x').length, 0, 'entrada sem campos nao casa')
assert.equal(normalizar(null), '', 'normalizar aguenta null')

// tag com mais de uma palavra nao pode casar por juncao acidental de duas tags
assert.equal(scoreEntry(entrada({ tags: ['gato', 'preto'] }), 'gatopreto'), 0, 'tags nao se colam')

console.log('ok rank')
