var EventEmitter = require('events').EventEmitter;
var util = require('util');
var fs = require('fs');
var path = require('path');
var os = require('os');
var extend = require('extend');

var defaultOptions = {
  endOfLineChar: os.EOL
};

var debug = require('debug');
// Define some debug logging functions for easy and readable debug messages.
var log = {
  main: debug('hlw'),
  gameStart: debug('hlw:game-start'),
  zoneChange: debug('hlw:zone-change'),
  gameOver: debug('hlw:game-over')
};

var friendlyCount = 0;
var opposingCount = 0;

// Determine the default location of the config and log files.
if (/^win/.test(os.platform())) {
  log.main('Windows platform detected.');
  var programFiles = 'Program Files';
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
function LogWatcher(options) {
    this.options = extend({}, defaultOptions, options);

    log.main('config file path: %s', this.options.configFile);
    log.main('log file path: %s', this.options.logFile);

    // Copy local config file to the correct location.
    // We're just gonna do this every time.
    var localConfigFile = path.join(__dirname, 'log.config');
    fs.createReadStream(localConfigFile).pipe(fs.createWriteStream(this.options.configFile));
    log.main('Copied log.config file to force Hearthstone to write to its log file.');
}
util.inherits(LogWatcher, EventEmitter);

LogWatcher.prototype.start = function () {
  var self = this;

  var parserState = new ParserState;

  log.main('Log watcher started.');
  // Begin watching the Hearthstone log file.
  var fileSize = fs.statSync(self.options.logFile).size;
  fs.watchFile(self.options.logFile, function (current, previous) {
    if (current.mtime <= previous.mtime) { return; }

    // We're only going to read the portion of the file that we have not read so far.
    var newFileSize = fs.statSync(self.options.logFile).size;
    var sizeDiff = newFileSize - fileSize;
    if (sizeDiff < 0) {
      fileSize = 0;
      sizeDiff = newFileSize;
    }

    var buffer = new Buffer(sizeDiff);
    var fileDescriptor = fs.openSync(self.options.logFile, 'r');
    fs.readSync(fileDescriptor, buffer, 0, sizeDiff, fileSize);
    fs.closeSync(fileDescriptor);
    fileSize = newFileSize;

    self.parseBuffer(buffer, parserState);
  });

  self.stop = function () {
    fs.unwatchFile(self.options.logFile);
    delete self.stop;
  };
};

LogWatcher.prototype.stop = function () {};

LogWatcher.prototype.parseBuffer = function (buffer, parserState) {
  var self = this;

  if (!parserState) {
    parserState = new ParserState;
  }

  // Iterate over each line in the buffer.
  buffer.toString().split(this.options.endOfLineChar).forEach(function (line) {

    // Check when the Mulligan begins
    var beginMulliganRegex = /\[Power\] GameState\.DebugPrintPower\(\) - TAG_CHANGE Entity=GameEntity tag=STEP value=BEGIN_MULLIGAN$/;
    if(beginMulliganRegex.test(line)){
      friendlyCount = 30;
      opposingCount = 30;
    }

    // Check for players entering play and track their team IDs.
    var newPlayerRegex = /\[Power\] GameState\.DebugPrintGame\(\) - PlayerID=(.*) PlayerName=(.*)$/;
    if (newPlayerRegex.test(line)) {
      var parts = newPlayerRegex.exec(line);
      parserState.players.push({
        id: parseInt(parts[1]),
        name: parts[2]
      });
      log.gameStart('A game has started.');
      self.emit('game-start', parserState.players);
    }

    // Check if a card is changing zones.
    var zoneChangeRegex = /^\[Zone\] ZoneChangeList.ProcessChanges\(\) - id=\d* local=.* \[entityName=(.*) id=(\d*) zone=.* zonePos=\d* cardId=(.*) player=(\d)\] zone from ?(FRIENDLY|OPPOSING)? ?(.*)? -> ?(FRIENDLY|OPPOSING)? ?(.*)?$/
    if (zoneChangeRegex.test(line)) {
      var parts = zoneChangeRegex.exec(line);
      //console.log(parts);
      var data = {
        cardName: parts[1],
        entityId: parseInt(parts[2]),
        cardId: parts[3],
        playerId: parseInt(parts[4]),
        fromTeam: parts[5],
        fromZone: parts[6],
        toTeam: parts[7],
        toZone: parts[8],
        fCount: friendlyCount,
        oCount: opposingCount
      };
      log.zoneChange('%s moved from %s %s to %s %s.', data.cardName, data.fromTeam, data.fromZone, data.toTeam, data.toZone);
      self.emit('zone-change', data);

      // If entering the deck, increment deck count
      if(data.toTeam == 'FRIENDLY' && data.toZone == 'DECK'){
        friendlyCount++;
      }

      // If drawn from deck, decrement deck count
      if(data.fromTeam == 'FRIENDLY' && data.fromZone == 'DECK'){
        friendlyCount--;
      }

      // If entering the deck, increment deck count
      if(data.toTeam == 'OPPOSING' && data.toZone == 'DECK'){
        opposingCount++;
      }

      if(data.fromTeam == 'OPPOSING' && data.fromZone == 'DECK'){
        friendlyCount--;
      }

      //console.log('Friendly deck: %d', friendlyCount);
      //console.log('Opposing deck: %d', opposingCount);

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
      //         self.emit('game-start', parserState.players);
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
    var gameOverRegex = /\[Power\] GameState\.DebugPrintPower\(\) - TAG_CHANGE Entity=(.*) tag=PLAYSTATE value=(LOST|WON|TIED)$/;
    if (gameOverRegex.test(line)) {
      var parts = gameOverRegex.exec(line);
      // Set the status for the appropriate player.
      parserState.players.forEach(function (player) {
        if (player.name == parts[1]) {
          player.status = parts[2];
        }
      });
      parserState.gameOverCount++;
      // When both players have lost, emit a game-over event.
      if (parserState.gameOverCount == 2) {
        log.gameOver('The current game has ended.');
        self.emit('game-over', parserState.players);
        parserState.reset();
      }
    }

  });
};

function ParserState() {
  this.reset();
}

ParserState.prototype.reset = function () {
  this.players = [];
  this.playerCount = 0;
  this.gameOverCount = 0;
};


// Set the entire module to our emitter.
module.exports = LogWatcher;
