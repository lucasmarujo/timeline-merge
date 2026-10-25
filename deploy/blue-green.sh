#!/usr/bin/env bash
# Deploy blue-green: sobe a cor ociosa, espera ela ficar healthy e so entao derruba
# a cor antiga. Se a nova nao passar no healthcheck, o `up --wait` falha, o trap
# remove a nova e a antiga continua atendendo — o deploy fica vermelho sem tirar o
# servico do ar.
#
# Quem redireciona o trafego e o Caddy: cada site declara os dois containers como
# upstream com health check ativo (ver DEPLOY.md). Este script so liga e desliga
# container — nunca toca na configuracao do proxy.
#
# Uso: blue-green.sh <compose-file> <servico> <container> [env-file]
#   servico    nome base no compose (existem <servico>-blue e <servico>-green)
#   container  prefixo do container_name (existem <container>_blue e <container>_green)
# -E propaga o trap ERR para dentro das funcoes: sem ele a falha do `up --wait`
# acontece dentro de compose() e o trap de limpeza nunca roda
set -Eeuo pipefail

COMPOSE_FILE=$1
SERVICO=$2
CONTAINER=$3
ENV_FILE=${4:-}

compose() {
  if [ -n "$ENV_FILE" ]; then
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
  else
    docker compose -f "$COMPOSE_FILE" "$@"
  fi
}

rodando() {
  [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" = "true" ]
}

# a cor ativa vem do que esta no ar agora, nao de um arquivo de estado que pode
# dessincronizar da realidade. Sem nenhuma no ar (primeiro deploy), comeca em blue.
if rodando "${CONTAINER}_blue"; then
  ativa=blue
  nova=green
else
  ativa=green
  nova=blue
fi

echo "blue-green ${CONTAINER}: ativa=${ativa} -> nova=${nova}"

trap 'echo "blue-green: ${nova} nao subiu; mantendo ${ativa} no ar"; compose rm -sf "${SERVICO}-${nova}" || true' ERR

compose pull "${SERVICO}-${nova}"
# ponytail: --wait-timeout generoso porque o boot do backend depende do postgres;
# abaixe se o deploy ficar lento demais esperando um container que ja subiu.
compose up -d --wait --wait-timeout "${WAIT_TIMEOUT:-180}" "${SERVICO}-${nova}"

# desarma antes de mexer na antiga: um erro daqui pra baixo nao pode derrubar a
# cor nova, que a essa altura ja esta healthy e recebendo trafego
trap - ERR

compose rm -sf "${SERVICO}-${ativa}"
# faxina, nao etapa do deploy: a cor nova ja esta healthy e a antiga ja saiu. Dois CDs
# empurrados no mesmo push disputam o daemon e o perdedor recebe "a prune operation is
# already running" — sem o `|| true` isso reprovava um deploy que deu certo.
docker image prune -f || true
