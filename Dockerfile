# Usa a imagem base do Playwright com Ubuntu Jammy
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos de dependência e instala libs de imagem
COPY package*.json ./

# Instala dependências do sistema (OCR e segurança)
RUN apt-get update && apt-get install -y \
  graphicsmagick \
  imagemagick \
  tesseract-ocr \
  tesseract-ocr-por \
  && rm -rf /var/lib/apt/lists/*

# Instala dependências Node.js
COPY package*.json ./

# Instala dependências Node.js
RUN npm install --omit=dev

# Copia restante do código
COPY . .

# Cria pastas necessárias
RUN mkdir -p /app/uploads /app/logs /app/prints

# Garante que a pasta uploads/ existe
RUN mkdir -p /app/uploads

# Instala navegadores do Playwright
RUN npx playwright install --with-deps

# Define ambiente de produção
ENV NODE_ENV=production

# Expõe a porta do Express
EXPOSE 8080

# Comando padrão de inicialização
CMD ["node", "index.js"]
