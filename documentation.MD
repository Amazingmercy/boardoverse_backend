# Ludo Game Server API Documentation

## Overview

This documentation describes the Socket.IO API endpoints for a multiplayer Ludo-style board game. The game server enables players to create games, join existing games, roll dice, move tokens, and interact with other players in real-time.

## Connection

Connect to the Socket.IO server:

```javascript
const socket = io('http://server-url:3000');
```

## Events

### Client to Server Events

These events are emitted by the client to trigger actions on the server.

#### `createGame`

Create a new game instance.

```javascript
socket.emit('createGame', { vsComputer: Boolean }, callback);
```

**Parameters:**
- `vsComputer` (Boolean): Whether to play against AI (true) or human opponent (false)

**Callback Response:**
```javascript
{
  gameId: String,   // Unique ID for the game
  playerId: Number, // Player index (0)
  colors: Array     // Array of colors assigned to player (e.g., ['red', 'yellow'])
}
```

#### `joinGame`

Join an existing game by ID.

```javascript
socket.emit('joinGame', gameId, callback);
```

**Parameters:**
- `gameId` (String): ID of the game to join

**Callback Response:**
```javascript
// Success
{
  gameId: String,   // Joined game ID
  playerId: Number, // Player index (1)
  colors: Array     // Array of colors assigned to player (e.g., ['green', 'blue'])
}

// Error
{
  error: String // Error message if joining failed
}
```

#### `rollDice`

Roll dice for the current player's turn.

```javascript
socket.emit('rollDice');
```

**Note:** No callback, response comes via `diceRolled` event.

#### `playRoll`

Move a token using a specific dice roll.

```javascript
socket.emit('playRoll', {
  tokenId: String, // ID of the token to move
  rollIdx: Number  // Index of the dice roll to use (0 or 1)
});
```

**Note:** No callback, response comes via `gameStateUpdated` event.

#### `skipTurn`

Skip the current player's turn when no valid moves are available.

```javascript
socket.emit('skipTurn');
```

**Note:** No callback, response comes via `gameStateUpdated` event.

#### `rejoinGame`

Reconnect to a game after disconnection.

```javascript
socket.emit('rejoinGame', {
  gameId: String,       // ID of the game to rejoin
  playerIndex: Number   // Player's index in the game (0 or 1)
});
```

**Note:** No callback, response comes via `gameStarted` event.

### Server to Client Events

These events are emitted by the server to notify clients about game state changes.

#### `diceRolled`

Triggered when a player rolls the dice.

```javascript
socket.on('diceRolled', data => {
  // data format:
  {
    playerId: Number,   // Index of player who rolled
    rolls: Array        // Array of dice values (e.g., [3, 6])
  }
});
```

#### `gameStateUpdated`

Triggered when the game state changes (after moves, turns, etc.).

```javascript
socket.on('gameStateUpdated', data => {
  // data format:
  {
    tokens: Array,      // Array of all token objects with positions and state
    dice: Array,        // Current available dice values
    myTurn: Boolean,    // Whether it's this player's turn
    gameOver: Boolean,  // Whether the game has ended
    winner: Number      // Index of winning player (null if game in progress)
  }
});
```

#### `gameStarted`

Triggered when a player successfully rejoins a game.

```javascript
socket.on('gameStarted', data => {
  // Same format as gameStateUpdated
});
```

#### `playerDisconnected`

Triggered when an opponent disconnects from the game.

```javascript
socket.on('playerDisconnected', () => {
  // No data, just notification of disconnect
});
```

## Token Object Structure

Each token in the `tokens` array has this structure:

```javascript
{
  id: String,           // Token ID (e.g., "red-0")
  color: String,        // Token color (red, green, yellow, blue)
  x: Number,            // X-coordinate on board
  y: Number,            // Y-coordinate on board
  isClickable: Boolean  // Whether token can be moved with current dice rolls
}
```

## Game Rules

1. Players take turns rolling two dice
2. Tokens start in home base (position -1)
3. A token can only leave home base with a roll of 6
4. Moving a token to the same position as an opponent's token sends the opponent's token back to home base
5. Safe positions protect tokens from being sent home
6. Players must use all valid moves before ending their turn
7. The first player to get all tokens to the center wins

## Error Handling

The server provides error messages in callback responses when appropriate. Common errors include:
- "Game not available": When joining a game that doesn't exist or is full
- "Not your turn": When trying to roll or move out of turn
- "Invalid move": When attempting an illegal token move
- "Game not found": When referencing a non-existent game
- "Invalid rejoin": When attempting to rejoin with incorrect credentials

## Implementation Example

Here's a basic client implementation example:

```javascript
const socket = io('http://server-url:3000');

// Create a new game
function createGame(vsComputer) {
  socket.emit('createGame', { vsComputer }, response => {
    console.log('Game created:', response.gameId);
    // Store gameId for sharing with other players
  });
}

// Join an existing game
function joinGame(gameId) {
  socket.emit('joinGame', gameId, response => {
    if (response.error) {
      console.error('Join failed:', response.error);
    } else {
      console.log('Joined game as player', response.playerId);
    }
  });
}

// Listen for game updates
socket.on('gameStateUpdated', gameState => {
  // Update UI with new game state
  renderBoard(gameState.tokens);
  updateDice(gameState.dice);
  updateTurnIndicator(gameState.myTurn);
  
  if (gameState.gameOver) {
    showGameOver(gameState.winner);
  }
});

// Handle dice rolls
function rollDice() {
  socket.emit('rollDice');
}

socket.on('diceRolled', data => {
  showDiceAnimation(data.rolls);
});

// Handle token movement
function moveToken(tokenId, diceIndex) {
  socket.emit('playRoll', {
    tokenId: tokenId,
    rollIdx: diceIndex
  });
}

// Handle disconnection
socket.on('playerDisconnected', () => {
  showDisconnectMessage();
});
```