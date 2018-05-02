var LogWatcher = require('./index.js');
var hlw = new LogWatcher();

hlw.start();

hlw.on('game-start', function (players) {
  console.log("GAME STARTED");
  players.forEach(function (player){
    if(player.team == 'FRIENDLY'){
      console.log('Friendly (local) player is %s', player.name);
    }
  });
});

hlw.on('zone-change', function (data){
  console.log('%s has moved to %s %s.', data.cardName, data.toTeam, data.toZone);
});

hlw.on('game-over', function (players){
  console.log('GAME OVER');
  players.forEach(function (player){
    if(player.status == 'WON'){
      console.log('The winner is %s!', player.name);
    }
  });
});

// var http = require('http');
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
