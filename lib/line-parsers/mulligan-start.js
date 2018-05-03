'use strict';

const beginMulliganRegex = /\[Power\] GameState\.DebugPrintPower\(\) - TAG_CHANGE Entity=GameEntity tag=STEP value=BEGIN_MULLIGAN$/;

// Check when the Mulligan begins.
module.exports = function (line, state, emitter, log) {
	if (!beginMulliganRegex.test(line)) {
		return;
	}

	state.friendlyCount = 30;
	state.opposingCount = 30;
	log.main('A mulligan has begun.');
	emitter.emit('mulligan');
};
