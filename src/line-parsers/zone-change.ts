import {AbstractLineParser} from './AbstractLineParser';
import {GameState, Card} from '../GameState';
import {secretToClass} from '../data/secrets';
import {questMap} from '../data/quests';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cardsJson: Array<{dbfId: number; id: string; name: string}> = require('../../data/cards.json');

interface Parts {
	cardName: string;
	entityId: number;
	cardId: string;
	playerId: number;
	fromTeam?: 'FRIENDLY' | 'OPPOSING';
	fromZone?: 'DECK' | 'HAND' | 'SECRET';
	toTeam?: 'FRIENDLY' | 'OPPOSING';
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

/**
 * Returns true if something is changed
 */
const updateCard = (cardList: Card[], entityId: number, newCard: Partial<Card>) => {
	const card = cardList.find(c => c.cardEntityId === entityId);
	if (!card) {
		return false;
	}

	if (newCard.cardId) {
		card.cardId = newCard.cardId;
	}

	if (newCard.cardName) {
		card.cardName = newCard.cardName;
	}

	if (newCard.state) {
		card.state = newCard.state;
	}

	return true;
};

// Check if a card is changing zones.
export class ZoneChangeLineParser extends AbstractLineParser {
	regex = /^\[Zone\] ZoneChangeList\.ProcessChanges\(\) - id=\d* local=.* \[entityName=(.*) id=(\d*) zone=.* zonePos=\d* cardId=(.*) player=(\d)\] zone from ?(FRIENDLY|OPPOSING)? ?(.*)? -> ?(FRIENDLY|OPPOSING)? ?(.*)?$/;

	eventName = 'zone-change' as const;

	lineMatched(parts: string[], gameState: GameState): void {
		const data = formatParts(parts);

		// Mulligan is good time to know specific info about the game
		if (gameState.mulliganActive) {
			const player = gameState.getPlayerById(data.playerId);
			const otherPlayer = gameState.getPlayerById(3 - data.playerId);

			if (!player || !otherPlayer) {
				return;
			}

			// Player getting coin is second, other player is first
			if (data.cardName === 'The Coin' && data.toZone === 'HAND') {
				otherPlayer.turn = true;
			}

			// Determine which player is bottom/top
			if (data.toZone === 'HAND' || data.toZone === 'DECK') {
				if (data.toTeam === 'FRIENDLY') {
					player.position = 'bottom';
					otherPlayer.position = 'top';
				}

				if (data.toTeam === 'OPPOSING') {
					player.position = 'top';
					otherPlayer.position = 'bottom';
				}
			}
		}

		const getPlayerFromTeam = (team?: 'FRIENDLY' | 'OPPOSING') => {
			if (team === 'FRIENDLY') {
				return gameState.getPlayerByPosition('bottom');
			}

			if (team === 'OPPOSING') {
				return gameState.getPlayerByPosition('top');
			}

			return undefined;
		};

		const cardRawData = cardsJson.find(card => card.id === data.cardId);

		// Handle origin
		const fromPlayer = getPlayerFromTeam(data.fromTeam);
		if (fromPlayer) {
			switch (data.fromZone) {
				case 'HAND':
				case 'DECK':
					if (data.fromZone === 'DECK') {
						fromPlayer.cardCount -= 1;
					}

					updateCard(fromPlayer.cards, data.entityId, {
						state: 'OTHERS'
					});
					break;

				case 'SECRET':
					if (questMap.has(data.cardId)) {
					// It's a quest or sidequest
						fromPlayer.quests = fromPlayer.quests.filter(q => q.cardName !== data.cardName);
					} else {
					// It's a secret
						fromPlayer.secrets = fromPlayer.secrets.filter(secret => secret.cardId !== data.cardId);
					}

					break;

				default:
					break;
			}
		}

		// Handle dest
		const toPlayer = getPlayerFromTeam(data.toTeam);
		if (toPlayer) {
			switch (data.toZone) {
				case 'HAND':
				case 'DECK': {
					if (data.toZone === 'DECK') {
						toPlayer.cardCount += 1;
					}

					const updated = updateCard(toPlayer.cards, data.entityId, {
						state: data.toZone,
						cardId: cardRawData && cardRawData.dbfId,
						cardName: cardRawData && cardRawData.name
					});
					if (!updated) {
						toPlayer.cards.push({
							cardEntityId: data.entityId,
							cardId: cardRawData && cardRawData.dbfId,
							cardName: cardRawData && cardRawData.name,
							state: data.toZone,
							// If it's not mulligan phase, it's spawned (not from the deck)
							isSpawnedCard: !gameState.mulliganActive
						});
					}

					break;
				}

				case 'SECRET': {
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

					break;
				}

				default:
					break;
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
