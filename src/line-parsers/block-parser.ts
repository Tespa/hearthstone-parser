import {LineParser} from './AbstractLineParser';
import {HspEventsEmitter} from './index';
import {GameState} from '../GameState';

interface TagData {
	type: 'tag';
}

export interface BlockData {
	type: 'block';
	entries: Array<BlockData | TagData>;
	blockType: string;
	entity?: {
		cardName: string;
		entityId: number;
	};
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

/**
 * Handles events associated with BLOCK_START and BLOCK_END.
 * Currently its just the card-played event.
 */
export class BlockParser extends LineParser {
	eventName = 'card-played' as const;

	private readonly prefix = '[Power] GameState.DebugPrintPower()' as const;

	/**
	 * Contains ongoing block stack data.
	 */
	private readonly stack = Array<BlockData>();

	private readonly blockStartReader = createSimpleRegexParser(
		/-\s+BLOCK_START BlockType=([A-Z]*) Entity=(.*) EffectCardId=(.*) EffectIndex=(.*) Target=(.*) SubOption=(.*) (?:TriggerKeyword=(.*))?/,
		parts => ({
			blockType: parts[1],
			entityString: parts[2]
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

	handleLine(emitter: HspEventsEmitter, gameState: GameState, line: string): boolean {
		if (!line.startsWith(this.prefix)) {
			return false;
		}

		line = line.substring(this.prefix.length).trimLeft();

		// Create a new block if we're starting one
		const blockStart = this.blockStartReader(line);
		if (blockStart) {
			const parsedEntity = this.entityReader(blockStart.entityString);
			const entity: BlockData['entity'] | undefined = (parsedEntity) ? {
				cardName: parsedEntity.cardName,
				entityId: parsedEntity.entityId
			} : undefined;

			const blockData: BlockData = {
				type: 'block',
				entries: [],
				blockType: blockStart.entityString,
				entity
			};

			this.stack.push(blockData);
			return true;
		}

		// If a block has ended, return it
		if (line.includes('BLOCK_END')) {
			const mostRecentBlock = this.stack.pop();
			if (!mostRecentBlock) {
				this.logger('ERROR - BLOCK_END with no active block');
				return true;
			}

			// Check if its the highest block. If so, emit it if the type is correct
			if (this.stack.length === 0 && mostRecentBlock?.blockType === 'PLAY') {
				this.logger(`Played card ${mostRecentBlock.entity?.cardName ?? 'UNKNOWN'}`);
				emitter.emit('card-played', mostRecentBlock);
			} else {
				this.stack[this.stack.length - 1].entries.push(mostRecentBlock);
			}
		}

		// Stop all other parsers if we're in a stack
		return this.stack.length > 0;
	}
}
