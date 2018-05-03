'use strict';

const zoneChangeRegex = /^\[Zone\] ZoneChangeList.ProcessChanges\(\) - id=\d* local=.* \[entityName=(.*) id=(\d*) zone=.* zonePos=\d* cardId=(.*) player=(\d)\] zone from ?(FRIENDLY|OPPOSING)? ?(.*)? -> ?(FRIENDLY|OPPOSING)? ?(.*)?$/;

// Check if a card is changing zones.
module.exports = function (line, state, emitter, log) {
	if (!zoneChangeRegex.test(line)) {
		return;
	}

	const parts = zoneChangeRegex.exec(line);
	const data = {
		cardName: parts[1],
		entityId: parseInt(parts[2], 10),
		cardId: parts[3],
		playerId: parseInt(parts[4], 10),
		fromTeam: parts[5],
		fromZone: parts[6],
		toTeam: parts[7],
		toZone: parts[8],
		fCount: state.friendlyCount,
		oCount: state.opposingCount
	};

	log.zoneChange('%s moved from %s %s to %s %s.', data.cardName, data.fromTeam, data.fromZone, data.toTeam, data.toZone);
	emitter.emit('zone-change', data);

	if (data.toTeam === 'FRIENDLY' && data.toZone === 'DECK') {
		// If entering the deck, increment deck count
		state.friendlyCount++;
	} else if (data.fromTeam === 'FRIENDLY' && data.fromZone === 'DECK') {
		// If drawn from deck, decrement deck count
		state.friendlyCount--;
	} else if (data.toTeam === 'OPPOSING' && data.toZone === 'DECK') {
		// If entering the deck, increment deck count
		state.opposingCount++;
	} else if (data.fromTeam === 'OPPOSING' && data.fromZone === 'DECK') {
		state.opposingCount--;
	}

	// Console.log('Friendly deck: %d', friendlyCount);
	// console.log('Opposing deck: %d', opposingCount);

	// Only zone transitions show both the player ID and the friendly or opposing zone type. By tracking entities going into
	// the "PLAY (Hero)" zone we can then set the player's team to FRIENDLY or OPPOSING. Once both players are associated with
	// a team we can emite the game-start event.
	// if (data.toZone == 'PLAY (Hero)') {
	//   console.log("Players: ", parserState.players);
	//   parserState.players.forEach(function (player) {
	//     if (player.id == data.playerId) {
	//       player.team = data.toTeam;
	//       parserState.playerCount++;
	//       if (parserState.playerCount == 2) {
	//         console.log('A game has started.');
	//         log.gameStart('A game has started.');
	//         this.emit('game-start', parserState.players);
	//       }
	//     }
	//   });
	// }
};
