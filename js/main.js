// Modified 2026-10-19: initialize without a browser extension.
$(document).ready(function() {
  var site = getQueryVariable('site') || 'ptt.cc';
  setupI18n();
  pttchrome.app = new pttchrome.App(function(app) {
    $('#BBSWindow').show();
    app.onWindowResize();
    app.setInputAreaFocus();
    app.connect(site);
  });
});

function setTimer(repeat, func, timelimit) {
  if(repeat) {
	  return {
		  timer: setInterval(func, timelimit),
		  cancel: function() {
			  clearInterval(this.timer);
		  }
	  };
  } else {
	  return {
		  timer: setTimeout(func, timelimit),
		  cancel: function() {
			  clearTimeout(this.timer);
		  }
	  };
  }
}

function getQueryVariable(variable) {
  return new URLSearchParams(window.location.search).get(variable);
}

function dumpLog(type, string) {
	switch(type){
		case DUMP_TYPE_LOG: 	 console.log(string); break;
		case DUMP_TYPE_WARN: 	 console.warn(string); break;
		case DUMP_TYPE_ERROR: 	 console.error(string); break;
		default: console.log(string); break;
	}
}

