/**
 * GameService.js
 * Manages game state and operations for Ludo-like board game
 * Handles game creation, player management, and game state transitions
 */

const { v4: uuidv4 } = require("uuid");
const Logic = require('../gameLogic.js');
const path = require('path')
const fs = require("fs");

/**
 * GameService class provides game management functionality
 * Implemented as a singleton to ensure consistent game state across the application
 */
class GameService {
    /**
     * Initialize the game service with empty collections
     */
    constructor() {
        // Store active games indexed by game ID
        this.games = {};
        // Map socket IDs to game IDs for quick lookup
        this.playerSockets = {};
    }

    /**
     * Singleton pattern implementation to ensure only one instance exists
     * @returns {GameService} The singleton instance of GameService
     */
    static getInstance() {
        return this.instance || (this.instance = new GameService());
        
    }




    /**
     * Create a new game instance
     * @param {string} socketId - The socket ID of the player creating the game
     * @param {boolean} vsComputer - Whether this is a single-player game against AI
     * @returns {Object} The newly created game object
     */
    createGame(socketId, vsComputer) {
        // Generate a short, unique game ID
        const id = uuidv4().slice(0, 6);

        // Initialize players array with the creator
        const players = [{ id: socketId, playerIndex: 0, colors: ['red', 'yellow'] }];

        // Add AI player if single-player mode
        if (vsComputer) players.push({ id: 'AI', playerIndex: 1, colors: ['green', 'blue'] });

        // Create game state object
        const game = {
            id,
            players,
            currentPlayer: 0,
            originalRolls: [],        // Store original dice rolls
            currentRolls: [],         // Remaining dice rolls to be used
            rolledValue: [],          // Store the rolled value for the current turn
            gameStarted: !!vsComputer,// Game starts immediately in single-player mode
            tokens: Logic.initializeTokens(),
            winners: [],              // Store winning players in order
            gameOver: false,
            vsComputer: !!vsComputer,
            createdAt: Date.now(),
            lastActivity: Date.now()
        };

        // Store game in collection
        this.games[id] = game;

        // Associate socket with game
        this.playerSockets[socketId] = id;

        return game;
    }

    /**
     * Handle a player joining an existing game
     * @param {string} socketId - The socket ID of the joining player
     * @param {string} gameId - The ID of the game to join
     * @returns {Object} The updated game object
     * @throws {Error} If the game doesn't exist or is full
     */
    joinGame(socketId, gameId) {
        const game = this.games[gameId];

        // Validate game exists and has room
        if (!game) throw new Error('Game does not exist');
        if (game.players.length >= 2) throw new Error('Game is already full');

        // Add player to the game
        game.players.push({ id: socketId, playerIndex: 1, colors: ['green', 'blue'] });

        // Associate socket with game
        this.playerSockets[socketId] = gameId;

        // Mark game as started
        game.gameStarted = true;
        game.lastActivity = Date.now(); // Update activity timestamp

        return game;
    }


/**
 * Roll the dice for a player's turn
 * @param {string} socketId - The socket ID of the player rolling
 * @returns {Object} The updated game object
 * @throws {Error} If it's not the player's turn
 */
rollDice(socketId) {
    const game = this._getGameBySocket(socketId);
    const pIdx = game.players.findIndex(p => p.id === socketId);

    // Validate it's the player's turn
    if (pIdx !== game.currentPlayer) {
        // If it's not their turn, ensure their dice display is empty as they can't roll.
        // This handles cases where a player might try to roll out of turn.
        game.rolledValue = [];
        throw new Error('Not your turn');
    }

    // Generate two random dice rolls (1-6)
    const rolls = [1, 2].map(() => Math.floor(Math.random() * 6) + 1);

    game.originalRolls = [...rolls];
    game.currentRolls = [...rolls]; // These are the rolls currently available for token movement
    game.rolledValue = [...rolls];  // This specifically holds the values to be displayed

    // Temporarily set game.diceValue for internal validation checks, then reset it.
    let hasValidMove = false;
    // Loop through the rolled dice to check if any move is valid
    for (const val of game.currentRolls) {
        game.diceValue = val; // Set the current dice value for the isValidMove check
        if (Logic.checkForValidMoves(game, pIdx)) {
            hasValidMove = true;
            break; // Found at least one valid move, no need to check further
        }
    }

    // Reset the dice value after checking
    game.diceValue = 0;

    // If no valid moves are possible with the rolled dice, end the turn immediately.
    if (!hasValidMove) {
        Logic.nextTurn(game); 

        // If it's an AI game and it's now the AI's turn, trigger the AI move after a delay.
        if (game.vsComputer && game.players[game.currentPlayer].id === 'AI') {
            setTimeout(() => {
                Logic.makeComputerMove(game);
            }, 1500); // Small delay for better user experience
        }
    }
    return game;
}

    /**
     * Play a token move using a specific dice roll
     * @param {string} socketId - The socket ID of the player making the move
     * @param {string} tokenId - The ID of the token to move
     * @param {number} rollIdx - The index of the roll to use
     * @returns {Object} The updated game object
     * @throws {Error} If the move is invalid
     */
    playRoll(socketId, tokenId, rolledValue) {
        const game = this._getGameBySocket(socketId);

  // Find the token
  const token = game.tokens.find(t => t.id === tokenId);
  if (!token) throw new Error('Token not found');

  // Find a matching die face in currentRolls
  const idx = game.currentRolls.findIndex(v => v === rolledValue);
  if (idx < 0) throw new Error('Invalid roll value');

  // Use that face to move
  game.diceValue = rolledValue;

  // Validate the move
  if (!Logic.isValidMove(game, token)) throw new Error('Invalid move');

  // Execute the move
  Logic.moveToken(game, token);

  // Remove exactly that one die from currentRolls
  game.currentRolls.splice(idx, 1);

  // If no more rolls or no valid moves remain, advance turn
  if (
    game.currentRolls.length === 0 ||
    !Logic.checkForValidMoves(game, game.currentPlayer)
  ) {
    Logic.nextTurn(game);
  }

  // If it’s AI’s turn, schedule the AI move
  if (game.vsComputer && game.currentPlayer === 1) {
    setTimeout(() => {
      Logic.makeComputerMove(game);
    }, 1000);
  }

  return game;
    }

    /**
     * Skip the current player's turn
     * @param {string} socketId - The socket ID of the player skipping
     * @returns {Object} The updated game object
     */
    skipTurn(socketId) {
        const game = this._getGameBySocket(socketId);
        const pIdx = game.players.findIndex(p => p.id === socketId);

        // Validate it's the player's turn
        if (pIdx !== game.currentPlayer) throw new Error('Not your turn');

        // End the current turn
        Logic.nextTurn(game);

        // If AI's turn, trigger AI move
        if (game.vsComputer && game.currentPlayer === 1) {
            setTimeout(() => {
                Logic.makeComputerMove(game);
            }, 1000);
        }

        return game;
    }

    
    /**
     * Handle a player disconnecting
     * @param {string} socketId - The socket ID of the disconnected player
     * @returns {string|undefined} The game ID the player was in, if any
     */
    handleDisconnect(socketId) {
        const gameId = this.playerSockets[socketId];
        const game = this.games[gameId];

        // Remove socket association
        delete this.playerSockets[socketId];

        if (game) {
            // Don't immediately remove the player to allow for reconnection
            // Just mark them as disconnected by setting a disconnected flag
            const player = game.players.find(p => p.id === socketId);
            if (player) {
                player.disconnected = true;
                
                // Keep the game alive for a reconnect window (e.g., 10 minutes)
                player.disconnectTimer = setTimeout(() => {
                    // After timeout, remove the player
                    game.players = game.players.filter(p => p.id !== socketId);
                    
                    // Clean up empty games
                    if (game.players.length === 0 || 
                        (game.players.length === 1 && game.players[0].id === 'AI')) {
                        delete this.games[gameId];
                    }
                }, 10 * 60 * 1000); // 10 minutes
            }
        }

        return gameId;
    }

    /**
     * Builds the game state for client consumption
     * @param {string} gameId - The ID of the game to build state for
     * @returns {Object} Simplified game state for the client
     */
    buildGameState(gameId) {
        const g = this.games[gameId];
        if (!g) throw new Error('Game not found');

        const currentPlayer = g.players[g.currentPlayer]; // current player object
        const allowedColors = currentPlayer.colors; // e.g. ['red', 'yellow']

        // Map tokens to client-friendly format with coordinates
        const tokens = g.tokens.map(t => {
            const coord = this._getCoords(t);
            return {
                id: t.id,
                color: t.color,
                x: coord[0],
                y: coord[1],
                position: t.position,
                index: t.index,
                isClickable: !g.gameOver &&
                    allowedColors.includes(t.color.toLowerCase()) &&
                    g.currentRolls.some(val => {
                        g.diceValue = val;
                        return Logic.isValidMove(g, t);
                    })
            };
        });

        return {
            id: g.id,
            tokens,
            dice: g.rolledValue || []
        };
    }

    /**
     * Get a game by socket ID
     * @param {string} socketId - The socket ID to look up
     * @returns {Object} The game object
     * @throws {Error} If no game is found for the socket
     * @private
     */
    _getGameBySocket(socketId) {
        const gameId = this.playerSockets[socketId];
        const game = this.games[gameId];

        if (!game) throw new Error('Game not found');

        return game;
    }

    /**
     * Get the board coordinates for a token
     * @param {Object} token - The token to get coordinates for
     * @returns {Array} [x, y] coordinates
     * @private
     */
    _getCoords(token) {
        const coords = Logic.getCoords(token)
        return coords
    }

    generateBoardPaths() {
        const paths = Logic.generateBoardPaths()
        return paths
    }

    
}

module.exports = GameService;
