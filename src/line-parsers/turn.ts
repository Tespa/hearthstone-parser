import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

interface Parts {
	playerName: string;
	turn: boolean;
}

function formatParts(parts: string[]): Parts {
	return {
		playerName: parts[1],
		turn: Boolean(parseInt(parts[2], 10))
	};
}

// Check if the current turn has changed.
export class TurnLineParser extends AbstractLineParser {
	regex = /^\[Power\] PowerTaskList\.DebugPrintPower\(\) -\s*TAG_CHANGE Entity=(.*) tag=CURRENT_PLAYER value=(\d)/;

	eventName = 'turn-change' as const;

	lineMatched(parts: string[], gameState: GameState): void {
		const data = formatParts(parts);
		const player = gameState.getPlayerByName(data.playerName);
		if (!player) {
			if (gameState.numPlayers === 1) {
				const allPlayers = gameState.getAllPlayers();
				const existingPlayerId = allPlayers[0].id;
				const existingPlayerPosition = allPlayers[0].position;
				gameState.addPlayer({
					id: existingPlayerId === 1 ? 2 : 1,
					name: data.playerName,
					status: '',
					turn: data.turn,
					questCounter: -1,
					timeout: 45,
					cardCount: 0,
					position: existingPlayerPosition === 'top' ? 'bottom' : 'top',
					secrets: []
				});
			}

			return;
		}

		player.turn = data.turn;

		const opponent = gameState.getPlayerById(3 - player.id); // Player 1's opponent is Player 2, Player 2's opponent is Player 1

		// Turn opponent of the matched player opposite of the turn value
		if (opponent) {
			opponent.turn = !data.turn;
		}
	}

	formatLogMessage(parts: string[]): string {
		const data = formatParts(parts);
		const turnState = data.turn ? 'begun' : 'ended';
		return `${data.playerName}'s turn has ${turnState}`;
	}

	shouldEmit(): boolean {
		return true;
	}
}
