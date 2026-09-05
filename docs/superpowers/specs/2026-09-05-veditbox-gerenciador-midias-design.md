# Veditbox — Gerenciador de Mídias (design)

**Data:** 2026-09-05
**Status:** aprovado em brainstorm, pendente revisão final
**Escopo:** transformar o veditbox de "cola e arrasta" em biblioteca de mídia gerenciável

Este documento é o **contrato compartilhado**. Toda spec de fase deriva dele.
Divergiu daqui? O documento vence, ou volta pra discussão — não se resolve
localmente numa fase.

---

## 1. Problema

O `~/veditbox` acumula arquivos com nomes de timestamp e nenhum metadado. A URL
de origem é descartada no momento em que o arquivo é salvo. Não há como
reencontrar mídia depois, nem apagar em lote.

**Uso esperado:** biblioteca permanente, milhares de arquivos em um a dois anos,
majoritariamente vídeo. O usuário raramente mexe na pasta por fora (e cada vez
menos, conforme a ferramenta melhora). Não renomeia arquivos.

**Como o usuário busca:** de onde veio, quando pegou, o que tem dentro, pra que
ia usar. Os dois primeiros saem de graça; os dois últimos exigem entrada manual.

---

## 2. Decisões arquiteturais

### 2.1 Filesystem é a fonte de verdade

O índice é derivado, nunca soberano. Se a pasta e o índice divergirem, a pasta
vence. Consequência: mexer por fora nunca corrompe estado, apenas gera
reconciliação.

### 2.2 Um índice JSON, não banco

`~/veditbox/.veditbox/index.json`.

Descartados com motivo:

- **SQLite** — exigiria `better-sqlite3`, dependência nativa recompilada a cada
  versão do Electron. Este repo já sofre com isso no electron-builder. Canhão
  para milhares de registros.
- **Sidecar por arquivo** (`x.jpg.json`) — dobraria a contagem de arquivos na
  pasta que o usuário abre no Finder, e buscar por tag exigiria ler milhares de
  arquivinhos.
- **Postgres + Redis + S3** — avaliado para acesso mobile. Desproporcional:
  um usuário, uma máquina, zero concorrência. Redis não tem carga para aliviar;
  Postgres trocaria "abrir o app" por "depender de um serviço estar de pé"; S3
  cobraria banda para subir mídia que já está local. Acesso mobile se resolve
  com pasta sincronizada (Drive/iCloud/Syncthing), zero código.

**Reavaliar banco/servidor se:** mais de uma pessoa escrever na mesma
biblioteca, ou surgir necessidade de escrever do celular com a máquina
desligada.

### 2.3 Chave é o nome do arquivo

Não hash de conteúdo. O usuário não renomeia, e hashear gigabytes de vídeo
custaria caro para resolver um problema que não ocorre.

### 2.4 Não armazenar o que é derivável

Princípio que guiou os cortes do schema. Armazenar é justificável apenas quando
recalcular é caro.

| Dado | Decisão | Motivo |
|---|---|---|
| tipo (image/video/gif/audio) | **derivar** | está na extensão |
| data | **derivar** | está no nome (`20260905T144341144Z.mp4`); fallback `mtime` |
| origem/domínio | **derivar** | `new URL(url).hostname` |
| dimensões | **armazenar** | exige abrir o arquivo |

Tipo especificamente **não** vai para `tags`: tags são do usuário e editáveis.
Se o app escrevesse `video` em tags e o usuário apagasse, a reconciliação
recriaria, criando uma disputa por um fato que ninguém precisa opinar.

---

## 3. Schema

```json
{
  "20260905T144341144Z.mp4": {
    "url": "https://www.facebook.com/reel/892819649954687",
    "titulo": "",
    "tags": [],
    "notes": ""
  }
}
```

Três campos do usuário (`titulo`, `tags`, `notes`) e um de procedência (`url`).

`notes` é anotação livre, pesquisável.

### 3.1 EMENDA — dimensões removidas

`largura`/`altura` saíram do schema. A Fase 1 apontou dois fatos que eu não
tinha: **não há consumidor** delas em nenhuma fase, e `@ffmpeg-installer` **não
embarca ffprobe**, então arquivo legado só ganharia dimensão ao abrir preview —
um índice permanentemente incompleto para um dado que ninguém lê.

Aplico aqui a mesma régua que cortou `tipo`, `origem` e `adicionadoEm`: não
armazenar sem consumidor. Volta quando algo precisar (ex: aspect-ratio real no
grid), e aí a discussão do ffprobe acontece com motivo.

**Derivação de data** — o nome vem de `new Date().toJSON().replace(/\W/g, '')`:

```js
const dataDoNome = (nome) => {
  const m = nome.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z/)
  if (!m) return null // arquivo de fora: usar mtime
  const [, a, mes, d, h, min, s, ms] = m
  return new Date(`${a}-${mes}-${d}T${h}:${min}:${s}.${ms}Z`)
}
```

Verificado contra arquivos reais da pasta e contra o formato gerado hoje.

---

## 4. Reconciliação

Roda **apenas na abertura do app**. Sem watcher, sem sincronização contínua.

- arquivo na pasta sem entrada no índice → **adota**, `url` vazia
- entrada no índice sem arquivo na pasta → **arquiva como tombstone** (ver 4.1)
- índice nunca escreve na pasta

### 4.1 EMENDA — poda vira tombstone

A Fase 1 apontou perda silenciosa: mover o arquivo pra fora, abrir o app e
devolver apagaria título, tags e notas. Era o que §2.1 e §4 mandavam, mas é
destruição de dado do usuário por um passeio no Finder.

Entrada sem arquivo vai para uma seção `arquivadas` do índice em vez de ser
deletada. Se o arquivo reaparecer com o mesmo nome, os metadados voltam com ele.
Custo: alguns KB de JSON. Filesystem continua vencendo sobre o que é *exibido* —
tombstone não aparece no grid.

Órfãos adotados ficam com `url` vazia e são alcançáveis por um filtro
"sem origem". Deliberadamente **não** recebem tag automática — o app não escreve
em tags.

**Escrita com debounce (~500ms):** `~/veditbox` **já é symlink para o Google
Drive** nesta máquina (achado independente das Fases 0 e 1). Sem debounce,
editar tags viraria um upload por tecla digitada. Não muda a API do store.

**Escrita atômica:** grava em `index.json.tmp` e renomeia por cima. `rename` é
atômico no mesmo volume, então uma queda no meio preserva o índice anterior.
Importa mais porque a pasta pode estar sincronizada.

---

## 5. Thumbnails

**Gerador: ffmpeg**, já embarcado via `@ffmpeg-installer`. Sem dependência nova.

Medido contra `qlmanage` (QuickLook) nesta máquina, 6 arquivos reais:

| | qlmanage | ffmpeg |
|---|---|---|
| por arquivo | 0,10s | **0,02s** |
| extrapolado 2000 | 3,4 min | **0,8 min** |
| saída | PNG, 762 KB | **JPEG, 127 KB** |

QuickLook seria a escolha certa se não já embarcássemos ffmpeg — a dependência
já está paga.

**Cache: `/tmp/veditbox/`**, 320px, ~21 KB cada.

Fica **fora** da biblioteca de propósito: thumbnail é regenerável, e a pasta
`~/veditbox` será sincronizada. Sincronizar ~42 MB que o ffmpeg refaz em 40s é
desperdício de cota. Separação por natureza do dado: `index.json` é
insubstituível e viaja com a biblioteca; thumbs são descartáveis e ficam locais.

O macOS limpa `/tmp` periodicamente (verificado: nada sobrevive 7 dias). Aceito
— geração é preguiçosa e custa 0,02s.

**Geração:** sob demanda ao entrar em viewport, nunca em lote na abertura.
Máximo 4 processos ffmpeg simultâneos.

**Invalidação:** thumb mais antigo que o arquivo → regenera. Usa `mtime` do
filesystem, sem guardar estado.

---

## 6. Grid

**Problema atual:** um elemento por arquivo, e vídeos criam `<video
preload="metadata">`. São N decoders instanciados. É isso que trava, não a
contagem de itens.

**Virada:** toda célula vira `<img>` do thumbnail, inclusive vídeo. Um tipo de
elemento, zero decodificação no grid.

- **Áudio:** ícone `♪` que já existe. Sem waveform (ver §11).
- **Hover:** troca `<img>` por `<video>` apenas no item sob o cursor, um por
  vez. Padrão YouTube. Preserva a sensação atual.
- **Carregamento incremental:** ~60 itens por vez, `IntersectionObserver`
  nativo com sentinela ao final. Sem virtualização — resolve quase tudo com
  fração da complexidade. A costura fica pronta para virtualizar se doer.

O mesmo `IntersectionObserver` dispara o próximo lote **e** a geração do
thumbnail. Uma peça, duas necessidades.

---

## 7. Seleção múltipla e delete

**Modelo:** Google Photos para descoberta, Finder para atalhos.

- clique simples → abre preview (como hoje)
- checkbox no hover → entra em modo seleção. **É a única parte descobrível;**
  atalho sozinho ninguém adivinha
- em modo seleção, clique alterna; `Shift+clique` estende intervalo
- `Cmd+A` seleciona tudo dentro da aba/filtro atual; `Esc` limpa

**Barra de ação:** a `#topBar` troca o status por "N selecionados" + ações.
Espaço que já existe.

**Delete → Lixeira do sistema** via `shell.trashItem()`. API nativa do Electron,
sem dependência, "Colocar de volta" do Finder funciona.

Cada exclusão faz três coisas: manda para a Lixeira, remove a entrada do índice,
apaga o thumb em `/tmp`.

**Confirmação:** 1 item sem confirmar; 2+ confirma mostrando a contagem. A
Lixeira já é o undo, então confirmar exclusão recuperável de um arquivo é
atrito. Mas seleção múltipla é onde um clique errado leva 40 arquivos, e a
contagem na tela é o que faz parar. `Cmd+Delete` dispara.

**Undo (`Cmd+Z`)** — verificado experimentalmente:

- `trashItem` coloca o arquivo em `~/.Trash` com o **mesmo nome**
- mover de volta restaura com conteúdo intacto

Implementação: guardar em memória o último lote apagado (nome + entrada do
índice). `Cmd+Z` move de volta e restaura as entradas. **Best-effort:** se a
Lixeira foi esvaziada ou o arquivo renomeado lá dentro, falha e avisa em vez de
fingir sucesso. Pilha de um nível, não histórico.

**Não construir:** detector de duplicados ou de arquivos vazios. Os vazios eram
bug do yt-dlp (já corrigido, deixava `.mp4` de 0 byte); os duplicados vieram de
testes. Com seleção múltipla, limpar é questão de cliques.

---

## 8. Busca e tags

**`Cmd+K` abre `<dialog>` nativo.** Sem campo permanente ocupando a interface.

Command palette de lib (kbar, cmdk) foi **descartada**: são React, e adotá-las
significaria trazer React + bundler para um projeto que deliberadamente não tem
nenhum dos dois. O app já usa `<dialog>` + `showModal()` no botão de ajuda.

**Busca:** substring em `titulo`, `tags`, `notes`, `url`. Ranking simples
(título > tag > nota). Escopo: **biblioteca inteira**, não a aba atual — o ponto
é achar o que não se sabe onde está.

**Fuse.js: não começar com ele.** É JS puro, sem build nativo, e portanto muito
mais aceitável que React — mas as tags são vocabulário que o próprio usuário
cria, então ele tende a lembrá-las exatamente. `includes()` é instantâneo em
milhares de itens.

**Gatilho para adotar:** se o usuário não achar coisas que sabe existirem, por
erro de digitação ou termo aproximado. Entra sem retrabalho — opera sobre o
mesmo array já filtrado.

**Edição de metadados:** sheet lateral direito no preview. Com seleção múltipla,
"adicionar tag a N itens" na barra de ação.

**Pills de tag:** badges na interface; clicar filtra por aquela tag.

**Filtros por aba** continuam por tipo derivado da extensão, independentes da
busca. Mais o filtro "sem origem".

### 8.0 PERIGO — `window.onkeydown` é atribuição, não listener

Achado da Fase 2, vale para **todas** as fases:
`src/renderer/lib/recorder/audio/index.js` faz `window.onkeydown = ...`. Uma
segunda atribuição em qualquer arquivo **apaga a gravação por atalho em
silêncio**, sem erro.

Toda fase que registrar teclado usa `addEventListener`, nunca atribuição, e
inclui regressão apertando `r` e espaço.

Nota da Fase 2: a guarda de foco de §8.1 não é necessária para atalhos com
`metaKey` (o handler de áudio já sai cedo em `!metaKey`). Ela continua
**obrigatória para a Fase 3**, cujo campo de busca recebe letras soltas.

### 8.1 Correção obrigatória: atalhos cientes de foco

O gravador de áudio registra `window.onkeydown` e captura `r` e espaço
globalmente. Hoje é inofensivo. Com campo de busca, digitar "reels" **começaria
a gravar áudio**.

**Verificado:** o modal **não** resolve sozinho — `keydown` digitado em input
dentro de `<dialog open>` sobe até `window.onkeydown`. A guarda é obrigatória:
ignorar quando o alvo for `input`, `textarea` ou `contenteditable`.

Entra junto com a busca, não depois, senão a busca nasce quebrada.

---

## 9. Design system

**Franken UI.** HTML-first sobre UIkit 3 + LitElement, inspirado no shadcn.
shadcn foi descartado por ser React.

Cobre quase todo componente novo planejado:

| Necessidade | Componente |
|---|---|
| Sheet lateral | `Offcanvas` |
| Cmd+K | `Command` |
| Pills de tag | `Badge` / `Label` |
| Editar tags | `Input Tag` |
| Confirmação | `<dialog>` nativo, estilizado com Franken |

### 9.1 EMENDA — decisões que a Fase 0 pediu

**Confirmação destrutiva usa `dialog.showMessageBox` do processo main.**

Esta emenda *substitui* minha decisão anterior (que era `<dialog>` HTML). A Fase
2 argumentou melhor: `showMessageBox` evita o alçapão do `elements.js` por
completo e, principalmente, **desacopla a Fase 2 do término da Fase 0** — que
era exatamente o paralelismo prometido na §10 e que minha emenda tinha quebrado
sem eu notar. É também o comportamento macOS correto para ação destrutiva: é o
que o Finder faz.

Regra resultante, por superfície:

| Superfície | Mecanismo |
|---|---|
| Confirmação destrutiva | `dialog.showMessageBox` (main, nativo do SO) |
| Palette Cmd+K, ajuda, sheet | `<dialog>` HTML, estilizado com Franken |

`uk-modal` não é usado em lugar nenhum.

**`elements.js:12` usa `querySelector('dialog')`**, que sequestra o botão de
ajuda assim que qualquer outro `<dialog>` aparecer antes dele no DOM. A Fase 3
achou o alçapão e corretamente não mexeu em arquivo compartilhado. **Correção é
da Fase 0** (dona do chrome): dar `id="helpDialog"` e usar seletor por id.

**Instalação: vendorizar local, não CDN.** Dois motivos que a documentação não
cobre porque não pensa em desktop:

1. o app precisa funcionar **offline** (hoje funciona)
2. `index.html` tem `Content-Security-Policy: script-src 'self'` — script de CDN
   seria **bloqueado**

Baixar uma vez, versionar no repo, carregar do disco.

**Não trazer** os ~91 kB de utilitários Tailwind pré-extraídos — classes
utilitárias são o que mais briga com o CSS existente.

**Custo honesto:** UIkit 3 + LitElement em runtime, num app cujo JS são poucas
centenas de linhas. Em desktop pesa menos que na web (sem download por visita),
mas é peso real.

**Não parte do zero:** `index.css` já tem tokens (`--gray-100`, `--purple`,
`--pink`). Mapear para os tokens do Franken em vez de descartar.

---

## 10. Fases

Ordem tem justificativa técnica, não é preferência.

**Fase 0 — Design system.** Vendoriza Franken UI, mapeia tokens, migra chrome
existente (sidebar, topBar, dialog de ajuda). **Explicitamente não toca no grid.**

Vem primeiro porque, se viesse depois, sheet/pills/palette seriam construídos à
mão e refeitos em seguida.

**Fase 1 — Índice + thumbnails + grid.** O alicerce. Reescreve o grid (dono
único dessa reescrita). Nada de novo visível ao usuário, mas 2 e 3 dependem.

**Fase 2 — Seleção, delete, undo.** Resolve a dor que originou a conversa.

**Fase 3 — Busca, tags, sheet, pills.** Inclui a correção de §8.1.

### API canônica do store (resolve suposições da Fase 2)

A Fase 1 é dona do store; os nomes dela valem. A Fase 2 supôs
`list/get/remove/put/save` — o correto é:

`reconcile()`, `getAll()`, `get(nome)`, `setEntry(nome, patch)`,
`addEntry(nome)`, `removeEntry(nome)`, `INDEX_PATH`.

Grid: `showLibrary(tab)`, `renderGrid(items, tab)`, `getRenderedItems()`,
`cellHooks`, `refresh()`. Cada célula tem `data-name` — confirma a suposição S2.

Thumbs: `thumbPath(nome)`, `getThumb(item)`, `deleteThumb(nome)`.

**Resolve S4:** a Fase 2 não deve montar o caminho do thumb à mão. Chama
`deleteThumb(nome)`. Se o padrão de nome mudar, quem muda é a dona.

### 10.1 Protocolo de merge (revisão cruzada dos 4 planos)

A análise de arquivos citados nos quatro planos revelou colisões que nenhum
plano isolado enxergava. Regras normativas:

**Dono único por arquivo compartilhado.** Quem não é dono consome, não edita.

| Arquivo | Dono | Demais |
|---|---|---|
| `src/main/index.js` | ninguém — ver append-only | uma linha cada |
| `src/utils/elements.js` | Fase 0 (corrige `id="helpDialog"`) | consomem |
| `src/renderer/styles/index.css` | Fase 0 | usam arquivo próprio |
| `src/renderer/lib/library.js` | Fase 1 | consomem via `cellHooks`/`renderGrid` |
| `src/renderer/lib/recorder/audio/index.js` | Fase 3 (guarda de foco) | Fase 2 só testa |

**Regra append-only para `src/main/index.js` e `src/renderer/index.js`:** toda
fase põe sua lógica em módulo próprio e acrescenta **uma única linha** de
`require` no fim do arquivo. Nada de editar o bloco de imports do topo — é onde
merges de quatro frentes explodem. A Fase 2 já fazia assim; agora vale para
todas.

**Fase 1 move o CSS do grid** de `index.css` para `styles/grid.css`. Isso
elimina a colisão tripla (0/1/2) no `index.css` e dá dono único a ele.

**Probe `grid-snapshot` da Fase 0** fixa o comportamento atual do grid. Quando a
Fase 1 reescrever, ele falha por bom motivo: a Fase 1 **atualiza os valores
esperados**, não deleta o probe.

**Suposições S1 e S4 da Fase 2 estão erradas** (o store é `media-index.js`, não
`library/store.js`; o thumb se apaga com `deleteThumb()`, não montando caminho).
Corrigidas em §10 acima — reler antes de implementar.

### 10.2 API real publicada pela Fase 1 (substitui as previsões)

Medida contra o app rodando, não prevista:

- `reconcile()` devolve `{adotados, arquivados, restaurados}` — três campos, não
  dois. O tombstone de §4.1 exigiu. Nenhuma fase lia isso.
- `flush()` **adicionado** ao store. Nenhum rename. **A Fase 2 deve chamar
  `flush()` antes de operação destrutiva**, senão os 500ms de debounce a pegam.
- `MediaItem` = `{name, filePath, category, date, domain, url, titulo, tags,
  notes}`. Sem `largura`/`altura`, conforme §3.1.
- `getThumb()` **nunca rejeita**: devolve o arquivo original como fallback, ou
  `''` para áudio (que usa o ícone).
- `index.json` é mapa plano `nome -> entrada` mais a chave reservada
  `arquivadas`. Não colide porque `categoryOf('arquivadas')` é `undefined`.
  Tombstone nunca sai em `getAll()`/`get()`.

**Cache de thumbs: `os.tmpdir()`**, não o literal `/tmp/veditbox` que §5 dizia.
No macOS `os.tmpdir()` resolve para o `TMPDIR` por usuário, enquanto `/tmp` é
compartilhado e world-writable — some a ressalva de privacidade que §5
registrava. O objetivo original (ficar fora da pasta sincronizada) continua
satisfeito, e §10 já proíbe montar caminho de thumb à mão.

**`removeEntry()` não cria tombstone.** Apagar é ato explícito do usuário;
tombstone existe para o passeio acidental no Finder. O undo da Fase 2 guarda a
entrada na própria pilha em memória, como §7 já previa.

### 10.3 ffmpeg: `-ss` está PROIBIDO para thumbnail

Medido nos 84 arquivos reais da biblioteca:

| estratégia | sucesso | mediana |
|---|---|---|
| `-ss 1` (seek) | **27/84** | — |
| filtro `thumbnail` | 80/84 | 0,024s |
| **híbrido (implementado)** | **80/84** | **0,022s** |

Buscar 1s dentro de uma **imagem parada** não devolve frame: o ffmpeg escreve
arquivo **vazio**. 57 dos 84 arquivos são stills. Seguir a tabela de §5 sem
medir teria criado o cache com ~57 JPEGs vazios.

Híbrido: still só escala; vídeo usa o filtro `thumbnail`.

Os 4 restantes são arquivos honestamente quebrados — dois `.webp` animados que o
decoder do ffmpeg não lê (o Chromium lê, então o fallback ao original exibe
certo) e dois `.mp4` de 0 byte, resíduo do bug antigo do yt-dlp.

### 10.4 Lições do merge 0 -> 1

**Auditoria de commit tem duas perguntas, não uma.** Auditei `5ced490` perguntando
"isso invade a fronteira do grid?" e aprovei como "cirúrgico". A pergunta que
faltou: **"isso é auto-contido?"**. Não era — o `<link>` do `theme.css` vive em
`2d5d2ed`, um commit antes. Cherry-pick isolado deixou o app com tokens vazios,
fundo transparente e texto preto. O `--stat` mostrava só `index.css` e
`theme.css`, sem `index.html`: o dado estava à vista e eu não raciocinei sobre ele.

Regra: antes de liberar cherry-pick, verificar o **fecho transitivo** — se o
commit cria um arquivo, quem o referencia?

**`src/renderer/index.html`:** cada fase pode acrescentar suas próprias linhas de
`<link>`/`<script>`. Mudança **estrutural** de markup é da Fase 0.

**Probe `grid-snapshot`, valores novos** (§10.1 manda atualizar, não deletar).
Quem fizer o merge 0 -> 1 troca:

- `itens`: 90 -> **61** (60 células + a sentinela do IntersectionObserver)
- `tagsDeThumb`: agora `[IMG,IMG,DIV,IMG,IMG,IMG,IMG,IMG]` (o `DIV` é o áudio)
- **campo novo `videosNoDom`, esperado `0`** — é o invariante de §6. Sem ele o
  probe não pega uma regressão que reintroduza decoder no grid.

Os outros 11 campos não mudam.

### 10.5 ARMADILHA do Cmd+A (Fase 2)

Achado da Fase 1, que **não** resolveu por ser escopo alheio:

**60 células estão no DOM, 90 entradas estão no índice.** Se o Cmd+A operar sobre
o DOM, o usuário seleciona 60 de 90 achando que pegou tudo — e apaga achando que
apagou tudo. Selecionar opera sobre a **lista** (`getAll()`), nunca sobre o DOM.

`getRenderedItems()` serve para iterar o que está na tela; `getAll()` para o
Cmd+A. Depois de apagar: `lib.refresh()` (preserva scroll) e `deleteThumb(nome)`.

### Paralelismo real

Honestidade sobre limites:

- **Fases 0 e 1 colidem** — ambas mexeriam no grid. Por isso Fase 0 exclui o
  grid do escopo e Fase 1 é dona dele. Ainda assim, 1 depende dos tokens de 0.
- **Specs das quatro fases: paralelizáveis** (documentos independentes, zero
  colisão de arquivo), desde que derivem deste contrato.
- **Fases 2 e 3: paralelizáveis** após a 1 — áreas distintas (barra de seleção +
  ipc de lixeira vs palette + sheet).

**A ordem de merge é 0 → 1 → (2 ‖ 3).** Como a Fase 0 aterrissa antes, a Fase 3
**pode assumir Franken UI disponível** e usar `Offcanvas` e `Input Tag`
diretamente, sem o `<aside>` provisório.

---

## 11. Fora de escopo

Registrado para não voltar como "esqueceram disso".

- **Tagueamento por IA, resumo de imagem, extração de legenda de vídeo.**
  Dependem de índice e busca existirem. Ganchos prontos: `tags`, `titulo`,
  `notes` são exatamente o que uma passada de IA preencheria, sem mudar schema.
  Decisão adiada conscientemente: **não** modelamos origem da tag (manual vs
  IA). Se a IA entrar e for preciso distinguir, aí o schema muda — é o momento
  certo de decidir.
- **Player com skip por waveform** (referência: `/Users/maykbrito/developer/mow`,
  `frontend/src/components/Waveform.tsx`, `NowPlaying.tsx`). Subsistema de
  reprodução, não de gerenciamento. Comportamento ainda não especificado.
- **Waveform como thumbnail de áudio.** Cortado junto com o player — decodificar
  e reduzir a picos só se paga uma vez. Devem voltar juntos. Gancho existente:
  `src/renderer/lib/recorder/audio/waveform-display.js` (hoje alimentado por
  áudio ao vivo).
- **Virtualização do grid.** Carregamento incremental resolve; costura pronta.
- **Detector de duplicados/vazios.** Ver §7.
- **Acesso mobile / backend.** Ver §2.2.

---

## 12. Testes

O repo não tem framework de teste e não vai ganhar um agora. O padrão
estabelecido nesta sessão, que funcionou para achar bugs reais, é:

- **lógica pura** (derivação de data, rotas, resumo de erro) → script Node com
  casos e asserção, rodado direto
- **fluxo de UI** → instrumentar `src/main/index.js` temporariamente com
  `executeJavaScript`, rodar o app headless-ish, medir estado real do DOM e do
  filesystem, **e reverter a instrumentação**

Regra que vale para todas as fases: **verificar rodando, não compilando.**
Nesta sessão, três bugs só apareceram no app rodando, e duas conclusões minhas
("qlmanage é lento", "o modal isola atalhos") estavam erradas até serem medidas.
