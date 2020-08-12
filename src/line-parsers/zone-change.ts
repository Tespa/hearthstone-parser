import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';
import {secretToClass} from '../data/secrets';
import {questMap} from '../data/quests';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cardsJson: Array<{dbfId: number; id: string}> = require('../data/cards.json');

const FRIENDLY = 'FRIENDLY';
const OPPOSING = 'OPPOSING';

interface Parts {
	cardName: string;
	entityId: number;
	cardId: string;
	playerId: number;
	fromTeam?: typeof FRIENDLY | typeof OPPOSING;
	fromZone?: 'DECK' | 'HAND' | 'SECRET';
	toTeam?: typeof FRIENDLY | typeof OPPOSING;
	toZone?: 'DECK' | 'HAND' | 'SECRET';
}

function formatParts(parts: string[]): Parts {
	return {
		cardName: parts[1],
		entityId: parseInt(parts[2], 10),
		cardId: parts[3],
		playerId: parseInt(parts[4], 10),
		fromTeam: parts[5] as any,
		fromZone: parts[6] as any,
		toTeam: parts[7] as any,
		toZone: parts[8] as any
	};
}

// Check if a card is changing zones.
export class ZoneChangeLineParser extends AbstractLineParser {
	regex = /^\[Zone\] ZoneChangeList.ProcessChanges\(\) - id=\d* local=.* \[entityName=(.*) id=(\d*) zone=.* zonePos=\d* cardId=(.*) player=(\d)\] zone from ?(FRIENDLY|OPPOSING)? ?(.*)? -> ?(FRIENDLY|OPPOSING)? ?(.*)?$/;

	eventName = 'zone-change' as const;

	lineMatched(parts: string[], gameState: GameState): void {
		const data = formatParts(parts);

		if (gameState.mulliganActive) {
			const player = gameState.getPlayerById(data.playerId);
			const otherPlayer = gameState.getPlayerById(data.playerId);
			if (!player || !otherPlayer) {
				return;
			}

			// Player getting coin is second, other player is first
			if (data.cardName === 'The Coin' && data.toZone === 'HAND') {
				otherPlayer.turn = true;
			}

			if (data.toTeam === FRIENDLY) {
				player.position = 'bottom';
			}

			if (data.toTeam === OPPOSING) {
				player.position = 'top';
			}
		}

		const friendlyPlayer = gameState.getPlayerByPosition('bottom');
		const opposingPlayer = gameState.getPlayerByPosition('top');
		const fromPlayer = data.fromTeam === FRIENDLY ? friendlyPlayer : opposingPlayer;
		const toPlayer = data.toTeam === FRIENDLY ? friendlyPlayer : opposingPlayer;

		if (!fromPlayer || !toPlayer) {
			return;
		}

		const cardRawData = cardsJson.find(card => card.id === data.cardId);

		// Card moved from HAND
		if (data.fromZone === 'HAND' && cardRawData) {
			const cardIndex = fromPlayer.handCards.findIndex(card => card.id === cardRawData.dbfId);
			fromPlayer.handCards.splice(cardIndex, 1);
		}

		// Card moved to HAND
		if (data.toZone === 'HAND' && cardRawData) {
			toPlayer.handCards = [...toPlayer.handCards, {id: cardRawData.dbfId, name: data.cardName}];
		}

		// Card moved from DECK
		if (data.fromZone === 'DECK') {
			fromPlayer.cardCount -= 1;
			// TODO: Also notify card is removed from deck
		}

		// Card moved from DECK
		if (data.toZone === 'DECK') {
			toPlayer.cardCount += 1;
			// TODO: Also notify card is removed from deck
		}

		// Secret played
		if (data.toZone === 'SECRET') {
			const quest = questMap.get(data.cardId);
			if (quest) {
				// It's a quest or sidequest
				toPlayer.quests.push({
					...quest,
					cardName: data.cardName,
					progress: 0,
					timestamp: Date.now()
				});
			} else {
				// It's a secret
				const cardClass = secretToClass[data.cardId];
				if (cardClass) {
					toPlayer.secrets.push({
						cardId: data.cardId,
						cardClass: cardClass,
						cardName: data.cardName,
						timestamp: Date.now()
					});
				}
			}
		}

		// Secret triggered
		if (data.fromZone === 'SECRET') {
			if (questMap.has(data.cardId)) {
				// It's a quest or sidequest
				fromPlayer.quests = fromPlayer.quests.filter(q => q.cardName !== data.cardName);
			} else {
				// It's a secret
				fromPlayer.secrets = fromPlayer.secrets.filter(secret => secret.cardId !== data.cardId);
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
