// Modified 2026-10-19: preferences belong to this website, not a Chrome App.
function BrowserStorage() {
  this.key = 'pttchrome.preferences.v1';
  this.data = { values: {}, logins: { u: '', p: '' } };
  this.failed = false;
  try {
    var stored = window.localStorage.getItem(this.key);
    if (stored) {
      var parsed = JSON.parse(stored);
      if (parsed && typeof parsed.values === 'object' && parsed.values !== null) {
        for (var name in DEFAULT_PREFS) {
          if (Object.prototype.hasOwnProperty.call(parsed.values, name)) {
            this.data.values[name] = parsed.values[name];
          }
        }
        if (parsed.logins && typeof parsed.logins.u === 'string' && typeof parsed.logins.p === 'string') {
          this.data.logins = parsed.logins;
        }
      }
    }
  } catch (error) {
    this.reportFailure();
  }
}

BrowserStorage.prototype.reportFailure = function() {
  if (!this.failed) window.alert(i18n('storage_failed'));
  this.failed = true;
};

BrowserStorage.prototype.get = function() {
  var values = {};
  for (var name in DEFAULT_PREFS) {
    var value = this.data.values[name];
    values[name] = typeof value === typeof DEFAULT_PREFS[name] ? value : DEFAULT_PREFS[name];
  }
  // Validate the structured preferences before the settings UI consumes them.
  ['blacklistedUserIds', 'quickSearchList'].forEach(function(name) {
    try {
      var parsed = JSON.parse(values[name]);
      if (!parsed || typeof parsed !== 'object' ||
          (name === 'quickSearchList' && (!Array.isArray(parsed) || parsed.some(function(item) {
            return !item || typeof item.name !== 'string' || typeof item.url !== 'string';
          }))) || (name === 'blacklistedUserIds' && Array.isArray(parsed))) {
        values[name] = DEFAULT_PREFS[name];
      }
    } catch (error) {
      values[name] = DEFAULT_PREFS[name];
    }
  });
  return { values: values, logins: { u: this.data.logins.u, p: this.data.logins.p } };
};

BrowserStorage.prototype.set = function(items) {
  for (var name in items.values) {
    if (Object.prototype.hasOwnProperty.call(DEFAULT_PREFS, name)) this.data.values[name] = items.values[name];
  }
  if (items.logins) this.data.logins = { u: items.logins.u, p: items.logins.p };
  try {
    window.localStorage.setItem(this.key, JSON.stringify(this.data));
  } catch (error) {
    this.reportFailure();
  }
};

BrowserStorage.prototype.clear = function() {
  this.data = { values: {}, logins: { u: '', p: '' } };
  try {
    window.localStorage.removeItem(this.key);
  } catch (error) {
    this.reportFailure();
  }
};
