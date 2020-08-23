import {AbstractLineParser} from './AbstractLineParser';
import {GameState, Card} from '../GameState';
import {secretToClass} from '../data/secrets';
import {questMap} from '../data/quests';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cardsJson: Array<{dbfId: number; id: string; name: string}> = require('../../data/cards.json');

export type Team = 'FRIENDLY' | 'OPPOSING';

interface Parts {
	cardName: string;
	entityId: number;
	cardId: string;
	playerId: number;
	fromTeam?: Team;
	fromZone?: string;
	toTeam?: Team;
	toZone?: string;
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
 * Update card in given list or push one if there isn't one already
 */
const putCard = (
	cardList: Card[],
	{
		cardEntityId,
		cardId,
		cardName,
		isSpawnedCard,
		state
	}: Partial<Card> & {cardEntityId: number}
) => {
	const card = cardList.find(c => c.cardEntityId === cardEntityId);
	if (card) {
		if (cardId) {
			card.cardId = cardId;
		}

		if (cardName) {
			card.cardName = cardName;
		}

		if (state) {
			card.state = state;
		}
	} else if (
		cardEntityId &&
		state &&
		typeof isSpawnedCard !== 'undefined'
	) {
		cardList.push({
			cardEntityId,
			state,
			isSpawnedCard,
			cardId,
			cardName
		});
	}
};

// Check if a card is changing zones.
export class ZoneChangeLineParser extends AbstractLineParser {
	regex = /^\[Zone\] ZoneChangeList\.ProcessChanges\(\) - id=\d* local=.* \[entityName=(.*) id=(\d*) zone=.* zonePos=\d* cardId=(.*) player=(\d)\] zone from ?(FRIENDLY|OPPOSING)? ?(.*)? -> ?(FRIENDLY|OPPOSING)? ?(.*)?$/;

	eventName = 'zone-change' as const;

	lineMatched(parts: string[], gameState: GameState): void {
		const data = formatParts(parts);

		// This may have "revealed" an entity, so register it
		gameState.resolveEntity(data);

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

		const getPlayerFromTeam = (team?: Team) => {
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
			// In some cases, we only get to know card info when going out of hand/deck
			if (data.fromZone === 'DECK' || data.fromZone === 'HAND') {
				putCard(fromPlayer.cards, {
					state: 'OTHERS',
					cardEntityId: data.entityId,
					cardId: cardRawData && cardRawData.dbfId,
					cardName: cardRawData && cardRawData.name
				});
			}

			if (data.fromZone === 'DECK') {
				fromPlayer.cardCount -= 1;
			}

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

		// Handle dest
		const toPlayer = getPlayerFromTeam(data.toTeam);
		if (toPlayer) {
			if (data.toZone === 'DECK' || data.toZone === 'HAND') {
				putCard(toPlayer.cards, {
					state: data.toZone,
					cardEntityId: data.entityId,
					cardId: cardRawData && cardRawData.dbfId,
					cardName: cardRawData && cardRawData.name,
					// If it's not mulligan phase, it's spawned (not from the deck)
					isSpawnedCard: !gameState.mulliganActive
				});
			}

			if (data.toZone === 'DECK') {
				toPlayer.cardCount += 1;
			}

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
