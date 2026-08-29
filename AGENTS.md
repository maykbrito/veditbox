# AGENTS.md

## O que é

Veditbox: app Electron (macOS) para colar/gravar mídia (imagem, áudio, vídeo)
e arrastar como arquivo para outro app.

## Stack

- Electron 33 + electron-builder 25.1.8
- JS puro, sem bundler, sem framework, sem TypeScript, sem testes
- `nodeIntegration: true`, `contextIsolation: false`, `asar: false`
- Deps nativas/externas: ffmpeg (`@ffmpeg-installer`), yt-dlp (baixado em runtime), ImageMagick (do sistema)

## Estrutura

```
src/main/index.js      processo main: janela, atalhos globais, ipc 'dragstart'
src/renderer/          UI (index.html/js) + lib/ com as features
  lib/file/            modelos de arquivo (Image/Video) e handlers de paste
  lib/recorder/        gravação de áudio e de tela (ffmpeg)
  lib/video-downloader.js  download via yt-dlp
  lib/ai-image-search/ busca de imagem
src/components/        UI compartilhada (menus)
src/utils/             constants, globals, helpers (webp-to-gif, get-yt-dlp…)
src/core/Menu.js       menu da aplicação
build/icon.png         ícone usado no drag e no app
```

Arquivos gerados vão para `~/veditbox`.

## Comandos

```
yarn            # instala + electron-builder install-app-deps
yarn start      # roda em dev
yarn build      # electron-builder --dir (pasta dist/mac)
yarn dist       # empacota .dmg
```

CI: `.github/workflows/build.yml` só roda se a mensagem do commit contiver `[build]`.

## Convenções

- Sem ponto e vírgula, aspas simples/backticks — segue `.prettierrc`
- CommonJS (`require`), não ESM
- main ↔ renderer via `ipcMain`/`ipcRenderer` e `@electron/remote`
- Mudança relevante → registrar em `version.md`

## Armadilhas conhecidas

- CI usa Node 12 e actions v1 — desatualizado frente ao Electron 33; provável fonte de falha de build
- `enableRemoteModule` não existe mais no Electron moderno (ignorado)
- yt-dlp/ffmpeg/ImageMagick precisam existir na máquina/no bundle; falham silenciosamente se ausentes
