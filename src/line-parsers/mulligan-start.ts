import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

// Check if a new game has started.
export class MulliganStartParser extends AbstractLineParser {
	regex = /\[Power\] GameState\.DebugPrintPower\(\) -\s*tag=MULLIGAN_STATE value=INPUT/;

	eventName = 'mulligan-start' as const;

	lineMatched(_: string[], gameState: GameState): void {
		gameState.mulliganActive = true;
	}

	formatLogMessage(): string {
		return 'Mulligan has started.';
	}

	shouldEmit(): boolean {
		return true;
	}
}
