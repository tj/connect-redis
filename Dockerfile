# Use the official Node.js 10.8.2 image
FROM node:21

# Update apt repository and install redis-server
RUN apt-get update && apt-get install -y redis-server

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port your app will run on (adjust as needed)
EXPOSE 3000

# Start redis-server in daemon mode then run the app
CMD redis-server --daemonize yes && npm test