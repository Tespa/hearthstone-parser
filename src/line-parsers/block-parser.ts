import {LineParser} from './AbstractLineParser';
import {HspEventsEmitter} from './index';
import {GameState, MatchLogEntry} from '../GameState';
import {compact, concat} from 'lodash';
import {BlockData, BlockReader, CardEntity, Entity, Entry, FullEntity, TagData} from './readers';

interface DamageValues {
	damage?: number;
	healing?: number;
}

/**
 * Tests if the entity is non-null and pertains to a card
 * @param entity the entity to test.
 */
const isCard = (entity: Entity | null | undefined): entity is CardEntity => {
	return entity?.type === 'card';
};

/**
 * Filters a list of entities to only contains the ones pertaining to cards
 * @param items a list of entities to filter
 */
const cardsOnly = (items: Entity[]): CardEntity[] => {
	return items.filter(i => i.type === 'card') as CardEntity[];
};

/**
 * Tests if the entry is a tag with a particular tag or tag/value combo.
 * @param entry The entry to test
 * @param tag The value entry.tag should have
 * @param value An optional value to test.
 */
const testTag = (entry: Entry, tag: string, value: string | null = null): entry is TagData => {
	return entry.type === 'tag' &&
		entry.tag === tag &&
		((value === null) ? true : entry.value === value);
};

/**
 * Filters a list of Entries to filter only to tags, with optional tag/value filtering
 * @param entries The entries to filter
 * @param tag The tag to filter the entries by (optional)
 * @param value The tag value to filter the entries by (optional)
 */
const filterTags = (entries: Entry[], tag: string | null = null, value: string | null = null): TagData[] => {
	return entries.filter(e => (tag) ? testTag(e, tag, value) : e.type === 'tag') as TagData[];
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
			for (const entity of cardsOnly(Object.values(entities))) {
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
		if (!isCard(source) || !['PLAY', 'ATTACK'].includes(block.blockType)) {
			return;
		}

		/** Retrieves an entity from anywhere in this block, or a default blank entry */
		const getEntity = (() => {
			const entities = this._extractEntities(block);
			return (entityId: number) => entities[entityId] ?? {cardName: '', entityId};
		})() as (id: number) => CardEntity;

		// Get damage data
		const damageData = this._resolveDamageAndHealing(block);

		// Get targets. Currently only the main one since we assume that damage targets
		// come in POWER. If that changes, add the entries from damageData here.
		// Attack targets via Trueaim are sometimes odd, so use PROPOSED_DEFENDER if given.
		const proposedDefender = filterTags(block.entries, 'PROPOSED_DEFENDER')[0]?.value;
		const mainTarget = (block.blockType === 'ATTACK' && proposedDefender) ?
			getEntity(parseInt(proposedDefender, 10)) :
			block.target;

		// Create main log entry
		const logEntry = new MatchLogEntry(block.blockType.toLowerCase() as MatchLogEntry['type']);
		logEntry.manaSpent = this._determineManaCost(block, gameState);
		logEntry.setSource(source, damageData.get(source.entityId));
		if (isCard(mainTarget)) {
			logEntry.addTarget(mainTarget, damageData.get(mainTarget.entityId));
		}

		// Match Log entries added before/after the core one (triggers)
		// Later parts of this function add to these lists
		const logPreExtras = new Array<MatchLogEntry>();
		const logExtras = new Array<MatchLogEntry>();

		/** Internal function to resolve a trigger, which can be standalone or nested */
		const handleTrigger = (trigger: BlockData) => {
			const validTriggerTypes = ['TRIGGER_VISUAL', 'SECRET', 'DEATHRATTLE'];
			if (!isCard(trigger.entity) || !validTriggerTypes.includes(trigger.triggerKeyword ?? '')) {
				return;
			}

			// Create Entry List, flatten subpower blocks
			const entryParts = trigger.entries.map(e => e.type === 'subspell' ? e.entries : e);
			const entries = concat([], ...entryParts);

			// If it was a trigger caused by a PLAY, add the trigger source as a target of the PLAY
			// An example of this effect is Mirror Entity
			// This isn't universal (Apexis Smuggler doesn't show this) but we can't differentiate here
			if (logEntry.type === 'play' && trigger.triggerKeyword !== 'DEATHRATTLE') {
				logEntry.addTarget(trigger.entity);
			}

			// Create new entry for the trigger, start off with entries that were damaged or healed
			const triggerDamage = this._resolveDamageAndHealing(trigger);
			const triggerLogEntry = new MatchLogEntry('trigger');
			triggerLogEntry.setSource(trigger.entity, triggerDamage.get(trigger.entity.entityId));
			for (const [eid, value] of triggerDamage.entries()) {
				triggerLogEntry.addTarget(getEntity(eid), value);
			}

			for (const subEntry of entries) {
				// Handle card draws / discovery / creation
				const draw = this._resolveDraw(subEntry, entries);
				triggerLogEntry.addTarget(draw);

				// Nested death block, mark existing targets as dead or add new ones
				if (subEntry.type === 'block' && subEntry.blockType === 'DEATHS') {
					const deaths = this._resolveDeaths(subEntry);
					for (const id of deaths) {
						const existingTarget = triggerLogEntry.targets.find(t => t.entityId === id);
						if (existingTarget) {
							existingTarget.dead = true;
						} else {
							const entity = getEntity(id);
							triggerLogEntry.addTarget(entity, {dead: true});
						}
					}
				}

				if (subEntry.type === 'tag') {
					// Handle most common tag types
					if (isCard(subEntry.entity) && this._isTargetTag(subEntry)) {
						triggerLogEntry.addTarget(getEntity(subEntry.entity.entityId));
					}

					// Handle redirections, if redirected, it goes before the attack, otherwise it goes after
					if (logEntry.type === 'attack' && subEntry.tag === 'PROPOSED_DEFENDER' && isCard(mainTarget)) {
						const newTargetId = parseInt(subEntry.value, 10);
						const triggerTargets = [newTargetId, source.entityId, mainTarget.entityId];
						for (const id of compact(triggerTargets)) {
							triggerLogEntry.addTarget(getEntity(id));
						}

						// Update the core entry to use the redirect
						const damage = damageData.get(newTargetId);
						logEntry.targets = [];
						logEntry.addTarget(getEntity(newTargetId), damage);

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

			// Add to the mana spent. Its sometimes here for power flexible cards
			logEntry.manaSpent += this._determineManaCost(power, gameState);

			for (const subEntry of entries) {
				// Resolve Draws/Discover/Zone Swaps (stealing)
				const draw = this._resolveDraw(subEntry, entries);
				logEntry.addTarget(draw ? getEntity(draw.entityId) : null);

				// Handle most common tag types
				if (subEntry.type === 'tag' && isCard(subEntry.entity) && this._isTargetTag(subEntry)) {
					logEntry.addTarget(getEntity(subEntry.entity.entityId));
				}

				// Handle nested triggers (such as in Puzzle Box)
				if (subEntry.type === 'block' && subEntry.blockType === 'TRIGGER') {
					handleTrigger(subEntry);
				}

				// Handle Updates (transformed targets)
				if (subEntry.type === 'embedded_entity' && subEntry.action === 'Updating') {
					const entity = getEntity(subEntry.entityId);
					logEntry.addTarget(entity);
				}

				// Handle recursive POWER blocks (Puzzle Box) by adding it as a target
				if (subEntry.type === 'block' && subEntry.blockType === 'POWER' && isCard(subEntry.entity)) {
					const entity = getEntity(subEntry.entity.entityId);
					logEntry.addTarget(entity);

					// Check if this was a hero power that was invoked
					const heroPower = entries.find(e => (
						e.type === 'embedded_entity' &&
						e.entityId === entity.entityId &&
						e.tags.CARDTYPE === 'HERO_POWER'));
					if (heroPower) {
						handlePower(subEntry);
					}
				}
			}

			// Merge damage (and add new targets) into MAIN entry
			const damageEntries = this._resolveDamageAndHealing(power);
			for (const [targetId, damage] of damageEntries.entries()) {
				const existing = logEntry.targets.find(t => t.entityId === targetId);
				if (existing) {
					existing.damage = (existing.damage ?? 0) + (damage.damage ?? 0);
					existing.healing = (existing.healing ?? 0) + (damage.healing ?? 0);
				} else {
					const entity = getEntity(targetId);
					logEntry.addTarget(entity, damage);
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
	private _extractEntities(block: BlockData, data: {[key: number]: CardEntity} = {}) {
		if (isCard(block.entity)) {
			data[block.entity.entityId] = block.entity;
		}

		if (isCard(block.target)) {
			data[block.target.entityId] = block.target;
		}

		for (const entry of block.entries) {
			if ('entity' in entry && isCard(entry.entity)) {
				data[entry.entity.entityId] = entry.entity;
			}

			if (entry.type === 'block') {
				this._extractEntities(entry, data);
			}
		}

		return data;
	}

	private _determineManaCost(block: BlockData, gameState: GameState) {
		const manaTag = filterTags(block.entries, 'NUM_RESOURCES_SPENT_THIS_GAME')[0];
		if (manaTag && manaTag.entity?.type === 'player') {
			const totalMana = parseInt(manaTag.value, 10);
			const player = gameState.getPlayerByPosition(manaTag.entity.player);
			if (player) {
				const spentMana = totalMana - player.manaSpent;
				player.manaSpent = totalMana;
				return spentMana;
			}
		}

		return 0;
	}

	/**
	 * Resolves damage numbers for any block type.
	 * Returns a Map to guarantee insertion order, which in ES2015 is not preserved
	 * for integer keys for objects.
	 * @param block
	 */
	private _resolveDamageAndHealing(block: BlockData): Map<number, DamageValues> {
		// Note: We could reduce LOC by being clever....but keeping it simple
		const damageByEntity = new Map<number, DamageValues>();

		let nextDamageEntityId = -1;
		let nextHealingEntityId = -1;
		for (const data of block.entries) {
			if (data.type === 'tag' && isCard(data.entity) && data.value !== '0') {
				if (data.tag === 'PREDAMAGE') {
					nextDamageEntityId = data.entity?.entityId;
				} else if (data.tag === 'PREHEALING') {
					nextHealingEntityId = data.entity?.entityId;
				}
			} else if (data.type === 'meta' && ['DAMAGE', 'HEALING'].includes(data.key)) {
				const currentValues = damageByEntity.get(nextDamageEntityId) ?? {};
				if (data.key === 'DAMAGE') {
					const currentValue = currentValues.damage ?? 0;
					damageByEntity.set(nextDamageEntityId, {...currentValues, damage: currentValue + data.value});
				} else if (data.key === 'HEALING') {
					const currentValue = currentValues.healing ?? 0;
					damageByEntity.set(nextHealingEntityId, {...currentValues, healing: currentValue + data.value});
				}
			}
		}

		return damageByEntity;
	}

	/**
	 * Resolves a card draw, discover, or creation in a block.
	 * @param entry the entry being analyzed
	 * @param entries All sibling entries (used to establish context)
	 */
	private _resolveDraw(entry: Entry, entries: Entry[]): CardEntity | null {
		// Note: card draw/creation seems to be either tag change or show_entity. Verify with other power types
		// We may also want to push this to a method?
		// Discover is 3 embedded entities followed by a ZONE=HAND and ZONE_POSITION=number
		// But ZONE is sometimes used for enchantments (has no ZONE_POSITION with it).
		// ZONE_POSITION without ZONE can happen when cards are moved around (Cabal Shadow Priest)
		const entityId = 'entity' in entry && isCard(entry.entity) ? entry.entity.entityId : null;

		// ZONE_POSITION + ZONE is required
		// Just ZONE_POSITION false flags board shifting
		// Just ZONE false flags enchantments
		if (testTag(entry, 'ZONE_POSITION') && isCard(entry.entity)) {
			const zoneTag = filterTags(entries, 'ZONE').find(e => isCard(e.entity) && e.entity.entityId === entityId);
			const embedded = entries.find(e => e.type === 'embedded_entity' && e.entityId === entityId) as FullEntity;

			if ((embedded?.tags.ZONE && embedded?.tags.ZONE !== 'SETASIDE') || zoneTag) {
				return entry.entity;
			}
		}

		if (entry.type === 'embedded_entity') {
			// NOTE: for "clones", there is a COPIED_FROM_ENTITY_ID which can be used as additional data
			if (entry.action === 'Creating' && entry.tags.ZONE !== 'SETASIDE') {
				return {
					type: 'card',
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
			if (data.type === 'tag' && isCard(data.entity) && data.tag === 'ZONE' && data.value === 'GRAVEYARD') {
				deadEntities.add(data.entity.entityId);
			}
		}

		return deadEntities;
	}

	/**
	 * Returns true if the tag denotes a target. False otherwise.
	 * Handles the cases where the tag is the only thing needed to determine if its a target.
	 * @param tag
	 */
	private _isTargetTag(tag: TagData): boolean {
		if (!isCard(tag.entity)) {
			return false;
		}

		// Counterspell, Silenced, Revealed Cards, and created secrets.
		// ZONE=PLAY is sometimes used for buffs, so that's relegated to handleDraws
		// REVEALED is inconsistent (semi-common false positives), but its the only way to get certain things,
		// 			and its better to have more data.
		return (
			testTag(tag, 'CANT_PLAY', '1') ||
			testTag(tag, 'SILENCED', '1') ||
			testTag(tag, 'REVEALED', '1') ||
			testTag(tag, 'ZONE', 'SECRET')
		);
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
