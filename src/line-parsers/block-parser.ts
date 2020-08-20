import {LineParser} from './AbstractLineParser';
import {HspEventsEmitter} from './index';
import {GameState} from '../GameState';

interface TagData {
	type: 'tag';
}

interface Entity {
	cardName: string;
	entityId: number;
	player: 'top' | 'bottom';
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

function identifyPlayer(gamestate: GameState, playerIndex: number) {
	const player = gamestate.getPlayerById(playerIndex);
	if (player) {
		return player.position;
	}

	// If there is a player and we didn't retrieve it, load the opposite player
	if (gamestate.playerCount === 1) {
		return (gamestate.players[0].position === 'bottom') ? 'top' : 'bottom';
	}

	// Lie and say its the bottom player otherwise (should never happen)
	return 'bottom';
}

/**
 * Class designed to read block data.
 * Does not emit actual events or use the block data for anything, for that use the BlockParser.
 */
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

	readLine(line: string, gameState: GameState): BlockData | null {
		if (!line.startsWith(this.prefix)) {
			return null;
		}

		line = line.substring(this.prefix.length).trimLeft();

		// Internal function to resolve an entity string
		const readEntity = (str: string): Entity | undefined => {
			const parsedEntity = this.entityReader(str);
			return (parsedEntity) ? {
				cardName: parsedEntity.cardName,
				entityId: parsedEntity.entityId,
				player: identifyPlayer(gameState, parsedEntity.player)
			} : undefined;
		};

		// Create a new block if we're starting one
		const blockStart = this.blockStartReader(line);
		if (blockStart) {
			// Read source and target (if given)
			const entity = readEntity(blockStart.entityString);
			const target = readEntity(blockStart.targetString);

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
 * Handles events associated with BLOCK_START and BLOCK_END and those inbetween.
 * Currently its just the card-played event.
 * It does not block execution of other events until the final BLOCK_END, however it can be
 * blocked by other parsers. So its best to run this one first.
 */
export class BlockParser extends LineParser {
	eventName = 'card-played' as const;

	private readonly reader = new BlockReader();

	handleLine(emitter: HspEventsEmitter, gameState: GameState, line: string): boolean {
		const block = this.reader.readLine(line, gameState);
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
