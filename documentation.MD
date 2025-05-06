## Overview

This document describes the architecture and workflow of the multiplayer Ludo game backend, implemented in Node.js with Socket.IO. It is intended for the frontend team to understand how events are processed, all available handlers, data shapes, and how game state is managed.

---

## 1. Architecture and Main Components

* **GameService**: A singleton service that encapsulates all game logic, state, and rules enforcement. It tracks active games, manages token positions, and computes valid moves.
* **GameController**: Acts as a Socket.IO adapter. It registers event handlers, delegates incoming messages to the service, and emits updates back to clients.

Communication is via WebSockets. Clients emit events (e.g., `rollDice`) and receive callbacks or broadcasts (e.g., `diceRolled`, `gameStateUpdated`).

---

## 2. Directory Structure

```
project-root/
├── gameLogic.js           # Board paths, coordinates, safe positions
├── services/
│   └── gameService.js     # Core logic: game creation, moves, turns
└── controllers/
    └── gameController.js  # Socket.IO handlers and payload composition
```

---

## 3. Handler Reference

Below are all Socket.IO events handled by `GameController`. For each:

* **Event Name**: The client-side emit call.
* **Parameters**: Data and optional callback signature.
* **Behavior**: Service invocation and emitted responses.

| Event           | Params                            | Description                                                                                              |
| --------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `createGame`    | `(opts: { vsComputer }, cb)`      | Creates a new game. Returns `{ gameId, playerId: 0, colors }` via callback and broadcasts initial state. |
| `joinGame`      | `(gameId: string, cb)`            | Joins existing game. Returns `{ gameId, playerId, colors }` or error. Broadcasts updated state.          |
| `getBoardPaths` | `(cb)`                            | Generates board coordinate mappings and emits both callback result and `boardPaths` event.               |
| `rollDice`      | `()`                              | Rolls dice for current player. Broadcasts `diceRolled` with `{ playerId, rolls }`.                       |
| `playRoll`      | `(data: { tokenId, rollIdx })`    | Moves token according to selected roll. Broadcasts full updated game state.                              |
| `skipTurn`      | `()`                              | Advances turn when no valid moves. Broadcasts updated state.                                             |
| `rejoinGame`    | `(data: { gameId, playerIndex })` | Reattaches disconnected player. Emits `gameStarted` with full payload to resume.                         |
| `disconnect`    | `()`                              | On client disconnect, service cleans up. Emits `playerDisconnected` to remaining players if needed.      |

---

## 4. Payload Structures

### createGame / joinGame Callback

```js
{ gameId: string, playerId: number, colors: string[] }
```

### boardPaths Event / Callback

```js
{
  positions: number[],      // cell indices in loop order
  entrances: Record<number, number>, // mapping home entrances per player
  coordinates: Record<number, { x: number, y: number }>
}
```

### diceRolled Broadcast

```js
{ playerId: number, rolls: number[] }
```

### gameStateUpdated / gameStarted Payload

```js
{
  tokens: { [tokenId: string]: number },  // token -> cell index
  dice: number[],                        // last rolled values
  myTurn: boolean,                       // enable/disable UI
  gameOver: boolean,
  winner: number | null                  // index of winning player
}
```

---

## 5. Board Logic Constants

Defined in `gameLogic.js`:

* **COMMON\_PATH**: Main loop of 52 cells.
* **HOME\_PATHS**: Final stretch per player.
* **FINAL\_PATHS**: Winning path cells.
* **SAFE\_POSITIONS**: Cells where tokens are immune.

Frontend should call `getBoardPaths` once at startup and cache the result for rendering.

---

## 6. Turn & Move Workflow

1. **Rolling**: Client emits `rollDice` → controller calls `service.rollDice` → broadcast `diceRolled`.
2. **Selecting Move**: Client emits `playRoll` with selected `tokenId` and `rollIdx` → service validates and updates state → broadcast `gameStateUpdated`.
3. **Skipping**: If no moves, client emits `skipTurn` → service advances turn → broadcast `gameStateUpdated`.

AI moves are handled transparently in the service and pushed alongside human player updates.

---

## 7. Disconnection & Rejoin

* **disconnect**: On socket drop, `service.handleDisconnect` frees resources and notifies others via `playerDisconnected`.
* **rejoinGame**: Client emits with saved `gameId` and `playerIndex`. Controller rejoins room and emits `gameStarted` with full payload.

---

## 8. Frontend Integration Tips

* **Listeners**:

  ```js
  socket.on("gameStateUpdated", updateBoard);
  socket.on("diceRolled", displayDice);
  socket.on("boardPaths", initBoard);
  socket.on("playerDisconnected", showDisconnectModal);
  socket.on("gameStarted", resumeGame);
  ```

* **Emitters**:

  ```js
  socket.emit("createGame", { vsComputer: false }, callback);
  socket.emit("joinGame", gameId, callback);
  socket.emit("getBoardPaths", callback);
  socket.emit("rollDice");
  socket.emit("playRoll", { tokenId, rollIdx });
  socket.emit("skipTurn");
  socket.emit("rejoinGame", { gameId, playerIndex });
  ```

* **State Handling**: Use `myTurn` to enable/disable controls and `gameOver`/`winner` to show endgame UI.

---

## 9. Testing & Debugging

* Log every incoming/outgoing payload in development mode.
* Use unique socket.io rooms to isolate games.
* Simulate AI by toggling `vsComputer` in `createGame` and observe interleaved events.

For deeper questions on service internals, refer to `services/gameService.js` and `gameLogic.js` for rule enforcement and path calculations.
