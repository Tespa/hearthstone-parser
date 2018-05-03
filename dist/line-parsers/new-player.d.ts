import { AbstractLineParser } from './AbstractLineParser';
import { GameState } from '../GameState';
export declare class NewPlayerLineParser extends AbstractLineParser {
    regex: RegExp;
    eventName: string;
    lineMatched(parts: string[], gameState: GameState): void;
    formatLogMessage(parts: string[], _gameState: GameState): string;
    shouldEmit(_gameState: GameState): boolean;
}
