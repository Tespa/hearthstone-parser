const LogWatcher = require('./index.js');
const hlw = new LogWatcher();

hlw.start();

hlw.on('game-start', players => {
	console.log('GAME STARTED');
	players.forEach(player => {
		if (player.team === 'FRIENDLY') {
			console.log('Friendly (local) player is %s', player.name);
		}
	});
});

hlw.on('zone-change', data => {
	console.log('%s has moved to %s %s.', data.cardName, data.toTeam, data.toZone);
	console.log('Deck 1: %d', data.fCount);
	console.log('Deck 2: %d', data.oCount);
});

hlw.on('game-over', players => {
	console.log('GAME OVER');
	players.forEach(player => {
		if (player.status === 'WON') {
			console.log('The winner is %s!', player.name);
		}
	});
});

// Var http = require('http');
// var fs = require('fs');
// http.createServer(function (req, res) {
//   fs.readFile('output.xml', function(err, data) {
//     res.writeHead(200, {'Content-Type': 'xml'});
//     res.write(data);
//     res.end();
//   });
// }).listen(8080);
//
// let output = '<deck_size>' +  30 + '</deck_size>';
//
// // write to a new file named 2pac.txt
// fs.writeFile('whateverfilename.xml', output (err) => {
//     // throws an error, you could also catch it here
//     if (err) throw err;
//
//     // success case, the file was saved
//     console.log('Output saved!');
// });
