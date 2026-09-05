// Verificacao da logica pura de selecao. Roda com:
//   node scripts/check-selection-range.js
const assert = require('assert')

const sel = require('../src/renderer/lib/selection/selection')

const ordem = ['a', 'b', 'c', 'd', 'e']

// rangeBetween e inclusivo nas duas pontas e independe da direcao
assert.deepStrictEqual(sel.rangeBetween('b', 'd', ordem), ['b', 'c', 'd'], 'range pra frente')
assert.deepStrictEqual(sel.rangeBetween('d', 'b', ordem), ['b', 'c', 'd'], 'range pra tras')
assert.deepStrictEqual(sel.rangeBetween('c', 'c', ordem), ['c'], 'range de um item so')
assert.deepStrictEqual(sel.rangeBetween('z', 'c', ordem), [], 'ancora fora da lista')
assert.deepStrictEqual(sel.rangeBetween('c', 'z', ordem), [], 'alvo fora da lista')

// toggle alterna e fixa ancora
sel.clear()
sel.toggle('b')
assert.strictEqual(sel.has('b'), true, 'toggle seleciona')
assert.strictEqual(sel.count(), 1, 'contagem apos toggle')
sel.toggle('b')
assert.strictEqual(sel.has('b'), false, 'toggle desseleciona')
assert.strictEqual(sel.count(), 0, 'contagem apos destoggle')

// shift+clique estende a partir da ancora
sel.clear()
sel.toggle('b')
sel.extendTo('d', ordem)
assert.deepStrictEqual(sel.names().sort(), ['b', 'c', 'd'], 'extendTo cobre o intervalo')

// extender de novo, mais curto, NAO deixa lixo do intervalo anterior (Finder)
sel.extendTo('c', ordem)
assert.deepStrictEqual(sel.names().sort(), ['b', 'c'], 'extendTo encolhe sem deixar residuo')

// extendTo sem ancora se comporta como toggle
sel.clear()
sel.extendTo('c', ordem)
assert.deepStrictEqual(sel.names(), ['c'], 'extendTo sem ancora vira toggle')

// selectAll respeita a lista recebida (§10.5: quem chama passa getAll() filtrado
// pela aba, nunca o DOM)
sel.clear()
sel.selectAll(['b', 'c'])
assert.deepStrictEqual(sel.names().sort(), ['b', 'c'], 'selectAll usa a lista recebida')

// selectAll de 90 nomes seleciona 90, mesmo que so 60 estejam na tela.
// E o numero da armadilha do §10.5, fixado como asserção.
sel.clear()
const noventa = Array.from({ length: 90 }, (_, i) => `f${i}.mp4`)
sel.selectAll(noventa)
assert.strictEqual(sel.count(), 90, `selectAll de 90 selecionou ${sel.count()}`)

// clear zera ancora tambem: extendTo depois nao ressuscita intervalo antigo
sel.clear()
assert.strictEqual(sel.count(), 0, 'clear zera')
sel.extendTo('e', ordem)
assert.deepStrictEqual(sel.names(), ['e'], 'clear zerou a ancora')

// remove() tira nomes que sumiram (usado depois de apagar)
sel.clear()
sel.selectAll(ordem)
sel.remove(['a', 'c'])
assert.deepStrictEqual(sel.names().sort(), ['b', 'd', 'e'], 'remove tira os nomes dados')

// onChange dispara em toda mutacao
let disparos = 0
sel.onChange(() => disparos++)
sel.clear()
sel.toggle('a')
sel.selectAll(ordem)
sel.clear()
assert.strictEqual(disparos, 4, `onChange disparou ${disparos}x, esperado 4`)

console.log('ok: logica de selecao')
