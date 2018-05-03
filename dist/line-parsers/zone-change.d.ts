import { AbstractLineParser } from './AbstractLineParser';
import { GameState } from '../GameState';
export declare class ZoneChangeLineParser extends AbstractLineParser {
    regex: RegExp;
    eventName: string;
    lineMatched(parts: string[], gameState: GameState): void;
    formatLogMessage(parts: string[]): string;
    shouldEmit(): boolean;
}
