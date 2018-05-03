"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AbstractLineParser_1 = require("./AbstractLineParser");
// Check when the Mulligan begins.
class MulliganStartLineParser extends AbstractLineParser_1.AbstractLineParser {
    constructor() {
        super(...arguments);
        this.regex = /\[Power\] GameState\.DebugPrintPower\(\) - TAG_CHANGE Entity=GameEntity tag=STEP value=BEGIN_MULLIGAN$/;
        this.eventName = 'mulligan-start';
    }
    lineMatched(_parts, gameState) {
        gameState.friendlyCount = 30;
        gameState.opposingCount = 30;
    }
    formatLogMessage(_parts, _gameState) {
        return 'A mulligan has begun.';
    }
    shouldEmit(_gameState) {
        return true;
    }
}
exports.MulliganStartLineParser = MulliganStartLineParser;
//# sourceMappingURL=mulligan-start.js.map