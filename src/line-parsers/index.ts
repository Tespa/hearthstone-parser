import {GameOverLineParser} from './game-over';
import {GameStartLineParser} from './game-start';
import {MulliganStartLineParser} from './mulligan-start';
import {NewPlayerLineParser} from './new-player';
import {ZoneChangeLineParser} from './zone-change';

export const lineParsers = [
	new GameOverLineParser(),
	new GameStartLineParser(),
	new MulliganStartLineParser(),
	new NewPlayerLineParser(),
	new ZoneChangeLineParser()
];
