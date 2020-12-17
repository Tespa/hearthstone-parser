import {LineParser} from '../AbstractLineParser';
import {HspEventsEmitter} from '../index';
import {GameState, MatchLogEntry} from '../../GameState';
import {compact} from 'lodash';
import {BlockData, BlockReader, Entry, FullEntity} from '../readers';
import {filterTags, isCard, testTag} from './util';
import {BlockContext} from './context';

/**
 * List of valid trigger keywords.
 */
const validTriggerTypes = ['TRIGGER_VISUAL', 'SECRET', 'DEATHRATTLE', 'SIDEQUEST', 'SPELLBURST'];

/**
 * Handles events associated with BLOCK_START and BLOCK_END and those inbetween.
 * Currently its just the card-played event.
 * It does not block execution of other events until the final BLOCK_END, however it can be
 * blocked by other parsers. So its best to run this one first.
 */
export class MatchLogParser extends LineParser {
	eventName = 'card-played' as const;

	private readonly prefix = '[Power] GameState.DebugPrintPower() -' as const;
	private readonly reader = new BlockReader(this.prefix);

	private readonly powerPrefix = '[Power] PowerTaskList.DebugPrintPower() -' as const;
	private readonly powerReader = new BlockReader(this.powerPrefix);

	handleLine(emitter: HspEventsEmitter, gameState: GameState, line: string): boolean {
		// Read GameState blocks. These are used to build the Match Log.
		const block = this.reader.readLine(line, gameState);
		if (block) {
			try {
				this._handleMatchLogTopLevelBlock(emitter, gameState, block);
			} catch (err) {
				const source = isCard(block.entity) && block.entity.cardName;
				const target = isCard(block.target) && block.target.cardName;
				console.error(`\nFailed to process block: Type=${block.blockType} Source=${source} Target=${target}`);
				console.trace(err.toString());
				console.error();
			}

			return true;
		}

		// Read the PowerTaskList block variant.
		// These are bad for identifying card flow, but great for resolving card names.
		const powerBlock = this.powerReader.readLine(line, gameState);
		if (powerBlock) {
			const context = new BlockContext(gameState, powerBlock);
			for (const entity of context.getAllEntities()) {
				gameState.resolveEntity(entity);
			}

			return true;
		}

		return false;
	}

	/**
	 * Handles a top level block for the purposes of entity tracking and the match log
	 */
	private _handleMatchLogTopLevelBlock(emitter: HspEventsEmitter, gameState: GameState, block: BlockData) {
		// Handle non-nested death blocks, which have special behavior
		if (block.blockType === 'DEATHS') {
			this._handleTopLevelDeaths(gameState, block);
			return;
		}

		// Check that there is a valid source.
		if (!isCard(block.entity)) {
			return;
		}

		const mainContext = new BlockContext(gameState, block);

		// Main block TRIGGER
		if (block.blockType === 'TRIGGER' && validTriggerTypes.includes(block.triggerKeyword ?? '')) {
			this._handleTopLevelTrigger(emitter, mainContext, block);
			return;
		}

		// From here on, only PLAY/ATTACK are valid types
		if (!['PLAY', 'ATTACK'].includes(block.blockType)) {
			return;
		}

		// Get targets. Currently only the main one since we assume that damage targets
		// come in POWER. If that changes, add the entries from damageData here.
		// Attack targets via Trueaim are sometimes odd, so use PROPOSED_DEFENDER if given.
		const proposedDefender = filterTags(block.entries, 'PROPOSED_DEFENDER')[0]?.value;
		const mainTarget = (block.blockType === 'ATTACK' && proposedDefender) ?
			mainContext.get(Number(proposedDefender)) :
			block.target;

		// Create main log entry
		const logType = block.blockType.toLowerCase() as MatchLogEntry['type'];
		const logEntry = new MatchLogEntry(logType, mainContext.get(block.entity));
		logEntry.manaSpent = this._determineManaCost(block, gameState);
		if (isCard(mainTarget)) {
			logEntry.addTarget(mainTarget);
		}

		// Match Log entries added before/after the core one (triggers)
		// Later parts of this function add to these lists
		const logPreExtras = new Array<MatchLogEntry>();
		const logExtras = new Array<MatchLogEntry>();

		/** Internal function to resolve a trigger, which can be standalone or nested */
		const handleTrigger = (trigger: BlockData) => {
			if (!isCard(trigger.entity) || !validTriggerTypes.includes(trigger.triggerKeyword ?? '')) {
				return;
			}

			// If it was a trigger caused by a PLAY, add the trigger source as a target of the PLAY
			// An example of this effect is Mirror Entity
			// This isn't universal (Apexis Smuggler doesn't show this) but we can't differentiate here
			if (logEntry.type === 'play' && trigger.triggerKeyword !== 'DEATHRATTLE') {
				logEntry.addTarget(trigger.entity);
			}

			const context = mainContext.createChild(trigger);
			const entries = context.flattenedEntries;

			// Create new entry for the trigger
			const triggerLogEntry = new MatchLogEntry('trigger', trigger.entity);
			let addBefore = false;

			for (const subEntry of entries) {
				// Resolve common target types (draw/discover/tag/etc)
				const draw = this._resolveTarget(context, subEntry, gameState);
				triggerLogEntry.addTarget(draw ? context.get(draw) : null);

				// Resolve damage and healing
				this._handleHealthChange(triggerLogEntry, context, subEntry);

				// Nested death block, mark existing targets as dead or add new ones
				if (subEntry.type === 'block' && subEntry.blockType === 'DEATHS') {
					const deaths = this._resolveDeaths(subEntry);
					const marked = triggerLogEntry.markDeaths(deaths);
					marked.forEach(m => deaths.delete(m));
					for (const unmarked of deaths) {
						const entity = context.get(unmarked);
						triggerLogEntry.addTarget(entity, {dead: true});
					}
				}

				// Handle redirections, if redirected, it goes before the attack, otherwise it goes after
				if (subEntry.type === 'tag' && logEntry.type === 'attack' && subEntry.tag === 'PROPOSED_DEFENDER' && isCard(mainTarget)) {
					const newTargetId = Number(subEntry.value);
					const triggerTargets = [newTargetId, mainContext.source?.entityId, mainTarget.entityId];
					for (const id of compact(triggerTargets)) {
						triggerLogEntry.addTarget(context.get(id));
					}

					// Update the core entry to use the redirect
					logEntry.targets = [];
					logEntry.addTarget(context.get(newTargetId));

					// Needs to go before the main entry
					addBefore = true;
				}
			}

			// Add as new match log entry
			const list = addBefore ? logPreExtras : logExtras;
			list.push(triggerLogEntry);
		};

		// Power entries sometimes have nested triggers, we may need to handle those too
		const handlePower = (power: BlockData) => {
			const context = mainContext.createChild(power);
			const entries = context.flattenedEntries;

			// Add to the mana spent. Its sometimes here for power flexible cards
			logEntry.manaSpent += this._determineManaCost(power, gameState);

			for (const subEntry of entries) {
				// Resolve common target types (draw/discover/tag/etc)
				const draw = this._resolveTarget(context, subEntry, gameState);
				logEntry.addTarget(draw ? context.get(draw) : null);

				// Resolve damage and healing
				this._handleHealthChange(logEntry, context, subEntry);

				// Handle nested triggers (such as in Puzzle Box)
				if (subEntry.type === 'block' && subEntry.blockType === 'TRIGGER') {
					handleTrigger(subEntry);
				}

				// Handle recursive POWER blocks (Puzzle Box) by adding it as a target
				if (subEntry.type === 'block' && subEntry.blockType === 'POWER' && isCard(subEntry.entity)) {
					const entity = context.get(subEntry.entity.entityId);
					logEntry.addTarget(entity);

					// Check if this was a hero power that was invoked
					const heroPower = entries.find(e => (
						e.type === 'embedded_entity' &&
						e.entity.entityId === entity.entityId &&
						e.entity.tags.CARDTYPE === 'HERO_POWER'));
					if (heroPower) {
						handlePower(subEntry);
					}
				}
			}
		};

		// Handle entries of the main block entry. These mostly delegate to other handlers.
		for (const entry of block.entries) {
			// Special Case - Twinspells. All other created entities should ONLY come from POWER/TRIGGER blocks.
			// If this assumption proves to be false, handle it here.
			if (entry.type === 'embedded_entity' && entry.action === 'Creating' && entry.entity.tags.ZONE === 'HAND') {
				logEntry.addTarget(mainContext.get(entry.entity.entityId));
			}

			// Resolve damage and healing
			this._handleHealthChange(logEntry, mainContext, entry);

			if (entry.type === 'block') {
				// Resolve "TRIGGER" entries
				if (entry.blockType === 'TRIGGER') {
					handleTrigger(entry);
				}

				// Resolve "POWER" entries (sources of additional damage/draws)
				// These merge into the main log entry
				if (entry.blockType === 'POWER') {
					handlePower(entry);
				}

				// Resolve DEATH entries, reverse order
				if (entry.blockType === 'DEATHS') {
					const entries = [...logPreExtras, logEntry, ...logExtras].reverse();
					const deaths = this._resolveDeaths(entry);
					for (const entry of entries) {
						entry.markDeaths(deaths).forEach(h => deaths.delete(h));
					}

					// Add leftovers to most recent block.
					// If this is wrong, use a tag=TO_BE_DESTROYED priority system
					const mostRecent = entries[0];
					for (const death of deaths.values()) {
						mostRecent.addTarget(mainContext.get(death), {dead: true});
					}
				}
			}
		}

		// Merge these entities into the match log
		mainContext.getAllEntities().forEach(e => gameState.resolveEntity(e));

		// Add to Match Log and emit events
		const allEntries = [...logPreExtras, logEntry, ...logExtras];
		gameState.addMatchLogEntry(...allEntries);
		this._emitEvents(emitter, allEntries);
	}

	/**
	 * Handle main block DEATHS, which updates old match log 'attack' entries.
	 * @param gameState
	 * @param block
	 */
	private _handleTopLevelDeaths(gameState: GameState, block: BlockData) {
		const deaths = this._resolveDeaths(block);
		for (let i = gameState.matchLog.length - 1; i >= 0 && deaths.size; i--) {
			const entry = gameState.matchLog[i];
			if (entry.type === 'attack') {
				entry.markDeaths(deaths).forEach(m => deaths.delete(m));
			}
		}
	}

	/**
	 * Handle nested triggered attacks (like Trueaim Crescent) and certain events like end of turn triggers
	 */
	private _handleTopLevelTrigger(emitter: HspEventsEmitter, context: BlockContext, block: BlockData) {
		const {gameState, source} = context;
		if (!source) {
			context.commitToState();
			return;
		}

		// Handle Nested attack entries
		const attacks = context.blocks.filter(b => b.blockType === 'ATTACK');
		attacks.forEach(a => this._handleMatchLogTopLevelBlock(emitter, gameState, a));

		// Resolve trigger normally (only publish if there are targets)
		const logEntry = new MatchLogEntry('trigger', source);
		for (const subEntry of block.entries) {
			// Resolve common target types (draw/discover/tag/etc)
			const draw = this._resolveTarget(context, subEntry, gameState);
			logEntry.addTarget(draw ? context.get(draw) : null);

			// Handle damage and healing
			this._handleHealthChange(logEntry, context, subEntry);
		}

		if (logEntry.targets.length || !attacks.length) {
			gameState.addMatchLogEntry(logEntry);
			this._emitEvents(emitter, [logEntry]);
		}

		// Merge these entities into the match log
		context.commitToState();
	}

	/**
	 * Handles health changes (damage or healing) on a log entry for a single line.
	 * If the entry is not in the match log, it is added automatically.
	 * @param logEntry
	 * @param context
	 * @param line
	 */
	private _handleHealthChange(logEntry: MatchLogEntry, context: BlockContext, line: Entry) {
		const entities = context.entities;
		const values = context.detectHealthChange(line);

		if (values) {
			const entries = [logEntry.source, ...logEntry.targets].filter(p => p.entityId === values.entityId);
			if (!entries.length) {
				logEntry.addTarget(entities.get(values.entityId), values.values);
				return;
			}

			for (const entry of entries) {
				if (values.values.damage) {
					entry.damage = (entry.damage ?? 0) + values.values.damage;
				}

				if (values.values.healing) {
					entry.healing = (entry.healing ?? 0) + values.values.healing;
				}
			}
		}
	}

	private _determineManaCost(block: BlockData, gameState: GameState) {
		const manaTag = filterTags(block.entries, 'NUM_RESOURCES_SPENT_THIS_GAME')[0];
		if (manaTag && manaTag.entity?.type === 'player') {
			const totalMana = Number(manaTag.value);
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
	 * Resolves a card draw, discover, or creation in a block, or common tag alterations
	 * @param entry the entry being analyzed
	 * @param entries All sibling entries (used to establish context)
	 * @returns an id if a target has been identified. Otherwise null.
	 */
	private _resolveTarget(context: BlockContext, entry: Entry, gameState: GameState): number | null {
		// Note: card draw/creation seems to be either tag change or show_entity. Verify with other power types
		// We may also want to push this to a method?
		// Discover is 3 embedded entities followed by a ZONE=HAND and ZONE_POSITION=number
		// But ZONE is sometimes used for enchantments (has no ZONE_POSITION with it).
		// ZONE_POSITION without ZONE can happen when cards are moved around (Cabal Shadow Priest)
		const {block, flattenedEntries: entries} = context;
		const entityId = 'entity' in entry && isCard(entry.entity) ? entry.entity.entityId : null;

		// Test for created embedded entities that have a valid zone and zone position
		if (entry.type === 'embedded_entity' && entry.action === 'Creating') {
			// NOTE: for "clones", there is a COPIED_FROM_ENTITY_ID which can be used as additional data
			const tags = entry.entity.tags;
			if (tags.ZONE_POSITION && tags.ZONE !== 'SETASIDE') {
				return entry.entity.entityId;
			}
		}

		// Test for altered embedded entities such as transform targets
		// Entities that have a created version in the same block are disqualified
		if (entry.type === 'embedded_entity' && entry.action === 'Updating') {
			const merged = context.getMergedEntity(entry.entity.entityId);
			const hasCreation = entries.find(e =>
				e.type === 'embedded_entity' &&
				e.action === 'Creating' &&
				e.entity.entityId === entityId);
			if (!hasCreation && merged?.entity.tags.ZONE !== 'SETASIDE') {
				return entityId;
			}
		}

		// ZONE_POSITION + ZONE to test for cards that entered play
		// Just ZONE_POSITION false flags board shifting
		// Just ZONE false flags enchantments, which is handled later.
		if (testTag(entry, 'ZONE_POSITION') && isCard(entry.entity)) {
			const zoneTag = filterTags(entries, 'ZONE').find(e => isCard(e.entity) && e.entity.entityId === entityId);
			const embedded = entries.find(e => e.type === 'embedded_entity' && e.entity.entityId === entityId) as FullEntity | undefined;
			const tags = embedded?.entity.tags ?? {};
			if ((tags.ZONE && tags.ZONE !== 'SETASIDE') || zoneTag) {
				return entityId;
			}
		}

		// Test for enchantments, and return what its attached to
		// Enchantments to 2 or 3 are on a player, and are nonsense.
		if (testTag(entry, 'ZONE', 'PLAY') && isCard(entry.entity) && isCard(block.entity)) {
			// Get all full_entities and merge them (handles Create > Update)
			const fullEntity = context.getMergedEntity(entry.entity.entityId);
			const tags = fullEntity?.entity.tags ?? {};
			const isEnchantment = tags.CARDTYPE === 'ENCHANTMENT';
			const creator = Number(tags.CREATOR);
			const attached = Number(tags.ATTACHED);
			if (isEnchantment && attached > 3 && creator === block.entity.entityId) {
				return attached;
			}
		}

		// Test for enchantments getting "enhanced" (Master Swordsmith / Dragonmaw Overseer)
		if (testTag(entry, 'SPAWN_TIME_COUNT') && isCard(entry.entity)) {
			const existing = gameState.getEntity(entry.entity.entityId);
			if (existing && existing.tags.CARDTYPE === 'ENCHANTMENT' && existing.tags.ATTACHED) {
				return Number(existing.tags.ATTACHED);
			}
		}

		// Counterspell, Silenced, Revealed Cards, created secrets, altered stats.
		// ZONE=PLAY is sometimes used for buffs, so that's relegated to handleDraws
		// REVEALED is inconsistent (semi-common false positives), but its the only way to get certain things,
		// 			and its better to have more data.
		if ((
			testTag(entry, 'CANT_PLAY', '1') ||
			testTag(entry, 'SILENCED', '1') ||
			testTag(entry, 'REVEALED', '1') ||
			testTag(entry, 'ZONE', 'SECRET')
		) && isCard(entry.entity)) {
			return entityId;
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
