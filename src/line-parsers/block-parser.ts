import {LineParser} from './AbstractLineParser';
import {HspEventsEmitter} from './index';
import {GameState} from '../GameState';

interface TagData {
	type: 'tag';
}

interface Entity {
	cardName: string;
	entityId: number;
	playerIndex: number;
}

export interface BlockData {
	type: 'block';
	entries: Array<BlockData | TagData>;
	blockType: string;
	entity?: Entity;
	target?: Entity;
}

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

class BlockReader {
	private readonly prefix = '[Power] GameState.DebugPrintPower()' as const;

	/**
	 * Contains ongoing block stack data.
	 */
	private readonly stack = Array<BlockData>();

	private readonly blockStartReader = createSimpleRegexParser(
		/-\s+BLOCK_START BlockType=([A-Z]*) Entity=(.*) EffectCardId=(.*) EffectIndex=(.*) Target=(.*) SubOption=(.*) (?:TriggerKeyword=(.*))?/,
		parts => ({
			blockType: parts[1],
			entityString: parts[2],
			targetString: parts[5]
		})
	);

	private readonly tagReader = createSimpleRegexParser(
		/-\s+TAG_CHANGE Entity=\[entityName=(.*) id=(\d*) zone=.* zonePos=\d* cardId=(.*) player=(\d)\] tag=(.*) value=(\d*)/,
		parts => ({
			cardName: parts[1],
			entityId: parseInt(parts[2], 10),
			cardId: parts[3],
			playerId: parseInt(parts[4], 10),
			tag: parts[5],
			value: parseInt(parts[6], 10)
		})
	);

	private readonly entityReader = createSimpleRegexParser(
		/\[entityName=(.*) (?:\[cardType=(.*)\] )?id=(\d*) zone=.* zonePos=\d* cardId=(.*) player=(\d)\]/,
		parts => ({
			cardName: parts[1],
			entityId: parseInt(parts[3], 10),
			player: parseInt(parts[5], 10)
		})
	);

	get processing(): boolean {
		return this.stack.length > 0;
	}

	readLine(line: string): BlockData | null {
		if (!line.startsWith(this.prefix)) {
			return null;
		}

		line = line.substring(this.prefix.length).trimLeft();

		// Create a new block if we're starting one
		const blockStart = this.blockStartReader(line);
		if (blockStart) {
			// The source (if one is given)
			const parsedEntity = this.entityReader(blockStart.entityString);
			const entity: Entity | undefined = (parsedEntity) ? {
				cardName: parsedEntity.cardName,
				entityId: parsedEntity.entityId,
				playerIndex: parsedEntity.player
			} : undefined;

			// The target (if one is given)
			const parsedTarget = this.entityReader(blockStart.targetString);
			const target: Entity | undefined = (parsedTarget) ? {
				cardName: parsedTarget.cardName,
				entityId: parsedTarget.entityId,
				playerIndex: parsedTarget.player
			} : undefined;

			const blockData: BlockData = {
				type: 'block',
				entries: [],
				blockType: blockStart.blockType,
				entity, target
			};

			this.stack.push(blockData);
			return null;
		}

		const tagData = this.tagReader(line);
		if (tagData && this.stack.length > 0) {
			this.stack[this.stack.length - 1].entries.push({type: 'tag'});
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

		return null;
	}
}

/**
 * Handles events associated with BLOCK_START and BLOCK_END.
 * Currently its just the card-played event.
 */
export class BlockParser extends LineParser {
	eventName = 'card-played' as const;

	private readonly reader = new BlockReader();

	handleLine(emitter: HspEventsEmitter, _gameState: GameState, line: string): boolean {
		const block = this.reader.readLine(line);
		if (block) {
			const entity = block.entity;
			const cardName = entity ? entity.cardName : 'UNKNOWN';
			if (block.blockType === 'PLAY') {
				this.logger(`Played card ${cardName}`);
				emitter.emit('card-played', block);
			} else if (block.blockType === 'ATTACK') {
				this.logger(`Attack initiated by ${cardName}`);
				emitter.emit('attack', block);
			}
		}

		// Stop all other parsers if the block has ended
		return Boolean(block);
	}
}
