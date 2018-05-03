import { AbstractLineParser } from './AbstractLineParser';
import { GameState } from '../GameState';
export declare class NewPlayerLineParser extends AbstractLineParser {
    regex: RegExp;
    eventName: string;
    lineMatched(parts: string[], gameState: GameState): void;
    formatLogMessage(parts: string[]): string;
    shouldEmit(): boolean;
}
