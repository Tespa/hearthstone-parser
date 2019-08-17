import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

interface Parts {
	entity: string;
	tag: string;
	value: string;
}

function formatParts(parts: string[]): Parts {
	return {
		entity: parts[1],
		tag: parts[2],
		value: parts[3].trim()
	};
}

// Check for gamestate tag changes.
export class GameTagChangeLineParser extends AbstractLineParser {
	regex = /^\[Power\] PowerTaskList.DebugPrintPower\(\) -\s+TAG_CHANGE Entity=(.*) tag=(.*) value=(.*)/;

	eventName = 'game-tag-change' as const;

	lineMatched(parts: string[], gameState: GameState): void {
		const data = formatParts(parts);

		if (data.entity === 'GameEntity' && data.value === 'MAIN_READY') {
			if (data.tag === 'NEXT_STEP') {
				gameState.mulliganActive = false;
			}

			if (data.tag === 'STEP') {
				gameState.turnStartTime = new Date();

				// Neither of players have turn true which means bottom player is playing first
				if (gameState.players.every(player => !player.turn)) {
					const bottomPlayer = gameState.getPlayerByPosition('bottom');
					if (bottomPlayer) {
						bottomPlayer.turn = true;
					}
				}
			}
		}

		if (data.tag === 'TIMEOUT') {
			const timeout = parseInt(data.value, 10);
			const player = gameState.getPlayerByName(data.entity);
			if (player) {
				player.timeout = timeout;
			}
		}

		if (data.tag === 'MULLIGAN_STATE' && data.value === 'INPUT') {
			gameState.mulliganActive = true;
		}
	}

	formatLogMessage(parts: string[]): string {
		const data = formatParts(parts);
		return `Tag ${data.tag} of ${data.entity} set to ${data.value}`;
	}

	shouldEmit(): boolean {
		return true;
	}
}
