import {Class} from './data/meta';

export interface Secret {
	cardId: string;
	cardClass: Class;
	cardName: string;
	timestamp: number;
}

export interface Quest {
	cardName: string;
	class: Class;
	progress: number;
	requirement: number;
	sidequest: boolean;
	timestamp: number;
}

export type CardState = 'DECK' | 'HAND' | 'OTHERS';

export interface Card {
	/**
	 * ID used by logs to distinguish same cards
	 */
	cardEntityId: number;
	/**
	 * Numeric ID for the card (same for same card)
	 * Unknown card has this undefined
	 */
	cardId?: number;
	/**
	 * Unknown card has this undefined
	 */
	cardName?: string;
	state: CardState;
	/**
	 * If card is originally from the deck
	 */
	readonly isSpawnedCard: boolean;
}

export interface Player {
	id: number;
	name: string;
	status: 'LOST' | 'WON' | 'TIED' | '';
	turn: boolean;
	quests: Quest[];
	timeout: number;
	cardCount: number;
	cards: Card[];
	position: 'top' | 'bottom';
	secrets: Secret[];
	discovery: {
		enabled: boolean;
		id: string | null;
	};
	cardsReplacedInMulligan: number;
}

export class GameState {
	playerCount: number;

	gameOverCount: number;

	players: Player[];

	mulliganActive: boolean;

	turnStartTime: Date;

	constructor() {
		this.reset();
	}

	get numPlayers(): number {
		return this.players.length;
	}

	reset(): void {
		this.players = [];
		this.gameOverCount = 0;
	}

	addPlayer(player: Player): Player {
		this.players.push(player);
		return player;
	}

	getPlayerById(index: number): Player | undefined {
		return this.players.find(player => player.id === index);
	}

	getPlayerByPosition(position: 'top' | 'bottom'): Player | undefined {
		return this.players.find(player => player.position === position);
	}

	getPlayerByName(name: string): Player | undefined {
		return this.players.find(player => player.name === name);
	}

	getAllPlayers(): Player[] {
		return this.players.slice(0);
	}
}
