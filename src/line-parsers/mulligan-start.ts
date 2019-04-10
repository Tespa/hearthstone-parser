import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

// Check when the Mulligan begins.
export class MulliganStartLineParser extends AbstractLineParser {
	regex = /\[Power\] GameState\.DebugPrintPower\(\) - TAG_CHANGE Entity=GameEntity tag=STEP value=BEGIN_MULLIGAN$/;

	eventName = 'mulligan-start';

	lineMatched(_parts: string[], gameState: GameState): void {
		gameState.friendlyCount = 30;
		gameState.opposingCount = 30;
	}

	formatLogMessage(): string {
		return 'A mulligan has begun.';
	}

	shouldEmit(): boolean {
		return true;
	}
}
