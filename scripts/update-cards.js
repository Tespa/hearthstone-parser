const path = require("path");
const fs = require("fs");
const os = require("os");
const got = require("got");

const main = async () => {
	const { body: cards } = await got.get(
		"https://api.hearthstonejson.com/v1/latest/enUS/cards.json",
		{
			json: true,
		}
	);

	fs.writeFileSync(
		path.resolve(__dirname, "../data/cards.json"),
		JSON.stringify(cards)
	);

	const secretsInfo = cards
		.filter((card) => card.text && card.text.includes("<b>Secret:</b>"))
		.map((card) => `${card.id} | ${card.cardClass}`)
		.join(os.EOL);

	const questsInfo = cards
		.filter((card) => card.text && card.text.includes("<b>Quest:</b>"))
		.map(
			(card) =>
				`${card.id} | ${card.cardClass} | ${card.text.replace(
					/\n/g,
					" "
				)}`
		)
		.join(os.EOL);

	const sidequestsInfo = cards
		.filter((card) => card.text && card.text.includes("<b>Sidequest:</b>"))
		.map(
			(card) =>
				`${card.id} | ${card.cardClass} | ${card.text.replace(
					/\n/g,
					" "
				)}`
		)
		.join(os.EOL);

	fs.writeFileSync(
		path.resolve(__dirname, "../data/secrets.txt"),
		secretsInfo
	);
	fs.writeFileSync(path.resolve(__dirname, "../data/quests.txt"), questsInfo);
	fs.writeFileSync(
		path.resolve(__dirname, "../data/sidequests.txt"),
		sidequestsInfo
	);
};

main().catch((err) => {
	console.error(err);
});
