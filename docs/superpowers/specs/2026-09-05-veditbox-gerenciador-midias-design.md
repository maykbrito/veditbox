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
    "notes": "",
    "largura": 720,
    "altura": 1280
  }
}
```

Três campos do usuário (`titulo`, `tags`, `notes`), um de procedência (`url`),
dois caros de recalcular (dimensões).

`notes` é anotação livre, pesquisável.

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
- entrada no índice sem arquivo na pasta → **poda**
- índice nunca escreve na pasta

Órfãos adotados ficam com `url` vazia e são alcançáveis por um filtro
"sem origem". Deliberadamente **não** recebem tag automática — o app não escreve
em tags.

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
| Confirmação | `Modal` |

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

### Paralelismo real

Honestidade sobre limites:

- **Fases 0 e 1 colidem** — ambas mexeriam no grid. Por isso Fase 0 exclui o
  grid do escopo e Fase 1 é dona dele. Ainda assim, 1 depende dos tokens de 0.
- **Specs das quatro fases: paralelizáveis** (documentos independentes, zero
  colisão de arquivo), desde que derivem deste contrato.
- **Fases 2 e 3: paralelizáveis** após a 1 — áreas distintas (barra de seleção +
  ipc de lixeira vs palette + sheet).

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
