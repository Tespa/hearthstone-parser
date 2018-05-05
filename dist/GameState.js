"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class GameState {
    constructor() {
        this.reset();
    }
    get numPlayers() {
        return this.players.length;
    }
    reset() {
        this.players = [];
        this.gameOverCount = 0;
        this.friendlyCount = 0;
        this.opposingCount = 0;
    }
    addPlayer(player) {
        this.players.push(player);
        return player;
    }
    getPlayerById(index) {
        return this.players.find(player => player.id === index);
    }
    getPlayerByPosition(position) {
        return this.getPlayerById(position === 'top' ? 2 : 1);
    }
    getPlayerByName(name) {
        return this.players.find(player => player.name === name);
    }
    getAllPlayers() {
        return this.players.slice(0);
    }
}
exports.GameState = GameState;
//# sourceMappingURL=GameState.js.map