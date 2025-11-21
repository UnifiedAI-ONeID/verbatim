
# Use the official Node.js 18 image
FROM node:18

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image
COPY functions/package.json functions/package-lock.json ./

# Install dependencies
RUN npm install

# Copy local code to the container image
COPY functions/ .

# Expose the port the app runs on
EXPOSE 8080

# Run the web service on container startup
CMD ["npm", "start"]
