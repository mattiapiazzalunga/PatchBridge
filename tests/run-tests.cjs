"use strict";

const { run } = require("./harness.cjs");

require("./paths.test.js");
require("./security.test.js");
require("./patchParser.test.js");
require("./patchFilter.test.js");
require("./patchPreview.test.js");
require("./prompt.test.js");
require("./scanner.test.js");
require("./git.test.js");
require("./requirements.test.js");
require("./metadata.test.js");

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
