// Shared image URL resolution, bounded preloading, and visibility-based loading.
// Inspired by ptt/ptt-term's media previewer (GPL-2.0).
lib.ImagePreview = function() {
  this.cache = new Map();
  this.pendingElements = new Map();
  var self = this;
  this.observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      var load = self.pendingElements.get(entry.target);
      self.observer.unobserve(entry.target);
      self.pendingElements.delete(entry.target);
      if (entry.target.isConnected && load) load();
    });
  }, { rootMargin: '300px' });
};

lib.ImagePreview.resolve = function(href) {
  var url;
  try { url = new URL(href); } catch (error) { return null; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  var host = url.hostname.toLowerCase();
  if (/^(?:www\.|m\.|i\.)?imgur\.com$/.test(host)) {
    var album = /^\/(?:a|gallery)\/([a-z0-9]+)\/?$/i.exec(url.pathname);
    if (album) return { albumId: album[1] };
    var image = /^\/([a-z0-9]+)(\.(?:jpe?g|png|gif|webp|bmp))?\/?$/i.exec(url.pathname);
    if (!image) return null;
    return { src: 'https://i.imgur.com/' + image[1] + (image[2] || '.jpg') + url.search };
  }
  if (/\.(?:jpe?g|png|gif|webp|bmp)$/i.test(url.pathname) ||
      (host === 'pbs.twimg.com' && /^\/media\//.test(url.pathname) && /^(?:jpe?g|png|gif|webp)$/i.test(url.searchParams.get('format') || ''))) {
    return { src: url.href };
  }
  if (host === 'ppt.cc' && /^\/[a-z0-9]+$/i.test(url.pathname)) {
    return { src: 'https://ppt.cc' + url.pathname + '@.jpg' };
  }
  return null;
};

lib.ImagePreview.prototype.load = function(src) {
  if (this.cache.has(src)) return this.cache.get(src);
  var self = this;
  var promise = new Promise(function(resolve, reject) {
    var img = new Image();
    var timer = window.setTimeout(function() { finish(false); }, 10000);
    var finish = function(success) {
      window.clearTimeout(timer);
      img.onload = img.onerror = null;
      if (success) resolve(img);
      else {
        img.removeAttribute('src');
        reject(new Error('Image unavailable'));
      }
    };
    img.referrerPolicy = 'no-referrer';
    img.onload = function() { finish(true); };
    img.onerror = function() { finish(false); };
    img.src = src;
  });
  this.cache.set(src, promise);
  if (this.cache.size > 100) this.cache.delete(this.cache.keys().next().value);
  promise.catch(function() {
    if (self.cache.get(src) === promise) self.cache.delete(src);
  });
  return promise;
};

lib.ImagePreview.prototype.whenVisible = function(element, load) {
  if (!this.observer) { load(); return; }
  this.pendingElements.set(element, load);
  this.observer.observe(element);
};

lib.ImagePreview.prototype.prune = function() {
  var self = this;
  this.pendingElements.forEach(function(load, element) {
    if (!element.isConnected) {
      self.observer.unobserve(element);
      self.pendingElements.delete(element);
    }
  });
};
