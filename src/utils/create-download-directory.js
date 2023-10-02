const fs = require('fs');
const { CONSTANTS } = require('./constants')

const create = () => { 
  const dir = CONSTANTS.destDownloadFolder 

  if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
  }
}

module.exports = { create }