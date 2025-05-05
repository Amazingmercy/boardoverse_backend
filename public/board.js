class BoardManager {
  constructor() {
    this.boardElement = document.getElementById('game-board');
    this.diceContainer = document.getElementById('dice-container');
    this.rollBtn = document.getElementById('roll-btn');
    this.skipBtn = document.getElementById('skip-btn');
  

    this.cellSize = 0;
    this.tokens = [];
    this.selectedRollIndex = null;
    this.boardPaths = null;
    this.onTokenClick = null;
    this.scaleFactor = 1.5; // Adjust this value to scale the board
  }

  initBoard() {
    this.boardElement.innerHTML = '';
    //const size = Math.min(this.boardElement.offsetWidth, this.boardElement.offsetHeight);
    const size = Math.min(this.boardElement.offsetWidth, this.boardElement.offsetHeight) * 0.9 * this.scaleFactor;
    this.cellSize = size / 10;
    this.boardElement.style.width = `${size}px`;
    this.boardElement.style.height = `${size}px`;

    // Request board paths when initializing
    this.socketManager.getBoardPaths();
    
    // Set up paths callback
    this.socketManager.on('boardPaths', (paths) => {
        console.log("Received board paths:", paths); // Debugging
        this.boardPaths = paths;
        this.drawBoard();
    });

    // Create the 15x15 grid of cells
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.width = `${this.cellSize}px`;
        cell.style.height = `${this.cellSize}px`;
        cell.dataset.x = x;
        cell.dataset.y = y;
        this.addCellStyling(cell, x, y);
        this.boardElement.appendChild(cell);
      }
    }
  }

  drawBoard() {
    this.initBoard(); // Recreate the base grid
    
    if (this.boardPaths) {
      this.drawPaths();
    }
  }

  drawPaths() {
    // Draw borders
    this.createPathElement('board-border', this.boardPaths.borders[0]);
    this.createPathElement('board-border', this.boardPaths.borders[1]);

    // Draw cross
    this.createPathElement('board-cross', this.boardPaths.cross[0]);
    this.createPathElement('board-cross', this.boardPaths.cross[1]);

    // Draw home bases
    Object.entries(this.boardPaths.homeBases).forEach(([color, base]) => {
      this.createPathElement(`home-base ${color}`, base);
    });

    // Draw safe zones
    this.boardPaths.safeZones.forEach(zone => {
      this.createPathElement('safe-zone', zone);
    });

    // Draw center
    this.createPathElement('board-center', this.boardPaths.center);
  }

  createPathElement(className, path) {
    const element = document.createElement('div');
    element.className = className;

    switch (path.type) {
      case 'square':
      case 'polygon':
        element.style.width = `${this.cellSize * (path.coords[2][0] - path.coords[0][0])}px`;
        element.style.height = `${this.cellSize * (path.coords[2][1] - path.coords[0][1])}px`;
        element.style.left = `${path.coords[0][0] * this.cellSize}px`;
        element.style.top = `${path.coords[0][1] * this.cellSize}px`;
        break;

      case 'line':
        const [x1, y1] = path.coords[0];
        const [x2, y2] = path.coords[1];
        const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) * this.cellSize;
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        
        element.style.width = `${length}px`;
        element.style.left = `${x1 * this.cellSize}px`;
        element.style.top = `${y1 * this.cellSize}px`;
        element.style.transformOrigin = '0 0';
        element.style.transform = `rotate(${angle}deg)`;
        break;

      case 'polyline':
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        const points = path.coords.map(coord => 
          `${coord[0] * this.cellSize},${coord[1] * this.cellSize}`
        ).join(' ');
        
        pathElement.setAttribute('d', `M${points}`);
        pathElement.setAttribute('fill', 'none');
        pathElement.setAttribute('stroke', 'currentColor');
        pathElement.setAttribute('stroke-width', '2');
        
        svg.appendChild(pathElement);
        svg.style.position = 'absolute';
        svg.style.width = '100%';
        svg.style.height = '100%';
        element.appendChild(svg);
        break;
    }

    this.boardElement.appendChild(element);
  }

  // Cell styling functions from the second version
  addCellStyling(cell, x, y) {
    if (this.isInHomeBase('red', x, y)) {
      cell.classList.add('home-base', 'red');
    } else if (this.isInHomeBase('green', x, y)) {
      cell.classList.add('home-base', 'green');
    } else if (this.isInHomeBase('yellow', x, y)) {
      cell.classList.add('home-base', 'yellow');
    } else if (this.isInHomeBase('blue', x, y)) {
      cell.classList.add('home-base', 'blue');
    }
    
    if (this.isOnPath(x, y)) {
      cell.classList.add('path');
      
      if (this.isOnColoredPath('red', x, y)) {
        cell.classList.add('red');
      } else if (this.isOnColoredPath('green', x, y)) {
        cell.classList.add('green');
      } else if (this.isOnColoredPath('yellow', x, y)) {
        cell.classList.add('yellow');
      } else if (this.isOnColoredPath('blue', x, y)) {
        cell.classList.add('blue');
      }
    }
    
    if (this.isSafeCell(x, y)) {
      cell.classList.add('safe');
    }
    
    if (x === 7 && y === 7) {
      cell.classList.add('home');
    }
  }
  
  isInHomeBase(color, x, y) {
    switch(color) {
      case 'red':
        return x >= 1 && x <= 4 && y >= 1 && y <= 4;
      case 'green':
        return x >= 10 && x <= 13 && y >= 1 && y <= 4;
      case 'yellow':
        return x >= 10 && x <= 13 && y >= 10 && y <= 13;
      case 'blue':
        return x >= 1 && x <= 4 && y >= 10 && y <= 13;
      default:
        return false;
    }
  }
  
  isOnPath(x, y) {
    if ((y === 6 || y === 8) && ((x >= 1 && x <= 5) || (x >= 9 && x <= 13))) {
      return true;
    }
    
    if ((x === 6 || x === 8) && ((y >= 1 && y <= 5) || (y >= 9 && y <= 13))) {
      return true;
    }
    
    if (((x === 7) && (y >= 1 && y <= 13)) || ((y === 7) && (x >= 1 && x <= 13))) {
      return true;
    }
    
    return false;
  }
  
  isOnColoredPath(color, x, y) {
    switch(color) {
      case 'red':
        return y === 7 && x >= 1 && x <= 6;
      case 'green':
        return x === 7 && y >= 1 && y <= 6;
      case 'yellow':
        return y === 7 && x >= 8 && x <= 13;
      case 'blue':
        return x === 7 && y >= 8 && y <= 13;
      default:
        return false;
    }
  }
  
  isSafeCell(x, y) {
    const safeCells = [
      [1, 6], [6, 1], [8, 1], [13, 6],
      [13, 8], [8, 13], [6, 13], [1, 8]
    ];
    return safeCells.some(cell => cell[0] === x && cell[1] === y);
  }

  // Token rendering with all functionality
  renderTokens(tokenData) {
    this.boardElement.querySelectorAll('.token').forEach(t => t.remove());
    this.tokens = tokenData;

    tokenData.forEach(token => {
      const el = document.createElement('div');
      el.className = `token ${token.color}`;
      el.dataset.id = token.id;
      // el.style.width = `${this.cellSize * 0.8}px`;
      // el.style.height = `${this.cellSize * 0.8}px`;
      // el.style.left = `${token.x * this.cellSize + this.cellSize * 0.1}px`;
      // el.style.top = `${token.y * this.cellSize + this.cellSize * 0.1}px`;
      // Increase token size relative to cell size
      const tokenSize = this.cellSize * 0.9; // Use 90% of cell size
      el.style.width = `${tokenSize}px`;
      el.style.height = `${tokenSize}px`;
      
      // Center token in cell
      const offset = (this.cellSize - tokenSize) / 2;
      el.style.left = `${token.x * this.cellSize + offset}px`;
      el.style.top = `${token.y * this.cellSize + offset}px`;

      if (token.isClickable) {
        el.classList.add('clickable');
        el.addEventListener('click', () => {
          if (this.selectedRollIndex != null && this.onTokenClick) {
            this.onTokenClick(token.id, this.selectedRollIndex);
          }
        });
      }
      token.element = el;
      this.boardElement.appendChild(el);
    });
  }

  renderDice(rolls) {
    this.diceContainer.innerHTML = '';
    rolls.forEach((val, idx) => {
      const die = document.createElement('button');
      die.className = 'die';
      die.textContent = val;
      die.addEventListener('click', () => {
        this.setSelectedRollIndex(idx);
        this.diceContainer.querySelectorAll('.die').forEach(d => d.classList.remove('selected'));
        die.classList.add('selected');
      });
      this.diceContainer.appendChild(die);
    });
  }

  setSelectedRollIndex(index) {
    this.selectedRollIndex = index;
    this.highlightValidMoves();
  }

  highlightValidMoves() {
    this.tokens.forEach(token => {
      if (token.element) {
        token.element.classList.toggle('clickable', token.isClickable);
      }
    });
  }

  animateTokenMove(tokenId, fromX, fromY, toX, toY) {
    const token = this.tokens.find(t => t.id === tokenId);
    if (!token || !token.element) return;

    // Set initial position
    token.element.style.transition = 'none';
    token.element.style.left = `${fromX * this.cellSize + this.cellSize * 0.1}px`;
    token.element.style.top = `${fromY * this.cellSize + this.cellSize * 0.1}px`;

    // Trigger animation
    setTimeout(() => {
      token.element.style.transition = 'left 0.5s ease, top 0.5s ease';
      token.element.style.left = `${toX * this.cellSize + this.cellSize * 0.1}px`;
      token.element.style.top = `${toY * this.cellSize + this.cellSize * 0.1}px`;
    }, 10);
  }
}

// Create and export a singleton instance
const boardManager = new BoardManager();