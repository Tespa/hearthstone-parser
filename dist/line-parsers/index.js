"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const game_over_1 = require("./game-over");
const game_start_1 = require("./game-start");
const mulligan_start_1 = require("./mulligan-start");
const new_player_1 = require("./new-player");
const zone_change_1 = require("./zone-change");
exports.lineParsers = [
    new game_over_1.GameOverLineParser(),
    new game_start_1.GameStartLineParser(),
    new mulligan_start_1.MulliganStartLineParser(),
    new new_player_1.NewPlayerLineParser(),
    new zone_change_1.ZoneChangeLineParser()
];
//# sourceMappingURL=index.js.map