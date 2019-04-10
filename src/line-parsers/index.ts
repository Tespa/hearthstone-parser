import {GameOverLineParser} from './game-over';
import {GameStartLineParser} from './game-start';
import {MulliganStartLineParser} from './mulligan-start';
import {NewPlayerLineParser} from './new-player';
import {TurnLineParser} from './turn';
import {ZoneChangeLineParser} from './zone-change';
import {TagChangeLineParser} from './tag-change';

export const lineParsers = [
	new GameOverLineParser(),
	new GameStartLineParser(),
	new MulliganStartLineParser(),
	new NewPlayerLineParser(),
	new TurnLineParser(),
	new ZoneChangeLineParser(),
	new TagChangeLineParser()
];

export interface Events {
	'game-over': void;
	'game-start': void;
	'mulligan-start': void;
	'player-joined': void;
	'turn-change': void;
	'tag-change': void;
	'zone-change': void;
}
