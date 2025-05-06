// Description: This file sets up an Express server and initializes a WebSocket connection using Socket.IO.
const http = require('http');
const express = require('express');
const { setupSocket } = require('./socket/socketHandler');


const app = express();
const server = http.createServer(app);

setupSocket(server);



app.use(express.json());



const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
