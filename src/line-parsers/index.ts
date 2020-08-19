import StrictEventEmitter from 'strict-event-emitter-types/types/src';
import {EventEmitter2} from 'eventemitter2';

import {GameOverLineParser} from './game-over';
import {GameStartLineParser} from './game-start';
import {GameTagChangeLineParser} from './game-tag-change';
import {NewPlayerLineParser} from './new-player';
import {TurnLineParser} from './turn';
import {ZoneChangeLineParser} from './zone-change';
import {TagChangeLineParser} from './tag-change';
import {GameState} from '../GameState';
import {MulliganStartParser} from './mulligan-start';
import {ChoiceIdParser} from './choice-id';
import {DiscoveryEndParser} from './discovery-end';
import {DiscoveryStartParser} from './discovery-start';
import {MullinganResultParser} from './mulligan-result';
import {BlockData, BlockParser} from './block-parser';

export const lineParsers = [
	new BlockParser(),
	new GameOverLineParser(),
	new GameStartLineParser(),
	new NewPlayerLineParser(),
	new TurnLineParser(),
	new ZoneChangeLineParser(),
	new TagChangeLineParser(),
	new GameTagChangeLineParser(),
	new MulliganStartParser(),
	new ChoiceIdParser(),
	new DiscoveryStartParser(),
	new DiscoveryEndParser(),
	new MullinganResultParser()
];

export interface Events {
	'gamestate-changed': GameState;
	'game-over': void;
	'game-start': void;
	'game-tag-change': void;
	'player-joined': void;
	'turn-change': void;
	'tag-change': void;
	'zone-change': void;
	'mulligan-start': void;
	'choice-id': void;
	'discovery-start': void;
	'discovery-end': void;
	'mulligan-result': void;
	'card-played': BlockData;
	'attack': BlockData;
}

export type HspEventsEmitter = StrictEventEmitter<EventEmitter2, Events>;
