var LogWatcher = require('./index.js');
var hlw = new LogWatcher();

hlw.on('game-start', console.log.bind(console, 'game-start'));
hlw.on('game-over', console.log.bind(console, 'game-over:'));
hlw.on('zone-change', console.log.bind(console, 'zone-change:'));

hlw.start();
