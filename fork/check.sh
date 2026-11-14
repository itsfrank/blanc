#!/usr/bin/env bash
# Runs every patch's checks (fork/patches/*.check.sh) in ID order.
# Exits non-zero if any check fails. See FORK.md.
set -uo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root" || exit 1

shopt -s nullglob
checks=(fork/patches/[0-9][0-9][0-9][0-9]-*.check.sh)
if [ ${#checks[@]} -eq 0 ]; then
  echo "fork/check.sh: no patch checks found"
  exit 0
fi

failed=()
for check in "${checks[@]}"; do
  echo "==> $check"
  if bash "$check"; then
    echo "    ok"
  else
    echo "    FAILED"
    failed+=("$check")
  fi
done

echo
if [ ${#failed[@]} -gt 0 ]; then
  echo "fork/check.sh: ${#failed[@]} of ${#checks[@]} checks failed:"
  printf '  %s\n' "${failed[@]}"
  exit 1
fi
echo "fork/check.sh: all ${#checks[@]} checks passed"
