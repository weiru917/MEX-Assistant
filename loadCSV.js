const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const unzipper = require('unzipper');

// Function to load CSV files
function loadCSV(filePath, isZipped = false, filenameInZip = '') {
  return new Promise((resolve, reject) => {
    const results = [];

    if (isZipped) {
      // Handling zipped files
      fs.createReadStream(filePath)
        .pipe(unzipper.ParseOne(filenameInZip))  // Specify the file to extract from the zip
        .pipe(csv())  // Parse the CSV file
        .on('data', (data) => results.push(data))  // Push each row to results
        .on('end', () => resolve(results))  // Resolve the promise with the parsed data
        .on('error', reject);  // Reject the promise if an error occurs
    } else {
      // Handling non-zipped CSV files
      fs.createReadStream(filePath)
        .pipe(csv())  // Parse the CSV file
        .on('data', (data) => results.push(data))  // Push each row to results
        .on('end', () => resolve(results))  // Resolve the promise with the parsed data
        .on('error', reject);  // Reject the promise if an error occurs
    }
  });
}

module.exports = loadCSV;