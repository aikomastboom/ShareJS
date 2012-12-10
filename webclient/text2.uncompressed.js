// Generated by CoffeeScript 1.4.0
(function() {
  /**
   @const
   @type {boolean}
*/
var WEB = true;
;

  var checkOp, componentLength, exports, makeAppend, makeTake, text2, trim, type;

  exports = window['sharejs'];

  text2 = {};

  text2.name = 'text2';

  text2.create = function() {
    return '';
  };

  checkOp = function(op) {
    var c, last, _i, _len;
    if (!Array.isArray(op)) {
      throw new Error('Op must be an array of components');
    }
    last = null;
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      c = op[_i];
      switch (typeof c) {
        case 'object':
          if (!(typeof c.d === 'number' && c.d > 0)) {
            throw new Error('Object components must be deletes of size > 0');
          }
          break;
        case 'string':
          if (!(c.length > 0)) {
            throw new Error('Inserts cannot be empty');
          }
          break;
        case 'number':
          if (!(c > 0)) {
            throw new Error('Skip components must be >0');
          }
          if (typeof last === 'number') {
            throw new Error('Adjacent skip components should be combined');
          }
      }
      last = c;
    }
    if (typeof last === 'number') {
      throw new Error('Op has a trailing skip');
    }
  };

  makeAppend = function(op) {
    return function(component) {
      if (!component || component.d === 0) {

      } else if (op.length === 0) {
        return op.push(component);
      } else if (typeof component === typeof op[op.length - 1]) {
        if (typeof component === 'object') {
          return op[op.length - 1].d += component.d;
        } else {
          return op[op.length - 1] += component;
        }
      } else {
        return op.push(component);
      }
    };
  };

  makeTake = function(op) {
    var idx, offset, peekType, take;
    idx = 0;
    offset = 0;
    take = function(n, indivisableField) {
      var c, part;
      if (idx === op.length) {
        if (n === -1) {
          return null;
        } else {
          return n;
        }
      }
      c = op[idx];
      if (typeof c === 'number') {
        if (n === -1 || c - offset <= n) {
          part = c - offset;
          ++idx;
          offset = 0;
          return part;
        } else {
          offset += n;
          return n;
        }
      } else if (typeof c === 'string') {
        if (n === -1 || indivisableField === 'i' || c.length - offset <= n) {
          part = c.slice(offset);
          ++idx;
          offset = 0;
          return part;
        } else {
          part = c.slice(offset, offset + n);
          offset += n;
          return part;
        }
      } else {
        if (n === -1 || indivisableField === 'd' || c.d - offset <= n) {
          part = {
            d: c.d - offset
          };
          ++idx;
          offset = 0;
          return part;
        } else {
          offset += n;
          return {
            d: n
          };
        }
      }
    };
    peekType = function() {
      return op[idx];
    };
    return [take, peekType];
  };

  componentLength = function(c) {
    if (typeof c === 'number') {
      return c;
    } else {
      return c.length || c.d;
    }
  };

  trim = function(op) {
    if (op.length > 0 && typeof op[op.length - 1] === 'number') {
      op.pop();
    }
    return op;
  };

  text2.normalize = function(op) {
    var append, component, newOp, _i, _len;
    newOp = [];
    append = makeAppend(newOp);
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      component = op[_i];
      append(component);
    }
    return trim(newOp);
  };

  text2.apply = function(str, op) {
    var component, newDoc, pos, _i, _len;
    if (typeof str !== 'string') {
      throw new Error('Snapshot should be a string');
    }
    checkOp(op);
    pos = 0;
    newDoc = [];
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      component = op[_i];
      switch (typeof component) {
        case 'number':
          if (component > str.length) {
            throw new Error('The op is too long for this document');
          }
          newDoc.push(str.slice(0, component));
          str = str.slice(component);
          break;
        case 'string':
          newDoc.push(component);
          break;
        case 'object':
          str = str.slice(component.d);
      }
    }
    return newDoc.join('') + str;
  };

  text2.transform = function(op, otherOp, side) {
    var append, chunk, component, length, newOp, o, peek, take, _i, _len, _ref;
    if (side !== 'left' && side !== 'right') {
      throw new Error("side (" + side + ") must be 'left' or 'right'");
    }
    checkOp(op);
    checkOp(otherOp);
    newOp = [];
    append = makeAppend(newOp);
    _ref = makeTake(op), take = _ref[0], peek = _ref[1];
    for (_i = 0, _len = otherOp.length; _i < _len; _i++) {
      component = otherOp[_i];
      switch (typeof component) {
        case 'number':
          length = component;
          while (length > 0) {
            chunk = take(length, 'i');
            append(chunk);
            if (typeof chunk !== 'string') {
              length -= componentLength(chunk);
            }
          }
          break;
        case 'string':
          if (side === 'left') {
            o = peek();
            if (typeof o === 'string') {
              append(take(-1));
            }
          }
          append(component.length);
          break;
        case 'object':
          length = component.d;
          while (length > 0) {
            chunk = take(length, 'i');
            switch (typeof chunk) {
              case 'number':
                length -= chunk;
                break;
              case 'string':
                append(chunk);
                break;
              case 'object':
                length -= chunk.d;
            }
          }
      }
    }
    while ((component = take(-1))) {
      append(component);
    }
    return trim(newOp);
  };

  text2.compose = function(op1, op2) {
    var append, chunk, component, length, result, take, _, _i, _len, _ref;
    checkOp(op1);
    checkOp(op2);
    result = [];
    append = makeAppend(result);
    _ref = makeTake(op1), take = _ref[0], _ = _ref[1];
    for (_i = 0, _len = op2.length; _i < _len; _i++) {
      component = op2[_i];
      switch (typeof component) {
        case 'number':
          length = component;
          while (length > 0) {
            chunk = take(length, 'd');
            append(chunk);
            if (typeof chunk !== 'object') {
              length -= componentLength(chunk);
            }
          }
          break;
        case 'string':
          append(component);
          break;
        case 'object':
          length = component.d;
          while (length > 0) {
            chunk = take(length, 'd');
            switch (typeof chunk) {
              case 'number':
                append({
                  d: chunk
                });
                length -= chunk;
                break;
              case 'string':
                length -= chunk.length;
                break;
              case 'object':
                append(chunk);
            }
          }
      }
    }
    while ((component = take(-1))) {
      append(component);
    }
    return trim(result);
  };

  if (typeof WEB !== "undefined" && WEB !== null) {
    exports.types.text2 = text2;
  } else {
    module.exports = text2;
  }

  if (typeof WEB !== "undefined" && WEB !== null) {
    type = exports.types.text2;
  } else {
    type = require('./text2');
  }

  type.api = {
    provides: {
      text: true
    },
    getLength: function() {
      return this.snapshot.length;
    },
    getText: function() {
      return this.snapshot;
    },
    insert: function(pos, text, callback) {
      var op;
      op = type.normalize([pos, text]);
      this.submitOp(op, callback);
      return op;
    },
    del: function(pos, length, callback) {
      var op;
      op = type.normalize([
        pos, {
          d: length
        }
      ]);
      this.submitOp(op, callback);
      return op;
    },
    _register: function() {
      return this.on('remoteop', function(op, snapshot) {
        var component, pos, spos, _i, _len, _results;
        pos = spos = 0;
        _results = [];
        for (_i = 0, _len = op.length; _i < _len; _i++) {
          component = op[_i];
          switch (typeof component) {
            case 'number':
              pos += component;
              _results.push(spos += component);
              break;
            case 'string':
              this.emit('insert', pos, component);
              _results.push(pos += component.length);
              break;
            case 'object':
              this.emit('delete', pos, snapshot.slice(spos, spos + component.d));
              _results.push(spos += component.d);
              break;
            default:
              _results.push(void 0);
          }
        }
        return _results;
      });
    }
  };

}).call(this);
