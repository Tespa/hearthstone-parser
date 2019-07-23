import {AbstractLineParser} from './AbstractLineParser';
import {GameState} from '../GameState';
import {DECK_CARD_COUNT} from '../data/meta';

const calcCardsReplaced = (cardsLeft: number, cardCount: number): number => {
	return 	DECK_CARD_COUNT - cardCount - cardsLeft;
};

// Detect how many cards are replaced in mulligan
export class MullinganResultParser extends AbstractLineParser {
	regex = /\[Power\]\s+GameState\.DebugPrintEntitiesChosen\(\)\s+-\s+id=\w+\s+Player=(.*)\s+EntitiesCount=(\d+)/;

	eventName = 'mulligan-result' as const;

	lineMatched([, name, cardsLeft]: string[], gameState: GameState): void {
		if (!gameState.mulliganActive) {
			return;
		}

		const player = gameState.getPlayerByName(name);
		if (!player) {
			return;
		}

		player.cardsReplacedInMulligan = calcCardsReplaced(parseInt(cardsLeft, 10), player.cardCount);
	}

	formatLogMessage([, name, cardsLeft]: string[], gameState: GameState): string | false {
		if (!gameState.mulliganActive) {
			return false;
		}

		const player = gameState.getPlayerByName(name);
		if (!player) {
			return false;
		}

		return `${player.name} replaced ${calcCardsReplaced(parseInt(cardsLeft, 10), player.cardCount)} cards in mulligan`;
	}

	shouldEmit(gameState: GameState): boolean {
		return gameState.mulliganActive;
	}
}
