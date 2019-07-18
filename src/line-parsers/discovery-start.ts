import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

// Check if a new game has started.
export class DiscoveryStartParser extends AbstractLineParser {
	regex = /^\[Power\]\s+ChoiceCardMgr\.WaitThenShowChoices\(\)\s+-\s+id=(\w+)\s+BEGIN/;

	eventName = 'discovery-start' as const;

	lineMatched([, choiceId]: string[], gameState: GameState): void {
		const player = gameState.players.find(player => player.discovery.id === choiceId);
		if (!player) {
			return;
		}

		player.discovery.enabled = true;
	}

	formatLogMessage([, choiceId]: string[]): string {
		return `Discovery has started for choice ID ${choiceId}`;
	}

	shouldEmit(): boolean {
		return true;
	}
}
