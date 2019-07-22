import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';
import {secretToClass} from '../data/secrets';

// For now, we hard code quest ids, as there are a limited number of unique quests.
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

		if (data.toZone === data.fromZone && data.toTeam === data.fromTeam) {
			return;
		}

		const player = gameState.getPlayerById(data.playerId);
		const otherPlayer = gameState.getPlayerById(3 - data.playerId);
		if (!player || !otherPlayer) {
			return;
		}

		if (data.toZone === 'DECK' && data.fromZone === 'DECK' && data.fromTeam !== data.toTeam) {
			// Handle the Togwaggle swap case
			player.cardCount++;
			otherPlayer.cardCount--;

			return;
		}

		if (data.toZone === 'DECK') {
			// If entering the deck, increment deck count
			player.cardCount++;
			const position = data.toTeam === 'FRIENDLY' ? 'bottom' : 'top';
			if (player.position !== position) {
				player.position = position;
			}
		}

		if (data.fromZone === 'DECK') {
			// If drawn from deck, decrement deck count
			player.cardCount--;
		}

		if (data.toZone === 'SECRET') {
			if (quests.find(cardId => cardId === data.cardId)) {
				player.questCounter = 0;
			} else {
				const cardClass = secretToClass[data.cardId];
				if (cardClass) {
					player.secrets.push({cardId: data.cardId, cardClass: cardClass, cardName: data.cardName});
				}
			}
		}

		if (data.fromZone === 'SECRET') {
			if (quests.find(cardId => cardId === data.cardId)) {
				player.questCounter = -1;
			} else {
				player.secrets = player.secrets.filter(secret => secret.cardId !== data.cardId);
			}
		}

		if (gameState.mulliganActive && data.cardName === 'The Coin' && data.toZone === 'HAND') {
			otherPlayer.turn = true;
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
