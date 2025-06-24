# Board Game WebSocket API Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [WebSocket Connection](#websocket-connection)
3. [API Events](#api-events)
   - [Client-to-Server Events](#client-to-server-events)
   - [Server-to-Client Events](#server-to-client-events)
4. [Game Flow](#game-flow)
5. [Data Structures](#data-structures)
6. [Error Handling](#error-handling)
7. [Example Implementation](#example-implementation)

## Introduction

This documentation describes the WebSocket API for a Ludo-style board game implementation. The API allows frontend clients to create, join, and play games in real-time using WebSocket connections.

## WebSocket Connection

### Establishing Connection

1. Connect to the WebSocket server at 
### `https://boardoverse-backend.onrender.com`
2. Once connected, the client must register event handlers for server messages
3. The connection remains open throughout the game session

### Connection Requirements

- The client must implement handlers for all server events
- The client must maintain the connection state
- All game actions are performed through WebSocket messages

## API Events

### Client-to-Server Events

#### `createGame`
- **Purpose**: Create a new game
- **Payload**: 
  ```typescript
  {
    vsComputer: boolean // true for single-player vs AI
  }
  ```
- **Response**: Callback with:
  ```typescript
  {
    gameId: string,     // 6-character game ID
    playerId: number,   // 0 (first player)
    colors: string[]    // ['red', 'yellow']
  }
  ```

#### `joinGame`
- **Purpose**: Join an existing game
- **Payload**: Game ID string
- **Response**: Callback with:
  ```typescript
  {
    gameId: string,     // Same as input
    playerId: number,   // 1 (second player)
    colors: string[]    // ['green', 'blue']
  }
  ```

#### `getBoardPaths`
- **Purpose**: Request board layout data
- **Payload**: None
- **Response**: Callback with complex board path data (see [Data Structures](#data-structures))

#### `rollDice`
- **Purpose**: Roll dice for current turn
- **Payload**: None
- **Server Response**: Broadcasts `diceRolled` event

#### `playRoll`
- **Purpose**: Move a token using a specific dice roll
- **Payload**: 
  ```typescript
  {
    tokenId: string,    // Format "COLOR-INDEX" (e.g., "RED-0")
    rolledValue: number, // Dice value to use (1-6)
    gameId: string
  }
  ```
- **Server Response**: Broadcasts updated game state

#### `skipTurn`
- **Purpose**: Skip current turn when no valid moves
- **Payload**: None
- **Server Response**: Broadcasts updated game state

### Server-to-Client Events

#### `diceRolled`
- **Purpose**: Notify players of dice roll results
- **Payload**: 
  ```typescript
  {
    playerId: number,   // Player who rolled
    dice: number[]   ,  // Array of dice values (typically 2 values)
    gameId: string
  }
  ```

#### `gameStateUpdated`
- **Purpose**: Broadcast updated game state after any change
- **Payload**: 
  ```typescript
  {
    tokens: TokenState[],
    dice: number[],
    myTurn: boolean,    // True if it's now this player's turn
    gameOver: boolean,
    winner: number|null // Index of winning player if gameOver=true
  }
  ```

#### `playerDisconnected`
- **Purpose**: Notify when a player disconnects
- **Payload**: None

#### `error`
- **Purpose**: Notify of errors
- **Payload**: 
  ```typescript
  {
    message: string // Error description
  }
  ```

## Game Flow

1. **Game Setup**
   - Player 1 creates game with `createGame`
   - Player 2 joins with `joinGame` (or AI joins automatically)
   - Client requests board data with `getBoardPaths`

2. **Gameplay Loop**
   - Current player rolls dice with `rollDice`
   - Server responds with `diceRolled` and updates state
   - Player selects token and calls `playRoll` with chosen dice value
   - If no valid moves, player calls `skipTurn`
   - Server broadcasts state changes to all players
   - Turn passes to next player

3. **Game End**
   - When a player gets all tokens to center, they win
   - Server sets `gameOver` and `winner` in state
   - Game can be restarted by creating a new game

## Data Structures

### Board Paths Structure
Returned by `getBoardPaths`:
```typescript
{
  commonPath: {
    type: 'path',
    coords: [number, number][], // Array of [x,y] coordinates
    length: number,
    next: number[],             // Indices of next positions
    prev: number[]              // Indices of previous positions
  },
  homePaths: {
    [color: string]: {
      type: 'homepath',
      coords: [number, number][],
      length: number,
      entryPoint: number        // Index on common path
    }
  },
  safeZones: {
    type: 'safezone',
    coords: [number, number][],
    color: string
  }[],
  homeBases: {
    [color: string]: {
      type: 'homebase',
      coords: [number, number][]
    }
  },
  startAreas: {
    [color: string]: {
      type: 'startarea',
      coords: [number, number][]
    }
  },
  center: {
    type: 'center',
    coords: [number, number][]
  }
}
```

### Token State
```typescript
{
  id: string,         // Format "COLOR-INDEX" (e.g., "RED-0")
  color: string,      // 'RED', 'GREEN', 'YELLOW', 'BLUE'
  x: number,          // Current x-coordinate
  y: number,          // Current y-coordinate
  position: number,   // Internal position index
  index: number,      // Token index (0-3)
  isClickable: boolean // True if token can be moved
}
```

## Error Handling

The server may send error messages through the `error` event. Common errors include:

- `Game does not exist` - Invalid game ID
- `Game is already full` - Attempt to join full game
- `Not your turn` - Attempt to act out of turn
- `Token not found` - Invalid token ID
- `Invalid move` - Attempted move violates game rules

## Example Implementation

```javascript
// Basic frontend implementation example
const socket = io('ws://localhost:3000');

// Set up event handlers
socket.on('gameStateUpdated', (state) => {
  console.log('Game state updated:', state);
  // Update UI with new state
});

socket.on('diceRolled', (data) => {
  console.log('Dice rolled:', data.dice);
  // Show dice animation
});

socket.on('playerDisconnected', () => {
  console.log('Opponent disconnected');
  // Show disconnect message
});

socket.on('error', (error) => {
  console.error('Game error:', error.message);
  // Show error to user
});

// Create a new game
function createGame(vsComputer) {
  socket.emit('createGame', { vsComputer }, (response) => {
    if (response.error) {
      console.error(response.error);
      return;
    }
    console.log('Game created:', response.gameId);
    // Store game ID and player ID
  });
}

// Join existing game
function joinGame(gameId) {
  socket.emit('joinGame', gameId, (response) => {
    if (response.error) {
      console.error(response.error);
      return;
    }
    console.log('Joined game:', response.gameId);
    // Store game ID and player ID
  });
}

// Request board data
function getBoardData() {
  socket.emit('getBoardPaths', (paths) => {
    console.log('Board paths:', paths);
    // Render board based on paths
  });
}

// Roll dice
function rollDice() {
  socket.emit('rollDice');
}

// Move token
function moveToken(tokenId, diceValue) {
  socket.emit('playRoll', { tokenId, rolledValue: diceValue });
}

// Skip turn
function skipTurn() {
  socket.emit('skipTurn');
}
```

This documentation provides a comprehensive guide for frontend developers to integrate with the board game WebSocket API. The API supports both single-player (vs AI) and multiplayer gameplay with real-time updates.