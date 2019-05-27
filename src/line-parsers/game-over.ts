import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

// Check if the game is over.
export class GameOverLineParser extends AbstractLineParser {
	regex = /\[Power\] PowerTaskList\.DebugPrintPower\(\) -\s+TAG_CHANGE Entity=(.*) tag=PLAYSTATE value=(LOST|WON|TIED)/;

	eventName = 'game-over' as const;

	lineMatched([, entity, status]: string[], gameState: GameState): void {
		// Set the status for the appropriate player.
		const player = gameState.getPlayerByName(entity);
		if (player && (status === 'WON' || status === 'LOST' || status === 'TIED')) {
			player.status = status;
		}

		gameState.gameOverCount++;
	}

	formatLogMessage(_: string[], gameState: GameState): string | false {
		if (gameState.gameOverCount === 2) {
			return 'The current game has ended.';
		}

		return false;
	}

	shouldEmit(gameState: GameState): boolean {
		// When both players have lost, emit a game-over event.
		return gameState.gameOverCount === 2;
	}
}
