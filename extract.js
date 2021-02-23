const fs = require('fs');
const writeJsonFile = require('write-json-file');
const util = require('util');
const commandLineArgs = require('command-line-args');

const options = commandLineArgs([
  {
    name: 'interesting-property',
    alias: 'p',
    type: String,
    defaultOption: true,
    defaultValue: '*',
  },
  { name: 'conditional-property', alias: 'k', type: String },
  { name: 'conditional-value', alias: 'v', type: String },
]);

extract(
  options['interesting-property'],
  options['conditional-property'],
  options['conditional-value'],
);

function extract(interestingProperty, conditionalProperty, conditionalValue) {
  const result = [];
  loadLogs().forEach(log => {
    if (
      log.hasOwnProperty(conditionalProperty) &&
      log[conditionalProperty] === conditionalValue
    ) {
      if (log.hasOwnProperty(interestingProperty)) {
        result.push(log[interestingProperty]);
      } else if (interestingProperty === '*') {
        result.push(log);
      }
    }
  });
  writeResult(
    result,
    `res/${interestingProperty}_with_${conditionalProperty}_eq_${conditionalValue}.json`,
  );
}

function loadLogs() {
  return JSON.parse(fs.readFileSync('log/log.json'));
}

function writeResult(result, fileName) {
  if (typeof fileName === 'undefined') {
    console.log(util.inspect(result, false, null, true));
  } else {
    writeJsonFile.sync(fileName, result, { indent: 2 });
  }
}
