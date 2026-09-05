#!/bin/bash
# Verificacao de fluxo da Fase 2 em pasta DESCARTAVEL.
#
# Higiene (licao da Fase 3): probe destrutivo nunca roda na biblioteca real.
# Este wrapper conta os arquivos da biblioteca real antes e depois e falha se o
# numero nao fechar.
#
# Roda com: bash scripts/check-selection-flow.sh
set -u

PROBE_DIR=/tmp/veditbox-probe
REAL_DIR="$HOME/veditbox"

antes_real=$(/bin/ls "$REAL_DIR" | wc -l | tr -d ' ')
antes_idx=$(node -e "const i=require('$REAL_DIR/.veditbox/index.json');console.log(Object.keys(i).filter(k=>k!=='arquivadas').length)")
echo "biblioteca real ANTES: $antes_real arquivos, $antes_idx entradas"

rm -rf "$PROBE_DIR"
mkdir -p "$PROBE_DIR"
for i in 1 2 3 4 5; do cp build/icon.png "$PROBE_DIR/isca-$i.png"; done
echo "pasta descartavel: $PROBE_DIR com $(/bin/ls "$PROBE_DIR" | wc -l | tr -d ' ') iscas"

VEDITBOX_DIR="$PROBE_DIR" VEDITBOX_PROBE=selection-delete yarn start 2>&1 |
  sed -n '/PROBE selection-delete/,$p'
status=$?

depois_real=$(/bin/ls "$REAL_DIR" | wc -l | tr -d ' ')
depois_idx=$(node -e "const i=require('$REAL_DIR/.veditbox/index.json');console.log(Object.keys(i).filter(k=>k!=='arquivadas').length)")
echo "biblioteca real DEPOIS: $depois_real arquivos, $depois_idx entradas"

if [ "$antes_real" != "$depois_real" ] || [ "$antes_idx" != "$depois_idx" ]; then
  echo "FALHOU: o probe MEXEU na biblioteca real ($antes_real/$antes_idx -> $depois_real/$depois_idx)"
  exit 1
fi
echo "ok: biblioteca real intacta"

# limpa a pasta descartavel, os thumbs e o que sobrou na Lixeira
rm -rf "$PROBE_DIR"
rm -f "$(node -p 'require("os").tmpdir()')"/veditbox/isca-*.png.jpg
for T in "$HOME/.Trash" "$HOME"/Library/CloudStorage/*/.Trash; do
  rm -f "$T"/isca-*.png 2>/dev/null
done
echo "ok: limpo"
exit $status
