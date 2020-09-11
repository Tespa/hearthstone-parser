import {LineParser} from './AbstractLineParser';
import {HspEventsEmitter} from './index';
import {GameState, MatchLogEntry, EntityProps} from '../GameState';
import compact = require('lodash.compact');
import {BlockData, BlockReader, Entity, TagData} from './readers';

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

		const entities = this._extractEntities(block);
		const subBlocks = block.entries.filter(b => b.type === 'block') as BlockData[];

		// Get death and damage data
		const deathBlock = subBlocks.find(b => b.type === 'block' && b.blockType === 'DEATHS');
		const deaths = this._resolveDeaths(deathBlock as BlockData);
		const damageData = this._resolveDamage(block);

		// Get targets. Currently only the main one since we assume that damage targets
		// come in POWER. If that changes, add the entries from damageData here.
		const targets = new Array<Entity>();
		if (block.target) {
			targets.push(block.target);
		}

		// Create main log entry
		const logEntry: MatchLogEntry = {
			type: type as MatchLogEntry['type'],
			source: entityToMatchLog(source, damageData.get(source.entityId)),
			targets: targets.map(t =>
				entityToMatchLog(t, damageData.get(t.entityId)))
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
				source: {...tSource, damage: triggerDamage.get(tSource.entityId)},
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

				// Update the core entry to use the redirect
				const damage = damageData.get(newTargetId);
				logEntry.targets = [{...entities[newTargetId], damage}];

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

			// Merge damage (and add new targets) into MAIN entry
			const damageEntries = this._resolveDamage(entry);
			for (const [targetId, damage] of damageEntries.entries()) {
				const existing = logEntry.targets.find(t => t.entityId === targetId);
				if (existing) {
					existing.damage = (existing.damage ?? 0) + damage;
				} else {
					logEntry.targets.push({...entities[targetId], damage});
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
	 * Resolves damage numbers for any block type.
	 * Returns a Map to guarantee insertion order, which in ES2015 is not preserved
	 * for integer keys for objects.
	 * @param block
	 */
	private _resolveDamage(block: BlockData): Map<number, number> {
		const damageByEntity = new Map<number, number>();

		let nextEntityId = -1;
		for (const data of block.entries) {
			if (data.type === 'tag') {
				if (data.entity && data.tag === 'PREDAMAGE' && data.value !== '0') {
					nextEntityId = data.entity?.entityId;
				}
			} else if (data.type === 'meta' && data.key === 'DAMAGE') {
				const currentDamage = damageByEntity.get(nextEntityId) ?? 0;
				damageByEntity.set(nextEntityId, currentDamage + data.value);
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
