'use strict';

// Native
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

// Packages
const debug = require('debug');
const extend = require('extend');
const os = require('os');

// Ours
const ParserState = require('./ParserState');

const defaultOptions = {
	endOfLineChar: os.EOL
};

// Define some debug logging functions for easy and readable debug messages.
const log = {
	main: debug('hlw'),
	gameStart: debug('hlw:game-start'),
	zoneChange: debug('hlw:zone-change'),
	gameOver: debug('hlw:game-over')
};

let friendlyCount = 0;
let opposingCount = 0;

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
		const localConfigFile = path.join(__dirname, 'log.config');
		fs.createReadStream(localConfigFile).pipe(fs.createWriteStream(this.options.configFile));
		log.main('Copied log.config file to force Hearthstone to write to its log file.');
	}

	start() {
		const parserState = new ParserState();
		log.main('Log watcher started.');

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
		buffer.toString().split(this.options.endOfLineChar).forEach(line => {
			// Check when the Mulligan begins
			const beginMulliganRegex = /\[Power\] GameState\.DebugPrintPower\(\) - TAG_CHANGE Entity=GameEntity tag=STEP value=BEGIN_MULLIGAN$/;
			if (beginMulliganRegex.test(line)) {
				friendlyCount = 30;
				opposingCount = 30;
			}

			// Check for players entering play and track their team IDs.
			const newPlayerRegex = /\[Power\] GameState\.DebugPrintGame\(\) - PlayerID=(.*) PlayerName=(.*)$/;
			if (newPlayerRegex.test(line)) {
				const parts = newPlayerRegex.exec(line);
				parserState.players.push({
					id: parseInt(parts[1], 10),
					name: parts[2]
				});
				log.gameStart('A game has started.');
				this.emit('game-start', parserState.players);
			}

			// Check if a card is changing zones.
			const zoneChangeRegex = /^\[Zone\] ZoneChangeList.ProcessChanges\(\) - id=\d* local=.* \[entityName=(.*) id=(\d*) zone=.* zonePos=\d* cardId=(.*) player=(\d)\] zone from ?(FRIENDLY|OPPOSING)? ?(.*)? -> ?(FRIENDLY|OPPOSING)? ?(.*)?$/;
			if (zoneChangeRegex.test(line)) {
				const parts = zoneChangeRegex.exec(line);
				const data = {
					cardName: parts[1],
					entityId: parseInt(parts[2], 10),
					cardId: parts[3],
					playerId: parseInt(parts[4], 10),
					fromTeam: parts[5],
					fromZone: parts[6],
					toTeam: parts[7],
					toZone: parts[8],
					fCount: friendlyCount,
					oCount: opposingCount
				};
				log.zoneChange('%s moved from %s %s to %s %s.', data.cardName, data.fromTeam, data.fromZone, data.toTeam, data.toZone);
				this.emit('zone-change', data);

				// If entering the deck, increment deck count
				if (data.toTeam === 'FRIENDLY' && data.toZone === 'DECK') {
					friendlyCount++;
				}

				// If drawn from deck, decrement deck count
				if (data.fromTeam === 'FRIENDLY' && data.fromZone === 'DECK') {
					friendlyCount--;
				}

				// If entering the deck, increment deck count
				if (data.toTeam === 'OPPOSING' && data.toZone === 'DECK') {
					opposingCount++;
				}

				if (data.fromTeam === 'OPPOSING' && data.fromZone === 'DECK') {
					friendlyCount--;
				}

				// Console.log('Friendly deck: %d', friendlyCount);
				// console.log('Opposing deck: %d', opposingCount);

				// Only zone transitions show both the player ID and the friendly or opposing zone type. By tracking entities going into
				// the "PLAY (Hero)" zone we can then set the player's team to FRIENDLY or OPPOSING. Once both players are associated with
				// a team we can emite the game-start event.
				// if (data.toZone == 'PLAY (Hero)') {
				//   console.log("Players: ", parserState.players);
				//   parserState.players.forEach(function (player) {
				//     if (player.id == data.playerId) {
				//       player.team = data.toTeam;
				//       parserState.playerCount++;
				//       if (parserState.playerCount == 2) {
				//         console.log('A game has started.');
				//         log.gameStart('A game has started.');
				//         this.emit('game-start', parserState.players);
				//       }
				//     }
				//   });
				// }
			}

			// // Check when both mulligans are complete
			// var gameReadyRegex = /\[Power\] GameState\.DebugPrintPower\(\) - TAG_CHANGE Entity=GameEntity tag=STEP value=MAIN_READY$/;
			// if(gameReadyRegex.test(line)) {
			//   friendlyCount = 30;
			//   opposingCount = 30;
			// }

			// Check if the game is over.
			const gameOverRegex = /\[Power\] GameState\.DebugPrintPower\(\) - TAG_CHANGE Entity=(.*) tag=PLAYSTATE value=(LOST|WON|TIED)$/;
			if (gameOverRegex.test(line)) {
				const [parsedName, parsedStatus] = gameOverRegex.exec(line);
				// Set the status for the appropriate player.
				parserState.players.forEach(player => {
					if (player.name === parsedName) {
						player.status = parsedStatus;
					}
				});
				parserState.gameOverCount++;
				// When both players have lost, emit a game-over event.
				if (parserState.gameOverCount === 2) {
					log.gameOver('The current game has ended.');
					this.emit('game-over', parserState.players);
					parserState.reset();
				}
			}
		});
	}
}

// Set the entire module to our emitter.
module.exports = LogWatcher;
