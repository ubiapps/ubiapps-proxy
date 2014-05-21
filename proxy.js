var http = require("http");
var httpProxy = require("http-proxy");
var path = require("path");
var fs = require("fs");

var _configFile = "proxyConfig.json";
var _configPath = path.join(__dirname,"proxyConfig.json");
var _proxyTargets = {};
var _proxy = httpProxy.createProxyServer({});

var readConfig = function() {
  var cfg = fs.readFileSync(_configPath);
  try {
    _proxyTargets = JSON.parse(cfg);
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

  readConfig();

  var server = http.createServer(function(req,res) {
    var options = getOptions(req);
    console.log("proxying " + req.headers.host);
    _proxy.web(req,res,options);
  });

  server.on("upgrade",function(req,socket,head) {
    var options = getOptions(req);
    console.log("upgrading " + req.headers.host);
    _proxy.ws(req,socket,head,options);
  });

  server.on("listening",function() {
    console.log("listening on port 80");
  });

  server.on("error",function(err) {
    console.error("proxying error",err);
  });

  server.listen(80);
};

initialiseProxy();
