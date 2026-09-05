#!/bin/bash
# Verificacao na BIBLIOTECA REAL, com contagem antes/depois obrigatoria.
#
# Planta UMA isca descartavel na biblioteca real e a mistura com os 2 .mp4 de 0
# byte, pra exercitar o caminho de FALHA PARCIAL de §7 com dados reais. No fim,
# confere que a contagem fechou — se nao fechar, o script grita.
#
# Roda com: bash scripts/check-selection-real.sh
set -u

REAL="$HOME/veditbox"
idx() { node -e "const i=require('$REAL/.veditbox/index.json');console.log(Object.keys(i).filter(k=>k!=='arquivadas').length)"; }

antes_arq=$(/bin/ls "$REAL" | wc -l | tr -d ' ')
antes_idx=$(idx)
echo "ANTES:  $antes_arq arquivos, $antes_idx entradas"

cp build/icon.png "$REAL/isca-real-$(date +%s).png"
echo "isca plantada; agora $(/bin/ls "$REAL" | wc -l | tr -d ' ') arquivos"

VEDITBOX_PROBE=selection-real yarn start 2>&1 | sed -n '/PROBE selection-real/,$p'

# a isca tem que ter voltado pelo undo; remove ela e o que ficou na Lixeira
rm -f "$REAL"/isca-real-*.png
for T in "$HOME/.Trash" "$HOME"/Library/CloudStorage/*/.Trash; do
  rm -f "$T"/isca-real-*.png 2>/dev/null
done
rm -f "$(node -p 'require("os").tmpdir()')"/veditbox/isca-real-*.png.jpg

# HIGIENE: apagar o arquivo nao tira a entrada do indice — a reconciliacao do
# proximo boot a viraria TOMBSTONE, deixando lixo permanente na biblioteca do
# usuario. Tira a entrada aqui. (Licao da Fase 3, aviso 5.)
node -e '
const fs = require("fs"), os = require("os")
const P = os.homedir() + "/veditbox/.veditbox/index.json"
const i = JSON.parse(fs.readFileSync(P, "utf8"))
const limpar = (o) =>
  Object.keys(o).filter((k) => k.startsWith("isca-real-")).forEach((k) => delete o[k])
limpar(i)
if (i.arquivadas) limpar(i.arquivadas)
fs.writeFileSync(P, JSON.stringify(i, null, 2))
'

depois_arq=$(/bin/ls "$REAL" | wc -l | tr -d ' ')
depois_idx=$(idx)
echo "DEPOIS: $depois_arq arquivos, $depois_idx entradas"
if [ "$antes_idx" != "$depois_idx" ]; then echo "FALHOU: indice nao fechou ($antes_idx -> $depois_idx)"; exit 1; fi

if [ "$antes_arq" != "$depois_arq" ]; then
  echo "FALHOU: contagem de arquivos nao fechou ($antes_arq -> $depois_arq)"
  exit 1
fi
echo "ok: biblioteca real fechou o numero"
