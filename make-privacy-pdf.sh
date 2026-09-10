#!/usr/bin/env bash
# build-privacy.sh 로 합쳐졌습니다 (PDF + web/privacy.html). 넘겨만 줍니다.
exec "$(dirname "$0")/build-privacy.sh" "$@"
