'use strict';

// Packages

module.exports = Object.values(require('require-all')({
	dirname: __dirname,
	filter: /^(?!index\.js).*$/
}));
