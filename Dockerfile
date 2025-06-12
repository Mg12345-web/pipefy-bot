# Usa a imagem base do Playwright com Ubuntu Jammy
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos de dependência e instala as libs do sistema
COPY package*.json ./

# 🛠️ Instala dependências do sistema (incluindo GraphicsMagick e ImageMagick)
RUN apt-get update && apt-get install -y \
  graphicsmagick \
  imagemagick \
  && rm -rf /var/lib/apt/lists/*

# Instala dependências Node.js
RUN npm install

# Copia restante do projeto
COPY . .

COPY package*.json ./
RUN npm install

# Garante que a pasta uploads/ existe
RUN mkdir -p /app/uploads

# Instala navegadores do Playwright
RUN npx playwright install --with-deps

# Define ambiente de produção
ENV NODE_ENV=production

# Expõe porta usada pelo Express
EXPOSE 8080

# Comando padrão
CMD ["node", "index.js"]
