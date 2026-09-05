const assert = require('assert')
const { categoryOf, dateFromName } = require('../src/utils/media-kinds')

assert.equal(categoryOf('a.PNG'), 'image', 'extensao maiuscula')
assert.equal(categoryOf('a.jpeg'), 'image')
assert.equal(categoryOf('a.gif'), 'gif', 'gif nao e image')
assert.equal(categoryOf('a.mp4'), 'video')
assert.equal(categoryOf('a.wav'), 'audio')
assert.equal(categoryOf('index.json'), undefined, 'nao-midia')
assert.equal(categoryOf('.DS_Store'), undefined, 'dotfile sem extensao conhecida')
assert.equal(categoryOf('sem-extensao'), undefined)

// §4.1: 'arquivadas' e chave reservada do indice. So e seguro porque nenhum
// arquivo de midia pode se chamar assim — nao tem extensao conhecida.
assert.equal(categoryOf('arquivadas'), undefined, 'chave reservada nunca colide')

// nome gerado por CONSTANTS: new Date().toJSON().replace(/\W/g, '')
const d = dateFromName('20260905T144341144Z.mp4')
assert.equal(d.toISOString(), '2026-09-05T14:43:41.144Z')

// arquivo real da pasta do usuario
assert.equal(
  dateFromName('20241123T095133225Z.mp4').toISOString(),
  '2024-11-23T09:51:33.225Z',
)

assert.equal(dateFromName('foto-de-ferias.jpg'), null, 'arquivo de fora -> mtime')
assert.equal(dateFromName('2026.png'), null, 'prefixo parcial nao conta')
assert.equal(dateFromName('20261399T999999999Z.png'), null, 'data invalida -> null')

console.log('check-media-kinds: OK')
