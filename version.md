# Versions

## Não lançado

### New

* Seleção múltipla no grid: checkbox no hover (a única parte descobrível),
  clique alterna em modo seleção, `Shift+clique` estende o intervalo, `Cmd+A`
  seleciona a aba inteira e `Esc` limpa. A `#topBar` vira "N selecionados" +
  ações enquanto há seleção
* `Cmd+A` opera sobre o **índice**, não sobre o DOM: o grid carrega em lotes de
  60, então selecionar o que está na tela pegaria 60 de 90 e o usuário apagaria
  achando que apagou tudo
* Delete em lote para a Lixeira do sistema (`Cmd+Delete` ou botão "Apagar").
  Cada exclusão faz três coisas: manda pra Lixeira, remove a entrada do índice e
  apaga o thumb do cache. 1 arquivo vai direto; 2 ou mais pedem confirmação
  nativa mostrando a contagem
* Undo de um nível com `Cmd+Z`: devolve o último lote da Lixeira e repõe as
  entradas do índice. Best-effort — se a Lixeira foi esvaziada, avisa em
  vermelho em vez de fingir que deu certo
* A Lixeira de destino é **descoberta**, não fixada: `~/veditbox` é symlink pro
  Google Drive nesta máquina, e um arquivo de lá vai pro `.Trash` do container
  do Drive, não pro `~/.Trash` que o design supunha

* Índice de metadados em `~/veditbox/.veditbox/index.json`: guarda a URL de
  origem, título, tags e notas de cada arquivo. Escrita atômica (tmp + rename)
  com debounce de 500ms, porque a pasta pode estar sincronizada na nuvem
* A URL de origem finalmente é gravada. Antes era descartada no momento de
  salvar — inclusive nos downloads via yt-dlp, onde a URL da página já tinha
  virado caminho local antes de chegar no modelo
* Reconciliação na abertura: arquivo novo na pasta é adotado, e entrada sem
  arquivo vira *tombstone* em vez de ser apagada. Mover um arquivo pra fora e
  devolver não destrói mais título, tags e notas
* Cache de thumbnails em `$TMPDIR/veditbox`, 320px, gerado sob demanda pelo
  ffmpeg já embarcado. No máximo 4 processos simultâneos. Fica fora da
  biblioteca de propósito: thumb é regenerável e não deve consumir cota de sync

* Design system: Franken UI 2.1.2 vendorizado em
  `src/renderer/lib/vendor/franken-ui` (local, sem CDN — o app funciona offline e
  a CSP bloqueia script externo)
* `src/renderer/styles/theme.css` liga a paleta existente (`--gray-100`,
  `--pink`, …) aos tokens do Franken, em triplete HSL
* Probes de UI em `tools/probes/` e `tools/check-theme-tokens.js`: verificam o
  app rodando, não compilando

### Update

* Grid: toda célula agora é `<img>` do thumbnail, inclusive vídeo. Antes o
  grid instanciava um `<video preload="metadata">` por arquivo — 29 decoders
  numa pasta de 90 itens, que era a causa real da lentidão. Agora são 0 em
  repouso, e o `<video>` só existe no item sob o cursor, um por vez
* Grid carrega ~60 itens por vez com `IntersectionObserver`; o mesmo observer
  dispara o próximo lote e a geração do thumbnail
* CSS do grid saiu do `index.css` para `styles/grid.css`

* Dialog de ajuda, sidebar e topBar usam componentes do Franken (`uk-card`,
  `uk-btn`, `uk-checkbox`). O dialog continua `<dialog>` nativo com `showModal()`
* `#topBar` tem altura fixa de 36px, agora declarada — o `trafficLightPosition`
  do processo main depende dela

### Fix

* Trocar de aba ou voltar pra home não deixa mais vídeo tocando escondido

* `elements.js` pegava o dialog de ajuda com `querySelector('dialog')`: o
  primeiro `<dialog>` do documento sequestraria o botão de ajuda assim que
  outro aparecesse antes dele. Agora é por `#helpDialog`
* O reset `* { margin: 0; padding: 0 }` zerava o padding de todo componente do
  Franken (o dialog media 0px). Era redundante — o `@layer base` do Franken traz
  o mesmo reset

## 1.1.0

### New

* Biblioteca: grid dos arquivos de `~/veditbox`, filtrado pelas abas do menu
* Preview ao clicar num arquivo, com botão de voltar
* Abas do menu refletem o tipo do que foi colado/gravado
* Logo do menu vira botão de home

### Update

* Electron 33 + electron-builder 25
* Frame sem barra de título (`hiddenInset`), alinhado com o conteúdo
* Aba de GIF usa texto em vez de ícone ambíguo
* CI: Node 20 e actions v4
* yt-dlp: usa o binário do Homebrew quando existe

### Fix

* Pins do Pinterest e outras páginas de imagem falhavam silenciosamente no
  yt-dlp; agora cai no OpenGraph (og:image/og:video) da página
* Download sem vídeo deixava um arquivo de 0 bytes na biblioteca
* Erro do yt-dlp aparecia como status em branco
* Colar de novo antes da colagem anterior terminar embaralhava tela e aba
* Facebook (e qualquer outro site suportado pelo yt-dlp) não era reconhecido
  ao colar; a tabela de rotas listava domínios um a um
* Imagem/áudio colado ou gravado só ia pro disco ao arrastar, então nunca
  aparecia na biblioteca; agora salva assim que é carregado
* Colar imagem do clipboard travava em "reading it..." — `generate()` não era
  aguardado e o `onload` estourava em `arrayBuffer.byteLength` antes da hora
* Links do Giphy nunca eram reconhecidos ao colar
* Home voltou a ser simples: busca de imagem não monta mais no boot

## 1.0.3

* small code improvements and refactor

### New

* Auto download yt-dlp executable (tested only in MacOS)

## Update 

* electron-builder

### Fix

* Download videos
* When recording or download new video, don't replace the older one

## 1.0.2

### New

* yt-dlp-wrap
* Writting files into OS user's directory `<user>/veditbox` 
* help button with instructions
* Download Youtube video
* Preview Video Recorder
* Versioning

### Update

* Electron 21
* Readme
* Styles

### Fix

* Twitter video download
* Download of any image link
* yarn install: youtube-dl phyton error

### Remove

* youtube-dl
* temp-write
* auto-paste because it's not working and it ins't necessary

## 1.0.1

Initial version