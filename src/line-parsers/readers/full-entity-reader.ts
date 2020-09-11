import {GameState} from '../../GameState';
import {createSimpleRegexParser, identifyPlayer, readEntityString} from '.';

/**
 * Object derived from FULL_ENTITY or SHOW_ENTITY sub-blocks.
 */
export interface FullEntity {
	type: 'embedded_entity';
	action: 'Creating' | 'Updating';
	entityId: number;
	cardId: string;
	player?: 'top' | 'bottom';
	tags: {[key: string]: string};
}

export class FullEntityReader {
	private readonly fullStartReader = createSimpleRegexParser(
		/^(\s*)FULL_ENTITY - (Creating|Updating) (?:ID=(\d+)|(\[.*\])) CardID=(.*)/,
		parts => {
			return {
				indentation: parts[1],
				type: parts[2] as 'Creating'|'Updating',
				entityIdOrString: parts[3],
				cardId: parts[4]
			};
		}
	);

	private readonly tagReader = createSimpleRegexParser(
		/^(\s*)tag=(.*) value=(.*)/,
		parts => ({
			indentation: parts[1],
			tag: parts[2],
			value: parts[3]
		})
	);

	private _entity: FullEntity | null = null;

	constructor(private readonly prefix = '') {}

	/**
	 * Reads the line, and returns if it was handled or not and any result data.
	 * There is no "end" indicator like there are with blocks, so these scenarios are possible
	 * false, no data - not parsing anything
	 * true, no data - mid parse
	 * false, data - parsing finished, on new unrelated line.
	 * true, data - two entities back to back, started on new one
	 * @param line
	 * @param gameState
	 */
	handleLine(line: string, gameState: GameState): {handled: boolean; result?: FullEntity} {
		// If a prefix is stated, check that first
		if (this.prefix?.length > 0) {
			if (!line.startsWith(this.prefix)) {
				return {handled: false};
			}

			line = line.substring(this.prefix.length);
		}

		let handled = false;
		let result: FullEntity | undefined;

		// Read block start data
		const startData = this.fullStartReader(line);
		if (startData) {
			handled = true;

			// If we already have an entity, the previous one just finished
			if (this._entity) {
				result = this._entity;
				this._entity = null;
			}

			const entityId = (startData.type === 'Creating') ?
				parseInt(startData.entityIdOrString, 10) :
				readEntityString(startData.entityIdOrString, gameState)?.entityId;

			if (entityId) {
				this._entity = {
					type: 'embedded_entity',
					action: startData.type,
					cardId: startData.cardId,
					entityId,
					tags: {}
				};
			}

			return {handled, result};
		}

		// Read tag data if we already have an entity in progress
		if (this._entity) {
			const tagData = this.tagReader(line);
			if (tagData) {
				handled = true;

				this._entity.tags[tagData.tag] = tagData.value;

				if (tagData.tag === 'CONTROLLER') {
					this._entity.player = identifyPlayer(gameState, parseInt(tagData.value, 10));
				}

				return {handled, result};
			}

			// This line is not a full entity anymore, clear what we have
			result = this._entity;
			this._entity = null;
		}

		return {handled, result};
	}
}
