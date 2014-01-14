stack-election
==============

The [Stack Exchange Election Statistics page](http://elections.stackexchange.com/), a collection of useful
statistics for elections on the [Stack Exchange](http://stackexchange.com/) network.

## Installation

  1. Install [node.js](http://nodejs.org/) 0.6 or later, with [npm](https://npmjs.org/)
  2. (Windows only) Install [Python](http://www.python.org/) 2.x
  3. (Windows only) Set the `PYTHON` environment variable as the full path to the Python executable,
     or include Python in `PATH`
  4. In code directory, run `npm install`
  5. Set environment variable `NODE_ENV=production` and `PORT=<port>` (optional, default port is 3000)
  6. Run application with `node app.js`
  
The application can also be run with [forever](https://github.com/nodejitsu/forever) to automate recovery
from fatal errors.
