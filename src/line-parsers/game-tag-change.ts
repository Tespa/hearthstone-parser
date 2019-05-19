import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

interface Parts {
	trigger: 'state' | 'animation';
	entity: string;
	tag: string;
	value: string;
}

function formatParts(parts: string[]): Parts {
	return {
		trigger: parts[1] === 'GameState' ? 'state' : 'animation',
		entity: parts[2],
		tag: parts[3],
		value: parts[4].trim()
	};
}

// Check for gamestate tag changes.
export class GameTagChangeLineParser extends AbstractLineParser {
	regex = /^\[Power\] (GameState|PowerTaskList).DebugPrintPower\(\) -\s+TAG_CHANGE Entity=([a-zA-Z0-9#]*) tag=(.*) value=(.*)/;

	eventName = 'game-tag-change' as const;

	lineMatched(parts: string[], gameState: GameState): void {
		const data = formatParts(parts);

		if (data.entity === 'GameEntity' && data.tag === 'STEP') {
			if (data.trigger === 'animation' && data.value === 'MAIN_ACTION') {
				gameState.mulliganActive = false;
				gameState.turnStartTime = new Date();
			}
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
