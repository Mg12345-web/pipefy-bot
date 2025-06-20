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

// ➕ Captura erros não tratados
process.on('uncaughtException', (err) => {
  console.error('❌ Erro não tratado:', err);
  releaseLock();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Rejeição não tratada:', reason);
  releaseLock();
  process.exit(1);
});

// ➕ Garantir que sempre libere o lock
process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(); }); 
process.on('SIGTERM', () => { releaseLock(); process.exit(); });

module.exports = { acquireLock, releaseLock, LOCK_PATH };
