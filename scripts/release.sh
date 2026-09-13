#!/usr/bin/env bash
# scripts/release.sh <patch|minor> <changelog-entry-file> [--dry-run]
#
# Bumps VERSION (and package.json, when present), prepends the given
# changelog entry file's content into CHANGELOG.md, commits, tags
# vX.Y.Z, and pushes the current branch + tags.
#
# Refuses to run when the working tree is dirty except for the changelog
# entry file itself and docs/STATUS.json (both of which the release is
# expected to touch as part of the same commit).
#
# --dry-run prints every step it would take and changes nothing.

set -euo pipefail

usage() {
  echo "usage: $(basename "$0") <patch|minor> <changelog-entry-file> [--dry-run]" >&2
  exit 1
}

BUMP_KIND="${1:-}"
ENTRY_FILE="${2:-}"
DRY_RUN=false

for arg in "$@"; do
  if [[ "$arg" == "--dry-run" ]]; then
    DRY_RUN=true
  fi
done

if [[ "$BUMP_KIND" != "patch" && "$BUMP_KIND" != "minor" ]]; then
  usage
fi
if [[ -z "$ENTRY_FILE" || "$ENTRY_FILE" == "--dry-run" ]]; then
  usage
fi
if [[ ! -f "$ENTRY_FILE" ]]; then
  echo "error: changelog entry file not found: $ENTRY_FILE" >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if [[ ! -f VERSION ]]; then
  echo "error: VERSION file not found at repo root ($REPO_ROOT)" >&2
  exit 1
fi

run() {
  if $DRY_RUN; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

# --- dirty-tree check -------------------------------------------------
# Allowed to be dirty: the changelog entry file itself, and
# docs/STATUS.json. Everything else must be clean.
ENTRY_FILE_REL="$(python3 - "$ENTRY_FILE" <<'PY'
import os, sys
print(os.path.relpath(sys.argv[1]))
PY
)"

DIRTY_FILES="$(git status --porcelain | awk '{print $2}')"
OFFENDING=""
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if [[ "$f" == "$ENTRY_FILE_REL" || "$f" == "docs/STATUS.json" ]]; then
    continue
  fi
  OFFENDING="$OFFENDING $f"
done <<< "$DIRTY_FILES"

if [[ -n "$(echo "$OFFENDING" | tr -d '[:space:]')" ]]; then
  echo "error: working tree is dirty beyond the changelog entry and docs/STATUS.json:" >&2
  echo "$OFFENDING" >&2
  exit 1
fi

# --- version bump -------------------------------------------------------
CURRENT_VERSION="$(tr -d '[:space:]' < VERSION)"
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

if [[ "$BUMP_KIND" == "patch" ]]; then
  PATCH=$((PATCH + 1))
else
  MINOR=$((MINOR + 1))
  PATCH=0
fi
NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

echo "Releasing v${NEW_VERSION} (was v${CURRENT_VERSION}, ${BUMP_KIND} bump)"

if $DRY_RUN; then
  echo "[dry-run] would write VERSION: ${NEW_VERSION}"
else
  echo "$NEW_VERSION" > VERSION
fi

if [[ -f package.json ]]; then
  if $DRY_RUN; then
    echo "[dry-run] would set package.json version to ${NEW_VERSION}"
  else
    node -e '
      const fs = require("fs");
      const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
      p.version = process.argv[1];
      fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");
    ' "$NEW_VERSION"
  fi
fi

# --- changelog ------------------------------------------------------
DATE="$(date -u +%Y-%m-%d)"
HEADING="## [${NEW_VERSION}] - ${DATE}"

if $DRY_RUN; then
  echo "[dry-run] would prepend to CHANGELOG.md:"
  echo "$HEADING"
  cat "$ENTRY_FILE"
else
  # Everything before the first "## " heading (title + any preamble
  # paragraph, including its trailing blank line) is kept as-is above the
  # new entry; everything from the first "## " heading onward is kept
  # below it. If CHANGELOG.md doesn't exist yet or has no "## " section,
  # the new entry is simply appended after whatever is there.
  if [[ -f CHANGELOG.md ]] && grep -q '^## ' CHANGELOG.md; then
    PREAMBLE_END_LINE="$(grep -n '^## ' CHANGELOG.md | head -1 | cut -d: -f1)"
  elif [[ -f CHANGELOG.md ]]; then
    PREAMBLE_END_LINE=$(($(wc -l < CHANGELOG.md) + 1))
  else
    PREAMBLE_END_LINE=1
  fi

  TMP_CHANGELOG="$(mktemp)"
  {
    if [[ -f CHANGELOG.md ]]; then
      head -n "$((PREAMBLE_END_LINE - 1))" CHANGELOG.md
    fi
    echo "$HEADING"
    echo
    cat "$ENTRY_FILE"
    echo
    if [[ -f CHANGELOG.md ]]; then
      tail -n "+${PREAMBLE_END_LINE}" CHANGELOG.md
    fi
  } > "$TMP_CHANGELOG"
  mv "$TMP_CHANGELOG" CHANGELOG.md
fi

# --- commit, tag, push ------------------------------------------------
run git add VERSION CHANGELOG.md
[[ -f package.json ]] && run git add package.json
if [[ -f docs/STATUS.json ]]; then
  run git add docs/STATUS.json
fi

run git commit -m "chore(release): v${NEW_VERSION}"
run git tag -a "v${NEW_VERSION}" -m "v${NEW_VERSION}"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
run git push -u origin "$CURRENT_BRANCH"
run git push origin "v${NEW_VERSION}"

echo "Released v${NEW_VERSION}"
