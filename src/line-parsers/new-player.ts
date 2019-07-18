import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

// Check for players entering play and track their team IDs.
export class NewPlayerLineParser extends AbstractLineParser {
	regex = /\[Power\] GameState\.DebugPrintGame\(\) - PlayerID=(\d), PlayerName=(.*)$/;

	eventName = 'player-joined' as const;

	lineMatched(parts: string[], gameState: GameState): void {
		if (parts[2] === 'UNKNOWN HUMAN PLAYER') {
			return;
		}

		gameState.addPlayer({
			id: parseInt(parts[1], 10),
			name: parts[2],
			status: '',
			turn: false,
			questCounter: -1,
			timeout: 45,
			cardCount: 0,
			position: gameState.numPlayers === 0 ? 'bottom' : 'top',
			secrets: [],
			discovery: {
				enabled: false,
				id: null
			}
		});
	}

	formatLogMessage(parts: string[]): string {
		return `Player "${parts[2]}" has joined (ID: ${parseInt(parts[1], 10)}).`;
	}

	shouldEmit(): boolean {
		return true;
	}
}
