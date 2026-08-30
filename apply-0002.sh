#!/usr/bin/env bash
# apply-migration.sh 로 합쳐졌습니다. 하던 대로 쓰셔도 되게 넘겨만 줍니다.
exec "$(dirname "$0")/apply-migration.sh" recall_0002_visibility.sql
