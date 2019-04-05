# Hearthstone Parser [![CircleCI](https://circleci.com/gh/Tespa/hearthstone-parser.svg?style=svg&circle-token=05f88c42a2f9db1a70dbcd5df487818bcc6e9887)](https://circleci.com/gh/Tespa/hearthstone-parser) [![npm](https://img.shields.io/npm/v/hearthstone-parser.svg)](https://www.npmjs.com/package/hearthstone-parser)

> A Node.js module for real-time parsing of Hearthstone game log files. 

## Why make another Hearthstone log parser/watcher?

We needed to be able to rapidly implement new functionality on an as-needed basis for various broadcasts. We also wanted to ensure that the library was sound, and could be relied upon in a broadcast context. To that end, this library has been written in TypeScript, and includes tests for most functionality.

## Install

```sh
npm i hearthstone-parser
```

## Table of Contents
- [Example](#example)
- [Features](#features)
- [Planned Features](#planned-features)
- [API](#api)
  - [`start`](#start)
  - [`stop`](#stop)
  - [`update`](#update)
  - [`parseBuffer`](#update)
- [Events](#events)
- [Adding Functionality](#adding-functionality)
- [Acknowledgements](#acknowledgements)

## Example

By default, `hearthstone-parser` will attempt to automatically discover your Hearthstone install directory:
```js
const {LogWatcher} = require('hearthstone-parser');
const logWatcher = new LogWatcher();
logWatcher.start();
```

But, you can of course pass in an explicit directory if you prefer:
```js
const {LogWatcher} = require('hearthstone-parser');
const logWatcher = new LogWatcher({
	logFile: 'C:\\Program Files (x86)\\Hearthstone\\Hearthstone_Data\\output_log.txt',
	configFile: 'C:\\Users\\YOUR_WINDOWS_USER_NAME\\AppData\\Local\\Blizzard\\Hearthstone\\log.config'
});
logWatcher.start();
```

## Features

- Automatic discovery of Hearthstone install directory.
- `gameState` object which contains a full snapshot of the parser's current tree of the game state.
- Events for changes to the game state.

## Planned Features

- Support for multi-line parsing.
	- Some log entries span more than one line, which is currently unsupported by this parser.
- Support for more events and pieces of game state.

## API

#### <a name="start"></a> `> logWatcher.start()`

Begins watching the `logFile` path provided to the constructor.

##### Example

```javascript
const logWatcher = new LogWatcher({
	logFile: 'C:\\Program Files (x86)\\Hearthstone\\Hearthstone_Data\\output_log.txt',
	configFile: 'C:\\Users\\YOUR_WINDOWS_USER_NAME\\AppData\\Local\\Blizzard\\Hearthstone\\log.config'
});
logWatcher.start();
```

#### <a name="stop"></a> `> logWatcher.stop()`

Stops watching the `logFile` path provided to the constructor.

##### Example

```javascript
logWatcher.stop();
```

#### <a name="update"></a> `> logWatcher.update(filePath: string, stats: fs.Stats)`

Checks the `logFile` for new data. If new data is found, that data will be parsed, added to the `gameState` object, and have the appropriate events emitted for any changes.

It is usually not necessary to call this method manually. The library _should_ take care of detecting changes to the log and running `update()` automatically.

##### Example

```javascript
const logFile = 'C:\\Program Files (x86)\\Hearthstone\\Hearthstone_Data\\output_log.txt';
logWatcher.update(logFile, fs.statSync(logFile));
```

#### <a name="parse-buffer"></a> `> logWatcher.parseBuffer(buffer: Buffer[, gameState: GameState]) -> GameState`

Immediately parse a buffer, adding it to the `gameState` and emitting the appropriate events for any changes.

If a `GameState` object is provided as the second argument, that object will be mutated to represent the new state after parsing the buffer. If no `GameState` object is provided, a new one will be created and returned.

It is usually not necessary to call this method manually. It is used internally to parse new chunks of the `logFile` as they are written.

##### Example

```javascript
const fileToAnalyze = 'C:\\Users\\example\\Downloads\\sample_log.txt';
const gameState = logWatcher.parseBuffer(fileToAnalyze);
console.log(gameState);
```

## Events

Currently, only a limited selection of events is available. More will be added by us as we need them for broadcasts, and we welcome pull requests to add others! See the [Adding Functionality](#adding-functionality) section for a crash course on how to implement a new event.

- `game-over`
- `game-start`
- `mulligan-start`
- `new-player`
- `turn`
- `zone-change`

At this time, the events provide no arguments to their callbacks. You can always query the `gameState` object after receiving an event to grab an up-to-date snapshot of the part of the state tree which you are interested in.

## Adding Functionality

First, parse through `output_log.txt` and find the line(s) pertaining to the desired functionality. This log can be found in `C:\Program Files (x86)\Hearthstone\Hearthstone_Data\` if on Windows and Hearthstone is installed in the default location.

For example, say you wanted to add functionality to detect when a new game began. You'd want to use the following log line as the indicator:
```
[Power] GameState.DebugPrintPower() - CREATE_GAME
```

This line can be matched by the following [regular expression](https://regex101.com/r/xUocMP/1):
```
/\[Power\] GameState\.DebugPrintPower\(\)\s*-\s*CREATE_GAME/
```

When you're parsing through the logs, you might find that it contains two sets of data: `GameState` and `PowerTaskList` - they both essentially log the same information, but GameState is logged as soon as the client receives the information and PowerTaskList is logged once the client actually executes the action (which can be delayed by things such as animations or task queues). Which one you act on will depend on what your end goals are.

Then:
- Create a new line parser file in `src/line-parsers/`
- Update `LogWatcher.ts` to include the new line parser function
- Create tests for the new function in `test/index.spec.ts`
- Run `npm run build` to test and build or `npm run test` to just test

## Acknowledgements

This library used [hearthstone-log-parser](https://www.npmjs.com/package/hearthstone-log-parser) as a starting point.


## License

`hearthstone-parser` is released under the MIT license, which is available to read [here](LICENSE).
