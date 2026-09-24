#!/usr/bin/env bash
# Cut a release from development and ship it to production.
#
#   ./release.sh               interactive release
#   ./release.sh --dry-run     show what would happen; change nothing
#   ./release.sh --skip-checks skip the lint, test and build checks
#
# Steps: check that development is clean and in sync with origin, read the current
# version, ask for a major/minor/patch bump, run the checks, bump the version
# in backend/pyproject.toml (+ uv.lock) and frontend/package.json (+ lock),
# update CHANGELOG.md, commit, tag vX.Y.Z, fast-forward the production branch
# to the tag, and push development, production and the tag in one atomic push.
# Railway deploys the production branch. The process is in docs/RELEASING.md.
set -euo pipefail
cd "$(dirname "$0")"

REMOTE=origin
DEVELOPMENT=development
PRODUCTION=production

DRY_RUN=false
SKIP_CHECKS=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --skip-checks) SKIP_CHECKS=true ;;
    -h | --help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg (see --help)" >&2; exit 2 ;;
  esac
done

log() { printf '\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
confirm() {
  local reply
  read -r -p "$1 [y/N] " reply
  [[ "$reply" =~ ^[Yy]([Ee][Ss])?$ ]]
}

for tool in git uv npm node; do
  command -v "$tool" >/dev/null || die "$tool is not installed"
done

# --- Preconditions -----------------------------------------------------------

branch=$(git rev-parse --abbrev-ref HEAD)
[[ "$branch" == "$DEVELOPMENT" ]] || die "releases are cut from $DEVELOPMENT; you are on $branch"
[[ -z "$(git status --porcelain)" ]] || die "working tree is not clean; commit or stash first"

log "Fetching $REMOTE"
git fetch --quiet --tags "$REMOTE"
git merge-base --is-ancestor "$REMOTE/$DEVELOPMENT" HEAD \
  || die "$DEVELOPMENT is behind $REMOTE/$DEVELOPMENT; pull first"
unpushed=$(git log --oneline "$REMOTE/$DEVELOPMENT..HEAD")
if [[ -n "$unpushed" ]]; then
  echo "These commits on $DEVELOPMENT are not on $REMOTE yet and will ship with the release:"
  echo "$unpushed" | sed 's/^/  /'
fi

# production may only move forward, so a hotfix pushed straight to it must be
# merged back into development before the next release.
if git rev-parse --verify --quiet "$REMOTE/$PRODUCTION" >/dev/null; then
  git merge-base --is-ancestor "$REMOTE/$PRODUCTION" HEAD \
    || die "$REMOTE/$PRODUCTION has commits that are not on $DEVELOPMENT; merge them into $DEVELOPMENT first"
fi

# --- Current version ---------------------------------------------------------

pyproject_version=$(uv version --project backend --short)
frontend_version=$(node -p 'require("./frontend/package.json").version')
[[ "$pyproject_version" == "$frontend_version" ]] \
  || die "backend ($pyproject_version) and frontend ($frontend_version) versions differ; fix by hand"

last_tag=$(git describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null || true)
if [[ -n "$last_tag" ]]; then
  current=${last_tag#v}
  [[ "$current" == "$pyproject_version" ]] \
    || die "last tag is $last_tag but backend/pyproject.toml says $pyproject_version; fix by hand"
  range="$last_tag..HEAD"
else
  current=$pyproject_version
  range=HEAD
fi
[[ "$current" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] || die "current version '$current' is not X.Y.Z"
major=${BASH_REMATCH[1]} minor=${BASH_REMATCH[2]} patch=${BASH_REMATCH[3]}

changes=$(git log --no-merges --format='%s' "$range")
[[ -n "$changes" ]] || die "no commits since $last_tag; nothing to release"

echo
echo "Current version: ${last_tag:-v$current (untagged; first release)}"
echo "Changes since ${last_tag:-the beginning}:"
echo "$changes" | sed 's/^/  /'
echo

# Suggest a bump from the Conventional Commit types.
if [[ -z "$last_tag" ]]; then
  suggested=keep
elif git log --format='%B' "$range" | grep -qE '^[a-z]+(\([^)]*\))?!:|^BREAKING[ -]CHANGE:'; then
  suggested=major
elif echo "$changes" | grep -qE '^feat(\([^)]*\))?:'; then
  suggested=minor
else
  suggested=patch
fi

# --- Choose the bump ---------------------------------------------------------

if [[ -z "$last_tag" ]]; then
  echo "  0) keep  -> $current   (tag the current version as the first release)"
fi
echo "  1) major -> $((major + 1)).0.0"
echo "  2) minor -> $major.$((minor + 1)).0"
echo "  3) patch -> $major.$minor.$((patch + 1))"
read -r -p "Release type [suggested: $suggested]: " choice
case "${choice:-$suggested}" in
  0 | keep) [[ -z "$last_tag" ]] || die "keep is only for the first release"; new=$current ;;
  1 | major) new="$((major + 1)).0.0" ;;
  2 | minor) new="$major.$((minor + 1)).0" ;;
  3 | patch) new="$major.$minor.$((patch + 1))" ;;
  *) die "unknown release type '$choice'" ;;
esac
tag="v$new"

git rev-parse --verify --quiet "refs/tags/$tag" >/dev/null && die "tag $tag already exists"
[[ -z "$(git ls-remote --tags "$REMOTE" "refs/tags/$tag")" ]] || die "tag $tag already exists on $REMOTE"

# --- Checks ------------------------------------------------------------------

if $SKIP_CHECKS; then
  log "Skipping checks (--skip-checks)"
else
  log "Running pre-commit hooks"
  uv run --project backend pre-commit run --all-files
  log "Running backend tests"
  (cd backend && uv run pytest -q)
  log "Running frontend tests"
  (cd frontend && npm test)
  log "Building the frontend"
  (cd frontend && npm run build)
  [[ -z "$(git status --porcelain)" ]] || die "the checks changed files; commit the fixes first"
fi

if $DRY_RUN; then
  echo
  log "Dry run: would release $tag"
  echo "  bump $current -> $new in backend/pyproject.toml, uv.lock, frontend/package.json, package-lock.json"
  echo "  update CHANGELOG.md, commit 'chore(release): $tag', tag $tag"
  echo "  move $PRODUCTION to $tag and push $DEVELOPMENT, $PRODUCTION and $tag to $REMOTE"
  exit 0
fi

echo
confirm "Release $tag and deploy it to production?" || die "aborted"

# --- Bump, commit, tag -------------------------------------------------------

start=$(git rev-parse HEAD)
# Past this point a failure leaves local changes; say how to undo them.
trap 'echo; echo "Release failed before pushing. To undo local changes:"; \
  echo "  git reset --hard $start && git tag -d $tag 2>/dev/null; git branch -f $PRODUCTION $REMOTE/$PRODUCTION 2>/dev/null"' ERR

if [[ "$new" != "$current" ]]; then
  log "Bumping version to $new"
  uv version --project backend --no-sync "$new" >/dev/null
  (cd frontend && npm version "$new" --no-git-tag-version >/dev/null)
fi

log "Updating CHANGELOG.md"
uv run --project backend cz changelog --incremental --unreleased-version "$tag"
# Let the whitespace hooks tidy the generated changelog before committing.
uv run --project backend pre-commit run --files CHANGELOG.md >/dev/null || true

git add CHANGELOG.md backend/pyproject.toml backend/uv.lock frontend/package.json frontend/package-lock.json
git commit --quiet -m "chore(release): $tag"
git tag -a "$tag" -m "Release $tag"

# --- Ship --------------------------------------------------------------------

log "Moving $PRODUCTION to $tag"
git branch -f "$PRODUCTION" "$tag"

log "Pushing $DEVELOPMENT, $PRODUCTION and $tag to $REMOTE"
# Atomic: all three refs update or none do. No --force, so production can only
# fast-forward.
git push --atomic "$REMOTE" "$DEVELOPMENT" "$PRODUCTION" "$tag"
trap - ERR

echo
log "Released $tag"
echo "Railway now deploys $PRODUCTION. Once it is live, check the version:"
echo "  curl -s https://<production-host>/api/v1/health   # expect \"version\": \"$new\""
