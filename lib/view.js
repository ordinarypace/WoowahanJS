'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/*global $ _*/

var Debug = require('debug');
var format = require('util').format;
var Backbone = require('backbone');

var PluginText = require('./plugin/text');
var PluginInputText = require('./plugin/input-text');
var PluginCheckbox = require('./plugin/checkbox');
var PluginSelect = require('./plugin/select');

var delegateEventSplitter = /^(\S+)\s*(.*)$/;
var childEventSplitter = /^\@(\w+)\s*(.*)$/;
var DEFAULT_ATTR_TYPE = 'text';

var View = void 0;
var viewMount = void 0;
var app = void 0;

viewMount = function viewMount() {
  var tagName = this.tagName;
  var renderData = this.getModel();
  var container = this.container;
  var template = this.template;
  var domStr = void 0;
  var $dom = void 0;

  if (!container) {
    throw '[' + this.viewname + '] Required attribute "container" is missing.';
  } else {
    if (typeof container === 'string') {
      container = $(container);
    }
  }

  if (!container || !container.length) {
    throw '[' + this.viewname + '] "container" is undefined.';
  }

  if (typeof this.viewWillMount === 'function') {
    renderData = this.viewWillMount(renderData) || renderData;
  }

  if (!!template) {
    if (typeof template === 'string') {
      domStr = template;
    } else {
      domStr = template(renderData);
    }

    if (tagName === 'div') {
      var proto = this;

      tagName = '';

      do {
        if (proto.hasOwnProperty('tagName') && !!proto.tagName) {
          tagName = proto.tagName;
          break;
        }
      } while ((proto = proto.__proto__) && proto.viewname !== '___WOOWA_VIEW___');
    }

    if (!!tagName || $(domStr).length > 1) {
      $dom = $('<' + (tagName || 'div') + '>' + domStr + '</' + (tagName || 'div') + '>');
    } else {
      $dom = $(domStr);
    }

    if (!!this.className) {
      $dom.addClass(this.className);
    }

    if (!!this._viewMounted) {
      if ($.contains(container[0], this.el)) {
        this.$el.replaceWith($dom);
      } else {
        container.html($dom);
      }
    } else {
      if (!!this.append) {
        container.append($dom);
      } else {
        container.html($dom);
      }
    }

    this.setElement($dom);
  } else {
    this.setElement(container);
  }

  this._viewMounted = true;
  this._bindModel();

  if (typeof this.viewDidMount === 'function') {
    this.viewDidMount($dom);
  }

  _.delay(_.bind(function () {
    this.trigger('viewDidMount');
  }, this), 1);
};

View = Backbone.View.extend({
  super: function _super() {
    View.prototype.initialize.apply(this, arguments);
  },
  initialize: function initialize(model) {
    this._viewMounted = false;
    this._views = {};
    this.debug = Debug('View:' + this.viewname);

    if (!!model) {
      this.setModel(model);
    }

    viewMount.apply(this);
  },


  _plugins: {
    'text': PluginText,
    'input-text': PluginInputText,
    'checkbox': PluginCheckbox,
    'select': PluginSelect
  },

  delegateEvents: function delegateEvents(events) {
    events || (events = _.result(this, 'events'));

    if (!events) return this;

    this.undelegateEvents();

    for (var key in events) {
      var method = events[key];
      var match = key.match(delegateEventSplitter);
      var childMatch = key.match(childEventSplitter);
      var eventName = void 0;
      var selector = void 0;
      var listener = void 0;

      if (!!childMatch) {
        var index = _.indexOf(method, '(');

        var params = [];

        eventName = childMatch[1];
        selector = childMatch[2];

        if (!!~index) {
          params = method.substring(index + 1, method.length - 1).split(',').map(function (el) {
            return $.trim(el);
          });
          method = method.substring(0, index);
        }

        listener = _.bind(function (eventName, selector, method, params, event) {
          var _this = this;

          var getVal = function getVal($el) {
            if ($el.is('input[type=checkbox]') || $el.is('input[type=radio]')) {
              return $el.is(':checked');
            } else {
              return $el.val();
            }
          };

          var values = _.map(params, function (param) {
            var $el = _this.$(param);

            return getVal($el);
          });

          if (eventName === 'submit') {
            (function () {
              var inputs = {};

              _.each(_this.$(selector).find('input, select, textarea'), function (el) {
                inputs[$(el).attr('name')] = getVal($(el));
              });

              values.push(inputs);
            })();
          }

          if (!_.isFunction(method)) method = this[method];

          for (var _len = arguments.length, args = Array(_len > 5 ? _len - 5 : 0), _key = 5; _key < _len; _key++) {
            args[_key - 5] = arguments[_key];
          }

          return method.apply(this, _.concat(values, args, event));
        }, this, eventName, selector, method, params);
      } else {
        if (!_.isFunction(method)) method = this[method];
        if (!method) continue;

        eventName = match[1];
        selector = match[2];
        listener = _.bind(method, this);
      }

      this.delegate(eventName, selector, listener);
    }

    return this;
  },
  updateView: function updateView(container, ChildView) {
    for (var _len2 = arguments.length, args = Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {
      args[_key2 - 2] = arguments[_key2];
    }

    if (!arguments.length) {
      this.close(false);

      viewMount.apply(this);

      return;
    }

    if (!!container && !ChildView) {
      this._views[container].close();

      delete this._views[container];

      return;
    }

    if (typeof ChildView != 'function') {
      args = ChildView;
    }

    if (!!this._views[container]) {
      this._views[container].setModel.apply(this._views[container], _.concat(args, { silent: true }));
      this._views[container].container = typeof container === 'string' ? this.$(container) : container;

      viewMount.apply(this._views[container]);
    } else {
      ChildView.prototype.container = typeof container === 'string' ? this.$(container) : container;

      var view = new (Function.prototype.bind.apply(ChildView, _.concat(ChildView, args)))();

      this._views[container] = view;
    }

    return this._views[container];
  },
  addView: function addView(container, ChildView) {
    for (var _len3 = arguments.length, args = Array(_len3 > 2 ? _len3 - 2 : 0), _key3 = 2; _key3 < _len3; _key3++) {
      args[_key3 - 2] = arguments[_key3];
    }

    return this.updateView.apply(this, [container, ChildView].concat(args));
  },
  removeView: function removeView(container) {
    this.updateView(container);
  },
  getStates: function getStates() {
    return app.getStates();
  },
  getComponent: function getComponent(name) {
    return app.getComponent(name).extend({});
  },
  dispatch: function dispatch(action, subscriber, options) {
    var _$el;

    action.__options = options || {};

    switch (action.wwtype) {
      case 'event':
        (_$el = this.$el).trigger.apply(_$el, [action.type].concat(_toConsumableArray(action.data)));
        break;
      case 'action':
        app.dispatch(action, _.bind(subscriber, this));
        break;
    }
  },
  setModel: function setModel(attrs) {
    if (attrs instanceof Backbone.Model) {
      if (!!this.model) {
        this._unbindModel();
      }

      this.model = attrs.clone();

      if (this._viewMounted) {
        this._bindModel();
      }
      return;
    }

    if (_.isNull(attrs) || !this.model || !(this.model instanceof Backbone.Model)) {
      this.model = new Backbone.Model();

      if (this._viewMounted) {
        this._bindModel();
      }
    }

    for (var attr in attrs) {
      var value = this.model.get(attr);

      if (value !== attrs[attr]) {
        this.model.set(attr, attrs[attr]);
      }
    }
  },
  getModel: function getModel(key) {
    if (!this.model || !(this.model instanceof Backbone.Model)) {
      this.model = new Backbone.Model();
    }

    if (!key) {
      return _.cloneDeep(this.model.toJSON());
    }

    return _.cloneDeep(this.model.get(key));
  },
  log: function log() {
    this.debug(format.apply(this, arguments));
  },
  logStamp: function logStamp() {
    this.log(arguments);
  },
  close: function close(remove) {
    if (typeof this.viewWillUnmount === 'function') {
      this.viewWillUnmount();
    }

    this._unbindModel();
    this._removeChild();

    if (remove + '' != 'false' && !!this) {
      this.remove();
    }
  },
  _bindModel: function _bindModel() {
    this._unbindModel();

    var targetElements = this.$el.find('[data-role=bind]');

    _.each(targetElements, _.bind(function (element) {
      var key = $(element).data('name');
      var eventName = 'change:' + key;
      this.listenTo(this.model, eventName, _.bind(function (element, key) {
        var value = this.model.get(key);
        var type = ($(element).data('type') || DEFAULT_ATTR_TYPE).toLowerCase();
        this._plugins[type].call(this, element, value);
      }, this, element, key));
    }, this));
  },
  _unbindModel: function _unbindModel() {
    this.stopListening(this.model);
  },
  _removeChild: function _removeChild() {
    for (var key in this._views) {
      this._views[key].close.call(this._views[key]);
      delete this._views[key];
    }
  }
});

View.create = function (viewName, options) {
  var view = View.extend(options);

  view.viewname = viewName;
  Object.defineProperty(view.prototype, 'viewname', { value: viewName, writable: false });

  return view;
};

module.exports = function (toolset) {
  if (!app) {
    app = toolset;
  }

  return View;
};