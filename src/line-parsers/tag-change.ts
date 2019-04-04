import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

function formatParts(parts: string[]) {
	return {
		cardName: parts[1],
		entityId: parseInt(parts[2], 10),
		cardId: parts[3],
		playerId: parseInt(parts[4], 10),
		tag: parts[5],
		value: parseInt(parts[6], 10)
	};
}

// Check if a card is changing tags.
export class TagChangeLineParser extends AbstractLineParser {
	regex = /^\[Power\] GameState.DebugPrintPower\(\) -\s+TAG_CHANGE Entity=\[entityName=(.*) id=(\d*) zone=.* zonePos=\d* cardId=(.*) player=(\d)\] tag=(.*) value=(\d*)/;
	eventName = 'tag-change';

	lineMatched(parts: string[], gameState: GameState) {
		const data = formatParts(parts);

		if (data.tag !== 'QUEST_PROGRESS') {
			return;
		}
		const player = gameState.getPlayerById(data.playerId);
		if (player) {
			player.questCounter = data.value;
		}
	}

	formatLogMessage(parts: string[], _gameState: GameState) {
		const data = formatParts(parts);
		return `Tag ${data.tag} of player ${data.playerId}'s ${data.cardName} set to ${data.value}`;
	}

	shouldEmit(_gameState: GameState) {
		return true;
	}
}