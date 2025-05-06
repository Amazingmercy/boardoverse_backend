// Description: This file sets up an Express server and initializes a WebSocket connection using Socket.IO.
const http = require('http');
const fs = require('fs');
const path = require('path');
const marked = require('marked');
const express = require('express');
const hljs = require('highlight.js');


const { setupSocket } = require('./socket/socketHandler');


const app = express();
const server = http.createServer(app);

setupSocket(server);



app.use(express.json());



app.get('/', (req, res) => {
    //const docPath = path.join(__dirname, 'documentation.md');
    const docPath = path.resolve(__dirname, 'documentation.MD');
    console.log('🛠  Looking for docs at:', docPath, '— exists?', fs.existsSync(docPath));

    fs.readFile(docPath, 'utf8', (err, data) => {
        if (err) return res.status(500).send('Could not read documentation file.');

        const html = marked.parse(data);
        res.send(`
            <html>
            <head>
                <title>Boardoverse API Documentation</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">
                <link rel="icon" href="https://upload.wikimedia.org/wikipedia/commons/f/f9/Ludo_board_2.svg" type="image/x-icon">
            </head>
            <body>
                ${html}
                <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
                <script>hljs.highlightAll();</script>
            </body>
            </html>
        `);
    });
});


marked.setOptions({
    highlight: function (code, lang) {
        const validLang = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language: validLang }).value;
    },
    langPrefix: 'hljs language-', // highlight.js css expects this
});




const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
