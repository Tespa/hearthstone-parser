"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AbstractLineParser_1 = require("./AbstractLineParser");
// Check for players entering play and track their team IDs.
class NewPlayerLineParser extends AbstractLineParser_1.AbstractLineParser {
    constructor() {
        super(...arguments);
        this.regex = /\[Power\] GameState\.DebugPrintGame\(\) - PlayerID=(.*) PlayerName=(.*)$/;
        this.eventName = 'player-joined';
    }
    lineMatched(parts, gameState) {
        gameState.addPlayer({
            id: parseInt(parts[1], 10),
            name: parts[2],
            status: '',
            turn: false
        });
    }
    formatLogMessage(parts, _gameState) {
        return `Player "${parts[2]}" has joined.`;
    }
    shouldEmit(_gameState) {
        return true;
    }
}
exports.NewPlayerLineParser = NewPlayerLineParser;
//# sourceMappingURL=new-player.js.map