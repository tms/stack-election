/**
 * jQuery.fn.sortElements
 *
 * Element sorting with jQuery
 * http://james.padolsey.com/javascript/sorting-elements-with-jquery/
 **/

jQuery.fn.sortElements=(function(){var e=[].sort;return function(b,c){c=c||function(){return this};var d=this.map(function(){var a=c.call(this),parentNode=a.parentNode,nextSibling=parentNode.insertBefore(document.createTextNode(''),a.nextSibling);return function(){if(parentNode===this){throw new Error("You can't sort elements if any one is a descendant of another.");}parentNode.insertBefore(this,nextSibling);parentNode.removeChild(nextSibling)}});return e.call(this,b).each(function(i){d[i].call(c.call(this))})}})();

/*
 * timeago: a jQuery plugin, version: 0.9.3 (2011-01-21)
 * @requires jQuery v1.2.3 or later
 *
 * Licensed under the MIT:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * Copyright (c) 2008-2011, Ryan McGeary (ryanonjavascript -[at]- mcgeary [*dot*] org)
 */
(function($){$.timeago=function(a){if(a instanceof Date){return inWords(a)}else if(typeof a==="string"){return inWords($.timeago.parse(a))}else{return inWords($.timeago.datetime(a))}};var o=$.timeago;$.extend($.timeago,{settings:{refreshMillis:60000,allowFuture:false,strings:{prefixAgo:null,prefixFromNow:null,suffixAgo:"",suffixFromNow:"from now",seconds:"less than a minute",minute:"a min",minutes:"%d mins",hour:"an hr",hours:"%d hrs",day:"a day",days:"%d days",month:"a month",months:"%d months",year:"about a year",years:"%d years",numbers:[]}},inWords:function(e){var f=this.settings.strings;var g=f.prefixAgo;var h=f.suffixAgo;if(this.settings.allowFuture){if(e<0){g=f.prefixFromNow;h=f.suffixFromNow}e=Math.abs(e)}var i=e/1000;var j=i/60;var k=j/60;var l=k/24;var m=l/365;function substitute(a,b){var c=$.isFunction(a)?a(b,e):a;var d=(f.numbers&&f.numbers[b])||b;return c.replace(/%d/i,d)}var n=i<45&&substitute(f.seconds,Math.round(i))||i<90&&substitute(f.minute,1)||j<45&&substitute(f.minutes,Math.round(j))||j<90&&substitute(f.hour,1)||k<24&&substitute(f.hours,Math.round(k))||k<48&&substitute(f.day,1)||l<30&&substitute(f.days,Math.floor(l))||l<60&&substitute(f.month,1)||l<365&&substitute(f.months,Math.floor(l/30))||m<2&&substitute(f.year,1)||substitute(f.years,Math.floor(m));return $.trim([g,n,h].join(" "))},parse:function(a){var s=$.trim(a);s=s.replace(/\.\d\d\d+/,"");s=s.replace(/-/,"/").replace(/-/,"/");s=s.replace(/T/," ").replace(/Z/," UTC");s=s.replace(/([\+\-]\d\d)\:?(\d\d)/," $1$2");return new Date(s)},datetime:function(a){var b=$(a).get(0).tagName.toLowerCase()==="time";var c=b?$(a).attr("datetime"):$(a).attr("title");return o.parse(c)}});$.fn.timeago=function(){var a=this;a.each(refresh);var b=o.settings;if(b.refreshMillis>0){setInterval(function(){a.each(refresh)},b.refreshMillis)}return a};function refresh(){var a=prepareData(this);if(!isNaN(a.datetime)){$(this).text(inWords(a.datetime))}return this}function prepareData(a){a=$(a);if(!a.data("timeago")){a.data("timeago",{datetime:o.datetime(a)});var b=$.trim(a.text());if(b.length>0){a.attr("title",b)}}return a.data("timeago")}function inWords(a){return o.inWords(distance(a))}function distance(a){return(new Date().getTime()-a.getTime())}document.createElement("abbr");document.createElement("time")}(jQuery));
