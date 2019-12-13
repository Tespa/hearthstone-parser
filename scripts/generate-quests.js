// 1. Ask Blizzard API credential (https://develop.battle.net/access/clients)
// 2. Fetch all quest cards
// 3. Fetch cards from hearthstonejson
// 4. Make JSON with pairs of ID and description

const path = require("path");
const got = require("got");
const inquirer = require("inquirer");
const writeJson = require("write-json-file");

const getAccessToken = async () => {
	const { clientId, clientSecret } = await inquirer.prompt([
		{ name: "clientId" },
		{ name: "clientSecret" }
	]);
	const res = await got.post("https://us.battle.net/oauth/token", {
		form: true,
		auth: `${clientId}:${clientSecret}`,
		body: { grant_type: "client_credentials" }
	});
	return JSON.parse(res.body).access_token;
};

const getAllQuests = async accessToken => {
	const res = await got.get("https://us.api.blizzard.com/hearthstone/cards", {
		json: true,
		query: {
			locale: "en_US",
			textFilter: "<b>Quest:</b>",
			access_token: accessToken
		}
	});
	return res.body.cards;
};

const getAllCards = async () => {
	const res = await got.get(
		"https://api.hearthstonejson.com/v1/latest/enUS/cards.json",
		{ json: true }
	);
	return res.body;
};

const main = async () => {
	const accessToken = await getAccessToken();
	const quests = await getAllQuests(accessToken);
	const cards = await getAllCards();

	const questTexts = {};
	quests
		.map(quest => {
			return cards.find(c => c.dbfId === quest.id);
		})
		.sort((a, b) => a.id.localeCompare(b.id))
		.forEach(card => {
			questTexts[card.id] = `${card.cardClass}: ${card.text}`;
		});
	await writeJson(
		path.resolve(__dirname, "../src/data/quest-text-map.json"),
		questTexts
	);
};

main().catch(err => {
	console.error(err);
});
