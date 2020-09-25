CARDS_JSON_FILE="data/cards.json"
BRANCH_NAME=${RANDOM}
curl -L https://api.hearthstonejson.com/v1/latest/enUS/cards.json > ${CARDS_JSON_FILE}

if [[ "$(git diff --name-only)" == *"${CARDS_JSON_FILE}"* ]]; then
	git switch -c ${BRANCH_NAME}
	git add ${CARDS_JSON_FILE}
	git commit -m "fix: update cards.json"
	git push -u origin ${BRANCH_NAME}
	gh pr create --fill --head ${BRANCH_NAME}
fi
