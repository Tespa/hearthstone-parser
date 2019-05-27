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
	regex = /^\[Power\] PowerTaskList.DebugPrintPower\(\) -\s+TAG_CHANGE Entity=([a-zA-Z0-9#]*) tag=(.*) value=(.*)/;

	eventName = 'game-tag-change' as const;

	lineMatched(parts: string[], gameState: GameState): void {
		const data = formatParts(parts);

		if (data.entity === 'GameEntity' && data.tag === 'STEP' && data.value === 'MAIN_READY') {
			gameState.mulliganActive = false;
			gameState.turnStartTime = new Date();
		}

		if (data.tag === 'MULLIGAN_STATE' && data.value === 'DEALING') {
			gameState.mulliganActive = true;
		}

		if (data.tag === 'TIMEOUT') {
			const timeout = parseInt(data.value, 10);
			const player = gameState.getPlayerByName(data.entity);
			if (player) {
				player.timeout = timeout;
			}
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
