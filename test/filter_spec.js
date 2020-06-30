/* jshint globalstrict: true */
/* global filter: false, register: false, parse: false */
"use strict";

import { register, filter } from "../src/filter";
import { parse } from "../src/parse";

describe("filter", () => {
  it("can be registered and obtained", () => {
    const myFilter = function() {};
    const myFilterFactory = function() {
      return myFilter;
    };
    register("my", myFilterFactory);
    expect(filter("my")).toBe(myFilter);
  });

  it("allows registering multiple filters with an object", () => {
    const myFilter = function() {};
    const myOtherFilter = function() {};
    register({
      my: function() {
        return myFilter;
      },
      myOther: function() {
        return myOtherFilter;
      }
    });
    expect(filter("my")).toBe(myFilter);
    expect(filter("myOther")).toBe(myOtherFilter);
  });

  xit("can parse filter expressions", () => {
    register("upcase", function() {
      return function(str) {
        return str.toUpperCase();
      };
    });
    const fn = parse("aString | upcase");
    expect(fn({ aString: "Hello" })).toEqual("HELLO");
  });

  xit("can parse filter chain expressions", () => {
    register("upcase", function() {
      return function(s) {
        return s.toUpperCase();
      };
    });
    register("exclamate", function() {
      return function(s) {
        return s + "!";
      };
    });
    const fn = parse('"hello" | upcase | exclamate');
    expect(fn()).toEqual("HELLO!");
  });

  xit("can pass an additional argument to filters", () => {
    register("repeat", function() {
      return function(s, times) {
        return _.repeat(s, times);
      };
    });
    const fn = parse('"hello" | repeat:3');
    expect(fn()).toEqual("hellohellohello");
  });

  xit("can pass several additional arguments to filters", () => {
    register("surround", function() {
      return function(s, left, right) {
        return left + s + right;
      };
    });
    const fn = parse('"hello" | surround:"*":"!"');
    expect(fn()).toEqual('*hello!');
  });
});
