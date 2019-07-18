import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

// Check if a new game has started.
export class DiscoveryEndParser extends AbstractLineParser {
	regex = /^\[Power\]\s+ChoiceCardMgr\.WaitThenHideChoicesFromPacket\(\)\s+-\s+id=(\w+)\s+END\s+WAIT/;

	eventName = 'discovery-end' as const;

	lineMatched([, choiceId]: string[], gameState: GameState): void {
		const player = gameState.players.find(
			player => player.discovery.id === choiceId
		);

		if (!player) {
			return;
		}

		player.discovery.enabled = false;
	}

	formatLogMessage([, choiceId]: string[]): string {
		return `Discovery has ended for choice ID ${choiceId}`;
	}

	shouldEmit(): boolean {
		return true;
	}
}
