set -e

BRANCH_NAME="${RANDOM}"
COMMIT_MSG="fix(data): update cards.json"
PR_LABEL="update-data"

if git diff --quiet; then
	echo "There is no changes"
	exit 0
fi

if [[ $(gh pr list --label ${PR_LABEL} --state open) ]]; then
	echo "Update PR already open"
	exit 0
fi

git switch -c "${BRANCH_NAME}"
git add .
git commit -m "${COMMIT_MSG}"
gh pr create \
	--title "${COMMIT_MSG}" \
	--body "automatically opened PR to update data" \
	--head ${BRANCH_NAME} \
	--label ${PR_LABEL}
