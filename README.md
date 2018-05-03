# Hearthstone Log Watcher [![CircleCI](https://circleci.com/bb/tespa/hearthstone-parser/tree/master.svg?style=svg&circle-token=40d258248800226671fc3ad40665d70bce221485)](https://circleci.com/bb/tespa/hearthstone-parser/tree/master)

This module is simple. It takes care of the low-level monitoring of the Hearthstone log file and emits events based on what happens in the log file. Use this module if you want to build your own Hearthstone deck tracker and don't want to do the work of parsing through the nasty log file yourself.

## Adding functionality

To add new functionality:

First you must parse through output_log.txt (which can be found in C:\Program Files (x86)\Hearthstone\Hearthstone_Data\ if Hearthstone is installed in the default location) and find the line pertaining to the desired functionality.

Example:

```
[Power] GameState.DebugPrintPower() - CREATE_GAME
```
Which in regex is:

```
/\[Power\] GameState\.DebugPrintPower\(\) -\s*CREATE_GAME/
```

When you're parsing through the Power logs, you might find that it contains two logs: GameState and PowerTaskList - they both essentially log the same information but GameState is logged as soon as the client receives the information and PowerTaskList is logged once the client actually executes the action (which can be delayed by e.g. animations)
so you can and should ignore one of them.

Then:

- Create a new line parser file in src/line-parsers/
- Update LogWatcher.ts to include the new line parser function
- Create tests for the new function in test/index.spec.ts
- Run ``npm run build`` to build and test or ``npm run test`` to test

