'use strict';

// Native
const EventEmitter = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Packages
const debug = require('debug');
const extend = require('extend');
const splitLines = require('split-lines');

// Ours
const ParserState = require('./ParserState');
const lineParsers = require('./line-parsers');

const defaultOptions = {};

// Define some debug logging functions for easy and readable debug messages.
const log = {
	main: debug('hlw'),
	gameStart: debug('hlw:game-start'),
	zoneChange: debug('hlw:zone-change'),
	gameOver: debug('hlw:game-over')
};

// Determine the default location of the config and log files.
if (/^win/.test(os.platform())) {
	log.main('Windows platform detected.');
	let programFiles = 'Program Files';
	if (/64/.test(os.arch())) {
		programFiles += ' (x86)';
	}
	defaultOptions.logFile = path.join('C:', programFiles, 'Hearthstone', 'Hearthstone_Data', 'output_log.txt');
	defaultOptions.configFile = path.join(process.env.LOCALAPPDATA, 'Blizzard', 'Hearthstone', 'log.config');
} else {
	log.main('OS X platform detected.');
	defaultOptions.logFile = path.join(process.env.HOME, 'Library', 'Logs', 'Unity', 'Player.log');
	defaultOptions.configFile = path.join(process.env.HOME, 'Library', 'Preferences', 'Blizzard', 'Hearthstone', 'log.config');
}

// The watcher is an event emitter so we can emit events based on what we parse in the log.
class LogWatcher extends EventEmitter {
	constructor(options) {
		super();

		this.options = extend({}, defaultOptions, options);

		log.main('config file path: %s', this.options.configFile);
		log.main('log file path: %s', this.options.logFile);

		// Copy local config file to the correct location.
		// We're just gonna do this every time.
		const localConfigFile = path.join(__dirname, '../log.config');
		fs.createReadStream(localConfigFile).pipe(fs.createWriteStream(this.options.configFile));
		log.main('Copied log.config file to force Hearthstone to write to its log file.');
	}

	start() {
		const parserState = new ParserState();
		this.parserState = parserState;
		log.main('Log watcher started.', this.options.logFile);

		// Begin watching the Hearthstone log file.
		let fileSize = fs.statSync(this.options.logFile).size;
		fs.watchFile(this.options.logFile, (current, previous) => {
			if (current.mtime <= previous.mtime) {
				return;
			}

			// We're only going to read the portion of the file that we have not read so far.
			const newFileSize = fs.statSync(this.options.logFile).size;
			let sizeDiff = newFileSize - fileSize;
			if (sizeDiff < 0) {
				fileSize = 0;
				sizeDiff = newFileSize;
			}

			const buffer = Buffer.alloc(sizeDiff);
			const fileDescriptor = fs.openSync(this.options.logFile, 'r');
			fs.readSync(fileDescriptor, buffer, 0, sizeDiff, fileSize);
			fs.closeSync(fileDescriptor);
			fileSize = newFileSize;

			this.parseBuffer(buffer, parserState);
		});
	}

	stop() {
		fs.unwatchFile(this.options.logFile);
	}

	parseBuffer(buffer, parserState) {
		if (!parserState) {
			parserState = new ParserState();
		}

		// Iterate over each line in the buffer.
		splitLines(buffer.toString()).forEach(line => {
			// Run each line through our entire array of line parsers.
			lineParsers.forEach(lineParser => {
				lineParser(line, parserState, this, log);
			});

			// // Check when both mulligans are complete
			// var gameReadyRegex = /\[Power\] GameState\.DebugPrintPower\(\) - TAG_CHANGE Entity=GameEntity tag=STEP value=MAIN_READY$/;
			// if(gameReadyRegex.test(line)) {
			//   friendlyCount = 30;
			//   opposingCount = 30;
			// }
		});

		return parserState;
	}
}

// Set the entire module to our emitter.
module.exports = LogWatcher;
