import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

interface Parts {
	tag: string;
	value: string;
}

function formatParts(parts: string[]): Parts {
	return {
		tag: parts[1],
		value: parts[2].trim()
	};
}

// Check for gamestate tag changes.
export class GameTagChangeLineParser extends AbstractLineParser {
	regex = /^\[Power\] GameState.DebugPrintPower\(\) -\s+TAG_CHANGE Entity=GameEntity tag=(.*) value=(.*)/;

	eventName = 'game-tag-change' as const;

	lineMatched(parts: string[], gameState: GameState): void {
		const data = formatParts(parts);

		if (data.tag === 'STEP' && data.value === 'MAIN_READY') {
			gameState.mulliganActive = false;
		}

		if (data.tag === 'STEP' && data.value === 'BEGIN_MULLIGAN') {
			gameState.mulliganActive = true;
		}
	}

	formatLogMessage(parts: string[]): string {
		const data = formatParts(parts);
		return `Tag ${data.tag} of GameEntity set to ${data.value}`;
	}

	shouldEmit(): boolean {
		return true;
	}
}
