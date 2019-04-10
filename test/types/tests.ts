import {LogWatcher} from 'hearthstone-parser';

const logWatcher = new LogWatcher();
logWatcher.start();

// Valid event name.
logWatcher.on('game-over', () => {});

// Invalid event name.
// $ExpectError
logWatcher.on('fakeEvent', () => {});
