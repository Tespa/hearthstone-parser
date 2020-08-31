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

export interface EntityProps {
	cardName: string;
	entityId: number;
	player: 'top' | 'bottom';
	damage?: number;
}

export interface MatchLogEntry {
	type: 'attack' | 'play' | 'trigger';
	source: EntityProps;
	targets: EntityProps[];
}

export class GameState {
	playerCount: number;

	gameOverCount: number;

	players: Player[];

	mulliganActive: boolean;

	turnStartTime: Date;

	matchLog: MatchLogEntry[];

	constructor() {
		this.reset();
	}

	get numPlayers(): number {
		return this.players.length;
	}

	reset(): void {
		this.players = [];
		this.matchLog = [];
		this.gameOverCount = 0;
	}

	addPlayer(player: Player): Player {
		const existingIdx = this.players.findIndex(p => p.id === player.id);
		if (existingIdx > -1) {
			const existingPlayer = this.players[existingIdx];
			if (existingPlayer.name === 'UNKNOWN HUMAN PLAYER') {
				existingPlayer.name = player.name;
			}

			return existingPlayer;
		}

		this.players.push(player);
		this.playerCount = this.numPlayers;
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

	/**
	 * Updates any unresolved entities in any sub-data.
	 * @param entity
	 */
	resolveEntity(entity: {cardName: string; entityId: number}) {
		// A better algorithm requires caching which will affect tests...
		// If performance is a problem, updates tests to ignore props starting with _
		const {cardName, entityId} = entity;

		const empty = 'UNKNOWN ENTITY [cardType=INVALID]';
		if (cardName === empty) {
			return;
		}

		for (const entry of this.matchLog) {
			if (entry.source.cardName === empty && entry.source.entityId === entityId) {
				entry.source = {...entry.source, entityId, cardName};
			}

			for (const [idx, target] of entry.targets.entries()) {
				if (target.cardName === empty && target.entityId === entityId) {
					entry.targets[idx] = {...target, entityId, cardName};
				}
			}
		}
	}
}
