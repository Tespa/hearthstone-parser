import {GameState} from '../../GameState';

const UNKNOWN_CARDNAME = 'UNKNOWN ENTITY [cardType=INVALID]';

/**
 * Object derived from [entityName=XXX ...] strings.
 */
export type Entity = CardEntity | GameEntity | PlayerEntity;

export interface CardEntity {
	readonly type: 'card';
	cardName: string;
	entityId: number;
	player: 'top' | 'bottom';

	/**
	 * All tags marked for this entity.
	 */
	tags: {[key: string]: string};
}

export interface GameEntity {
	readonly type: 'game';
}

export interface PlayerEntity {
	readonly type: 'player';
	player: 'top' | 'bottom';
}

/**
 * Object derived from FULL_ENTITY or SHOW_ENTITY sub-blocks.
 */
export interface FullEntity {
	type: 'embedded_entity';
	action: 'Creating' | 'Updating';
	entity: CardEntity;
	cardId: string;
	player?: 'top' | 'bottom';
}

/**
 * Object derived from TAG_CHANGE Entity=[ENTITYSTRING] tag=X value=Y lines.
 */
export interface TagData {
	type: 'tag';
	entity?: Entity;
	tag: string;
	value: string;
}

/**
 * Object derived from META_DATA -Meta=XX Data=YY lines.
 */
export interface MetaData {
	type: 'meta';
	key: string;
	value: number;
}

/**
 * Creates a function that runs a set regex and returns a parsed result
 * @param regex The regex to run on each line given the result function
 * @param onMatch A function to convert the regex match data into a result
 */
export const createSimpleRegexParser = <T>(
	regex: RegExp,
	onMatch: (parts: RegExpExecArray) => T
) => {
	return function (line: string) {
		const parts = regex.exec(line);
		if (!parts) {
			return null;
		}

		return onMatch(parts);
	};
};

/**
 * Determines if the player is bottom or top given the player index
 * @param gameState
 * @param playerIndex
 */
export const identifyPlayer = (gameState: GameState, playerIndex: number) => {
	const player = gameState.getPlayerById(playerIndex);
	if (player) {
		return player.position;
	}

	// If there is a player and we didn't retrieve it, load the opposite player
	if (gameState.playerCount === 1) {
		return (gameState.players[0].position === 'bottom') ? 'top' : 'bottom';
	}

	// Lie and say its the bottom player otherwise (should never happen)
	return 'bottom';
};

/**
 * Function that can be used to parse entity strings (common occurence in logs)
 * If the entity string is a number, it will have no card name and be player 'bottom".
 */
export const readEntityString = (() => {
	// Raw parser used by readEntityString (encapsulate this somehow)
	const entityParser = createSimpleRegexParser(
		/\[entityName=(.*) (?:\[cardType=(.*)\] )?id=(\d*) zone=.* zonePos=\d* cardId=(.*) player=(\d)\]/,
		parts => ({
			cardName: parts[1],
			entityId: parseInt(parts[3], 10),
			player: parseInt(parts[5], 10)
		})
	);

	// Returned function (the actual function)
	return (str: string, gameState: GameState): Entity | undefined => {
		if (str === 'GameEntity') {
			return {type: 'game'};
		}

		// Check if its a player, otherwise parse it as a regular entity string
		const player = gameState.players.find(p => p.name === str);
		if (player) {
			return {type: 'player', player: player.position};
		}

		const entityId = parseInt(str, 10);
		if (entityId) {
			return {type: 'card', entityId, cardName: '', player: 'bottom', tags: {}};
		}

		const parsedEntity = entityParser(str);
		return (parsedEntity) ? {
			type: 'card',
			cardName: (parsedEntity.cardName === UNKNOWN_CARDNAME) ? '' : parsedEntity.cardName,
			entityId: parsedEntity.entityId,
			player: identifyPlayer(gameState, parsedEntity.player),
			tags: {}
		} : undefined;
	};
})();

export * from './block-reader';
export * from './full-entity-reader';
