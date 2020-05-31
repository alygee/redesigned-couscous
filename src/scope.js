/* jshint globalstrict: true */
'use strict';

const _ = require('lodash');

function Scope() {
  this.$$watchers = [];
  this.$$lastDirtyWatch = null;
  this.$$asyncQueue = [];
  this.$$applyAsyncQueue = [];
  this.$$applyAsyncId = null;
  this.$$phase = null;
  this.$$postDigestQueue = [];
}

function initWatchVal() {}

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
  const watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function () {},
    valueEq: !!valueEq,
    last: initWatchVal
  };
  this.$$watchers.unshift(watcher);
  this.$$lastDirtyWatch = 'null';
  return () => {
    const index = this.$$watchers.indexOf(watcher);
    if (index >= 0) {
      this.$$watchers.splice(index, 1);
      this.$$lastDirtyWatch = null;
    }
  };
};

Scope.prototype.$eval = function(expr, locals) {
  return expr(this, locals);
};

Scope.prototype.$apply = function(expr) {
  try {
    this.$beginPhase('$apply');
    return this.$eval(expr);
  } finally {
    this.$clearPhase();
    this.$digest();
  }
};

Scope.prototype.$evalAsync = function(expr) {
  if (!this.$$phase && !this.$$asyncQueue.length) {
    setTimeout(() => {
      if (this.$$asyncQueue.length) {
        this.$digest();
      }
    }, 0);
  }
  this.$$asyncQueue.push({ scope: this, expression: expr });
};

Scope.prototype.$$flushApplyAsync = function() {
  while(this.$$applyAsyncQueue.length) {
    try {
      this.$$applyAsyncQueue.shift()();
    } catch (e) {
      console.error(e);
    }
  }
  this.$$applyAsyncId = null;
};

Scope.prototype.$applyAsync = function(expr) {
  this.$$applyAsyncQueue.push(() => {
    this.$eval(expr);
  });
  if (this.$$applyAsyncId === null) {
    this.$$applyAsyncId = setTimeout(() => {
      this.$apply(_.bind(this.$$flushApplyAsync, this));
    }, 0);
  }
};

Scope.prototype.$$areEqual = function (newValue, oldValue, valueEq) {
  if (valueEq) {
    return _.isEqual(newValue, oldValue);
  } else {
    return newValue === oldValue ||
      (typeof newValue === 'number' && typeof oldValue === 'number' && isNaN(newValue) && isNaN(oldValue));
  }
};

Scope.prototype.$beginPhase = function(phase) {
  if (this.$$phase) {
    throw this.$$phase + ' already in progress.';
  }
  this.$$phase = phase;
};

Scope.prototype.$clearPhase = function () {
  this.$$phase = null;
};

Scope.prototype.$$digestOnce = function () {
  const self = this;
  let newValue, oldValue, dirty;

  _.forEachRight(this.$$watchers, function (watcher) {
    try {
      if (watcher) {
        newValue  = watcher.watchFn(self);
        oldValue = watcher.last;

        if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
          self.$$lastDirtyWatch = watcher;
          watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
          watcher.listenerFn(newValue, (oldValue === initWatchVal ? newValue : oldValue), self);
          dirty = true;
        } else if (self.$$lastDirtyWatch === watcher) {
          return false;
        }
      }
    } catch (e) {
      console.error(e);
    }
  });

  return dirty;
};

Scope.prototype.$digest = function() {
  let ttl = 10;
  let dirty;
  this.$$lastDirtyWatch = null;
  this.$beginPhase('$digest');

  if (this.$$applyAsyncId) {
    clearTimeout(this.$$applyAsyncId);
    this.$$flushApplyAsync();
  }

  do {
    while (this.$$asyncQueue.length) {
      try {
        const asyncTask = this.$$asyncQueue.shift();
        asyncTask.scope.$eval(asyncTask.expression);
      } catch (e) {
        console.error(e);
      }
    }
    dirty = this.$$digestOnce();
    if ((dirty || this.$$asyncQueue.length) && !(ttl--)) {
      this.$clearPhase();
      throw "10 digest iterations reached";
    }
  } while (dirty || this.$$asyncQueue.length);
  this.$clearPhase();

  while(this.$$postDigestQueue.length) {
    try {
      this.$$postDigestQueue.shift()();
    } catch (e) {
      console.error(e);
    }
  }
};

Scope.prototype.$$postDigest = function(fn) {
  this.$$postDigestQueue.push(fn);
};

Scope.prototype.$watchGroup = function(watchFns, listenerFn) {
  const self = this;
  const newValues = new Array(watchFns.length);
  const oldValues = new Array(watchFns.length);
  let changeReactionScheduled = false;
  let firstRun = true;

  if (watchFns.length === 0) {
    let shouldCall = true;
    this.$evalAsync(function() {
      if (shouldCall) {
        listenerFn(newValues, oldValues, self);
      }
    });
    return function() {
      shouldCall = false;
    };
  }

  function watchGroupListener() {
    if (firstRun) {
      firstRun = false;
      listenerFn(newValues, newValues, self);
    } else {
      listenerFn(newValues, oldValues, self);
    }
    changeReactionScheduled = false;
  }

  const destroyFunctions = _.map(watchFns, (watchFn, i) => {
    return this.$watch(watchFn, (newValue, oldValue) => {
      newValues[i] = newValue;
      oldValues[i] = oldValue;
      if (!changeReactionScheduled) {
        changeReactionScheduled = true;
        this.$evalAsync(watchGroupListener);
      }
    });
  });

  return function() {
    _.forEach(destroyFunctions, function(destroyFunction) {
      destroyFunction();
    });
  };
};

module.exports = Scope;
