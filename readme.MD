# Ludo Game Backend API Documentation

This document provides a comprehensive guide to the Socket.IO API for the Ludo game. It explains how to connect to the server, available events, and the expected data formats for communication between the frontend and backend.

## Table of Contents
1. [Connection Setup](#connection-setup)
2. [Game Creation and Joining](#game-creation-and-joining)
3. [Game Flow Events](#game-flow-events)
4. [Game State](#game-state)
5. [Error Handling](#error-handling)
6. [Example Implementation](#example-implementation)

## Connection Setup

### Initializing the Socket Connection

```javascript
// Using the Socket.IO client library
const socket = io('http://your-server-url');

// Or with the provided SocketManager
socketManager.init('http://your-server-url');
```

When no URL is provided, the connection will attempt to connect to the current origin.

### Connection Events

The server emits the following connection-related events:

| Event | Description |
|-------|-------------|
| `connect` | Fired when successfully connected to the server |
| `disconnect` | Fired when disconnected from the server |
| `connect_error` | Fired when a connection error occurs |

## Game Creation and Joining

### Creating a New Game

```javascript
// Create a new game (with optional computer opponent)
socket.emit('createGame', { vsComputer: true }, callback);

// Using SocketManager
socketManager.createGame(true); // true for computer opponent
```

#### Response (in callback)

```javascript
{
  gameId: "abc123",      // Unique game identifier
  playerId: "player1",   // Your player identifier
  colors: ["red", "blue"] // Array of colors assigned to each player
}
```

### Joining an Existing Game

```javascript
// Join an existing game using its ID
socket.emit('joinGame', "abc123", callback);

// Using SocketManager
socketManager.joinGame("abc123");
```

#### Response (in callback)

```javascript
{
  gameId: "abc123",       // Game identifier
  playerId: "player2",    // Your player identifier
  colors: ["yellow", "green"] // Array of colors assigned to each player
}
```

### Rejoining a Game

If a player disconnects, they can rejoin the same game:

```javascript
socket.emit('rejoinGame', { gameId: "abc123", playerIndex: 1 });

// Using SocketManager
socketManager.rejoinGame("abc123", 1);
```

## Game Flow Events

### Rolling the Dice

```javascript
// Request to roll the dice
socket.emit('rollDice');

// Using SocketManager
socketManager.rollDice();
```

### Playing a Roll (Moving a Token)

```javascript
// Move a token using a specific dice roll
socket.emit('playRoll', { tokenId: "red-1", rollIdx: 0 });

// Using SocketManager
socketManager.playRoll("red-1", 0);
```

Parameters:
- `tokenId`: The identifier of the token to move
- `rollIdx`: The index of the dice roll to use (0 for first dice, 1 for second dice if available)

### Skipping a Turn

```javascript
// Skip the current turn
socket.emit('skipTurn');

// Using SocketManager
socketManager.skipTurn();
```

## Game State

### Game State Updates

The server emits `gameStateUpdated` events whenever the game state changes:

```javascript
socket.on('gameStateUpdated', (data) => {
  console.log('Game state updated:', data);
  // Update UI based on new game state
});
```

#### Game State Object

```javascript
{
  currentPlayer: "player1", // ID of the current player
  players: [               // Array of players
    {
      id: "player1",
      color: "red",
      name: "Player 1",
      isConnected: true
    },
    {
      id: "player2",
      color: "blue",
      name: "Player 2",
      isConnected: true
    }
  ],
  tokens: [                // Array of all tokens on the board
    {
      id: "red-1",
      color: "red",
      x: 3,                // x-coordinate on the board
      y: 2,                // y-coordinate on the board
      position: 5,         // Position along the path
      isHome: false,       // Whether token is in home (finished)
      isStart: false,      // Whether token is in starting position
      isClickable: true,   // Whether the token can be clicked (valid move)
      playerId: "player1"  // ID of the player who owns this token
    },
    // ... more tokens
  ],
  dice: [5, 6],           // Current dice values
  myTurn: true,           // Whether it's the current client's turn
  gameOver: false,        // Whether the game is over
  winner: null            // ID of the winning player (if game is over)
}
```

### Dice Roll Events

The server emits `diceRolled` events when dice are rolled:

```javascript
socket.on('diceRolled', (data) => {
  console.log('Dice rolled:', data);
  // Update dice display
});
```

#### Dice Roll Object

```javascript
{
  playerId: "player1",  // ID of the player who rolled
  rolls: [5, 6]         // Values of the dice rolled
}
```

### Player Disconnection Events

```javascript
socket.on('playerDisconnected', () => {
  console.log('A player disconnected');
  // Update UI to show player disconnected
});
```

## Error Handling

Error responses are returned in callbacks with an `error` property:

```javascript
socket.emit('joinGame', 'invalidId', (response) => {
  if (response.error) {
    console.error('Error joining game:', response.error);
    // Handle error (e.g., show error message)
  } else {
    // Process successful response
  }
});
```

Common errors:
- Game not found
- Game already full
- Not your turn
- Invalid move

## Example Implementation

Here's a complete example using the SocketManager class:

```javascript
// Initialize the socket connection
socketManager.init();

// Set up event handlers
socketManager.on('onGameCreated', (data) => {
  console.log('Game created:', data);
  // Show game screen, display game ID, etc.
});

socketManager.on('onGameJoined', (data) => {
  console.log('Game joined:', data);
  // Show game screen, initialize board, etc.
});

socketManager.on('onGameStateUpdated', (data) => {
  console.log('Game state updated:', data);
  // Update board with token positions
  // Update game status
  // Enable/disable controls based on turn
});

socketManager.on('onDiceRolled', (data) => {
  console.log('Dice rolled:', data);
  // Show dice values
  // Enable token selection if it's my turn
});

socketManager.on('onPlayerDisconnected', () => {
  console.log('A player disconnected');
  // Show message that opponent disconnected
});

socketManager.on('onError', (errorMsg) => {
  console.error('Error:', errorMsg);
  // Show error message to user
});

// User interactions
document.getElementById('create-game').addEventListener('click', () => {
  const vsComputer = document.getElementById('vs-computer').checked;
  socketManager.createGame(vsComputer);
});

document.getElementById('join-game').addEventListener('click', () => {
  const gameId = document.getElementById('game-id-input').value.trim();
  if (gameId) {
    socketManager.joinGame(gameId);
  } else {
    // Show error: Game ID required
  }
});

document.getElementById('roll-dice').addEventListener('click', () => {
  socketManager.rollDice();
});

document.getElementById('skip-turn').addEventListener('click', () => {
  socketManager.skipTurn();
});

// Example of token click handler
boardManager.onTokenClick = (tokenId, rollIdx) => {
  socketManager.playRoll(tokenId, rollIdx);
};
```

---

## Troubleshooting

### Common Issues:

1. **Connection Problems**
   - Check that the server is running
   - Verify the server URL is correct
   - Check for network/firewall issues

2. **Game Creation/Joining Issues**
   - Ensure game IDs are correctly formatted
   - Check that the game exists when joining
   - Verify the game isn't already full

3. **Game Play Issues**
   - Check that it's your turn when attempting actions
   - Verify tokens are in valid positions for moves
   - Check dice values allow the desired moves

4. **State Synchronization**
   - If board state seems incorrect, try refreshing or rejoining
   - Check console for error messages
   - Verify event listeners are properly set up

For persistent issues, check server logs or contact the backend team.
