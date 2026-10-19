// Modified 2026-10-19: standalone binary WebSocket transport.
var lib = {};

lib.WebSocketConnection = function(callbacks) {
  this.callbacks = callbacks;
  this.socket = null;
  this.timeout = null;
};

lib.WebSocketConnection.resolveUrl = function(site) {
  var sites = {
    'ptt.cc': 'wss://ws.ptt.cc/bbs',
    'ptt2.cc': 'wss://ws.ptt2.cc/bbs'
  };
  var host = site.replace(/:(23|22|443)$/, '').toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(sites, host)) {
    throw new Error(i18n('connection_invalidSite'));
  }
  return sites[host];
};

lib.WebSocketConnection.prototype.connect = function(url) {
  this.disconnect();
  var self = this;
  var socket;
  var startedAt = Date.now();
  var opened = false;
  var cause = 'closed';
  var closeInfo = function(event) {
    return {
      endpoint: url,
      phase: opened ? 'connected' : 'connecting',
      cause: cause,
      code: event ? event.code : null,
      wasClean: event ? event.wasClean : null,
      hidden: document.hidden,
      time: new Date().toISOString(),
      elapsedSeconds: Math.round((Date.now() - startedAt) / 1000)
    };
  };
  try {
    socket = new WebSocket(url);
  } catch (error) {
    cause = 'creation_failed';
    self.callbacks.close(closeInfo());
    return;
  }
  this.socket = socket;
  socket.binaryType = 'arraybuffer';
  this.timeout = window.setTimeout(function() {
    if (self.socket === socket && socket.readyState === WebSocket.CONNECTING) {
      cause = 'timeout';
      socket.close();
    }
  }, 15000);
  socket.onopen = function() {
    if (self.socket !== socket) return;
    window.clearTimeout(self.timeout);
    opened = true;
    self.callbacks.open();
  };
  socket.onmessage = function(event) {
    if (self.socket !== socket) return;
    var data = event.data;
    if (data instanceof ArrayBuffer) {
      var bytes = new Uint8Array(data);
      var chunks = [];
      for (var i = 0; i < bytes.length; i += 8192) {
        chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)));
      }
      data = chunks.join('');
    }
    self.callbacks.data(data);
  };
  socket.onerror = function() {
    if (self.socket === socket && cause !== 'timeout') cause = 'network_error';
  };
  socket.onclose = function(event) {
    if (self.socket !== socket) return;
    window.clearTimeout(self.timeout);
    self.socket = null;
    self.callbacks.close(closeInfo(event));
  };
};

lib.WebSocketConnection.prototype.send = function(str) {
  if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
  // Keep the original client's paste chunk size and Big5 byte values.
  for (var offset = 0; offset < str.length; offset += 1000) {
    var chunk = str.substring(offset, offset + 1000);
    var bytes = new Uint8Array(chunk.length);
    for (var i = 0; i < chunk.length; ++i) bytes[i] = chunk.charCodeAt(i);
    this.socket.send(bytes.buffer);
  }
};

lib.WebSocketConnection.prototype.disconnect = function() {
  window.clearTimeout(this.timeout);
  if (!this.socket) return;
  var socket = this.socket;
  this.socket = null;
  socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
  socket.close();
};
