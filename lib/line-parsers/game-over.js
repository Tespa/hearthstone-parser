'use strict';

const gameOverRegex = /\[Power\] GameState\.DebugPrintPower\(\) - TAG_CHANGE Entity=(.*) tag=PLAYSTATE value=(LOST|WON|TIED)/;

// Check if the game is over.
module.exports = function (line, state, emitter, log) {
	if (!gameOverRegex.test(line)) {
		return;
	}

	// Set the status for the appropriate player.
	const [parsedName, parsedStatus] = gameOverRegex.exec(line);
	state.players.forEach(player => {
		if (player.name === parsedName) {
			player.status = parsedStatus;
		}
	});

	state.gameOverCount++;

	// When both players have lost, emit a game-over event.
	if (state.gameOverCount === 2) {
		log.gameOver('The current game has ended.');
		emitter.emit('game-over');
	}
};
