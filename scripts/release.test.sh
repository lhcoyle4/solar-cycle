#!/usr/bin/env bash
# scripts/release.test.sh — exercises scripts/release.sh end-to-end inside
# a throwaway git repository (with a throwaway bare "origin" remote so
# `git push` in release.sh has somewhere real to push to).
#
# Asserts: version bump, tag creation, changelog ordering, dirty-tree
# refusal, and that --dry-run leaves no trace.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_SH="$REPO_ROOT/scripts/release.sh"

PASS=0
FAIL=0

assert() {
  local desc="$1"
  local cond="$2"
  if [[ "$cond" == "0" ]]; then
    echo "  ok - $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL - $desc"
    FAIL=$((FAIL + 1))
  fi
}

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

BARE="$WORK/origin.git"
git init --bare -q -b main "$BARE"

REPO="$WORK/repo"
git clone -q "$BARE" "$REPO"
cd "$REPO"
git config user.name "Release Test"
git config user.email "release-test@example.com"
git checkout -q -B main

echo "1.2.3" > VERSION
echo '{"name":"fixture","version":"1.2.3"}' > package.json
cat > CHANGELOG.md <<'EOF'
# Changelog

## [1.2.3] - 2020-01-01

### Added
- Initial fixture entry.
EOF
git add -A
git commit -q -m "chore: fixture initial state"
git push -q -u origin main

echo "== release.sh test suite =="

# --- Test 1: --dry-run leaves no trace ---------------------------------
echo "### VersionEntry" > entry.md
echo "- would bump" >> entry.md
BEFORE_LOG="$(git log --oneline)"
BEFORE_TAGS="$(git tag)"
BEFORE_VERSION="$(cat VERSION)"

set +e
bash "$RELEASE_SH" patch entry.md --dry-run > /tmp/dry-run.out 2>&1
set -e
cat /tmp/dry-run.out

AFTER_LOG="$(git log --oneline)"
AFTER_TAGS="$(git tag)"
AFTER_VERSION="$(cat VERSION)"

if [[ "$AFTER_VERSION" == "$BEFORE_VERSION" ]]; then assert "dry-run does not modify VERSION" 0; else assert "dry-run does not modify VERSION" 1; fi
if [[ "$AFTER_LOG" == "$BEFORE_LOG" ]]; then assert "dry-run creates no commit" 0; else assert "dry-run creates no commit" 1; fi
if [[ "$AFTER_TAGS" == "$BEFORE_TAGS" ]]; then assert "dry-run creates no tag" 0; else assert "dry-run creates no tag" 1; fi
if grep -q "1.2.4" /tmp/dry-run.out; then assert "dry-run reports the version it would bump to" 0; else assert "dry-run reports the version it would bump to" 1; fi

rm -f entry.md

# --- Test 2: dirty-tree refusal -----------------------------------------
echo "### Entry" > entry.md
echo "- content" >> entry.md
echo "dirty" > dirty-file.txt

set +e
bash "$RELEASE_SH" patch entry.md > /tmp/dirty.out 2>&1
DIRTY_RC=$?
set -e
cat /tmp/dirty.out

if [[ "$DIRTY_RC" -ne 0 ]]; then assert "refuses to run with an unrelated dirty file" 0; else assert "refuses to run with an unrelated dirty file" 1; fi
if [[ "$(cat VERSION)" == "1.2.3" ]]; then assert "VERSION unchanged after refused dirty run" 0; else assert "VERSION unchanged after refused dirty run" 1; fi

rm -f dirty-file.txt entry.md

# --- Test 3: real patch release -----------------------------------------
echo "### Patch release" > entry.md
echo "- Did a thing." >> entry.md

bash "$RELEASE_SH" patch entry.md > /tmp/patch.out 2>&1
cat /tmp/patch.out

if [[ "$(cat VERSION)" == "1.2.4" ]]; then assert "VERSION bumped to 1.2.4 for patch release" 0; else assert "VERSION bumped to 1.2.4 for patch release" 1; fi

if node -e 'const p=require("./package.json"); process.exit(p.version==="1.2.4"?0:1)'; then
  assert "package.json version bumped" 0
else
  assert "package.json version bumped" 1
fi

if git tag | grep -q "^v1.2.4$"; then assert "tag v1.2.4 created" 0; else assert "tag v1.2.4 created" 1; fi
if git log -1 --format=%s | grep -q "chore(release): v1.2.4"; then assert "release commit message correct" 0; else assert "release commit message correct" 1; fi
if head -n1 CHANGELOG.md | grep -q "^# Changelog$"; then assert "changelog title preserved at top" 0; else assert "changelog title preserved at top" 1; fi
if sed -n '3p' CHANGELOG.md | grep -q "1.2.4"; then assert "new entry heading is the first ## section" 0; else assert "new entry heading is the first ## section" 1; fi

NEW_LINE="$(grep -n "1.2.4" CHANGELOG.md | head -1 | cut -d: -f1)"
OLD_LINE="$(grep -n "1.2.3" CHANGELOG.md | head -1 | cut -d: -f1)"
if [[ "$NEW_LINE" -lt "$OLD_LINE" ]]; then assert "new changelog entry appears before the old one" 0; else assert "new changelog entry appears before the old one" 1; fi

if git ls-remote --tags "$BARE" | grep -q "refs/tags/v1.2.4"; then assert "tag pushed to origin" 0; else assert "tag pushed to origin" 1; fi
REMOTE_HEAD="$(git ls-remote "$BARE" refs/heads/main | cut -f1)"
LOCAL_HEAD="$(git rev-parse HEAD)"
if [[ "$REMOTE_HEAD" == "$LOCAL_HEAD" ]]; then assert "branch pushed to origin" 0; else assert "branch pushed to origin" 1; fi

rm -f entry.md

# --- Test 4: minor release bump -----------------------------------------
echo "### Minor release" > entry.md
echo "- Milestone." >> entry.md
bash "$RELEASE_SH" minor entry.md > /tmp/minor.out 2>&1
if [[ "$(cat VERSION)" == "1.3.0" ]]; then assert "minor bump resets patch to 0" 0; else assert "minor bump resets patch to 0" 1; fi

echo
echo "== $PASS passed, $FAIL failed =="
[[ "$FAIL" -eq 0 ]]
