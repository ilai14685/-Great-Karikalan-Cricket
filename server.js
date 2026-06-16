const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));


const BALLS_PER_INNINGS = 12;

const rooms = {};

function newGameState() {
  return {
    phase: 'waiting',
    players: {},
    tossCallerIndex: null,
    tossWinner: null,
    batter: null,
    bowler: null,
    innings: 1,
    score: 0,
    balls: 0,
    target: null,
    inn1Score: null,
    ballInPlay: false,
    lastBat: null,
    timer: null,
  };
}

const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

function sendTo(socketId, event, data) {
  io.to(socketId).emit(event, data);
}

function broadcast(roomId, event, data) {
  io.to(roomId).emit(event, data);
}

function clearTick(roomId) {
  const r = rooms[roomId];
  if (r && r.gs.timer) { clearTimeout(r.gs.timer); r.gs.timer = null; }
}

function startTick(roomId, sec) {
  clearTick(roomId);
  broadcast(roomId, 'timer', { sec });
  rooms[roomId].gs.timer = setTimeout(() => onTimeout(roomId), sec * 1000);
}

/* ════ TOSS ════ */
function doToss(roomId) {
  const r = rooms[roomId];
  const gs = r.gs;
  gs.phase = 'toss';

  /* Pick random player as caller */
  const callerIndex = rand(0, 1);
  gs.tossCallerIndex = callerIndex;
  const callerId = r.players[callerIndex];
  const callerName = gs.players[callerId].name;

  /* Send personalized message to EACH player */
  for (const pid of r.players) {
    const isCaller = pid === callerId;
    sendTo(pid, 'toss_start', {
      isCaller,
      callerName,
      players: gs.players,
    });
  }
}

/* ════ INNINGS ════ */
function startInnings(roomId) {
  const r = rooms[roomId];
  const gs = r.gs;
  gs.phase = 'play';
  gs.ballInPlay = false;
  gs.lastBat = null;

  for (const pid of r.players) {
    sendTo(pid, 'innings_start', {
      innings: gs.innings,
      batter: gs.batter,
      bowler: gs.bowler,
      players: gs.players,
      target: gs.target,
      isBatter: pid === gs.batter,
    });
  }
  startTick(roomId, 15);
}

function endInnings(roomId) {
  clearTick(roomId);
  const r = rooms[roomId];
  const gs = r.gs;

  if (gs.innings === 1) {
    gs.inn1Score = gs.score;
    gs.target = gs.score + 1;
    gs.innings = 2;
    gs.score = 0;
    gs.balls = 0;
    [gs.batter, gs.bowler] = [gs.bowler, gs.batter];

    broadcast(roomId, 'innings_end', {
      inn1Score: gs.inn1Score,
      target: gs.target,
    });
    setTimeout(() => startInnings(roomId), 3000);
  } else {
    endMatch(roomId);
  }
}

function endMatch(roomId) {
  clearTick(roomId);
  const r = rooms[roomId];
  const gs = r.gs;
  gs.phase = 'result';

  const inn2Score = gs.score;
  const inn1Score = gs.inn1Score;

  let resultText, winnerId = null;
  if (inn2Score >= gs.target) {
    winnerId = gs.batter;
    resultText = `🏆 ${gs.players[gs.batter].name} Won!`;
  } else if (inn1Score > inn2Score) {
    winnerId = gs.bowler;
    resultText = `🏆 ${gs.players[gs.bowler].name} Won!`;
  } else {
    resultText = '🤝 It\'s a Tie!';
  }

  broadcast(roomId, 'match_result', {
    resultText,
    inn1Score,
    inn2Score,
    target: gs.target,
    players: gs.players,
    batter: gs.batter,
    bowler: gs.bowler,
  });
}



function resolveBall(roomId, batNum, bowlNum) {
  const r = rooms[roomId];
  const gs = r.gs;
  gs.ballInPlay = false;

  broadcast(roomId, 'ball_result', { batNum, bowlNum });

  setTimeout(() => {
    if (batNum === bowlNum) {
      gs.balls++;
      broadcast(roomId, 'wicket', {
        score: gs.score,
        balls: gs.balls,
        batNum,
        bowlNum,
      });
      setTimeout(() => endInnings(roomId), 2500);
    } else {
      gs.score += batNum;
      gs.balls++;
      const over = Math.floor(gs.balls / 6);
      const ballInOv = gs.balls % 6;
      const chasing = gs.innings === 2;

      broadcast(roomId, 'score_update', {
        score: gs.score,
        balls: gs.balls,
        over,
        ballInOv,
        run: batNum,
        target: gs.target,
        innings: gs.innings,
      });

      if (chasing && gs.score >= gs.target) {
        setTimeout(() => endMatch(roomId), 1200);
        return;
      }
      if (gs.balls >= BALLS_PER_INNINGS) {
        setTimeout(() => endInnings(roomId), 1200);
        return;
      }
      setTimeout(() => startTick(roomId, 15), 600);
    }
  }, 1200);
}

function onTimeout(roomId) {
  const gs = rooms[roomId]?.gs;
  if (!gs || gs.phase !== 'play') return;

  if (!gs.ballInPlay) {
    broadcast(roomId, 'timeout_out', { who: 'batter' });
    gs.balls++;
    setTimeout(() => endInnings(roomId), 2200);
  } else {
    const bowlNum = rand(1, 6);
    broadcast(roomId, 'timeout_bowl', { bowlNum });
    resolveBall(roomId, gs.lastBat, bowlNum);
  }
}

/* ════ SOCKET ════ */
io.on('connection', socket => {
  socket.on('join_room', ({ roomId, playerName }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { players: [], gs: newGameState() };
    }
    const r = rooms[roomId];

    if (r.players.length >= 2) {
      sendTo(socket.id, 'room_full');
      return;
    }

    socket.join(roomId);
    r.players.push(socket.id);
    r.gs.players[socket.id] = { name: playerName };

    sendTo(socket.id, 'joined', { socketId: socket.id });

    broadcast(roomId, 'player_joined', {
      count: r.players.length,
      players: r.gs.players,
    });

    if (r.players.length === 2) {
      setTimeout(() => doToss(roomId), 1000);
    }
  });

  socket.on('toss_call', ({ roomId, call }) => {
    const r = rooms[roomId];
    if (!r || r.gs.phase !== 'toss') return;
    
    /* Only the caller can call */
    const callerId = r.players[r.gs.tossCallerIndex];
    if (socket.id !== callerId) return;

    const gs = r.gs;
    const flip = rand(0, 1);
    const callN = call === 'heads' ? 1 : 0;
    const iWon = flip === callN;
    const result = flip === 1 ? 'heads' : 'tails';

    gs.tossWinner = iWon ? socket.id : r.players.find(p => p !== socket.id);
    gs.phase = 'toss_choice';

    for (const pid of r.players) {
      sendTo(pid, 'toss_result', {
        result,
        winnerName: gs.players[gs.tossWinner].name,
        isWinner: pid === gs.tossWinner,
      });
    }
  });

  socket.on('toss_choice', ({ roomId, choice }) => {
    const r = rooms[roomId];
    if (!r || r.gs.phase !== 'toss_choice') return;
    if (socket.id !== r.gs.tossWinner) return;

    const gs = r.gs;
    const other = r.players.find(p => p !== socket.id);

    if (choice === 'bat') { gs.batter = socket.id; gs.bowler = other; }
    else { gs.bowler = socket.id; gs.batter = other; }

    broadcast(roomId, 'toss_choice_made', {
      choice,
      batter: gs.batter,
      bowler: gs.bowler,
      players: gs.players,
    });
    setTimeout(() => startInnings(roomId), 2000);
  });

  socket.on('bat', ({ roomId, num }) => {
    const r = rooms[roomId];
    if (!r) return;
    const gs = r.gs;
    if (gs.phase !== 'play') return;
    if (socket.id !== gs.batter) return;
    if (gs.ballInPlay) return;
    if (num < 1 || num > 6) return;

    clearTick(roomId);
    gs.ballInPlay = true;
    gs.lastBat = num;

    broadcast(roomId, 'bat_chosen', { num });
    startTick(roomId, 15);
  });

  socket.on('bowl', ({ roomId, num }) => {
    const r = rooms[roomId];
    if (!r) return;
    const gs = r.gs;
    if (gs.phase !== 'play') return;
    if (socket.id !== gs.bowler) return;
    if (!gs.ballInPlay) return;
    if (num < 1 || num > 6) return;

    clearTick(roomId);
    resolveBall(roomId, gs.lastBat, num);
  });

  socket.on('super3_pick', (data) => {
  socket.to(data.roomId).emit('super3_pick', {...data, fromId: socket.id});
});

  socket.on('disconnect', () => {
    for (const [roomId, r] of Object.entries(rooms)) {
      if (!r.players.includes(socket.id)) continue;
      clearTick(roomId);
      const name = r.gs.players[socket.id]?.name || 'A player';
      delete r.gs.players[socket.id];
      r.players = r.players.filter(p => p !== socket.id);

      if (!['waiting', 'result'].includes(r.gs.phase)) {
        broadcast(roomId, 'match_cancelled', { message: `${name} left the match.` });
      }
      if (r.players.length === 0) delete rooms[roomId];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🏏 Karikalan running on http://localhost:${PORT}`));

