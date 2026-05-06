"use strict";

const tests = [];

function test(name, fn) {
  tests.push({ fn, name });
}

async function run() {
  let failures = 0;
  for (const item of tests) {
    try {
      await item.fn();
      console.log(`ok - ${item.name}`);
    } catch (error) {
      failures += 1;
      console.error(`not ok - ${item.name}`);
      console.error(error && error.stack ? error.stack : error);
    }
  }
  console.log(`${tests.length - failures}/${tests.length} tests passed`);
  if (failures > 0) {
    process.exitCode = 1;
  }
}

module.exports = {
  run,
  test,
};
