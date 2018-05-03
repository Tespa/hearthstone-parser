import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

// Check if a new game has started.
export class GameStartLineParser extends AbstractLineParser {
	regex = /\[Power\] GameState\.DebugPrintPower\(\) -\s*CREATE_GAME/;
	eventName = 'game-start';

	lineMatched(_parts: string[], gameState: GameState) {
		gameState.reset();
	}

	formatLogMessage(_parts: string[], _gameState: GameState) {
		return 'A new game has started.';
	}

	shouldEmit(_gameState: GameState) {
		return true;
	}
}
