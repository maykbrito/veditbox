# Versions

## Em desenvolvimento

### New

* Design system: Franken UI 2.1.2 vendorizado em
  `src/renderer/lib/vendor/franken-ui` (local, sem CDN — o app funciona offline e
  a CSP bloqueia script externo)
* `src/renderer/styles/theme.css` liga a paleta existente (`--gray-100`,
  `--pink`, …) aos tokens do Franken, em triplete HSL
* Probes de UI em `tools/probes/` e `tools/check-theme-tokens.js`: verificam o
  app rodando, não compilando

### Update

* Dialog de ajuda, sidebar e topBar usam componentes do Franken (`uk-card`,
  `uk-btn`, `uk-checkbox`). O dialog continua `<dialog>` nativo com `showModal()`
* `#topBar` tem altura fixa de 36px, agora declarada — o `trafficLightPosition`
  do processo main depende dela

### Fix

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