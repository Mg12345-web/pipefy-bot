# Usa imagem oficial Node
FROM node:18

# Cria diretório de trabalho
WORKDIR /app

# Copia arquivos
COPY package*.json ./
RUN npm install

# Copia o restante do projeto
COPY . .

# Expondo porta padrão do Railway
EXPOSE 8080

# Comando de inicialização
CMD ["npm", "start"]
