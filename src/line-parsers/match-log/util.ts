import {CardEntity, Entity, Entry, TagData} from '../readers';

/**
 * Tests if the entity is non-null and pertains to a card
 * @param entity the entity to test.
 */
export const isCard = (entity: Entity | null | undefined): entity is CardEntity => {
	return entity?.type === 'card';
};

/**
 * Tests if the entry is a tag with a particular tag or tag/value combo.
 * @param entry The entry to test
 * @param tag The value entry.tag should have
 * @param value An optional value to test.
 */
export const testTag = (entry: Entry, tag: string, value: string | null = null): entry is TagData => {
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
export const filterTags = (entries: Entry[], tag: string | null = null, value: string | null = null): TagData[] => {
	return entries.filter(e => (tag) ? testTag(e, tag, value) : e.type === 'tag') as TagData[];
};
