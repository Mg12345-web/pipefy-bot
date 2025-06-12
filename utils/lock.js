const fs = require('fs');
const path = require('path');
const os = require('os');

// Caminho do arquivo de lock (em pasta temporária do sistema)
const LOCK_PATH = path.join(os.tmpdir(), 'pipefy_robo.lock');

/**
 * Tenta adquirir o lock para impedir execuções simultâneas do robô.
 * @returns {boolean} Retorna true se o lock foi adquirido com sucesso, false se já estiver em uso.
 */
function acquireLock() {
  try {
    const lockFd = fs.openSync(LOCK_PATH, 'wx'); // 'wx': write e erro se já existir
    fs.writeFileSync(lockFd, String(process.pid)); // Grava o PID atual no arquivo
    fs.closeSync(lockFd);
    return true;
  } catch {
    return false; // Lock já existe, não pode continuar
  }
}

/**
 * Libera o lock, permitindo uma nova execução futura.
 */
function releaseLock() {
  try {
    if (fs.existsSync(LOCK_PATH)) {
      fs.unlinkSync(LOCK_PATH);
    }
  } catch (e) {
    console.error("❌ Erro ao tentar liberar o lock:", e.message);
  }
}
} catch (e) {
  console.warn("🔒 Lock já em uso. Processo impedido.");
  return false;
}

// Garante liberação do lock ao sair do processo (natural ou forçado)
process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(); }); // Ctrl+C
process.on('SIGTERM', () => { releaseLock(); process.exit(); }); // kill

module.exports = { acquireLock, releaseLock, LOCK_PATH };
