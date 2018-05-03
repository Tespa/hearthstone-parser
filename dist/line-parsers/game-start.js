"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AbstractLineParser_1 = require("./AbstractLineParser");
// Check if a new game has started.
class GameStartLineParser extends AbstractLineParser_1.AbstractLineParser {
    constructor() {
        super(...arguments);
        this.regex = /\[Power\] GameState\.DebugPrintPower\(\) -\s*CREATE_GAME/;
        this.eventName = 'game-start';
    }
    lineMatched(_parts, gameState) {
        gameState.reset();
    }
    formatLogMessage(_parts, _gameState) {
        return 'A new game has started.';
    }
    shouldEmit(_gameState) {
        return true;
    }
}
exports.GameStartLineParser = GameStartLineParser;
//# sourceMappingURL=game-start.js.map