import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './helpers/game.mjs';

test('all selectable powers execute without a runtime error', () => {
  const game = createGame();
  game.run('startCampaignLevel(0)');
  for (const power of ['dash', 'hook', 'shield', 'shuriken']) {
    assert.doesNotThrow(() => game.run(`players[0].powerType = '${power}'; players[0].usePower()`), power);
  }
});

test('corrupt or unavailable storage does not prevent boot', () => {
  for (const saved of ['{broken', 'null', '[]', '42', '{"0":{"stars":-1}}']) {
    assert.doesNotThrow(() => createGame({ saved }).run('renderCampaignGrid()'), saved);
  }
  assert.doesNotThrow(() => createGame({ storageFails: true }));
});

test('campaign replay preserves best stars and fastest time', () => {
  const game = createGame();
  game.run(`startCampaignLevel(0); campaignTimer = 10; campaignGoldCollected = campaignGoldTotal; winCampaignLevel();
    startCampaignLevel(0); campaignTimer = 50; winCampaignLevel();`);
  assert.equal(game.run('campaignProgress[0].stars'), 3);
  assert.equal(game.run('campaignProgress[0].bestTime'), 10);
});

test('campaign can be completed when storage writes fail', () => {
  const game = createGame({ storageFails: true });
  assert.doesNotThrow(() => game.run('startCampaignLevel(0); winCampaignLevel()'));
  assert.equal(game.element('campaignClearModal').classList.contains('hidden'), false);
});

test('campaign death never auto-respawns and cannot fail a new attempt', () => {
  const game = createGame();
  game.run("startCampaignLevel(0); players[0].die('trap'); players[0].update()");
  assert.equal(game.run('players[0].alive'), false);
  game.run('startCampaignLevel(0)');
  game.flushTimers();
  assert.equal(game.run('gameState'), 'play');
});

test('local multiplayer has independent movement and energy keys', () => {
  const game = createGame();
  game.run("gameMode = 'arena'; generateLevel(); players = PLAYER_CONFIGS.map((cfg, i) => new Player(i, cfg)); activeKeys = {KeyD: true, KeyC: true, KeyJ: true}; players.forEach(p => p.update());");
  assert.equal(game.run('players[0].vx'), 0);
  assert.equal(game.run('players[1].energy'), 0);
  assert.equal(game.run('players[2].energy'), 0);
  assert.equal(game.run('players[3].energy'), 0);
  assert.ok(game.run('players[1].vx > 0'));
  assert.ok(game.run('players[2].vx < 0'));
});

test('blur and menu transitions release keys and hide touch controls', () => {
  const game = createGame();
  game.run("startCampaignLevel(0); touchMode = 'on'; updateHUD(); activeKeys.ArrowRight = true");
  game.dispatch('window:blur');
  assert.equal(Boolean(game.run('activeKeys.ArrowRight')), false);
  game.run('showMenu()');
  assert.equal(game.element('touchControls').classList.contains('hidden'), true);
  assert.equal(game.element('campaignHud').classList.contains('hidden'), true);
});

test('escape key repeat does not toggle pause repeatedly', () => {
  const game = createGame();
  game.run('startCampaignLevel(0)');
  game.dispatch('window:keydown', { code: 'Escape' });
  game.dispatch('window:keydown', { code: 'Escape', repeat: true });
  assert.equal(game.run('gameState'), 'pause');
});

test('respawn clears dive, grapple, attack and held-key state', () => {
  const game = createGame();
  game.run(`startCampaignLevel(0); Object.assign(players[0], {isDiving: true, dashTime: 9, jumpHeld: true,
    hookTarget: {x: 100, y: 100}, atkTimer: 10, waveHeld: true}); players[0].respawn();`);
  assert.equal(game.run('players[0].isDiving'), false);
  assert.equal(game.run('players[0].hookTarget'), null);
  assert.equal(game.run('players[0].atkTimer'), 0);
  assert.equal(game.run('players[0].jumpHeld'), false);
});

test('missing PeerJS leaves the game offline and retryable', () => {
  const game = createGame({ peerAvailable: false });
  game.run('netManager.initHost()');
  assert.equal(game.run('netManager.isOnline'), false);
  game.run("netManager.joinRoom('NPLUS-1234')");
  assert.equal(game.run('netManager.isOnline'), false);
});

test('switching host/join closes the previous peer', () => {
  const game = createGame();
  game.run('netManager.initHost(); var previousPeer = netManager.peer');
  game.run("netManager.joinRoom('NPLUS-1234')");
  assert.equal(game.run('previousPeer.destroyed'), true);
});

test('close resets connections, inputs and lobby slots', () => {
  const game = createGame();
  game.run("netManager.initHost(); netManager.lobbyState.players[1].connected = true; netManager.onlineInputs[1] = {x:1}; netManager.close()");
  assert.equal(game.run('netManager.lobbyState.players[1].connected'), false);
  assert.equal(game.run('Object.keys(netManager.onlineInputs).length'), 0);
  assert.equal(game.run('netManager.roomId'), null);
});

test('third/fourth peers receive actual player slots and disconnect becomes a bot', () => {
  const game = createGame();
  game.run('netManager.initHost()');
  for (const id of ['one', 'two', 'three']) {
    const connection = new game.FakeConnection(id);
    game.run('netManager.peer').emit('connection', connection);
    connection.emit('open');
  }
  assert.equal(game.run('netManager.lobbyState.playerCount'), 4);
  game.run('netManager.startMatchInternal()');
  assert.equal(game.run('players.length'), 4);
  game.run("netManager.connections.two.close()");
  assert.equal(game.run('players[2].isBot'), true);
  assert.equal(game.run('players[2].isOnlineRemote'), false);
});

test('untrusted client input and power configuration cannot corrupt the simulation', () => {
  const game = createGame();
  game.run('netManager.initHost()');
  const connection = new game.FakeConnection();
  game.run('netManager.peer').emit('connection', connection);
  connection.emit('open');
  assert.doesNotThrow(() => connection.emit('data', null));
  connection.emit('data', { type: 'INPUT', input: { x: Infinity, atk: 'yes' } });
  assert.ok(game.run('Number.isFinite(netManager.onlineInputs[1].x) && Math.abs(netManager.onlineInputs[1].x) <= 1'));
  connection.emit('data', { type: 'UPDATE_CONFIG', power: 'constructor' });
  assert.equal(game.run('netManager.lobbyState.players[1].power'), 'hook');
});

test('returning to main menu closes an online session', () => {
  const game = createGame();
  game.run('netManager.initHost(); showMenu()');
  assert.equal(game.run('netManager.isOnline'), false);
});

test('all campaign maps have a valid spawn, one switch and one exit', () => {
  const game = createGame();
  for (let index = 0; index < game.run('CAMPAIGN_LEVELS.length'); index++) {
    game.run(`startCampaignLevel(${index})`);
    assert.equal(game.run('level.flat().filter(tile => tile === 6).length'), 1);
    assert.equal(game.run('level.flat().filter(tile => tile === 7).length'), 1);
    assert.equal(game.run('solidAt(players[0].x + 6, players[0].y + 11)'), false);
  }
});

test('overkill and fractional health do not crash the HUD', () => {
  const game = createGame();
  game.run("gameMode = 'arena'; generateLevel(); players = [new Player(0, PLAYER_CONFIGS[0])]; gameState = 'play'; players[0].hp = 0.5; updateHUD(); players[0].takeHit(null, 2)");
  assert.equal(game.run('players[0].hp'), 0);
  assert.doesNotThrow(() => game.run('updateHUD()'));
});

test('dash grants the invulnerability promised by the power description', () => {
  const game = createGame();
  game.run('startCampaignLevel(0); players[0].usePower(); players[0].takeHit(null, 2)');
  assert.equal(game.run('players[0].hp'), 2);
});

test('hook direction comes from its own input, not another keyboard player', () => {
  const game = createGame();
  game.run("startCampaignLevel(0); level[12].fill(1); players[0].powerType = 'hook'; activeKeys = {}; players[0].usePower(true)");
  assert.ok(game.run('players[0].hookTarget.y < players[0].y'));
});

test('countdown freezes movement and is cancelled by the main menu', () => {
  const game = createGame();
  game.run("gameMode = 'arena'; startGame(); var startX = players[0].x; activeKeys.ArrowRight = true;");
  for (let step = 0; step < 179; step++) game.run('updateGame()');
  assert.equal(game.run('players[0].x === startX'), true);
  assert.equal(game.run('gameState'), 'countdown');
  game.run('updateGame()');
  assert.equal(game.run('gameState'), 'play');
  game.run('showMenu(); updateGame()');
  assert.equal(game.element('countdown').style.opacity, 0);
  assert.equal(game.run('gameState'), 'menu');
});

test('fixed simulation clock advances equally at 30, 60 and 144 Hz', () => {
  for (const fps of [30, 60, 144]) {
    const game = createGame();
    game.run('startCampaignLevel(0); players[0].update = () => {}; drawLevel = () => {}; updateHUD = () => {}');
    for (let frame = 0; frame <= fps; frame++) game.frames.shift()(frame * 1000 / fps);
    assert.equal(game.run('gameTime'), 60, `${fps} Hz`);
    assert.ok(Math.abs(game.run('campaignTimer') - 1) < 1e-9);
  }
});

test('Gold Rush resolves tied scores as a draw and stops at timeout', () => {
  const game = createGame();
  game.run("gameMode = 'rush'; startGame(); gameState = 'play'; rushTimer = 1/60; players.forEach(p => p.score = 4); updateGame()");
  assert.equal(game.run('matchWinnerId'), null);
  assert.equal(game.run('gameState'), 'gameover');
  assert.equal(game.run('rushTimer'), 0);
});

test('random sky map uses open-bottom physics and safe lower-player spawns', () => {
  const game = createGame();
  game.run("gameMode = 'arena'; selectedMapKey = 'random'; Math.random = () => 0.61; startGame()");
  assert.equal(game.run('activeMapKey'), 'sky');
  assert.equal(game.run('solidTile(20, levelHeight)'), false);
  assert.ok(game.run('getSpawn(2).y < 16 * TILE'));
  game.run('startCampaignLevel(0)');
  assert.equal(game.run('solidTile(20, levelHeight)'), true);
});

test('a client never simulates collisions, damage, bots or coin collection', () => {
  const game = createGame();
  game.run(`netManager.isOnline = true; netManager.myPlayerId = 1; netManager.startMatchInternal('cyber'); gameState = 'play';
    players.forEach(p => p.update = () => {throw new Error('Client simulation')});
    projectiles = [{update() {throw new Error('Client projectile simulation')}}];`);
  assert.doesNotThrow(() => game.run('updateGame()'));
});

test('host snapshots round-trip weapons, HUD, map changes, pause and victory', () => {
  const host = createGame();
  host.run('netManager.initHost()');
  const connection = new host.FakeConnection('guest');
  host.run('netManager.peer').emit('connection', connection);
  connection.emit('open');
  host.run(`netManager.startMatchInternal('cyber'); gameState = 'play'; players[0].energy = 75; players[0].cooldown = 100; level[2][2] = 9;
    projectiles = [new Projectile(100, 100, 12, 0, players[0]), new EnergyWaveProjectile(150, 100, 1, 0, 0, 'inferno')]; netManager.broadcastSnapshot();`);
  const client = createGame();
  client.run("netManager.isOnline = true; netManager.myPlayerId = 1; netManager.startMatchInternal('cyber')");
  const sync = () => client.run('netManager').applySnapshot(connection.sent.filter(data => data.type === 'SYNC').at(-1).snapshot);
  sync();
  assert.equal(client.run('players[0].energy'), 75);
  assert.equal(client.run('players[0].cooldown'), 100);
  assert.equal(client.run('level[2][2]'), 9);
  assert.equal(client.run('projectiles[0] instanceof Projectile && projectiles[1] instanceof EnergyWaveProjectile'), true);
  assert.equal(client.run('projectiles[1].type'), 'inferno');
  host.run('togglePause()'); sync();
  assert.equal(client.run('gameState'), 'pause');
  host.run('togglePause(); endGame(players[1])'); sync();
  assert.equal(client.run('gameState'), 'gameover');
  assert.equal(client.element('winnerText').innerText, 'Ninja Red VINCE!');
  assert.equal(client.element('rematchBtn').disabled, true);
});

test('host resolves the random map before announcing a match to clients', () => {
  const game = createGame();
  game.run("netManager.initHost(); netManager.peer.emit('open'); selectedMapKey = 'random'");
  const connection = new game.FakeConnection();
  game.run('netManager.peer').emit('connection', connection);
  connection.emit('open');
  game.run('netManager.startOnlineMatchHost()');
  const start = connection.sent.find(data => data.type === 'START_GAME');
  assert.ok(start);
  assert.notEqual(start.map, 'random');
  assert.equal(start.map, game.run('activeMapKey'));
});

test('client rematch cannot start an independent local match', () => {
  const game = createGame();
  game.run("netManager.isOnline = true; netManager.myPlayerId = 1; netManager.startMatchInternal('cyber'); gameState = 'gameover'; restartGame()");
  assert.equal(game.run('gameState'), 'gameover');
  assert.equal(game.run('netManager.isOnline'), true);
});

test('Gold Rush scores coins separately from combat kills', () => {
  const game = createGame();
  game.run("gameMode = 'rush'; startGame(); gameState = 'play'; players[1].die('player', players[0])");
  assert.equal(game.run('players[0].kills'), 1);
  assert.equal(game.run('players[0].score'), 0);
});

test('coin spawning finds distinct valid positions even with repeated random values', () => {
  const game = createGame();
  game.run("gameMode = 'rush'; generateLevel(); Math.random = () => 0; for (let i = 0; i < 6; i++) spawnCoin()");
  assert.equal(game.run('coins.length'), 6);
  assert.equal(game.run('new Set(coins.map(c => c.x + "," + c.y)).size'), 6);
});

test('all arena maps survive a deterministic four-bot simulation and rendering', () => {
  const game = createGame();
  game.run(`var randomSeed = 12345; Math.random = () => ((randomSeed = Math.imul(1664525, randomSeed) + 1013904223 >>> 0) / 4294967296);
    playerCount = 4; playerTypes.fill('bot');`);
  for (const map of game.run('Object.keys(ARENA_MAPS)')) {
    assert.doesNotThrow(() => game.run(`gameMode = 'arena'; selectedMapKey = '${map}'; startGame();
      for (let tick = 0; tick < 1800; tick++) { updateGame(); if (tick % 60 === 0) {drawLevel(); players.forEach(p => p.draw()); updateHUD();} }`), map);
    assert.equal(game.run('players.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))'), true);
  }
});

test('connection timeout releases a pending peer and allows retry', () => {
  const game = createGame();
  game.run("netManager.joinRoom('NPLUS-1234'); var oldPeer = netManager.peer");
  game.flushTimers();
  assert.equal(game.run('oldPeer.destroyed'), true);
  assert.equal(game.run('netManager.isOnline'), false);
  game.run("netManager.joinRoom('NPLUS-5678'); oldPeer.emit('open')");
  assert.equal(game.run('netManager.hostConn'), null);
  assert.equal(game.run('netManager.isOnline'), true);
});

test('fatal network errors return a match to the menu instead of a broken local game', () => {
  const game = createGame();
  game.run("netManager.initHost(); netManager.startMatchInternal('cyber'); netManager.peer.emit('error', {type:'network'})");
  assert.equal(game.run('gameState'), 'menu');
  assert.equal(game.run('netManager.isOnline'), false);
});

test('hidden host pauses the authoritative match and notifies clients', () => {
  const game = createGame();
  game.run("netManager.initHost(); netManager.startMatchInternal('cyber'); gameState = 'play'; document.hidden = true");
  game.dispatch('document:visibilitychange');
  assert.equal(game.run('gameState'), 'pause');
});

test('client menu suppresses controls without pausing the host simulation', () => {
  const game = createGame();
  game.run("netManager.isOnline = true; netManager.myPlayerId = 1; netManager.startMatchInternal('cyber'); gameState = 'play'; togglePause(); activeKeys = {ArrowRight: true}");
  assert.equal(game.run('gameState'), 'play');
  assert.equal(game.run('readPlayerInput(players[1]).x'), 0);
  assert.equal(game.element('touchControls').classList.contains('hidden'), true);
});

test('peer identifiers cannot alter the connection dictionary prototype', () => {
  const game = createGame();
  game.run('netManager.initHost()');
  const connection = new game.FakeConnection('__proto__');
  game.run('netManager.peer').emit('connection', connection);
  connection.emit('open');
  assert.equal(game.run('Object.keys(netManager.connections).length'), 1);
  assert.equal(game.run('Object.getPrototypeOf(netManager.connections)'), null);
  game.run('netManager.close()');
  assert.equal(connection.open, false);
});
