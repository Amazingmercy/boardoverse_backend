//gameController.js
const GameService = require('../services/gameService')
const {
    FINAL_PATHS,
    COMMON_PATH,
    HOME_PATHS,
    HOME_ENTRANCES,
    COMMON_COORDINATES,
    SAFE_POSITIONS
} = require('../gameLogic');



class GameController {
    constructor(io, socket) {
        this.io = io;
        this.socket = socket;
        this.service = GameService.getInstance();
    }

    

    registerHandlers() {
        this.socket.on("createGame", (opts, cb) => this.createGame(opts, cb));
        this.socket.on("joinGame", (id, cb) => this.joinGame(id, cb));
        this.socket.on("getBoardPaths", (cb) => this.generateBoardPaths(cb));
        this.socket.on("rollDice", () => this.rollDice());
        this.socket.on("playRoll", (data) => this.playRoll(data));
        this.socket.on("skipTurn", () => this.skipTurn());
        this.socket.on("rejoinGame", (data) => this.rejoinGame(data));
        this.socket.on("disconnect", () => this.disconnect());
    }

    createGame({ vsComputer }, cb) {
        const game = this.service.createGame(this.socket.id, vsComputer);
        this.socket.join(game.id);
        cb({ gameId: game.id, playerId: 0, colors: game.players[0].colors });
        this.broadcastState(game);
    }

    generateBoardPaths(cb) {
        const boardPaths = this.service.generateBoardPaths();
        // Send response to the requesting client
        if (cb) cb(boardPaths);
        
        // Also emit to all clients (optional)
        this.socket.emit("boardPaths", boardPaths);
      }


    joinGame(gameId, cb) {
        try {
            const game = this.service.joinGame(this.socket.id, gameId);
            this.socket.join(game.id);
            const p = game.players.find((p) => p.id === this.socket.id);
            cb({ gameId: game.id, playerId: p.playerIndex, colors: p.colors });
            this.broadcastState(game);
        } catch (e) {
            cb({ error: e.message });
        }
    }

    rollDice() {
        const game = this.service.rollDice(this.socket.id);
        this.broadcastDice(game);
    }

    playRoll({ tokenId, rollIdx }) {
        const game = this.service.playRoll(this.socket.id, tokenId, rollIdx);
        this.broadcastState(game);
    }

    skipTurn() {
        const game = this.service.skipTurn(this.socket.id);
        this.broadcastState(game);
    }

    rejoinGame({ gameId, playerIndex }) {
        const game = this.service.rejoinGame(this.socket.id, gameId, playerIndex);
        this.socket.join(game.id);
        this.socket.emit("gameStarted", this.composePayload(game, this.socket.id));
    }

    disconnect() {
        const gameId = this.service.handleDisconnect(this.socket.id);
        if (gameId) this.io.to(gameId).emit("playerDisconnected");
    }

    broadcastDice(game) {
        const payload = { dice: [...game.rolledValue] };
        game.players.forEach((p) => {
            if (p.id !== "AI") {
                this.io.to(p.id).emit("diceRolled", {
                    playerId: game.currentPlayer,
                    rolls: [...game.rolledValue],
                });
            }
        });
    }

    broadcastState(game) {
        game.players.forEach((p) => {
            if (p.id !== "AI") {
                this.io
                    .to(p.id)
                    .emit("gameStateUpdated", this.composePayload(game, p.id));
            }
        });
    }

    composePayload(game, socketId) {
        const base = this.service.buildGameState(game.id);
        const playData = {
            tokens: base.tokens,
            dice: base.dice,
            myTurn: game.players.find((p) => p.id === socketId).playerIndex === game.currentPlayer,
            gameOver: game.gameOver,
            winner: game.winners.length ? game.winners[0] : null,
        };
        return playData
    }
}

module.exports = GameController;
