var argv = require("minimist")(process.argv.slice(2));
var http = require("http");
var https = require("https");
var httpProxy = require("http-proxy");
var path = require("path");
var fs = require("fs");
var _ = require("lodash");

var _configFile = argv.config || "proxyConfig.json";
var _configPath = path.join(__dirname,_configFile);
var _config = {};
var _proxyTargets = {};
var _proxy = httpProxy.createProxyServer({xfwd:true});

var readConfig = function() {
  var cfg = fs.readFileSync(_configPath);
  try {
    _config = JSON.parse(cfg);
    _proxyTargets = _config.targets;
    console.log("successfully parsed config file");
  } catch (err) {
    console.log("failed to parse config file: " + err.message);
  }
};

var getOptions = function(req) {
  var target;
  if (_proxyTargets.hasOwnProperty(req.headers.host)) {
    target = _proxyTargets[req.headers.host];
  } else {
    target = _proxyTargets["*"];
  }

  return { target: target };
};

var initialiseProxy = function() {
  // Listen for changes to config file.
  fs.watch(_configPath, function(evt,filename) {
    // Re-load config if changed.
    if (evt === "change" && filename === _configFile) {
      readConfig();
    }
  });

  _proxy.on("error", function(err) {
    console.error("proxy error",err);
  });

  readConfig();

  var listener = function(req,res) {
    var options = getOptions(req);
    if (options.target) {
      console.log("proxying " + req.headers.host);
      _proxy.web(req,res,options);
    } else {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("unknown host");
    }
  };

  var server;
  if (_config.useSSL) {
    console.log("using ssl");
    var sslOptions = {
      key: fs.readFileSync(_config.options.key),
      cert: fs.readFileSync(_config.options.cert),
      requestCert: !!_config.options.requestCert,
      rejectUnauthorized: !!_config.options.rejectUnauthorized
    };
    if (_config.options.ca) {
      sslOptions.ca = [];
      _.forEach(_config.options.ca, (ca) => {
        sslOptions.ca.push(fs.readFileSync(ca));
      });
    }
    server = https.createServer(sslOptions, listener);
  } else {
    server = http.createServer(listener);
  }

  server.timeout = _config.timeout || 0;

  server.on("upgrade",function(req,socket,head) {
    var options = getOptions(req);
    console.log("upgrading " + req.headers.host);
    _proxy.ws(req,socket,head,options);
  });

  server.on("listening",function() {
    console.log("listening on port " + _config.port);
  });

  server.on("error",function(err) {
    console.error("server error",err);
  });

  server.listen(_config.port || 80);
};

initialiseProxy();
