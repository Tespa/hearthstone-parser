import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

// For now, we hard code quest ids, as there are a limited number of unique quests. Later, if we want to implement secret tracking, we should use hearthstonejson to recognize whether a card is a secret or a quest
const quests = ['UNG_028', 'UNG_067', 'UNG_116', 'UNG_829', 'UNG_920', 'UNG_934', 'UNG_940', 'UNG_942', 'UNG_954'];

interface Parts {
	cardName: string;
	entityId: number;
	cardId: string;
	playerId: number;
	fromTeam: string;
	fromZone: string;
	toTeam: string;
	toZone: string;
}

function formatParts(parts: string[]): Parts {
	return {
		cardName: parts[1],
		entityId: parseInt(parts[2], 10),
		cardId: parts[3],
		playerId: parseInt(parts[4], 10),
		fromTeam: parts[5],
		fromZone: parts[6],
		toTeam: parts[7],
		toZone: parts[8]
	};
}

// Check if a card is changing zones.
export class ZoneChangeLineParser extends AbstractLineParser {
	regex = /^\[Zone\] ZoneChangeList.ProcessChanges\(\) - id=\d* local=.* \[entityName=(.*) id=(\d*) zone=.* zonePos=\d* cardId=(.*) player=(\d)\] zone from ?(FRIENDLY|OPPOSING)? ?(.*)? -> ?(FRIENDLY|OPPOSING)? ?(.*)?$/;

	eventName = 'zone-change' as const;

	lineMatched(parts: string[], gameState: GameState): void {
		const data = formatParts(parts);

		if (data.toZone === data.fromZone) {
			return;
		}

		if (data.toTeam === 'FRIENDLY' && data.toZone === 'DECK') {
			// If entering the deck, increment deck count
			gameState.friendlyCount++;
		} else if (data.fromTeam === 'FRIENDLY' && data.fromZone === 'DECK') {
			// If drawn from deck, decrement deck count
			gameState.friendlyCount--;
		} else if (data.toTeam === 'OPPOSING' && data.toZone === 'DECK') {
			// If entering the deck, increment deck count
			gameState.opposingCount++;
		} else if (data.fromTeam === 'OPPOSING' && data.fromZone === 'DECK') {
			gameState.opposingCount--;
		}

		if (quests.find(cardId => cardId === data.cardId) && data.toZone === 'SECRET') {
			const player = gameState.getPlayerById(data.playerId);
			if (player) {
				player.questCounter = 0;
			}
		} else if (quests.find(cardId => cardId === data.cardId) && data.fromZone === 'SECRET') {
			const player = gameState.getPlayerById(data.playerId);
			if (player) {
				player.questCounter = -1;
			}
		}
	}

	formatLogMessage(parts: string[]): string {
		const data = formatParts(parts);
		return `${data.cardName} moved from ${data.fromTeam} ${data.fromZone} to ${data.toTeam} ${data.toZone}`;
	}

	shouldEmit(): boolean {
		return true;
	}
}
