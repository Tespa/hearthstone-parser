import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

// Check for players entering play and track their team IDs.
export class NewPlayerLineParser extends AbstractLineParser {
	regex = /\[Power\] GameState\.DebugPrintGame\(\) - PlayerID=(.*) PlayerName=(.*)$/;
	eventName = 'player-joined';

	lineMatched(parts: string[], gameState: GameState) {
		gameState.players.push({
			id: parseInt(parts[1], 10),
			name: parts[2],
			status: ''
		});
	}

	formatLogMessage(parts: string[], _gameState: GameState) {
		return `Player "${parts[2]}" has joined.`;
	}

	shouldEmit(_gameState: GameState) {
		return true;
	}
}
