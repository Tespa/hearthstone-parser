"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AbstractLineParser_1 = require("./AbstractLineParser");
function formatParts(parts) {
    return {
        playerName: parts[1],
        turn: Boolean(parseInt(parts[2], 10))
    };
}
// Check if the current turn has changed.
class TurnLineParser extends AbstractLineParser_1.AbstractLineParser {
    constructor() {
        super(...arguments);
        this.regex = /^\[Power\] PowerTaskList\.DebugPrintPower\(\) -\s*TAG_CHANGE Entity=(.*) tag=CURRENT_PLAYER value=(\d)/;
        this.eventName = 'turn-change';
    }
    lineMatched(parts, gameState) {
        const data = formatParts(parts);
        const player = gameState.getPlayerByName(data.playerName);
        if (!player) {
            return;
        }
        player.turn = data.turn;
    }
    formatLogMessage(parts, _gameState) {
        const data = formatParts(parts);
        const turnState = data.turn ? 'begun' : 'ended';
        return `${data.playerName}'s turn has ${turnState}`;
    }
    shouldEmit(_gameState) {
        return true;
    }
}
exports.TurnLineParser = TurnLineParser;
//# sourceMappingURL=turn.js.map