// Verifica Lixeira + restauracao com arquivos REAIS, na pasta REAL da
// biblioteca (que nesta maquina e symlink pro Google Drive — e por isso que a
// afirmacao "vai pra ~/.Trash" do contrato §7 nao vale aqui).
// Roda com:
//   ./node_modules/.bin/electron scripts/check-trash-roundtrip.js
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const { app } = require('electron')

// Chama as funcoes puras direto, sem passar por ipc: sao elas que tem a logica,
// e o handler ipc e so um wrapper.
const { trashFiles, untrashFiles } = require('../src/main/trash')

const destDir = path.join(os.homedir(), 'veditbox')

app.whenReady().then(async () => {
  try {
    fs.mkdirSync(destDir, { recursive: true })

    const nome = `check-trash-${Date.now()}.txt`
    const alvo = path.join(destDir, nome)
    const conteudo = 'conteudo que precisa sobreviver ao roundtrip'
    fs.writeFileSync(alvo, conteudo)

    // 1. vai pra Lixeira, e sabemos PRA ONDE foi
    const r1 = await trashFiles([alvo])
    assert.deepStrictEqual(r1.fail, [], `trash falhou: ${JSON.stringify(r1.fail)}`)
    assert.strictEqual(fs.existsSync(alvo), false, 'arquivo ainda esta na pasta')

    const { trashedPath } = r1.ok[0]
    assert.ok(trashedPath, 'nao descobrimos pra onde o arquivo foi na Lixeira')
    assert.strictEqual(path.basename(trashedPath), nome, 'nome mudou na Lixeira')
    assert.strictEqual(fs.existsSync(trashedPath), true, 'nao esta no caminho relatado')
    console.log(`  lixeira usada: ${path.dirname(trashedPath)}`)

    // 2. volta intacto
    const r2 = await untrashFiles([{ name: nome, trashedPath }], destDir)
    assert.deepStrictEqual(r2.fail, [], `untrash falhou: ${JSON.stringify(r2.fail)}`)
    assert.strictEqual(fs.existsSync(alvo), true, 'arquivo nao voltou pra pasta')
    assert.strictEqual(fs.readFileSync(alvo, 'utf8'), conteudo, 'conteudo corrompido')

    // 3. undo de arquivo que sumiu da Lixeira FALHA, nao finge sucesso (§7)
    const r3 = await untrashFiles(
      [{ name: 'sumiu.txt', trashedPath: path.join(os.tmpdir(), 'nao-existe-999.txt') }],
      destDir,
    )
    assert.strictEqual(r3.ok.length, 0, 'reportou ok pra arquivo inexistente')
    assert.strictEqual(r3.fail.length, 1, 'nao reportou a falha')

    // 3b. undo sem saber onde caiu tambem falha e avisa
    const r3b = await untrashFiles([{ name: 'x.txt', trashedPath: null }], destDir)
    assert.strictEqual(r3b.fail.length, 1, 'trashedPath null deveria falhar')

    // 4. undo nao sobrescreve arquivo existente na pasta
    const nomeOcupado = `check-ocupado-${Date.now()}.txt`
    const ocupado = path.join(destDir, nomeOcupado)
    fs.writeFileSync(ocupado, 'original')
    const daLixeira = path.join(os.tmpdir(), nomeOcupado)
    fs.writeFileSync(daLixeira, 'da lixeira')
    const r4 = await untrashFiles([{ name: nomeOcupado, trashedPath: daLixeira }], destDir)
    assert.strictEqual(r4.fail.length, 1, 'sobrescreveu arquivo existente')
    assert.strictEqual(fs.readFileSync(ocupado, 'utf8'), 'original', 'original foi sobrescrito')

    // 5. lote que falha pela metade reporta os dois lados separadamente
    const bom = path.join(destDir, `check-meio-${Date.now()}.txt`)
    fs.writeFileSync(bom, 'x')
    const r5 = await trashFiles([bom, path.join(destDir, 'nao-existe-999.txt')])
    assert.strictEqual(r5.ok.length, 1, `ok deveria ter 1, teve ${r5.ok.length}`)
    assert.strictEqual(r5.fail.length, 1, `fail deveria ter 1, teve ${r5.fail.length}`)

    // 6. lote de 3: cada um sabe seu proprio caminho na Lixeira
    const tres = [1, 2, 3].map((i) => path.join(destDir, `check-lote-${Date.now()}-${i}.txt`))
    tres.forEach((p) => fs.writeFileSync(p, 'lote'))
    const r6 = await trashFiles(tres)
    assert.strictEqual(r6.ok.length, 3, `lote de 3 devolveu ${r6.ok.length}`)
    assert.strictEqual(
      r6.ok.filter((o) => o.trashedPath).length,
      3,
      'algum item do lote perdeu o trashedPath',
    )
    const r6b = await untrashFiles(
      r6.ok.map((o) => ({ name: path.basename(o.path), trashedPath: o.trashedPath })),
      destDir,
    )
    assert.strictEqual(r6b.ok.length, 3, `so ${r6b.ok.length} de 3 voltaram`)
    tres.forEach((p) => assert.strictEqual(fs.existsSync(p), true, `${p} nao voltou`))

    // limpeza do que este script criou
    fs.rmSync(alvo, { force: true })
    fs.rmSync(ocupado, { force: true })
    fs.rmSync(daLixeira, { force: true })
    tres.forEach((p) => fs.rmSync(p, { force: true }))
    if (r5.ok[0] && r5.ok[0].trashedPath) fs.rmSync(r5.ok[0].trashedPath, { force: true })

    console.log('ok: lixeira e restauracao')
    app.exit(0)
  } catch (erro) {
    console.error('FALHOU:', erro.message)
    app.exit(1)
  }
})
