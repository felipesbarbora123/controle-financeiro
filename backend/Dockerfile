# Dockerfile para o backend Node.js
FROM node:18-alpine

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install --production

# Copiar código do backend
COPY . .

# Expor porta
EXPOSE 5000

# Comando para iniciar o servidor
CMD ["node", "server.js"]
