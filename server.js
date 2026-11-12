const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// Разрешаем CORS, чтобы сайты могли делиться сохранениями
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

const cloudSaves = {};

app.post('/api/save', (req, res) => {
  const { userId, data } = req.body;
  if (userId && data) {
    cloudSaves[userId] = data;
    return res.json({ success: true });
  }
  res.status(400).json({ success: false });
});

app.get('/api/load/:userId', (req, res) => {
  const { userId } = req.params;
  if (cloudSaves[userId]) {
    return res.json({ success: true, data: cloudSaves[userId] });
  }
  res.json({ success: false, data: null });
});

let waitingPlayer = null;

io.on('connection', (socket) => {
  console.log(`Игрок подключился: ${socket.id}`);

  socket.on('find_match', (playerData) => {
    if (waitingPlayer && waitingPlayer.id !== socket.id) {
      const roomName = `room_${Date.now()}`;
      const p1 = waitingPlayer;
      const p2 = socket;

      waitingPlayer = null;
      p1.join(roomName);
      p2.join(roomName);

      io.to(p1.id).emit('match_found', { room: roomName, role: 'p1', enemyData: playerData });
      io.to(p2.id).emit('match_found', { room: roomName, role: 'p2', enemyData: playerData });
    } else {
      waitingPlayer = socket;
      socket.emit('waiting_for_opponent');
    }
  });

  socket.on('cancel_search', () => {
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
    }
  });

  socket.on('spawn_unit', (data) => {
    socket.to(data.room).emit('opponent_spawn', data);
  });

  socket.on('disconnect', () => {
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});