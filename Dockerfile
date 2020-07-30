#Image base
FROM node:latest

#Path of files
WORKDIR /app

#Copy files
ADD . /app

#Dependencies
RUN npm install

#Port
EXPOSE 3000

#Command
CMD ["npm", "start"]
