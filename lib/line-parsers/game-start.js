'use strict';

const gameStartRegex = /\[Power\] PowerTaskList\.DebugPrintPower\(\) -\s*CREATE_GAME/;

// Check if the game is over.
module.exports = function (line, state, emitter, log) {
	if (!gameStartRegex.test(line)) {
		return;
	}

	log.gameOver('A new game has started.');
	emitter.emit('game-start');
	state.reset();
};
