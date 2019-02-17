"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const game_over_1 = require("./game-over");
const game_start_1 = require("./game-start");
const mulligan_start_1 = require("./mulligan-start");
const new_player_1 = require("./new-player");
const turn_1 = require("./turn");
const zone_change_1 = require("./zone-change");
const tag_change_1 = require("./tag-change");
exports.lineParsers = [
    new game_over_1.GameOverLineParser(),
    new game_start_1.GameStartLineParser(),
    new mulligan_start_1.MulliganStartLineParser(),
    new new_player_1.NewPlayerLineParser(),
    new turn_1.TurnLineParser(),
    new zone_change_1.ZoneChangeLineParser(),
    new tag_change_1.TagChangeLineParser()
];
//# sourceMappingURL=index.js.map