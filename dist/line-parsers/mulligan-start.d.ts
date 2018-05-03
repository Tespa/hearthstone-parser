import { AbstractLineParser } from './AbstractLineParser';
import { GameState } from '../GameState';
export declare class MulliganStartLineParser extends AbstractLineParser {
    regex: RegExp;
    eventName: string;
    lineMatched(_parts: string[], gameState: GameState): void;
    formatLogMessage(): string;
    shouldEmit(): boolean;
}
