import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

function formatParts(parts: string[]) {
	return {
		playerName: parts[1],
		turn: Boolean(parseInt(parts[2], 10))
	};
}

// Check if the current turn has changed.
export class TurnLineParser extends AbstractLineParser {
	regex = /^\[Power\] GameState\.DebugPrintPower\(\) -\s*TAG_CHANGE Entity=(.*) tag=CURRENT_PLAYER value=(\d)/;
	eventName = 'turn-change';

	lineMatched(parts: string[], gameState: GameState) {
		const data = formatParts(parts);
		const player = gameState.getPlayerByName(data.playerName);
		if (!player) {
			if (gameState.numPlayers === 1) {
				const allPlayers = gameState.getAllPlayers();
				const existingPlayerId = allPlayers[0].id;
				gameState.addPlayer({
					id: existingPlayerId === 1 ? 2 : 1,
					name: data.playerName,
					status: '',
					turn: data.turn
				});
			}
			return;
		}

		player.turn = data.turn;
	}

	formatLogMessage(parts: string[], _gameState: GameState) {
		const data = formatParts(parts);
		const turnState = data.turn ? 'begun' : 'ended';
		return `${data.playerName}'s turn has ${turnState}`;
	}

	shouldEmit(_gameState: GameState) {
		return true;
	}
}