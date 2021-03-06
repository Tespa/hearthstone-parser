import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

// Check if a new game has started.
export class GameStartLineParser extends AbstractLineParser {
	regex = /\[Power\] GameState\.DebugPrintPower\(\) -\s*CREATE_GAME/;

	eventName = 'game-start' as const;

	lineMatched(_: string[], gameState: GameState): void {
		gameState.start();
	}

	formatLogMessage(): string {
		return 'A new game has started.';
	}

	shouldEmit(): boolean {
		return true;
	}
}
