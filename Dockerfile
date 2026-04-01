# Dockerfile
FROM node:20-alpine

# Working directory
WORKDIR /app

# Copy package.json and lock file
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy project files
COPY . .

# Expore the port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
