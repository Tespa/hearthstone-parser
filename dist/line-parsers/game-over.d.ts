import { AbstractLineParser } from './AbstractLineParser';
import { GameState } from '../GameState';
export declare class GameOverLineParser extends AbstractLineParser {
    regex: RegExp;
    eventName: string;
    lineMatched(parts: string[], gameState: GameState): void;
    formatLogMessage(_parts: string[], gameState: GameState): false | "The current game has ended.";
    shouldEmit(gameState: GameState): boolean;
}
