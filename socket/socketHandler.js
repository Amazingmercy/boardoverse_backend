const { Server } = require('socket.io');
const GameController = require('../controllers/gameController');

exports.setupSocket = (server) => {
  const io = new Server(server, { cors: { origin: '*' } });
  io.on('connection', socket => new GameController(io, socket).registerHandlers());
}

