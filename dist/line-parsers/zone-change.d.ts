import { AbstractLineParser } from './AbstractLineParser';
import { GameState } from '../GameState';
export declare class ZoneChangeLineParser extends AbstractLineParser {
    regex: RegExp;
    eventName: string;
    lineMatched(parts: string[], gameState: GameState): void;
    formatLogMessage(parts: string[], _gameState: GameState): string;
    shouldEmit(_gameState: GameState): boolean;
}
