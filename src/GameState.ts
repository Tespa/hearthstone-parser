import {Class} from './data/meta';

const UNKNOWN_CARDNAME = 'UNKNOWN ENTITY [cardType=INVALID]';

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
	dead?: boolean;
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

	/**
	 * Internal set used to optimize card reveals
	 */
	private readonly missingEntityIds = new Set<number>();

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
	 * Adds match log entries to the gamestate, and flags any entities
	 * that need filling out by future events.
	 * @param entries
	 */
	addMatchLogEntry(...entries: MatchLogEntry[]) {
		const isEmpty = (cardName: string) => {
			return !cardName || cardName === UNKNOWN_CARDNAME;
		};

		for (const entry of entries) {
			if (isEmpty(entry.source?.cardName)) {
				this.missingEntityIds.add(entry.source.entityId);
			}

			for (const target of entry.targets) {
				if (isEmpty(target.cardName)) {
					this.missingEntityIds.add(target.entityId);
				}
			}
		}

		this.matchLog.push(...entries);
	}

	/**
	 * Updates any unresolved entities in any sub-data.
	 * Very often hearthstone won't assign a name to an entity until later,
	 * this handles the name resolution. Recommended place is the TAG_CHANGE event.
	 * @param entity
	 */
	resolveEntity(entity: {cardName: string; entityId: number}) {
		// A better algorithm requires caching to a private property
		const {cardName, entityId} = entity;

		const isEmpty = (cardName: string) => {
			return !cardName || cardName === UNKNOWN_CARDNAME;
		};

		if (isEmpty(cardName) || !this.missingEntityIds.has(entityId)) {
			return;
		}

		for (const entry of this.matchLog) {
			if (isEmpty(entry.source.cardName) && entry.source.entityId === entityId) {
				entry.source = {...entry.source, entityId, cardName};
			}

			for (const [idx, target] of entry.targets.entries()) {
				if (isEmpty(target.cardName) && target.entityId === entityId) {
					entry.targets[idx] = {...target, entityId, cardName};
				}
			}
		}
	}
}
