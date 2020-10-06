import {GameState} from '../../GameState';
import {FullEntity} from '.';
import {FullEntityReader} from './full-entity-reader';
import {createSimpleRegexParser, Entity, MetaData, readEntityString, TagData} from './base';

export type Entry = BlockData | SubSpell | TagData | MetaData | FullEntity;

/**
 * Object derived from the combination of elements between BLOCK_START and BLOCK_END
 */
export interface BlockData {
	type: 'block';
	blockType: string;
	triggerKeyword?: string;
	entity?: Entity;
	target?: Entity;
	entries: Entry[];
}

export interface SubSpell {
	type: 'subspell';
	spell: string;
	entries: Entry[];
}

/**
 * Class designed to read block data.
 * Does not emit actual events or use the block data for anything, for that use the BlockParser.
 */
export class BlockReader {
	/**
	 * Contains ongoing block stack data.
	 */
	private readonly stack = Array<BlockData | SubSpell>();

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

	private readonly subSpellReader = createSimpleRegexParser(
		/\s*SUB_SPELL_START - SpellPrefabGUID=(.*):(.*) Source=(.*) TargetCount=(.*)/,
		parts => ({
			spell: parts[1]
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
		if (line.includes('BLOCK_END') || line.includes('SUB_SPELL_END')) {
			const mostRecentBlock = this.stack.pop();
			if (!mostRecentBlock) {
				// This shouldn't ever happen
				return null;
			}

			// Check if its the highest block. If so, return it
			// The first one is forced to be a block by algorithm design, so its ok to cast it.
			if (this.stack.length === 0) {
				return mostRecentBlock as BlockData;
			}

			this.stack[this.stack.length - 1].entries.push(mostRecentBlock);
		}

		// For the rest, skip if we're not in a block
		if (this.stack.length === 0) {
			return null;
		}

		const subSpellStart = this.subSpellReader(line);
		if (subSpellStart) {
			const {spell} = subSpellStart;
			this.stack.push({type: 'subspell', spell, entries: []});
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
		const tagData = this.tagReader(line);
		if (!tagData) {
			return false;
		}

		const mostRecentBlock = this.mostRecentBlock;
		const {tag, value, entityString} = tagData;
		let entity: Entity | undefined;

		const entityId = parseInt(entityString, 10);
		if (entityId) {
			// Try to get some more data from the current block (like the player)
			const existing = mostRecentBlock.entries.find(e =>
				e.type === 'embedded_entity' && e.entity.entityId === entityId) as FullEntity;
			if (existing) {
				entity = existing.entity;
			}
		} else {
			entity = readEntityString(entityString, gameState);
		}

		mostRecentBlock.entries.push({type: 'tag', entity, tag, value});
		return true;
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
