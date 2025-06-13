const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pastaUploads = path.resolve(__dirname, '../uploads');
await normalizarArquivo('procuracao', req.files?.procuracao?.[0]?.path);

// ✅ Garante que "uploads" seja uma pasta
if (fs.existsSync(pastaUploads)) {
  const stat = fs.statSync(pastaUploads);
  if (!stat.isDirectory()) {
    fs.unlinkSync(pastaUploads);
    fs.mkdirSync(pastaUploads, { recursive: true });
  }
} else {
  fs.mkdirSync(pastaUploads, { recursive: true });
}

const nomesFixos = {
  cnh: 'cnh',
  procuracao: 'procuracao',
  contrato: 'contrato',
  crlv: 'crlv',
  autuacoes: 'autuacao'
};

const tiposPermitidos = ['.pdf', '.jpg', '.jpeg', '.png'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, pastaUploads),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = nomesFixos[file.fieldname] || 'arquivo';

    if (!req._fileCount) req._fileCount = {};
    req._fileCount[file.fieldname] = (req._fileCount[file.fieldname] || 0) + 1;

    const count = req._fileCount[file.fieldname];
    const nomeFinal = (count > 1) ? `${base}_${count}${ext}` : `${base}${ext}`;
    cb(null, nomeFinal);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (tiposPermitidos.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('❌ Tipo de arquivo não permitido. Apenas PDF, JPG, JPEG e PNG são aceitos.'));
    }
  }
});

module.exports = upload;
