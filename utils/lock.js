const fs = require('fs');
const path = require('path');
const os = require('os');

const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo.lock');

function acquireLock() {
  try {
    const lockFd = fs.openSync(LOCK_PATH, 'wx'); 
    fs.writeFileSync(lockFd, String(process.pid)); 
    fs.closeSync(lockFd);
    return true;
  } catch {
    return false; 
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_PATH)) {
      fs.unlinkSync(LOCK_PATH);
    }
  } catch (e) {
    console.error("❌ Erro ao tentar liberar o lock:", e.message);
  }
}

process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(); }); // Ctrl+C
process.on('SIGTERM', () => { releaseLock(); process.exit(); }); // kill

module.exports = { acquireLock, releaseLock, LOCK_PATH };
