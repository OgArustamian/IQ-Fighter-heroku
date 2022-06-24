/* eslint-disable no-param-reassign */
/* eslint-disable no-restricted-syntax */
require('dotenv').config();
const createError = require('http-errors');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');

// ws
// const { v4: uuidv4 } = require('uuid');
const http = require('http');
const { WebSocketServer } = require('ws');

const { roomController, leave, deleteRoom } = require('./ws/roomController');
const { gameController } = require('./ws/gameController');

// routing
const authRouter = require('./routes/auth');
const {
  game, find, leaveType, GETRATE,
} = require('./ws/types');
const ladderboard = require('./ws/rankController');

const app = express();
const PORT = process.env.PORT ?? 3001;

const sessionParser = session({
  name: 'sessionID',
  store: new FileStore({}),
  secret: process.env.SESSION,
  resave: true,
  proxy: true,
  saveUninitialized: false,
});

app.use(express.static('build'));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({ credentials: true, origin: 'https://iq-fighter.herokuapp.com' }));

app.use(sessionParser);

app.use('/auth', authRouter);

app.get('*', (req, res) => {
  console.log('router get * ---->');
  res.sendFile(path.resolve(__dirname, 'build', 'index.html'));
});

// Create an HTTP server
const server = http.createServer(app);
const wss = new WebSocketServer({ clientTracking: false, noServer: true });

// part1
server.on('upgrade', (request, socket, head) => {
  console.log('Parsing session from request...');

  sessionParser(request, {}, () => {
    if (!request.session.user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); // ?
      socket.destroy();
      return;
    }

    console.log('Session is parsed!');

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
});

const maxClients = 2;
const rooms = {};

// part2
wss.on('connection', (ws, request) => {
  const { id, username } = request.session.user;
  const userID = id;

  ws.userID = userID;
  ws.username = username;

  // коннект и получение месседжа
  ws.on('message', (message) => {
    const obj = JSON.parse(message);
    const { type } = obj;
    const { subtype } = obj;
    const { params } = obj;
    console.log(obj);

    switch (type) {
      case game:
        gameController(rooms, subtype, params);
        break;
      case find:
        roomController(rooms, maxClients, ws, userID);
        break;
      case leaveType:
        leave(rooms, ws, params);
        break;
      case GETRATE:
        ladderboard(ws, params);
        break;
        case DELETE_ROOM:
          deleteRoom(rooms, room);
          break;
      default:
        console.log('default case');
        console.warn(`Type: ${type} unknown`);
        break;
    }
  });

  ws.on('close', () => {
    leave(rooms, ws);
  });
});

server.listen(PORT, () => {
  console.log('server running on port', PORT);
});

module.exports = app;
