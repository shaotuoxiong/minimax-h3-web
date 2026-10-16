#!/usr/bin/env bash
set -euo pipefail
project_dir=/home/sim/projects/minimax-h3-web
if ! curl -fsS --max-time 3 http://127.0.0.1:8188/system_stats >/dev/null; then
  nohup /home/sim/minimax-h3/start.sh >/home/sim/projects/minimax-h3-tools/logs/comfyui-start.log 2>&1 &
  for attempt in {1..60}; do
    if curl -fsS --max-time 2 http://127.0.0.1:8188/system_stats >/dev/null; then break; fi
    sleep 1
  done
fi
curl -fsS --max-time 3 http://127.0.0.1:8188/system_stats >/dev/null
systemctl --user start h3-api-router.service
curl --retry 5 --retry-connrefused --retry-delay 1 -fsS --max-time 5 http://127.0.0.1:8189/h3/api/system_stats >/dev/null
docker compose \
  -f /home/sim/models/ninfer-chat-web/compose.public.yml \
  -f "$project_dir/deploy/ngrok.override.yml" up -d --no-deps ngrok
echo 'Frontend: https://shaotuoxiong.github.io/minimax-h3-web/'
echo 'API: https://letdown-riverboat-flatware.ngrok-free.dev/h3'
