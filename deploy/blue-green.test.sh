#!/usr/bin/env bash
# Teste do blue-green.sh sem Docker: um `docker` falso no inicio do PATH registra
# os comandos e finge o estado dos containers. Roda com `bash deploy/blue-green.test.sh`.
set -euo pipefail

AQUI=$(cd "$(dirname "$0")" && pwd)
ALVO=$AQUI/blue-green.sh
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/docker" <<'FAKE'
#!/usr/bin/env bash
echo "$*" >> "$DOCKER_LOG"
if [ "$1" = inspect ]; then
  case " ${FAKE_RUNNING:-} " in
    *" $4 "*) echo true; exit 0 ;;
  esac
  exit 1
fi
case "$*" in
  *" up "*) [ -z "${FAKE_UP_FALHA:-}" ] || exit 1 ;;
  *"image prune"*) [ -z "${FAKE_PRUNE_FALHA:-}" ] || exit 1 ;;
esac
exit 0
FAKE
chmod +x "$TMP/docker"
export PATH="$TMP:$PATH"

falhas=0

# roda o script e devolve o log dos comandos docker em $LOG
executa() {
  DOCKER_LOG=$TMP/log
  export DOCKER_LOG
  : > "$DOCKER_LOG"
  set +e
  bash "$ALVO" docker-compose.prod.yml game timeline_merge .env > "$TMP/saida" 2>&1
  STATUS=$?
  set -e
  LOG=$(cat "$DOCKER_LOG")
}

verifica() {
  local descricao=$1 esperado=$2
  if printf '%s\n' "$LOG" | grep -qF -- "$esperado"; then
    echo "  ok   $descricao"
  else
    echo "  FALHOU $descricao"
    echo "    esperava no log: $esperado"
    echo "    log: $LOG"
    falhas=$((falhas + 1))
  fi
}

nao_verifica() {
  local descricao=$1 proibido=$2
  if printf '%s\n' "$LOG" | grep -qF -- "$proibido"; then
    echo "  FALHOU $descricao"
    echo "    nao podia aparecer no log: $proibido"
    echo "    log: $LOG"
    falhas=$((falhas + 1))
  else
    echo "  ok   $descricao"
  fi
}

echo "primeiro deploy (nenhuma cor no ar) sobe blue"
FAKE_RUNNING="" FAKE_UP_FALHA="" executa
verifica "sobe game-blue" "up -d --wait --wait-timeout 180 game-blue"
verifica "remove a cor ociosa" "rm -sf game-green"
[ "$STATUS" = 0 ] || { echo "  FALHOU status $STATUS"; falhas=$((falhas + 1)); }

echo "blue no ar: sobe green e derruba blue"
FAKE_RUNNING="timeline_merge_blue" FAKE_UP_FALHA="" executa
verifica "puxa a imagem de green" "pull game-green"
verifica "sobe game-green" "up -d --wait --wait-timeout 180 game-green"
verifica "derruba blue depois" "rm -sf game-blue"

echo "green no ar: sobe blue e derruba green"
FAKE_RUNNING="timeline_merge_green" FAKE_UP_FALHA="" executa
verifica "sobe game-blue" "up -d --wait --wait-timeout 180 game-blue"
verifica "derruba green depois" "rm -sf game-green"

echo "cor nova nao fica healthy: mantem a antiga no ar"
FAKE_RUNNING="timeline_merge_blue" FAKE_UP_FALHA=1 executa
[ "$STATUS" != 0 ] || { echo "  FALHOU deploy devia falhar"; falhas=$((falhas + 1)); }
verifica "remove a cor que falhou" "rm -sf game-green"
nao_verifica "nao derruba a cor no ar" "rm -sf game-blue"

echo "env-file opcional nao vira --env-file vazio"
DOCKER_LOG=$TMP/log; export DOCKER_LOG; : > "$DOCKER_LOG"
FAKE_RUNNING="" bash "$ALVO" docker-compose.prod.yml motor-ia motor_ia > /dev/null 2>&1
LOG=$(cat "$DOCKER_LOG")
nao_verifica "sem env-file nao passa --env-file" "--env-file"
verifica "usa o servico informado" "up -d --wait --wait-timeout 180 motor-ia-blue"

# por ultimo: em bash a atribuicao antes da chamada de funcao persiste depois dela, entao
# FAKE_PRUNE_FALHA vazaria para os cenarios seguintes
echo "prune concorrente falhando nao reprova o deploy"
FAKE_RUNNING="timeline_merge_blue" FAKE_UP_FALHA="" FAKE_PRUNE_FALHA=1 executa
verifica "derruba blue depois" "rm -sf game-blue"
[ "$STATUS" = 0 ] || { echo "  FALHOU deploy nao podia falhar por causa do prune (status $STATUS)"; falhas=$((falhas + 1)); }

if [ "$falhas" -gt 0 ]; then
  echo "$falhas verificacao(oes) falharam"
  exit 1
fi
echo "todos os cenarios passaram"
