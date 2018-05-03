'use strict';

const newPlayerRegex = /\[Power\] GameState\.DebugPrintGame\(\) - PlayerID=(.*) PlayerName=(.*)$/;

// Check for players entering play and track their team IDs.
module.exports = function (line, state, emitter, log) {
	if (!newPlayerRegex.test(line)) {
		return;
	}

	const parts = newPlayerRegex.exec(line);
	state.players.push({
		id: parseInt(parts[1], 10),
		name: parts[2]
	});
	log.gameStart('A player has joined.');
	emitter.emit('player-joined', state.players);
};
