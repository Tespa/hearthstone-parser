import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

// Check if a new game has started.
export class ChoiceIdParser extends AbstractLineParser {
	regex = /^\[Power\]\s+GameState\.DebugPrintEntityChoices\(\)\s+-\s+id=(\w+)\s+Player=(.*)\s+TaskList=.*\s+ChoiceType=GENERAL/;

	eventName = 'choice-id' as const;

	lineMatched([, choiceId, playerName]: string[], gameState: GameState): void {
		const player = gameState.getPlayerByName(playerName);
		if (!player) {
			return;
		}

		player.discovery.id = choiceId;
	}

	formatLogMessage([, choiceId, playerName]: string[]): string {
		return `Choice ID ${choiceId} is registered for ${playerName}`;
	}

	shouldEmit(): boolean {
		return false;
	}
}
