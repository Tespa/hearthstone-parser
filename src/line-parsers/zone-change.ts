import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';

// For now, we hard code quest ids, as there are a limited number of unique quests.
const quests = ['UNG_028', 'UNG_067', 'UNG_116', 'UNG_829', 'UNG_920', 'UNG_934', 'UNG_940', 'UNG_942', 'UNG_954'];

/* eslint-disable: @typescript-eslint/camelcase */
const secretToClass: {[id: string]: string} =
{
	AT_002: 'MAGE',
	AT_060: 'HUNTER',
	AT_073: 'PALADIN',
	BOT_908: 'PALADIN',
	CFM_026: 'HUNTER',
	CFM_620: 'MAGE',
	CFM_800: 'PALADIN',
	DAL_570: 'PALADIN',
	EX1_130: 'PALADIN',
	EX1_132: 'PALADIN',
	EX1_136: 'PALADIN',
	EX1_287: 'MAGE',
	EX1_289: 'MAGE',
	EX1_294: 'MAGE',
	EX1_295: 'MAGE',
	EX1_379: 'PALADIN',
	EX1_533: 'HUNTER',
	EX1_554: 'HUNTER',
	EX1_594: 'MAGE',
	EX1_609: 'HUNTER',
	EX1_610: 'HUNTER',
	EX1_611: 'HUNTER',
	FP1_018: 'MAGE',
	FP1_020: 'PALADIN',
	GIL_577: 'HUNTER',
	GIL_903: 'PALADIN',
	ICC_082: 'MAGE',
	ICC_200: 'HUNTER',
	KAR_004: 'HUNTER',
	LOE_021: 'HUNTER',
	LOE_027: 'PALADIN',
	LOOT_079: 'HUNTER',
	LOOT_101: 'MAGE',
	LOOT_204: 'ROGUE',
	LOOT_210: 'ROGUE',
	LOOT_214: 'ROGUE',
	TRL_400: 'MAGE',
	tt_010: 'MAGE', // eslint-disable-line @typescript-eslint/camelcase
	UNG_024: 'MAGE'
};
/* eslint-enable: @typescript-eslint/camelcase */

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

		if (data.toZone === 'DECK' && data.fromZone === 'DECK' && data.fromTeam !== data.toTeam) {
			// Handle the Togwaggle swap case
			const toPlayer = gameState.getPlayerById(data.playerId);
			const fromPlayer = gameState.getPlayerById(3 - data.playerId); // Player 1's opponent is Player 2
			if (fromPlayer) {
				fromPlayer.cardCount--;
			}

			if (toPlayer) {
				toPlayer.cardCount++;
			}

			return;
		}

		if (data.toZone === 'DECK') {
			// If entering the deck, increment deck count
			const player = gameState.getPlayerById(data.playerId);
			if (player) {
				player.cardCount++;
			}
		}

		if (data.fromZone === 'DECK') {
			// If drawn from deck, decrement deck count
			const player = gameState.getPlayerById(data.playerId);
			if (player) {
				player.cardCount--;
			}
		}

		if (data.toZone === 'SECRET') {
			if (quests.find(cardId => cardId === data.cardId)) {
				const player = gameState.getPlayerById(data.playerId);
				if (player) {
					player.questCounter = 0;
				}
			} else {
				const player = gameState.getPlayerById(data.playerId);
				if (player) {
					const cardClass = secretToClass[data.cardId];
					if (cardClass) {
						player.secrets.push({cardId: data.cardId, cardClass: cardClass, cardName: data.cardName});
					}
				}
			}
		}

		if (data.fromZone === 'SECRET') {
			if (quests.find(cardId => cardId === data.cardId)) {
				const player = gameState.getPlayerById(data.playerId);
				if (player) {
					player.questCounter = -1;
				}
			} else {
				const player = gameState.getPlayerById(data.playerId);
				if (player) {
					const index = player.secrets.findIndex(secret => {
						return secret.cardId === data.cardId;
					});
					player.secrets = player.secrets.splice(index);
				}
			}
		}

		if (gameState.mulliganActive && data.cardName === 'The Coin' && data.toZone === 'HAND') {
			const player = gameState.getPlayerById(3 - data.playerId); // Player 1's opponent is Player 2, Player 2's opponent is Player 1
			if (player) {
				player.turn = true;
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
