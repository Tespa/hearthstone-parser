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
			// Calculate turn duration of the current player, since it ended
			const currentPlayer = gameState.players.find(p => p.turn);
			if (currentPlayer && currentPlayer?.turnHistory?.length > 0) {
				const lastTurn = currentPlayer.turnHistory[currentPlayer.turnHistory.length - 1];
				lastTurn.duration = Date.now() - lastTurn.startTime;
			}

			return 'The current game has ended.';
		}

		return false;
	}

	shouldEmit(gameState: GameState): boolean {
		// When both players have lost, emit a game-over event.
		return gameState.gameOverCount === 2;
	}
}
