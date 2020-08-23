import {LineParser} from './AbstractLineParser';
import {HspEventsEmitter} from './index';
import {GameState, MatchLogEntry, EntityProps} from '../GameState';

interface TagData {
	type: 'tag';
	entity?: Entity;
	tag: string;
	value: string;
}

interface MetaData {
	type: 'meta';
	key: string;
	value: number;
}

interface Entity {
	cardName: string;
	entityId: number;
	player: 'top' | 'bottom';
}

export interface BlockData {
	type: 'block';
	entries: Array<BlockData | TagData | MetaData>;
	blockType: string;
	trigger?: string;
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
			targetString: parts[5],
			trigger: parts[7]
		})
	);

	private readonly tagReader = createSimpleRegexParser(
		/-\s+TAG_CHANGE Entity=(.*) tag=(.*) value=(\d*)/,
		parts => ({
			entityString: parts[1],
			tag: parts[2],
			value: parts[3]
		})
	);

	private readonly metaReader = createSimpleRegexParser(
		/-\s+META_DATA - Meta=([A-Z]+) Data=(\d*) Info(?:Count)?=(.*)/,
		parts => ({
			key: parts[1],
			value: parseInt(parts[2], 10)
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
				trigger: blockStart.trigger,
				entity, target
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

		const mostRecentBlock = this.stack[this.stack.length - 1];

		const tagData = this.tagReader(line);
		if (tagData) {
			mostRecentBlock.entries.push({
				type: 'tag',
				entity: readEntity(tagData.entityString),
				tag: tagData.tag,
				value: tagData.value
			});
		}

		const metaData = this.metaReader(line);
		if (metaData) {
			mostRecentBlock.entries.push({
				type: 'meta',
				key: metaData.key,
				value: metaData.value
			});
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
			this._handleMatchLog(emitter, gameState, block);
			return true;
		}

		return false;
	}

	private _handleMatchLog(emitter: HspEventsEmitter, gameState: GameState, block: BlockData) {
		const source = block.entity;
		const cardName = source ? source.cardName : 'UNKNOWN ENTITY [cardType=INVALID]';
		const type = block.blockType.toLowerCase();

		// Exit out if its not a match log relevant
		if (!source || !['play', 'attack'].includes(type)) {
			return;
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
				damage
			};
		};

		const targets = new Array<Entity>();
		if (block.target) {
			targets.push(block.target);
		}

		const damageData = this._resolveDamage(block);

		const entry: MatchLogEntry = {
			type: type as MatchLogEntry['type'],
			source: entityToMatchLog(source, damageData[source.entityId]),
			targets: targets.map(t =>
				entityToMatchLog(t, damageData[t.entityId]))
		};

		gameState.matchLog.push(entry);

		// Check for triggers
		for (const trigger of block.entries) {
			if (trigger.type !== 'block' || trigger.blockType !== 'TRIGGER') {
				continue;
			}

			if (trigger.trigger === 'SECRET' && trigger.entity) {
				const triggerSource = entityToMatchLog(trigger.entity);

				// If it was a play entry, add it as a target of the play
				// An example of this effect is Mirror Entity
				if (entry.type === 'play') {
					entry.targets.push(triggerSource);
				}

				gameState.matchLog.push({
					type: 'trigger',
					source: triggerSource,
					targets: []
				});
			}
		}

		if (block.blockType === 'PLAY') {
			this.logger(`Played card ${cardName}`);
			emitter.emit('card-played', entry);
		} else if (block.blockType === 'ATTACK') {
			this.logger(`Attack initiated by ${cardName}`);
			emitter.emit('attack', entry);
		}
	}

	/**
	 * Resolves damage numbers for a block of type ATTACK
	 * @param block
	 */
	private _resolveDamage(block: BlockData): { [key: number]: number } {
		const damageByEntity: { [key: number]: number } = {};

		let nextEntityId = -1;
		for (const data of block.entries) {
			if (data.type === 'tag') {
				const value = parseInt(data.value, 10);
				if (data.entity && data.tag === 'PREDAMAGE' && value !== 0) {
					nextEntityId = data.entity?.entityId;
				}
			} else if (data.type === 'meta' && data.key === 'DAMAGE') {
				damageByEntity[nextEntityId] = data.value;
			}
		}

		return damageByEntity;
	}
}
