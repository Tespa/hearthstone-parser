import {GameState} from '../../GameState';

const UNKNOWN_CARDNAME = 'UNKNOWN ENTITY [cardType=INVALID]';

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
 * Object derived from [entityName=XXX ...] strings.
 */
export interface Entity {
	cardName: string;
	entityId: number;
	player: 'top' | 'bottom';
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
		const parsedEntity = entityParser(str);
		return (parsedEntity) ? {
			cardName: (parsedEntity.cardName === UNKNOWN_CARDNAME) ? '' : parsedEntity.cardName,
			entityId: parsedEntity.entityId,
			player: identifyPlayer(gameState, parsedEntity.player)
		} : undefined;
	};
})();

export * from './block-reader';
export * from './full-entity-reader';
