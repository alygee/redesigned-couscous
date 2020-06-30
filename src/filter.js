import _ from 'lodash';

const filters = {};

export function register(name, factory) {
  if (_.isObject(name)) {
    return _.map(name, function(factory, name) {
      return register(name, factory);
    });
  } else {
    const filter = factory();
    filters[name] = filter;
    return filter;
  }
}

export function filter(name) {
  return filters[name];
}
