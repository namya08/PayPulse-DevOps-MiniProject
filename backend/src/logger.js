'use strict';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };
const threshold = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function write(level, msg, fields) {
  if (LEVELS[level] < threshold) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields
  };
  const out = JSON.stringify(line);
  if (level === 'error') process.stderr.write(out + '\n');
  else process.stdout.write(out + '\n');
}

const logger = {
  debug: (msg, fields = {}) => write('debug', msg, fields),
  info: (msg, fields = {}) => write('info', msg, fields),
  warn: (msg, fields = {}) => write('warn', msg, fields),
  error: (msg, fields = {}) => write('error', msg, fields),
  child: (base = {}) => ({
    debug: (msg, fields = {}) => write('debug', msg, { ...base, ...fields }),
    info: (msg, fields = {}) => write('info', msg, { ...base, ...fields }),
    warn: (msg, fields = {}) => write('warn', msg, { ...base, ...fields }),
    error: (msg, fields = {}) => write('error', msg, { ...base, ...fields })
  })
};

module.exports = logger;
