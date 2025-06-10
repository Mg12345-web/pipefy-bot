const fs = require('fs');
const path = require('path');
const os = require('os');

const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo.lock');

/**
 * Tenta adquirir um lock para evitar múltiplas execuções.
 * @returns {boolean} True se o lock foi adquirido, false se já estiver em uso.
 */
function acquireLock() {
  try {
    const lockFd = fs.openSync(LOCK_PATH, 'wx'); // 'wx' abre para escrita, falha se existir
    fs.writeFileSync(lockFd, String(process.pid));
    fs.closeSync(lockFd);
    return true;
  } catch (e) {
    return false; // Lock já existe
  }
}

/**
 * Libera o lock.
 */
function releaseLock() {
  try {
    if (fs.existsSync(LOCK_PATH)) {
      fs.unlinkSync(LOCK_PATH);
    }
  } catch (e) {
    console.error("Erro ao tentar liberar o lock:", e.message);
  }
}

// Adiciona um handler para garantir a liberação do lock ao encerrar o processo
process.on('exit', releaseLock);
process.on('SIGINT', () => { // Interrupção (Ctrl+C)
  releaseLock();
  process.exit();
});
process.on('SIGTERM', () => { // Sinal de término
  releaseLock();
  process.exit();
});

module.exports = { acquireLock, releaseLock, LOCK_PATH };
