// Native
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Packages
import * as debug from 'debug';
import {EventEmitter2} from 'eventemitter2';
import * as extend from 'extend';
import * as chokidar from 'chokidar';
import {chunk, throttle} from 'lodash';
import splitLines = require('split-lines');
import {FSWatcher} from 'chokidar';

// Ours
import {GameState} from './GameState';
import {lineParsers, HspEventsEmitter} from './line-parsers';

export interface Options {
	logFile: string;
	configFile: string;

	/**
	 * Path to save any log files
	 */
	logDirectory?: string;

	/**
	 * The number of lines in each parsing group.
	 */
	linesPerUpdate?: number;

	/**
	 * Whether an update event should be sent out when the turn has changed
	 */
	updateEveryTurn?: boolean;
}

const defaultOptions: Options = {
	logFile: '',
	configFile: ''
};
const log = debug('hlp');

// Determine the default location of the config and log files.
if (/^win/.test(os.platform())) {
	log('Windows platform detected.');

	if (process.env.UserProfile) {
		defaultOptions.logFile = path.join(process.env.UserProfile, 'AppData', 'LocalLow', 'Blizzard Entertainment', 'Hearthstone', 'output_log.txt');
	}

	if (process.env.LOCALAPPDATA) {
		defaultOptions.configFile = path.join(process.env.LOCALAPPDATA, 'Blizzard', 'Hearthstone', 'log.config');
	}
} else {
	log('OS X platform detected.');
	if (process.env.HOME) {
		defaultOptions.logFile = path.join(process.env.HOME, 'Library', 'Logs', 'Unity', 'Player.log');
		defaultOptions.configFile = path.join(process.env.HOME, 'Library', 'Preferences', 'Blizzard', 'Hearthstone', 'log.config');
	}
}

// eslint-disable-next-line @typescript-eslint/prefer-function-type
export const HspEventsEmitterClass = EventEmitter2 as { new (): HspEventsEmitter };

// The watcher is an event emitter so we can emit events based on what we parse in the log.
export class LogWatcher extends HspEventsEmitterClass {
	options: Options;

	gameState: GameState;

	private _lastFileSize = 0;

	private _watcher: FSWatcher | null;

	private _updateDebouncer: (filePath: string, stats: fs.Stats) => void;

	private _logStream: fs.WriteStream | null = null;
	private _linesQueued = new Array<string>();

	constructor(options?: Partial<Options>) {
		super();

		this.options = extend({}, defaultOptions, options);
		this.gameState = new GameState();
		this._lastFileSize = 0;

		log('config file path: %s', this.options.configFile);
		log('log file path: %s', this.options.logFile);

		if (!fs.existsSync(path.parse(this.options.configFile).dir)) {
			throw new Error('Config file path does not exist.');
		}

		if (!fs.existsSync(path.parse(this.options.logFile).dir)) {
			throw new Error('Log file path does not exist.');
		}

		if (this.options.logDirectory) {
			log('output log directory: %s', this.options.logDirectory);
			fs.mkdirSync(this.options.logDirectory, {recursive: true});
		}

		// Copy local config file to the correct location.
		// We're just gonna do this every time.
		const localConfigFile = path.join(__dirname, '../log.config');
		fs.createReadStream(localConfigFile).pipe(fs.createWriteStream(this.options.configFile));
		log('Copied log.config file to force Hearthstone to write to its log file.');
	}

	// This is a throttled version of our private _update method.
	// It is on a throttle to avoid thrashing, as we might sometimes have hundreds of updates in a single tick.
	update(filePath: string, stats: fs.Stats): void {
		if (!this._updateDebouncer) {
			this._updateDebouncer = throttle((filePath: string, stats: fs.Stats) => {
				this._update(filePath, stats);
			}, 100);
		}

		return this._updateDebouncer(filePath, stats);
	}

	start(): void {
		this.gameState.reset();
		log('Log watcher started.');

		// Begin watching the Hearthstone log file.
		const watcher = chokidar.watch(this.options.logFile, {
			persistent: true,
			disableGlobbing: true,
			usePolling: true
		});

		watcher.on('add', (filePath, stats) => {
			if (stats) {
				this.update(filePath, stats);
			}
		});

		watcher.on('change', (filePath, stats) => {
			if (stats) {
				this.update(filePath, stats);
			}
		});

		this._watcher = watcher;
	}

	stop(): void {
		if (!this._watcher) {
			return;
		}

		this._watcher.close();
		this._watcher = null;
		this._lastFileSize = 0;
	}

	parseBuffer(buffer: Buffer, gameState: GameState = new GameState()): GameState {
		const lines = splitLines(buffer.toString());
		return this.parseLines(lines, gameState);
	}

	private parseLines(lines: string[], gameState: GameState): GameState {
		let updated = false;

		let lastTurnTime = gameState.turnStartTime;

		lines.forEach(line => {
			// Run each line through our entire array of line parsers.
			for (const lineParser of lineParsers) {
				const handled = lineParser.handleLine(this, gameState, line);
				if (!handled) {
					continue;
				}

				// Stop after the first match we get.
				updated = true;
				break;
			}

			// If an update is sent when the turn changes, check so here
			if (updated && this.options.updateEveryTurn && gameState.turnStartTime !== lastTurnTime) {
				lastTurnTime = gameState.turnStartTime;
				this.emit('gamestate-changed', gameState);
				updated = false;
			}

			this._handleLogging(line, gameState);
		});

		if (updated) {
			this.emit('gamestate-changed', gameState);
		}

		return gameState;
	}

	/**
	 * Internal method to potentially write a line to the output log (if enabled).
	 * @param line
	 * @param gameState
	 */
	private _handleLogging(line: string, gameState: GameState) {
		const activeOrComplete = gameState.active || gameState.complete;
		if (!this.options.logDirectory || !activeOrComplete) {
			return;
		}

		// If there's no file stream and we have enough info to create one, then create one.
		if (!this._logStream && gameState.active && gameState.numPlayers === 2) {
			const [player1, player2] = gameState.getAllPlayers();
			const ext = path.extname(this.options.logFile);
			const filename = `${gameState.startTime}_${player1?.name ?? 'unknown'}_vs_${player2?.name ?? 'unknown'}${ext}`;

			// Convert the name to something safe to save
			const specialChars = String.raw`<>:"/\|?*`.split('');
			const filenameSlugged = filename.split('').map(c => specialChars.includes(c) ? '!' : c).join('');

			// Create write stream
			const filepath = path.join(this.options.logDirectory, filenameSlugged);
			this._logStream = fs.createWriteStream(path.normalize(filepath));

			// Flush our "buffer"
			this._logStream.write(this._linesQueued.join(''));
			this._linesQueued = [];
		}

		// Write to output log.
		// If we are still waiting for players to load,write to a buffer beforehand.
		// This is because the filename is decided AFTER the file has started.
		if (gameState.active || (gameState.complete && this._logStream)) {
			if (this._logStream) {
				this._logStream.write(line + '\n');
			} else {
				// No file stream, so write to our "buffer"
				this._linesQueued.push(line + '\n');
			}
		}

		// If the game is complete, close the output stream
		if (gameState.complete) {
			this._logStream?.end();
			this._logStream = null;
		}
	}

	private _update(filePath: string, stats: fs.Stats): void {
		// We're only going to read the portion of the file that we have not read so far.
		const newFileSize = stats.size;
		let sizeDiff = newFileSize - this._lastFileSize;
		if (sizeDiff < 0) {
			sizeDiff = newFileSize;
		}

		const buffer = Buffer.alloc(sizeDiff);
		const fileDescriptor = fs.openSync(filePath, 'r');
		fs.readSync(fileDescriptor, buffer, 0, sizeDiff, this._lastFileSize);
		fs.closeSync(fileDescriptor);
		this._lastFileSize = newFileSize;

		const lines = splitLines(buffer.toString());
		if (this.options.linesPerUpdate) {
			for (const group of chunk(lines, this.options.linesPerUpdate)) {
				this.parseLines(group, this.gameState);
			}
		} else {
			this.parseLines(lines, this.gameState);
		}
	}
}
