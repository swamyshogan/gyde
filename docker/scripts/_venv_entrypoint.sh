#! /usr/bin/env bash

set -e -o pipefail
VIRTUAL_ENV_DISABLE_PROMPT=1 source /opt/venv/bin/activate
[ "$#" -gt 0 ] && exec "$@" || exec bash
