"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AbstractLineParser_1 = require("./AbstractLineParser");
function formatParts(parts) {
    return {
        cardName: parts[1],
        entityId: parseInt(parts[2], 10),
        cardId: parts[3],
        playerId: parseInt(parts[4], 10),
        tag: parts[5],
        value: parseInt(parts[6], 10)
    };
}
// Check if a card is changing tags.
class TagChangeLineParser extends AbstractLineParser_1.AbstractLineParser {
    constructor() {
        super(...arguments);
        this.regex = /^\[Power\] GameState.DebugPrintPower\(\) -\s+TAG_CHANGE Entity=\[entityName=(.*) id=(\d*) zone=.* zonePos=\d* cardId=(.*) player=(\d)\] tag=(.*) value=(\d*)/;
        this.eventName = 'tag-change';
    }
    lineMatched(parts, gameState) {
        const data = formatParts(parts);
        if (data.tag !== 'QUEST_PROGRESS') {
            return;
        }
        const player = gameState.getPlayerById(data.playerId);
        if (player) {
            player.questCounter = data.value;
        }
    }
    formatLogMessage(parts, _gameState) {
        const data = formatParts(parts);
        return `Tag ${data.tag} of player ${data.playerId}'s ${data.cardName} set to ${data.value}`;
    }
    shouldEmit(_gameState) {
        return true;
    }
}
exports.TagChangeLineParser = TagChangeLineParser;
//# sourceMappingURL=tag-change.js.map