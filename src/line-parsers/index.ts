import {GameOverLineParser} from './game-over';
import {GameStartLineParser} from './game-start';
import {GameTagChangeLineParser} from './game-tag-change';
import {NewPlayerLineParser} from './new-player';
import {TurnLineParser} from './turn';
import {ZoneChangeLineParser} from './zone-change';
import {TagChangeLineParser} from './tag-change';
import {GameState} from '../GameState';

export const lineParsers = [
	new GameOverLineParser(),
	new GameStartLineParser(),
	new GameTagChangeLineParser(),
	new NewPlayerLineParser(),
	new TurnLineParser(),
	new ZoneChangeLineParser(),
	new TagChangeLineParser()
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
}
