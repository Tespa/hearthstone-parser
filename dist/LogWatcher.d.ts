/// <reference types="node" />
import * as EventEmitter from 'events';
import * as fs from 'fs';
import { GameState } from './GameState';
export interface IOptions {
    logFile: string;
    configFile: string;
}
export default class LogWatcher extends EventEmitter {
    options: IOptions;
    gameState: GameState;
    private _lastFileSize;
    private _watcher;
    constructor(options: IOptions);
    start(): void;
    update(filePath: string, stats: fs.Stats): void;
    stop(): void;
    parseBuffer(buffer: Buffer, gameState: GameState): GameState;
}
