import StrictEventEmitter from 'strict-event-emitter-types/types/src';
import {EventEmitter2} from 'eventemitter2';

import {GameOverLineParser} from './game-over';
import {GameStartLineParser} from './game-start';
import {GameTagChangeLineParser} from './game-tag-change';
import {NewPlayerLineParser} from './new-player';
import {TurnLineParser} from './turn';
import {ZoneChangeLineParser} from './zone-change';
import {TagChangeLineParser} from './tag-change';
import {GameState, MatchLogEntry} from '../GameState';
import {MulliganStartParser} from './mulligan-start';
import {DiscoveryParser} from './discovery';
import {MullinganResultParser} from './mulligan-result';
import {MatchLogParser} from './match-log';
import {CardInitParser} from './card-init';

export const lineParsers = [
	new MatchLogParser(),
	new GameOverLineParser(),
	new GameStartLineParser(),
	new NewPlayerLineParser(),
	new TurnLineParser(),
	new ZoneChangeLineParser(),
	new TagChangeLineParser(),
	new GameTagChangeLineParser(),
	new MulliganStartParser(),
	new DiscoveryParser(),
	new MullinganResultParser(),
	new CardInitParser()
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
	'discovery-start': void;
	'discovery-end': void;
	'mulligan-result': void;
	'card-played': MatchLogEntry;
	'attack': MatchLogEntry;
	'trigger': MatchLogEntry;
}

export type HspEventsEmitter = StrictEventEmitter<EventEmitter2, Events>;
