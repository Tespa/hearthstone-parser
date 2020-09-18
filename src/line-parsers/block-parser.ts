import {LineParser} from './AbstractLineParser';
import {HspEventsEmitter} from './index';
import {GameState, MatchLogEntry, EntityProps} from '../GameState';
import {compact, concat} from 'lodash';
import {BlockData, BlockReader, Entity, Entry, FullEntity, TagData} from './readers';

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

	private readonly powerPrefix = '[Power] PowerTaskList.DebugPrintPower() -' as const;
	private readonly powerReader = new BlockReader(this.powerPrefix);

	handleLine(emitter: HspEventsEmitter, gameState: GameState, line: string): boolean {
		// Read GameState blocks. These are used to build the Match Log.
		const block = this.reader.readLine(line, gameState);
		if (block) {
			this._handleMatchLog(emitter, gameState, block);
			return true;
		}

		// Read the PowerTaskList block variant.
		// These are bad for identifying card flow, but great for resolving card names.
		const powerBlock = this.powerReader.readLine(line, gameState);
		if (powerBlock) {
			const entities = this._extractEntities(powerBlock);
			for (const entity of Object.values(entities)) {
				gameState.resolveEntity(entity);
			}

			return true;
		}

		return false;
	}

	private _handleMatchLog(emitter: HspEventsEmitter, gameState: GameState, block: BlockData) {
		const source = block.entity;
		const subBlocks = block.entries.filter(b => b.type === 'block') as BlockData[];

		// Main block TRIGGER but only for nested ATTACK blocks
		// Current known example is Trueaim Crescent
		if (block.blockType === 'TRIGGER' && block.entity) {
			const attacks = subBlocks.filter(b => b.blockType === 'ATTACK');
			attacks.forEach(a => this._handleMatchLog(emitter, gameState, a));
			return;
		}

		// Main block DEATHS updates old match log 'attack' entries
		if (block.blockType === 'DEATHS') {
			const deaths = this._resolveDeaths(block);
			for (let i = gameState.matchLog.length - 1; i >= 0; i--) {
				if (deaths.size === 0) {
					return;
				}

				const entry = gameState.matchLog[i];
				if (entry.type === 'attack') {
					const props = [entry.source, ...entry.targets];
					const propsToKill = props.filter(p => deaths.has(p.entityId));
					propsToKill.forEach(p => {
						p.dead = true;
						deaths.delete(p.entityId);
					});
				}
			}

			return;
		}

		// Exit out if its not a match log relevant
		if (!source || !['PLAY', 'ATTACK'].includes(block.blockType)) {
			return;
		}

		/** Retrieves an entity from anywhere in this block, or a default blank entry */
		const getEntity = (() => {
			const entities = this._extractEntities(block);
			return (entityId: number) => entities[entityId] ?? {cardName: '', entityId};
		})() as (id: number) => Entity;

		// Get damage data
		const damageData = this._resolveDamage(block);
		const tags = block.entries.filter(e => e.type === 'tag') as TagData[];

		// Get targets. Currently only the main one since we assume that damage targets
		// come in POWER. If that changes, add the entries from damageData here.
		const proposedDefender = tags.find(t => t.tag === 'PROPOSED_DEFENDER')?.value;
		const mainTarget = (block.blockType === 'ATTACK' && proposedDefender) ?
			getEntity(parseInt(proposedDefender, 10)) :
			block.target;

		// Create main log entry
		const logEntry: MatchLogEntry = {
			type: block.blockType.toLowerCase() as MatchLogEntry['type'],
			source: entityToMatchLog(source, damageData.get(source.entityId)),
			targets: mainTarget ?
				[entityToMatchLog(mainTarget, damageData.get(mainTarget.entityId))] :
				[]
		};

		// Match Log entries added before/after the core one (triggers)
		// Later parts of this function add to these lists
		const logPreExtras = new Array<MatchLogEntry>();
		const logExtras = new Array<MatchLogEntry>();

		/** Internal function to resolve a trigger, which can be standalone or nested */
		const handleTrigger = (trigger: BlockData) => {
			const validTriggerTypes = ['TRIGGER_VISUAL', 'SECRET', 'DEATHRATTLE'];
			if (!trigger.entity || !validTriggerTypes.includes(trigger.triggerKeyword ?? '')) {
				return;
			}

			// Create Entry List, flatten subpower blocks, resolve trigger source
			const entryParts = trigger.entries.map(e => e.type === 'subspell' ? e.entries : e);
			const entries = concat([], ...entryParts);
			const tSource = entityToMatchLog(trigger.entity);

			// If it was a trigger caused by a PLAY, add the trigger source as a target of the PLAY
			// An example of this effect is Mirror Entity
			// This isn't universal (Apexis Smuggler doesn't show this) but we can't differentiate here
			if (logEntry.type === 'play' && trigger.triggerKeyword !== 'DEATHRATTLE') {
				logEntry.targets.push(tSource);
			}

			const triggerDamage = this._resolveDamage(trigger);
			const triggerLogEntry: MatchLogEntry = {
				type: 'trigger',
				source: {...tSource, damage: triggerDamage.get(tSource.entityId)},
				targets: [...triggerDamage.entries()].map(([eid, value]) => {
					// If the target died here, then it didn't die earlier
					return {...getEntity(eid), damage: value};
				})
			};

			/** Internal function to check that a target does not already exist */
			const doesNotExist = (entityId: number) => {
				return triggerLogEntry.targets.findIndex(t => t.entityId === entityId) === -1;
			};

			for (const subEntry of entries) {
				// Handle card draws / discovery / creation
				const draw = this._resolveDraw(subEntry, entries);
				if (draw && doesNotExist(draw.entityId)) {
					triggerLogEntry.targets.push(draw);
				}

				// Nested death block, mark existing targets as dead or add new ones
				if (subEntry.type === 'block' && subEntry.blockType === 'DEATHS') {
					const deaths = this._resolveDeaths(subEntry);
					for (const id of deaths) {
						const existingTarget = triggerLogEntry.targets.find(t => t.entityId === id);
						if (existingTarget) {
							existingTarget.dead = true;
						} else {
							triggerLogEntry.targets.push({...getEntity(id), dead: true});
						}
					}
				}

				if (subEntry.type === 'tag') {
					// Handle Counterspell
					if (subEntry.entity && subEntry.tag === 'CANT_PLAY' && subEntry.value === '1') {
						triggerLogEntry.targets.push(getEntity(subEntry.entity.entityId));
					}

					// Handle redirections, if redirected, it goes before the attack, otherwise it goes after
					if (logEntry.type === 'attack' && subEntry.tag === 'PROPOSED_DEFENDER') {
						const newTargetId = parseInt(subEntry.value, 10);
						const triggerTargets = [newTargetId, block.entity?.entityId, block.target?.entityId];
						for (const id of compact(triggerTargets)) {
							triggerLogEntry.targets.push(getEntity(id));
						}

						// Update the core entry to use the redirect
						const damage = damageData.get(newTargetId);
						logEntry.targets = [{...getEntity(newTargetId), damage}];

						logPreExtras.push(triggerLogEntry);
						return;
					}
				}
			}

			// Add as new match log entry
			logExtras.push(triggerLogEntry);
		};

		// Power entries sometimes have nested triggers, we may need to handle those too
		const handlePower = (power: BlockData) => {
			// Create Entry List, flatten subpower blocks
			const entryParts = power.entries.map(e => e.type === 'subspell' ? e.entries : e);
			const entries = concat([], ...entryParts);

			/** Internal function to check that a target does not already exist */
			const doesNotExist = (entityId: number) => {
				return logEntry.targets.findIndex(t => t.entityId === entityId) === -1;
			};

			for (const subEntry of entries) {
				// Resolve Draws/Discover/Zone Swaps (stealing)
				const draw = this._resolveDraw(subEntry, entries);
				if (draw && doesNotExist(draw.entityId)) {
					logEntry.targets.push(getEntity(draw.entityId));
				}

				// Handle nested triggers (such as in Puzzle Box)
				if (subEntry.type === 'block' && subEntry.blockType === 'TRIGGER') {
					handleTrigger(subEntry);
				}

				// Handle Updates (transformed targets)
				if (subEntry.type === 'embedded_entity') {
					const entity = getEntity(subEntry.entityId);
					if (subEntry.action === 'Updating' && doesNotExist(subEntry.entityId)) {
						logEntry.targets.push(entity);
					}
				}

				// Handle Revealed entries and elements that become Secrets.
				// ZONE=PLAY is sometimes used for buffs, so we have to ignore those.
				// REVEALED is inconsistent, but better to have more data.
				if (subEntry.type === 'tag' && subEntry.entity && (
					(subEntry.tag === 'REVEALED' && subEntry.value === '1') ||
					(subEntry.tag === 'ZONE' && ['SECRET'].includes(subEntry.value)))) {
					const entity = getEntity(subEntry.entity?.entityId);
					if (doesNotExist(entity.entityId)) {
						logEntry.targets.push(entity);
					}
				}

				// Handle recursive POWER blocks (Puzzle Box) by adding it as a target
				if (subEntry.type === 'block' && subEntry.blockType === 'POWER' && subEntry.entity) {
					const entity = getEntity(subEntry.entity?.entityId);
					if (doesNotExist(entity.entityId)) {
						logEntry.targets.push(entity);
					}

					// Check if this was a hero power that was invoked
					const heroPower = entries.find(
						e => e.type === 'embedded_entity' &&
						e.entityId === subEntry.entity?.entityId &&
						e.tags.CARDTYPE === 'HERO_POWER');
					if (heroPower) {
						handlePower(subEntry);
					}
				}
			}

			// Merge damage (and add new targets) into MAIN entry
			const damageEntries = this._resolveDamage(power);
			for (const [targetId, damage] of damageEntries.entries()) {
				const existing = logEntry.targets.find(t => t.entityId === targetId);
				if (existing) {
					existing.damage = (existing.damage ?? 0) + damage;
				} else {
					logEntry.targets.push({...getEntity(targetId), damage});
				}
			}
		};

		// Handle sub blocks
		for (const block of subBlocks) {
			// Resolve "TRIGGER" entries
			if (block.blockType === 'TRIGGER') {
				handleTrigger(block);
			}

			// Resolve "POWER" entries (sources of additional damage/draws)
			// These merge into the main log entry
			if (block.blockType === 'POWER') {
				handlePower(block);
			}

			// Resolve DEATH entries, reverse order
			if (block.blockType === 'DEATHS') {
				const deaths = this._resolveDeaths(block);
				for (const entry of [...logPreExtras, logEntry, ...logExtras].reverse()) {
					entry.source.dead = deaths.has(entry.source.entityId);
					for (const target of entry.targets) {
						target.dead = deaths.has(target.entityId);
					}

					deaths.delete(entry.source.entityId);
					entry.targets.forEach(t => deaths.delete(t.entityId));
				}
			}
		}

		// Add to Match Log and emit events
		const allEntries = [...logPreExtras, logEntry, ...logExtras];
		gameState.addMatchLogEntry(...allEntries);
		this._emitEvents(emitter, allEntries);
	}

	/**
	 * Recursively extracts all entity objects referenced by entity id
	 * @param block
	 * @param data
	 */
	private _extractEntities(block: BlockData, data: {[key: number]: Entity} = {}) {
		if (block.entity) {
			data[block.entity.entityId] = block.entity;
		}

		if (block.target) {
			data[block.target.entityId] = block.target;
		}

		for (const entry of block.entries) {
			if ('entity' in entry && entry.entity) {
				data[entry.entity.entityId] = entry.entity;
			}

			if (entry.type === 'block') {
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

	/**
	 * Resolves a card draw, discover, or creation in a block.
	 * @param entry the entry being analyzed
	 * @param entries All sibling entries (used to establish context)
	 */
	private _resolveDraw(entry: Entry, entries: Entry[]): Entity | null {
		// Note: card draw/creation seems to be either tag change or show_entity. Verify with other power types
		// We may also want to push this to a method?
		// Discover is 3 embedded entities followed by a ZONE=HAND and ZONE_POSITION=number
		// But ZONE is sometimes used for enchantments (has no ZONE_POSITION with it).
		// ZONE_POSITION without ZONE can happen when cards are moved around (Cabal Shadow Priest)
		const entityId = 'entity' in entry ? entry.entity?.entityId : null;

		// ZONE_POSITION + ZONE is required
		// Just ZONE_POSITION false flags board shifting
		// Just ZONE false flags enchantments
		if (entry.type === 'tag' && entry.entity && entry.tag === 'ZONE_POSITION') {
			const zoneTag = entries.find(e => e.type === 'tag' && e.tag === 'ZONE' && e.entity?.entityId === entityId) as TagData;
			const embedded = entries.find(e => e.type === 'embedded_entity' && e.entityId === entityId) as FullEntity;

			if ((embedded?.tags.ZONE && embedded?.tags.ZONE !== 'SETASIDE') || zoneTag) {
				return entry.entity;
			}
		}

		if (entry.type === 'embedded_entity') {
			// NOTE: for "clones", there is a COPIED_FROM_ENTITY_ID which can be used as additional data
			if (entry.action === 'Creating' && entry.tags.ZONE !== 'SETASIDE') {
				return {
					cardName: '',
					entityId: entry.entityId,
					player: entry.player ?? 'bottom'
				};
			}
		}

		return null;
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
