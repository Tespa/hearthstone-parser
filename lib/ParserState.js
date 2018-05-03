'use strict';

class ParserState {
	constructor() {
		this.reset();
	}

	reset() {
		this.players = [];
		this.playerCount = 0;
		this.gameOverCount = 0;
	}
}

module.exports = ParserState;
