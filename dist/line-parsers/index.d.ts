import { GameOverLineParser } from './game-over';
import { GameStartLineParser } from './game-start';
import { MulliganStartLineParser } from './mulligan-start';
import { NewPlayerLineParser } from './new-player';
import { TurnLineParser } from './turn';
import { ZoneChangeLineParser } from './zone-change';
import { TagChangeLineParser } from './tag-change';
export declare const lineParsers: (GameOverLineParser | GameStartLineParser | MulliganStartLineParser | NewPlayerLineParser | TurnLineParser | ZoneChangeLineParser | TagChangeLineParser)[];
