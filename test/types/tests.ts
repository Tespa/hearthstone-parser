import { LogWatcher } from 'hearthstone-parser';

const logWatcher = new LogWatcher();
logWatcher.start();

// Valid event names.
logWatcher.on('gamestate-changed', (gameState) => {
	gameState.playerCount; // $ExpectType number
	gameState.gameOverCount; // $ExpectType number
});
logWatcher.on('game-over', () => {});
logWatcher.on('game-start', () => {});
logWatcher.on('game-tag-change', () => {});
logWatcher.on('player-joined', () => {});
logWatcher.on('turn-change', () => {});
logWatcher.on('tag-change', () => {});
logWatcher.on('zone-change', () => {});

// Wildcard event -- valid because we use EventEmitter2.
logWatcher.onAny((event, value) => {
	console.log(event);
	console.log(value);
});

// Invalid event name.
// $ExpectError
logWatcher.on('fakeEvent', () => {});

// Extraneous event args.
// $ExpectError
logWatcher.on('game-over', (fakeArg) => {
	console.log(fakeArg);
});
