import {LineParser} from './AbstractLineParser';
import {HspEventsEmitter} from './index';
import {GameState, MatchLogEntry, EntityProps} from '../GameState';

const UNKNOWN_CARDNAME = 'UNKNOWN ENTITY [cardType=INVALID]';

/**
 * Object derived from TAG_CHANGE Entity=[ENTITYSTRING] tag=X value=Y lines.
 */
interface TagData {
	type: 'tag';
	entity?: Entity;
	tag: string;
	value: string;
}

/**
 * Object derived from META_DATA -Meta=XX Data=YY lines.
 */
interface MetaData {
	type: 'meta';
	key: string;
	value: number;
}

/**
 * Object derived from [entityName=XXX ...] strings.
 */
interface Entity {
	cardName: string;
	entityId: number;
	player: 'top' | 'bottom';
}

/**
 * Object derived from FULL_ENTITY or SHOW_ENTITY sub-blocks.
 */
interface FullEntity {
	type: 'embedded_entity';
	action: 'Creating' | 'Updating';
	entityId: number;
	cardId: string;
	player?: 'top' | 'bottom';
	tags: {[key: string]: string};
}

/**
 * Object derived from the combination of elements between BLOCK_START and BLOCK_END
 */
export interface BlockData {
	type: 'block';
	blockType: string;
	triggerKeyword?: string;
	entity?: Entity;
	target?: Entity;
	entries: Array<BlockData | TagData | MetaData | FullEntity>;
}

/**
 * Creates a function that runs a set regex and returns a parsed result
 * @param regex The regex to run on each line given the result function
 * @param onMatch A function to convert the regex match data into a result
 */
function createSimpleRegexParser<T>(
	regex: RegExp,
	onMatch: (parts: RegExpExecArray) => T
) {
	return function (line: string) {
		const parts = regex.exec(line);
		if (!parts) {
			return null;
		}

		return onMatch(parts);
	};
}

/**
 * Determines if the player is bottom or top given the player index
 * @param gameState
 * @param playerIndex
 */
function identifyPlayer(gameState: GameState, playerIndex: number) {
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
}

/**
 * Function that can be used to parse entity strings (common occurence in logs)
 */
const readEntityString = (() => {
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

class FullEntityReader {
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

/**
 * Class designed to read block data.
 * Does not emit actual events or use the block data for anything, for that use the BlockParser.
 */
class BlockReader {
	/**
	 * Contains ongoing block stack data.
	 */
	private readonly stack = Array<BlockData>();

	private readonly blockStartReader = createSimpleRegexParser(
		/\s*BLOCK_START BlockType=([A-Z]*) Entity=(.*) EffectCardId=(.*) EffectIndex=(.*) Target=(.*) SubOption=(.*) (?:TriggerKeyword=(.*))?/,
		parts => ({
			blockType: parts[1],
			entityString: parts[2],
			targetString: parts[5],
			trigger: parts[7]
		})
	);

	private readonly tagReader = createSimpleRegexParser(
		/\s*TAG_CHANGE Entity=(.*) tag=(.*) value=([\w\d_.-]*)/,
		parts => ({
			entityString: parts[1],
			tag: parts[2],
			value: parts[3]
		})
	);

	private readonly metaReader = createSimpleRegexParser(
		/\s*META_DATA - Meta=([A-Z]+) Data=(\d*) Info(?:Count)?=(.*)/,
		parts => ({
			key: parts[1],
			value: parseInt(parts[2], 10)
		})
	);

	private readonly fullEntityReader = new FullEntityReader();

	constructor(private readonly prefix: string) {}

	get processing(): boolean {
		return this.stack.length > 0;
	}

	readLine(line: string, gameState: GameState): BlockData | null {
		if (!line.startsWith(this.prefix)) {
			return null;
		}

		line = line.substring(this.prefix.length);

		// Because embedded entities can "lead" into the future parses, we need do that first
		if (this._handleEmbeddedEntities(line, gameState)) {
			return null;
		}

		// Create a new block if we're starting one
		const blockStart = this.blockStartReader(line);
		if (blockStart) {
			// Read source and target (if given)
			const entity = readEntityString(blockStart.entityString, gameState);
			const target = readEntityString(blockStart.targetString, gameState);

			const blockData: BlockData = {
				type: 'block',
				blockType: blockStart.blockType,
				triggerKeyword: blockStart.trigger,
				entity, target,
				entries: []
			};

			this.stack.push(blockData);
			return null;
		}

		// If a block has ended, return it
		if (line.includes('BLOCK_END')) {
			const mostRecentBlock = this.stack.pop();
			if (!mostRecentBlock) {
				// This shouldn't ever happen
				return null;
			}

			// Check if its the highest block. If so, return it
			if (this.stack.length === 0) {
				return mostRecentBlock;
			}

			this.stack[this.stack.length - 1].entries.push(mostRecentBlock);
		}

		// For the rest, skip if we're not in a block
		if (this.stack.length === 0) {
			return null;
		}

		this._readTagChange(line, gameState);
		this._readMetaData(line);

		return null;
	}

	private get mostRecentBlock() {
		return this.stack[this.stack.length - 1];
	}

	/**
	 * Reads TAG_CHANGE lines and adds to the current block.
	 * @param line
	 * @param gameState
	 */
	private _readTagChange(line: string, gameState: GameState): boolean {
		const mostRecentBlock = this.mostRecentBlock;

		const tagData = this.tagReader(line);
		if (tagData) {
			let entity: Entity | undefined;
			const entityId = parseInt(tagData.entityString, 10);
			if (entityId) {
				// Try to get some more data from the current block
				const existing = mostRecentBlock.entries.find(e =>
					e.type === 'embedded_entity' && e.entityId === entityId) as FullEntity;
				if (existing) {
					entity = {
						entityId,
						cardName: '',
						player: existing.player ?? 'bottom'
					};
				}
			} else {
				entity = readEntityString(tagData.entityString, gameState);
			}

			mostRecentBlock.entries.push({
				type: 'tag',
				entity,
				tag: tagData.tag,
				value: tagData.value
			});
			return true;
		}

		return false;
	}

	/**
	 * Reads META_DATA blocks and adds to the current block.
	 * @param line
	 */
	private _readMetaData(line: string): boolean {
		const mostRecentBlock = this.mostRecentBlock;

		const metaData = this.metaReader(line);
		if (metaData) {
			mostRecentBlock.entries.push({
				type: 'meta',
				key: metaData.key,
				value: metaData.value
			});
			return true;
		}

		return false;
	}

	/**
	 * Parses lines regarding FULL_ENTITY and returns if the line has been used to parse one.
	 * This sort of function is needed because there is no clear end-indicator for the type.
	 */
	private _handleEmbeddedEntities(line: string, gameState: GameState): boolean {
		if (this.stack.length === 0) {
			return false;
		}

		const mostRecentBlock = this.stack[this.stack.length - 1];

		// Read FULL_ENTITY lines.
		const fullEntityResult = this.fullEntityReader.handleLine(line, gameState);
		if (fullEntityResult.result) {
			mostRecentBlock.entries.push(fullEntityResult.result);
		}

		// Exit out if we're still reading a FULL_ENTITY
		return fullEntityResult.handled;
	}
}

/**
 * Internal function to convert a parsed entity to something for the match log.
 * This allows us to add new properties to the entity later without affecting the match log.
 * @param entity
 */
const entityToMatchLog = (entity: Entity, damage = 0): EntityProps => {
	return {
		cardName: entity.cardName,
		entityId: entity.entityId,
		player: entity.player,
		damage,
		dead: false
	};
};

/**
 * Handles events associated with BLOCK_START and BLOCK_END and those inbetween.
 * Currently its just the card-played event.
 * It does not block execution of other events until the final BLOCK_END, however it can be
 * blocked by other parsers. So its best to run this one first.
 */
export class BlockParser extends LineParser {
	eventName = 'card-played' as const;

	private readonly prefix = '[Power] GameState.DebugPrintPower() -' as const;
	private readonly reader = new BlockReader(this.prefix);

	handleLine(emitter: HspEventsEmitter, gameState: GameState, line: string): boolean {
		const block = this.reader.readLine(line, gameState);
		if (block) {
			this._handleMatchLog(emitter, gameState, block);
			return true;
		}

		return false;
	}

	private _handleMatchLog(emitter: HspEventsEmitter, gameState: GameState, block: BlockData) {
		const source = block.entity;
		const type = block.blockType.toLowerCase();

		// Exit out if its not a match log relevant
		if (!source || !['play', 'attack'].includes(type)) {
			return;
		}

		const targets = new Array<Entity>();
		if (block.target) {
			targets.push(block.target);
		}

		const entities = this._extractEntities(block);
		const subBlocks = block.entries.filter(b => b.type === 'block') as BlockData[];

		// Identify deaths
		const deathBlock = subBlocks.find(b => b.type === 'block' && b.blockType === 'DEATHS');
		const deaths = this._resolveDeaths(deathBlock as BlockData);

		// Create core damage entry
		const damageData = this._resolveDamage(block);
		const logEntry: MatchLogEntry = {
			type: type as MatchLogEntry['type'],
			source: entityToMatchLog(source, damageData[source.entityId]),
			targets: targets.map(t =>
				entityToMatchLog(t, damageData[t.entityId]))
		};

		// Match Log entries added before/after the core one (triggers)
		const logPreExtras = new Array<MatchLogEntry>();
		const logExtras = new Array<MatchLogEntry>();

		// Resolve triggers (those with entity data)
		const triggers = subBlocks.filter(b => b.blockType === 'TRIGGER' && b.entity);
		for (const trigger of triggers) {
			const tSource = entityToMatchLog(trigger.entity!);
			if (!['TRIGGER_VISUAL', 'SECRET'].includes(trigger.triggerKeyword ?? '')) {
				continue;
			}

			// If it was a play trigger, add it as a target of the play
			// An example of this effect is Mirror Entity
			// NOTE: This is not universal for some reason,
			// Example: Apexis Smuggler doesn't show it. What's the difference?
			if (logEntry.type === 'play') {
				logEntry.targets.push(tSource);
			}

			const triggerDamage = this._resolveDamage(trigger);
			const tags = trigger.entries.filter(e => e.type === 'tag') as TagData[];

			const triggerLogEntry: MatchLogEntry = {
				type: 'trigger',
				source: {...tSource, damage: triggerDamage[tSource.entityId]},
				targets: Object.entries(triggerDamage).map(([eid, value]) => {
					// If the target died here, then it didn't die earlier
					const targetId = parseInt(eid, 10);
					return {
						...entities[targetId],
						damage: value
					};
				})
			};

			// Handle card draws / discovery / creation
			const draws = this._resolveDraws(trigger);
			for (const draw of draws) {
				triggerLogEntry.targets.push(draw);
			}

			// Handle redirections, if redirected, it goes before the attack, otherwise it goes after
			const redirectTag = tags.find(t => t.tag === 'PROPOSED_DEFENDER');
			if (logEntry.type === 'attack' && redirectTag) {
				const newTargetId = parseInt(redirectTag.value, 10);
				const triggerTargets = [newTargetId, block.entity?.entityId, block.target?.entityId];
				for (const id of triggerTargets) {
					const target = entities[id ?? -1];
					if (target) {
						triggerLogEntry.targets.push({...target});
					}
				}

				// Update the core entry to redirect
				logEntry.targets = [{
					...entities[newTargetId],
					damage: damageData[newTargetId]
				}];

				logPreExtras.push(triggerLogEntry);
				continue;
			}

			logExtras.push(triggerLogEntry);
		}

		// Resolve power entries (sources of additional damage/draws)
		// These merge into the main log entry
		const powers = subBlocks.filter(b => b.blockType === 'POWER' && b.entity);
		for (const entry of powers) {
			const draws = this._resolveDraws(entry);
			for (const draw of draws) {
				logEntry.targets.push(draw);
			}

			// Merge damage into MAIN entry
			const damageEntries = this._resolveDamage(entry);
			for (const target of logEntry.targets) {
				if (target.entityId in damageEntries) {
					target.damage = damageEntries[target.entityId];
				}
			}
		}

		const allEntries = [...logPreExtras, logEntry, ...logExtras];

		// Apply deaths, reverse order (not in place)
		for (const entry of [...allEntries].reverse()) {
			entry.source.dead = deaths.has(entry.source.entityId);
			for (const target of entry.targets) {
				target.dead = deaths.has(target.entityId);
			}

			deaths.delete(entry.source.entityId);
			entry.targets.forEach(t => deaths.delete(t.entityId));
		}

		// Add to Match Log and emit events
		gameState.matchLog.push(...allEntries);
		this._emitEvents(emitter, allEntries);
	}

	/**
	 * Recursively extracts all entity objects referenced by entity id
	 * @param block
	 * @param data
	 */
	private _extractEntities(block: BlockData, data: {[key: number]: Entity} = {}) {
		for (const entry of block.entries) {
			if ('entity' in entry && entry.entity) {
				data[entry.entity.entityId] = entry.entity;
			}

			if (entry.type === 'block') {
				if (entry.target) {
					data[entry.target.entityId] = entry.target;
				}

				this._extractEntities(entry, data);
			}
		}

		return data;
	}

	/**
	 * Resolves damage numbers for any block type
	 * @param block
	 */
	private _resolveDamage(block: BlockData): {[key: number]: number} {
		const damageByEntity: { [key: number]: number } = {};

		let nextEntityId = -1;
		for (const data of block.entries) {
			if (data.type === 'tag') {
				if (data.entity && data.tag === 'PREDAMAGE' && data.value !== '0') {
					nextEntityId = data.entity?.entityId;
				}
			} else if (data.type === 'meta' && data.key === 'DAMAGE') {
				damageByEntity[nextEntityId] = data.value;
			}
		}

		return damageByEntity;
	}

	private _resolveDraws(entry: BlockData): Entity[] {
		// Note: card draw/creation seems to be either tag change or show_entity. Verify with other power types
		// We may also want to push this to a method?
		// Discover is 3 embedded entities followed by a ZONE=HAND and ZONE_POSITION=number
		// But ZONE is sometimes used for enchantments (has no ZONE_POSITION with it).
		const drawn: Entity[] = [];

		for (const subEntry of entry.entries) {
			if (subEntry.type === 'tag' && subEntry.entity && subEntry.tag === 'ZONE_POSITION') {
				drawn.push(subEntry.entity);
			}

			if (subEntry.type === 'embedded_entity') {
				// NOTE: for "clones", there is a COPIED_FROM_ENTITY_ID which can be used as additional data
				if (subEntry.action === 'Creating' && subEntry.tags.ZONE !== 'SETASIDE') {
					drawn.push({
						cardName: '',
						entityId: subEntry.entityId,
						player: subEntry.player ?? 'bottom'
					});
				}
			}
		}

		return drawn;
	}

	/**
	 * Determines the id of all entities that died in a block with BlockType=DEATHS.
	 * @param deathBlock
	 */
	private _resolveDeaths(deathBlock: BlockData | null | undefined): Set<number> {
		const deadEntities = new Set<number>();
		if (!deathBlock) {
			return deadEntities;
		}

		for (const data of deathBlock.entries) {
			if (data.type === 'tag' && data.entity && data.tag === 'ZONE' && data.value === 'GRAVEYARD') {
				deadEntities.add(data.entity.entityId);
			}
		}

		return deadEntities;
	}

	private _emitEvents(emitter: HspEventsEmitter, entries: MatchLogEntry[]) {
		for (const logEntry of entries) {
			const cardName = logEntry.source?.cardName;
			if (logEntry.type === 'play') {
				this.logger(`Played card ${cardName}`);
				emitter.emit('card-played', logEntry);
			} else if (logEntry.type === 'attack') {
				this.logger(`Attack initiated by ${cardName}`);
				emitter.emit('attack', logEntry);
			} else if (logEntry.type === 'trigger') {
				this.logger(`Trigger activated on ${cardName}`);
				emitter.emit('trigger', logEntry);
			}
		}
	}
}
