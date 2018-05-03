'use strict';

class ParserState {
	constructor() {
		this.reset();
	}

	reset() {
		this.players = [];
		this.playerCount = 0;
		this.gameOverCount = 0;
		this.friendlyCount = 0;
		this.opposingCount = 0;
	}
}

module.exports = ParserState;
