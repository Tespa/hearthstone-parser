"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug = require("debug");
class AbstractLineParser {
    get logger() {
        if (!this._logger) {
            this._logger = debug(`hlp:${this.eventName}`);
        }
        return this._logger;
    }
    parseLine(line) {
        return this.regex.exec(line);
    }
}
exports.AbstractLineParser = AbstractLineParser;
//# sourceMappingURL=AbstractLineParser.js.map