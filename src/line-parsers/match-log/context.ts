import {concat, merge} from 'lodash';
import {BlockData, CardEntity, Entry, FullEntity} from '../readers';
import {GameState} from '../../GameState';
import {isCard} from './util';

/**
 * Used to receive full entity data from the full block scope or the game state.
 */
class EntityCollection {
	entities: Record<number, CardEntity> = {};
	constructor(private readonly gameState: GameState) { }

	add(entity: CardEntity) {
		this.entities[entity.entityId] = merge(this.get(entity.entityId), entity);
	}

	/**
	 * Adds the entity and sets the tag
	 */
	setTag(entity: CardEntity, key: string, value: string) {
		this.add(entity);
		this.entities[entity.entityId].tags[key] = value;
	}

	values() {
		return Object.values(this.entities);
	}

	get(entityIdOrCard: number | CardEntity): CardEntity {
		const entityId = typeof entityIdOrCard === 'number' ? entityIdOrCard : entityIdOrCard?.entityId;
		if (entityId in this.entities) {
			return this.entities[entityId];
		}

		const newEntity = this.gameState.getEntity(entityId) ??
			{cardName: '', entityId, player: 'bottom', type: 'card', tags: {}};
		return newEntity;
	}
}

/**
 * Class used to perform pre-processing of a block and store the results.
 * The intention is to cache and pass around certain groups of properties,
 * while also maintaining a context of what has already been processed.
 */
export class BlockContext {
	/**
	 * Entries that have been flattened (merged subspells mostly)
	 */
	public flattenedEntries: Entry[];

	public nextDamageEntityId: number;
	public nextHealingEntityId: number;

	public entities: EntityCollection;

	public readonly blocks: BlockData[];
	public readonly source: CardEntity | undefined;

	constructor(public gameState: GameState, public block: BlockData, entities?: EntityCollection) {
		if (isCard(block.entity)) {
			this.source = block.entity;
		}

		if (entities) {
			// Assign entities. If this version is called, its most likely a child.
			this.entities = entities;
		} else {
			// Build Entity collection, and iterate over entries
			this.entities = new EntityCollection(gameState);
			this.applyEntry(block);
		}

		// Create Entry List, flatten subpower blocks
		const entryParts = block.entries.map(e => e.type === 'subspell' ? e.entries : e);
		this.flattenedEntries = concat([], ...entryParts);

		// Filter sub blocks
		this.blocks = block.entries.filter(b => b.type === 'block') as BlockData[];
	}

	createChild(block: BlockData) {
		return new BlockContext(this.gameState, block, this.entities);
	}

	getAllEntities() {
		return this.entities.values();
	}

	/**
	 * Retrieves a resolved complete scoped entity, using either the id or an existing card entity.
	 * This includes all the resolved tags in the block.
	 */
	get(entityId: number | CardEntity) {
		return this.entities.get(entityId);
	}

	/**
	 * Merges all embedded entities into one super entity. We might wanna resolve tags as well?
	 * @param entityId
	 */
	getMergedEntity(entityId: number) {
		// Get all full_entities and merge them (handles Create > Update)
		const allEmbedded = this.flattenedEntries.filter(
			e => e.type === 'embedded_entity' && e.entity.entityId === entityId) as FullEntity[];
		if (allEmbedded.length) {
			return merge(allEmbedded[0], ...allEmbedded.slice(1)) as FullEntity;
		}

		return null;
	}

	/**
	 * Detects instances of an entry taking damage or healing.
	 * Run on every entry inside of the list of damage entries for procs.
	 * @param data
	 */
	detectHealthChange(data: Entry) {
		if (data.type === 'tag' && isCard(data.entity) && data.value !== '0') {
			if (data.tag === 'PREDAMAGE') {
				this.nextDamageEntityId = data.entity?.entityId;
			} else if (data.tag === 'PREHEALING') {
				this.nextHealingEntityId = data.entity?.entityId;
			}
		}

		if (data.type === 'meta' && data.key === 'DAMAGE') {
			return {
				entityId: this.nextDamageEntityId,
				values: {damage: data.value}
			};
		}

		if (data.type === 'meta' && data.key === 'HEALING') {
			return {
				entityId: this.nextHealingEntityId,
				values: {healing: data.value}
			};
		}

		return null;
	}

	commitToState() {
		this.getAllEntities().forEach(e => this.gameState.resolveEntity(e));
	}

	/**
	 * Recursively extracts all entity objects referenced by entity id.
	 * This exists because we may want to transition eventually
	 * to iterating over entries line by line, and "building" entities
	 * rather than pre-loading them all at least.
	 * @param block
	 * @param data
	 */
	private applyEntry(entry: Entry) {
		if (entry.type === 'block') {
			if (isCard(entry.entity)) {
				this.entities.add(entry.entity);
			}

			if (isCard(entry.target)) {
				this.entities.add(entry.target);
			}
		} else if ('entity' in entry && isCard(entry.entity)) {
			const entity = entry.entity;
			if (entry.type === 'tag') {
				this.entities.setTag(entity, entry.tag, entry.value);
			} else {
				this.entities.add(entity);
			}
		}

		// Apply entries recursively
		if (entry.type === 'block' || entry.type === 'subspell') {
			for (const sub of entry.entries) {
				this.applyEntry(sub);
			}
		}
	}
}
