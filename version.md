# Versions

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