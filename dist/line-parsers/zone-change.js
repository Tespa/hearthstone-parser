"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AbstractLineParser_1 = require("./AbstractLineParser");
function formatParts(parts) {
    return {
        cardName: parts[1],
        entityId: parseInt(parts[2], 10),
        cardId: parts[3],
        playerId: parseInt(parts[4], 10),
        fromTeam: parts[5],
        fromZone: parts[6],
        toTeam: parts[7],
        toZone: parts[8]
    };
}
// Check if a card is changing zones.
class ZoneChangeLineParser extends AbstractLineParser_1.AbstractLineParser {
    constructor() {
        super(...arguments);
        this.regex = /^\[Zone\] ZoneChangeList.ProcessChanges\(\) - id=\d* local=.* \[entityName=(.*) id=(\d*) zone=.* zonePos=\d* cardId=(.*) player=(\d)\] zone from ?(FRIENDLY|OPPOSING)? ?(.*)? -> ?(FRIENDLY|OPPOSING)? ?(.*)?$/;
        this.eventName = 'zone-change';
    }
    lineMatched(parts, gameState) {
        const data = formatParts(parts);
        if (data.toZone === data.fromZone) {
            return;
        }
        if (data.toTeam === 'FRIENDLY' && data.toZone === 'DECK') {
            // If entering the deck, increment deck count
            gameState.friendlyCount++;
        }
        else if (data.fromTeam === 'FRIENDLY' && data.fromZone === 'DECK') {
            // If drawn from deck, decrement deck count
            gameState.friendlyCount--;
        }
        else if (data.toTeam === 'OPPOSING' && data.toZone === 'DECK') {
            // If entering the deck, increment deck count
            gameState.opposingCount++;
        }
        else if (data.fromTeam === 'OPPOSING' && data.fromZone === 'DECK') {
            gameState.opposingCount--;
        }
    }
    formatLogMessage(parts, _gameState) {
        const data = formatParts(parts);
        return `${data.cardName} moved from ${data.fromTeam} ${data.fromZone} to ${data.toTeam} ${data.toZone}`;
    }
    shouldEmit(_gameState) {
        return true;
    }
}
exports.ZoneChangeLineParser = ZoneChangeLineParser;
//# sourceMappingURL=zone-change.js.map