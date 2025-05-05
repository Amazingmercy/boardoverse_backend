class SocketManager {
    constructor() {
      this.socket = null;
      this.gameId = null;
      this.playerId = null;
      this.colors = null;
      this.callbacks = {
        onGameCreated: null,
        onGameJoined: null,
        onGameStateUpdated: null,
        onDiceRolled: null,
        onPlayerDisconnected: null,
        onError: null
      };
    }
  
    init(serverUrl) {
      // Connect to the Socket.IO server
      this.socket = io(serverUrl || window.location.origin);
      
      // Set up event listeners
      this.socket.on('connect', () => {
        console.log('Connected to server');
      });

      this.socket.on('boardPaths', (paths) => {
        if (this.callbacks.onBoardPaths) {
          this.callbacks.onBoardPaths(paths);
        }
      });

      
    
      this.socket.on('gameStateUpdated', (data) => {
        console.log('Game state updated:', data);
        if (this.callbacks.onGameStateUpdated) {
          this.callbacks.onGameStateUpdated(data);
        }
      });
  
      this.socket.on('diceRolled', (data) => {
        console.log('Dice rolled:', data);
        if (this.callbacks.onDiceRolled) {
          this.callbacks.onDiceRolled(data);
        }
      });
  
      this.socket.on('playerDisconnected', () => {
        console.log('A player disconnected');
        if (this.callbacks.onPlayerDisconnected) {
          this.callbacks.onPlayerDisconnected();
        }
      });
  
      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
      });
  
      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        if (this.callbacks.onError) {
          this.callbacks.onError('Connection error: ' + error.message);
        }
      });
    }
  
    createGame(vsComputer, callback) {
      this.socket.emit('createGame', { vsComputer }, (response) => {
        if (response.error) {
          console.error('Error creating game:', response.error);
          if (this.callbacks.onError) {
            this.callbacks.onError(response.error);
          }
          return;
        }
  
        this.gameId = response.gameId;
        this.playerId = response.playerId;
        this.colors = response.colors;
  
        console.log('Game created:', response);
        
        if (callback) {
          callback(response);
        }
  
        if (this.callbacks.onGameCreated) {
          this.callbacks.onGameCreated(response);
        }
      });
    }

    // In SocketManager class
getBoardPaths(callback) {  // Add optional callback
  console.log('Requesting board paths...');
  this.socket.emit('getBoardPaths', (response) => {
      if (callback) callback(response);
  });
}
  
    joinGame(gameId, callback) {
      this.socket.emit('joinGame', gameId, (response) => {
        if (response.error) {
          console.error('Error joining game:', response.error);
          if (this.callbacks.onError) {
            this.callbacks.onError(response.error);
          }
          return;
        }
  
        this.gameId = response.gameId;
        this.playerId = response.playerId;
        this.colors = response.colors;
  
        console.log('Game joined:', response);
        
        if (callback) {
          callback(response);
        }
  
        if (this.callbacks.onGameJoined) {
          this.callbacks.onGameJoined(response);
        }
      });
    }
  
    rollDice() {
      console.log('Rolling dice...');
      this.socket.emit('rollDice');
    }
  
    playRoll(tokenId, rollIdx) {
      console.log('Playing roll:', { tokenId, rollIdx });
      this.socket.emit('playRoll', { tokenId, rollIdx });
    }
  
    skipTurn() {
      console.log('Skipping turn...');
      this.socket.emit('skipTurn');
    }
  
    rejoinGame(gameId, playerIndex) {
      console.log('Rejoining game:', { gameId, playerIndex });
      this.socket.emit('rejoinGame', { gameId, playerIndex });
    }
  
    // Set callback handlers
    on(event, callback) {
      if (this.callbacks.hasOwnProperty(event)) {
        this.callbacks[event] = callback;
      }
    }
  }
  
  // Create and export a singleton instance
  const socketManager = new SocketManager();
  