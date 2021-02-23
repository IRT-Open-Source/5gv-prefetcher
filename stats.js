const fs = require('fs');
const util = require('util');

// logs = null;

module.exports = function computeStatistic() {
  //   if (logs === null) {
  const logs = JSON.parse(fs.readFileSync('log/log.json'));
  //   }

  const statistic = {
    success: 0,
    cache_misses: 0,
    cache_hits: 0,
    error: {
      count: 0,
      codes: {},
    },
    unhandled: {
      count: 0,
      messages: {},
    },
  };

  logs.forEach(val => {
    if (val.status.match(/200|202|304/)) {
      statistic.success++;
      if (val.hasOwnProperty('cache_status')) {
        if (val.cache_status === 'HIT') {
          statistic.cache_hits++;
          //   statistic.cache_the_hits.push(val.url);
        } else if (val.cache_status === 'MISS') {
          statistic.cache_misses++;
        }
      }
    } else if (val.status === '418' || val.status === 3) {
      statistic.unhandled.count++;
      if (!statistic.unhandled.messages.hasOwnProperty(val.msg)) {
        statistic.unhandled.messages[val.msg] = 0;
      }
      statistic.unhandled.messages[val.msg]++;
    } else if (val.status.match(/[4|5][0-9]{2}/)) {
      statistic.error.count++;

      if (!statistic.error.codes.hasOwnProperty(val.status)) {
        statistic.error.codes[val.status] = {};
        statistic.error.codes[val.status].count = 0;
        statistic.error.codes[val.status].messages = {};
      }
      statistic.error.codes[val.status].count++;
      if (!statistic.error.codes[val.status].messages.hasOwnProperty(val.msg)) {
        statistic.error.codes[val.status].messages[val.msg] = 0;
      }
      statistic.error.codes[val.status].messages[val.msg]++;
    }
  });

  return statistic;
};

// console.log(util.inspect(computeStatistic(), false, null, true));
