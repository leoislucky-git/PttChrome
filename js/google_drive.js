// Modified 2026-10-19: optional website-owned Google authorization and Drive v3 backups.
function GoogleDrive(app) {
  this.app = app;
  this.token = '';
  this.expires = 0;
  this.clientId = '';
  this.identity = null;
}

GoogleDrive.prototype.loadIdentity = function() {
  if (!this.identity) {
    this.identity = new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = resolve;
      script.onerror = function() { reject(new Error(i18n('drive_failed'))); };
      document.head.appendChild(script);
    });
  }
  return this.identity;
};

GoogleDrive.prototype.setupUi = function() {
  var self = this;
  ['SyncTitle', 'Authorize', 'Load', 'Save', 'SaveNew', 'SaveExisting', 'Done', 'Loading'].forEach(function(name) {
    $('#blacklist_drive' + name).text(i18n('blacklist_drive' + name));
  });
  $('#blacklist_privacyPolicy').text(i18n('blacklist_privacyPolicy'));
  $('#googleDriveHelp').text(i18n('drive_setup'));
  $('#blacklist_driveLoading, #blacklist_driveDone').hide();
  $('#blacklist_driveAuthorize').off('click').on('click', function() { self.authorize(); });
  $('#blacklist_driveLoad').off('click').on('click', function() {
    self.run(function() { return self.loadFile(); });
  });
  $('#blacklist_driveSaveNew').off('click').on('click', function() {
    self.run(function() { return self.saveFile(''); });
  });
  $('#blacklist_driveSaveExisting').off('click').on('click', function() {
    var id = $('#blacklist_driveFiles').val();
    if (!id) return window.alert(i18n('drive_selectFile'));
    self.run(function() { return self.saveFile(id); });
  });
  $('#opt_googleDriveClientId input').off('change').on('change', function() {
    self.token = '';
    self.expires = 0;
    self.loadIdentity().catch(function() { self.identity = null; });
  });
  if (this.app.pref.values.googleDriveClientId) {
    this.loadIdentity().catch(function() { self.identity = null; });
  }
};

GoogleDrive.prototype.authorize = function() {
  var self = this;
  var clientId = $('#opt_googleDriveClientId input').val().trim();
  if (!clientId) return window.alert(i18n('drive_setup'));
  if (!window.google || !window.google.accounts) {
    this.loadIdentity().then(function() {
      window.alert(i18n('drive_ready'));
    }).catch(function(error) { self.identity = null; window.alert(error.message); });
    return;
  }
  var client = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: function(response) {
      if (!response.access_token) return window.alert(i18n('drive_failed'));
      self.token = response.access_token;
      self.clientId = clientId;
      self.expires = Date.now() + Number(response.expires_in) * 1000 - 30000;
      self.run(function() { return self.listFiles(); });
    },
    error_callback: function() { window.alert(i18n('drive_failed')); }
  });
  client.requestAccessToken();
};

GoogleDrive.prototype.request = function(url, options) {
  var self = this;
  if (!this.token || Date.now() >= this.expires || this.clientId !== $('#opt_googleDriveClientId input').val().trim()) {
    return Promise.reject(new Error(i18n('drive_authorizeFirst')));
  }
  options = options || {};
  options.headers = options.headers || {};
  options.headers.Authorization = 'Bearer ' + this.token;
  return fetch(url, options).then(function(response) {
    if (!response.ok) {
      if (response.status === 401) { self.token = ''; self.expires = 0; }
      throw new Error(i18n('drive_failed'));
    }
    return response;
  });
};

GoogleDrive.prototype.run = function(action) {
  $('#blacklist_driveDone').hide();
  $('#blacklist_driveLoading').show();
  Promise.resolve().then(action).then(function() {
    $('#blacklist_driveLoading').hide();
    $('#blacklist_driveDone').show();
  }).catch(function(error) {
    $('#blacklist_driveLoading').hide();
    window.alert(error.message);
  });
};

GoogleDrive.prototype.listFiles = function() {
  var self = this;
  var query = "trashed = false and (mimeType = 'text/plain' or mimeType = 'application/vnd.google-apps.document')";
  var files = [];
  function page(token) {
    var url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(query) +
      '&fields=nextPageToken,files(id,name,mimeType)&pageSize=100';
    if (token) url += '&pageToken=' + encodeURIComponent(token);
    return self.request(url).then(function(response) { return response.json(); }).then(function(result) {
      files = files.concat(result.files || []);
      if (result.nextPageToken) return page(result.nextPageToken);
      var select = $('#blacklist_driveFiles').empty();
      select.append($('<option>').val('').text(i18n('drive_selectFile')));
      files.forEach(function(file) {
        select.append($('<option>').val(file.id).text(file.name).attr('data-mime', file.mimeType));
      });
    });
  }
  return page('');
};

GoogleDrive.prototype.loadFile = function() {
  var id = $('#blacklist_driveFiles').val();
  if (!id) return Promise.reject(new Error(i18n('drive_selectFile')));
  var type = $('#blacklist_driveFiles option:selected').attr('data-mime');
  var url = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) +
    (type === 'application/vnd.google-apps.document' ? '/export?mimeType=text/plain' : '?alt=media');
  var self = this;
  return this.request(url).then(function(response) { return response.text(); }).then(function(text) {
    $('#opt_blacklistedUsers').val(text);
    self.app.pref.readBlacklistValues();
    self.app.pref.setBlacklistStorage();
    self.app.pref.refreshBlacklistOnUi();
  });
};

GoogleDrive.prototype.saveFile = function(id) {
  this.app.pref.readBlacklistValues();
  var text = Object.keys(this.app.pref.blacklistedUserIds).join('\n');
  var boundary = 'pttchrome_' + Date.now();
  var body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify({ name: 'PttChrome blacklist', mimeType: 'text/plain' }) +
    '\r\n--' + boundary + '\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n' +
    text + '\r\n--' + boundary + '--';
  var self = this;
  return this.request('https://www.googleapis.com/upload/drive/v3/files' + (id ? '/' + encodeURIComponent(id) : '') +
    '?uploadType=' + (id ? 'media' : 'multipart'), {
      method: id ? 'PATCH' : 'POST',
      body: id ? text : body,
      headers: { 'Content-Type': id ? 'text/plain; charset=UTF-8' : 'multipart/related; boundary=' + boundary }
    }).then(function() { return self.listFiles(); });
};
