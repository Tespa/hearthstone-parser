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
		if (player) {
			player.turn = data.turn;

			// Player 1's opponent is Player 2, Player 2's opponent is Player 1
			const opponent = gameState.getPlayerById(3 - player.id);

			// Turn opponent of the matched player opposite of the turn value
			if (opponent) {
				opponent.turn = !data.turn;
			}

			// Update turn history
			if (data.turn) {
				player.turnHistory.push({startTime: Date.now()});
			} else if (player.turnHistory.length > 0) {
				const lastTurn = player.turnHistory[player.turnHistory.length - 1];
				lastTurn.duration = Date.now() - lastTurn.startTime;
			}
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
