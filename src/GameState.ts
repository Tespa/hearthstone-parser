import {merge} from 'lodash';
import {Class} from './data/meta';
import {CardEntity} from './line-parsers/readers';

const UNKNOWN_CARDNAME = 'UNKNOWN ENTITY [cardType=INVALID]';

/**
 * Tests if a card name is empty or the "empty string"
 * @param cardName
 */
const isEmpty = (cardName?: string) => {
	return !cardName || cardName === UNKNOWN_CARDNAME;
};

/**
 * Returns an array of special tags that can be used to communicate additional properties of a card.
 * Currently the available properties deal with corruption.
 * @param entity
 */
const identifySpecialTags = (entity: CardEntity | undefined) => {
	if (!entity || !entity.tags) {
		return;
	}

	// Tags are handled here. These are the "simplified" version.
	const tags = new Array<EntityTags>();
	if (entity.tags.CORRUPTEDCARD === '1') {
		tags.push('corrupt');
	} else if (entity.tags.CORRUPT === '1') {
		tags.push('can-corrupt');
	}

	return tags.length > 0 ? tags : undefined;
};

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
	entityId: number;

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

	/**
	 * Additional tags for when cards have special types
	 */
	tags?: EntityTags[];
}

type EntityTags = 'can-corrupt' | 'corrupt';

export interface EntityProps {
	entityId: number;
	cardId?: number;
	cardName: string;
	player: 'top' | 'bottom';
	damage?: number;
	healing?: number;
	dead?: boolean;

	/**
	 * Additional tags for when cards have special types
	 */
	tags?: EntityTags[];
}

/**
 * Extracts a subset of entity data for presentational use.
 * @param entity CardEntity to pull data from
 */
export const simplifyEntity = (entity: CardEntity): EntityProps => {
	return {
		cardId: entity.cardId,
		cardName: entity.cardName,
		entityId: entity.entityId,
		player: entity.player
	};
};

export interface Discovery {
	enabled: boolean;
	id: string | null;
	source?: EntityProps;
	chosen?: EntityProps;
	options: EntityProps[];
}

export interface Player {
	id: number;
	name: string;
	status: 'LOST' | 'WON' | 'TIED' | '';
	turn: boolean;
	turnHistory: Array<{
		startTime: number;
		duration?: number;
	}>;
	quests: Quest[];
	timeout: number;
	cardCount: number;
	cards: Card[];
	position: 'top' | 'bottom';
	secrets: Secret[];
	discovery: Discovery;
	discoverHistory: Discovery[];
	cardsReplacedInMulligan: number;
	manaSpent: number;
}

type MatchLogType = 'attack' | 'play' | 'trigger';

export class MatchLogEntry {
	type: MatchLogType;
	manaSpent = 0;
	source: EntityProps;
	targets: EntityProps[];

	constructor(type: MatchLogType, source: CardEntity) {
		this.type = type;
		this.setSource(source);
		this.targets = [];
	}

	/**
	 * Sets the source of this match log entry, with the ability to specify
	 * additional merge properties.
	 * @param entity
	 */
	setSource(entity: CardEntity, ...props: Array<Partial<EntityProps> | undefined>) {
		this.source = this.createProps(entity, ...props);
	}

	/**
	 * Adds a target to this match log entry, with the ability to specify
	 * additional merge properties. Ignored if the entity is falsey
	 * or if it is already added.
	 * @param entity entity to add. If undefined or null, it will be ignored
	 */
	addTarget(entity: CardEntity | undefined | null, ...props: Array<Partial<EntityProps> | undefined>) {
		if (!entity || this.targets.findIndex(t => t.entityId === entity.entityId) !== -1) {
			return;
		}

		this.targets.push(this.createProps(entity, ...props));
	}

	/**
	 * Marks targets/sources using the death entries.
	 * Returns the entity ids of the cards that were successfully marked.
	 * @param deaths Entity IDs that need to be marked
	 * @returns the subset of deaths that were present in this log entry
	 */
	markDeaths(deaths: Set<number>) {
		const marked = new Set<number>();

		if (deaths.has(this.source.entityId)) {
			this.source.dead = true;
			marked.add(this.source.entityId);
		}

		for (const target of this.targets) {
			if (deaths.has(target.entityId)) {
				target.dead = true;
				marked.add(target.entityId);
			}
		}

		return marked;
	}

	private createProps(entity: CardEntity, ...props: Array<Partial<EntityProps> | undefined>) {
		const tags = identifySpecialTags(entity);
		const merged = merge(simplifyEntity(entity), ...props);
		if (tags) {
			merged.tags = tags;
		}

		return merged;
	}
}

export class GameState {
	startTime: number;

	matchDuration: number;

	playerCount: number;

	gameOverCount: number;

	players: Player[];

	beginPhaseActive: boolean;

	mulliganActive: boolean;

	turnStartTime: Date;

	matchLog: MatchLogEntry[];

	#entities: {[id: number]: CardEntity | undefined} = {};

	/**
	 * Internal set used to optimize card reveals
	 */
	readonly #missingEntityIds = new Set<number>();

	constructor() {
		this.reset();
	}

	get numPlayers(): number {
		return this.players.length;
	}

	/**
	 * Returns true if the game state is active for an ongoing game
	 */
	get active(): boolean {
		return Boolean(this.startTime) && !this.complete;
	}

	/**
	 * Returns true if the gamestate is representing a completed game.
	 */
	get complete(): boolean {
		return this.gameOverCount === 2;
	}

	/**
	 * Resets the game state to default conditions.
	 */
	reset(): void {
		this.players = [];
		this.matchLog = [];
		this.beginPhaseActive = true;
		this.gameOverCount = 0;
		this.#entities = {};
		this.#missingEntityIds.clear();
	}

	/**
	 * Resets the game state to default conditions and marks it as a game that has begun.
	 */
	start(): void {
		this.reset();
		this.startTime = Date.now();
	}

	addPlayer(player: Player): Player {
		const existingPlayer = this.players.find(p => p.id === player.id);
		if (existingPlayer) {
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
		for (const entry of entries) {
			if (isEmpty(entry.source?.cardName)) {
				this.#missingEntityIds.add(entry.source.entityId);
			}

			for (const target of entry.targets) {
				if (isEmpty(target.cardName)) {
					this.#missingEntityIds.add(target.entityId);
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
	resolveEntity(entity: Pick<CardEntity, 'entityId'> & Partial<CardEntity>) {
		const existing = this.#entities[entity.entityId];
		const newEntity = merge({
			type: 'card',
			tags: {},
			player: 'bottom',
			cardName: ''
		}, existing, entity);

		this.#entities[entity.entityId] = newEntity;
		const {cardName, entityId, cardId} = newEntity;
		const newProps = {entityId, cardName, cardId};

		// Update player cards in case this entity updated any important tags (like corrupt)
		for (const player of this.players) {
			for (const card of player.cards.filter(c => c.entityId === entity.entityId)) {
				const tags = identifySpecialTags(this.#entities[card.entityId]);
				if (tags) {
					card.tags = tags;
				}
			}
		}

		if (isEmpty(cardName) || !this.#missingEntityIds.has(entityId)) {
			return;
		}

		// Update entities for each match log entry (only card name, entity id, and card id)
		for (const entry of this.matchLog) {
			if (isEmpty(entry.source.cardName) && entry.source.entityId === entityId) {
				entry.source = {...entry.source, ...newProps};
			}

			for (const [idx, target] of entry.targets.entries()) {
				if (isEmpty(target.cardName) && target.entityId === entityId) {
					entry.targets[idx] = {...target, ...newProps};
				}
			}
		}
	}

	getEntity(id: number): CardEntity | undefined {
		return this.#entities[id];
	}
}
