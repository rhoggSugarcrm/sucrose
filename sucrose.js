/*
 * Copyright (c) 2016 SugarCRM Inc. Licensed by SugarCRM under the Apache 2.0 license.
 */
(function(){

var sucrose = window.sucrose || {};

sucrose.version = '0.0.1a';
sucrose.dev = false; //set false when in production

window.sucrose = sucrose;

sucrose.tooltip = {}; // For the tooltip system
sucrose.utils = {}; // Utility subsystem
sucrose.models = {}; //stores all the possible models/components
sucrose.charts = {}; //stores all the ready to use charts
sucrose.graphs = []; //stores all the graphs currently on the page
sucrose.logs = {}; //stores some statistics and potential error messages

sucrose.dispatch = d3.dispatch('render_start', 'render_end');

// *************************************************************************
//  Development render timers - disabled if dev = false

if (sucrose.dev) {
  sucrose.dispatch.on('render_start', function(e) {
    sucrose.logs.startTime = +new Date();
  });

  sucrose.dispatch.on('render_end', function(e) {
    sucrose.logs.endTime = +new Date();
    sucrose.logs.totalTime = sucrose.logs.endTime - sucrose.logs.startTime;
    sucrose.log('total', sucrose.logs.totalTime); // used for development, to keep track of graph generation times
  });
}

// ********************************************
//  Public Core NV functions

// Logs all arguments, and returns the last so you can test things in place
sucrose.log = function() {
  if (sucrose.dev && console.log && console.log.apply)
    console.log.apply(console, arguments)
  else if (sucrose.dev && console.log && Function.prototype.bind) {
    var log = Function.prototype.bind.call(console.log, console);
    log.apply(console, arguments);
  }
  return arguments[arguments.length - 1];
};


sucrose.render = function render(step) {
  step = step || 1; // number of graphs to generate in each timeout loop

  sucrose.render.active = true;
  sucrose.dispatch.call('render_start', this);

  setTimeout(function() {
    var chart, graph;

    for (var i = 0; i < step && (graph = sucrose.render.queue[i]); i++) {
      chart = graph.generate();
      if (typeof graph.callback == typeof(Function)) graph.callback(chart);
      sucrose.graphs.push(chart);
    }

    sucrose.render.queue.splice(0, i);

    if (sucrose.render.queue.length) setTimeout(arguments.callee, 0);
    else { sucrose.render.active = false; sucrose.dispatch.call('render_end', this); }
  }, 0);
};

sucrose.render.active = false;
sucrose.render.queue = [];

sucrose.addGraph = function(obj) {
  if (typeof arguments[0] === typeof(Function))
    obj = {generate: arguments[0], callback: arguments[1]};

  sucrose.render.queue.push(obj);

  if (!sucrose.render.active) sucrose.render();
};

sucrose.strip = function(s) { return s.replace(/(\s|&)/g,''); };

sucrose.identity = function(d) { return d; };

sucrose.functor = function functor(v) {
  return typeof v === "function" ? v : function() {
    return v;
  };
};

sucrose.daysInMonth = function(month, year) {
  return (new Date(year, month+1, 0)).getDate();
};


/*****
 * A no frills tooltip implementation.
 *****/
// REFERENCES:
// http://www.jacklmoore.com/notes/mouse-position/


(function() {

  var sctooltip = window.sucrose.tooltip = {};

  sctooltip.show = function(evt, content, gravity, dist, container, classes) {

    var tooltip = document.createElement('div'),
        inner = document.createElement('div'),
        arrow = document.createElement('div');

    gravity = gravity || 's';
    dist = dist || 5;

    inner.className = 'tooltip-inner';
    arrow.className = 'tooltip-arrow';
    inner.innerHTML = content;
    tooltip.style.left = 0;
    tooltip.style.top = -1000;
    tooltip.style.opacity = 0;
    tooltip.className = 'tooltip xy-tooltip in';

    tooltip.appendChild(inner);
    tooltip.appendChild(arrow);
    container.appendChild(tooltip);

    sctooltip.position(container, tooltip, evt, gravity, dist);
    tooltip.style.opacity = 1;

    return tooltip;
  };

  sctooltip.cleanup = function() {
      // Find the tooltips, mark them for removal by this class
      // (so others cleanups won't find it)
      var tooltips = document.getElementsByClassName('tooltip'),
          purging = [],
          i = tooltips.length;

      while (i > 0) {
          i -= 1;

          if (tooltips[i].className.indexOf('xy-tooltip') !== -1) {
              purging.push(tooltips[i]);
              tooltips[i].style.transitionDelay = '0 !important';
              tooltips[i].style.opacity = 0;
              tooltips[i].className = 'sctooltip-pending-removal out';
          }
      }

      setTimeout(function() {
          var removeMe;
          while (purging.length) {
              removeMe = purging.pop();
              removeMe.parentNode.removeChild(removeMe);
          }
      }, 500);
  };

  sctooltip.position = function(container, tooltip, evt, gravity, dist) {
    gravity = gravity || 's';
    dist = dist || 5;

    var rect = container.getBoundingClientRect();

    var pos = [
          evt.clientX - rect.left,
          evt.clientY - rect.top
        ];

    var tooltipWidth = parseInt(tooltip.offsetWidth, 10),
        tooltipHeight = parseInt(tooltip.offsetHeight, 10),
        containerWidth = container.clientWidth,
        containerHeight = container.clientHeight,
        containerLeft = container.scrollLeft,
        containerTop = container.scrollTop,
        class_name = tooltip.className.replace(/ top| right| bottom| left/g, ''),
        left, top;

    function alignCenter() {
      var left = pos[0] - (tooltipWidth / 2);
      if (left < containerLeft) left = containerLeft;
      if (left + tooltipWidth > containerWidth) left = containerWidth - tooltipWidth;
      return left;
    }
    function alignMiddle() {
      var top = pos[1] - (tooltipHeight / 2);
      if (top < containerTop) top = containerTop;
      if (top + tooltipHeight > containerTop + containerHeight) top = containerTop - tooltipHeight;
      return top;
    }
    function arrowLeft(left) {
      var marginLeft = pos[0] - (tooltipWidth / 2) - left - 5,
          arrow = tooltip.getElementsByClassName('tooltip-arrow')[0];
      arrow.style.marginLeft = marginLeft + 'px';
    }
    function arrowTop(top) {
      var marginTop = pos[1] - (tooltipHeight / 2) - top - 5,
          arrow = tooltip.getElementsByClassName('tooltip-arrow')[0];
      arrow.style.marginTop = marginTop + 'px';
    }

    switch (gravity) {
      case 'e':
        top = alignMiddle();
        left = pos[0] - tooltipWidth - dist;
        arrowTop(top);
        if (left < containerLeft) {
          left = pos[0] + dist;
          class_name += ' right';
        } else {
          class_name += ' left';
        }
        break;
      case 'w':
        top = alignMiddle();
        left = pos[0] + dist;
        arrowTop(top);
        if (left + tooltipWidth > containerWidth) {
          left = pos[0] - tooltipWidth - dist;
          class_name += ' left';
        } else {
          class_name += ' right';
        }
        break;
      case 'n':
        left = alignCenter();
        top = pos[1] + dist;
        arrowLeft(left);
        if (top + tooltipHeight > containerTop + containerHeight) {
          top = pos[1] - tooltipHeight - dist;
          class_name += ' top';
        } else {
          class_name += ' bottom';
        }
        break;
      case 's':
        left = alignCenter();
        top = pos[1] - tooltipHeight - dist;
        arrowLeft(left);
        if (containerTop > top) {
          top = pos[1] + dist;
          class_name += ' bottom';
        } else {
          class_name += ' top';
        }
        break;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';

    tooltip.className = class_name;
  };

})();

sucrose.utils.windowSize = function () {
    // Sane defaults
    var size = {width: 640, height: 480};

    // Earlier IE uses Doc.body
    if (document.body && document.body.offsetWidth) {
        size.width = document.body.offsetWidth;
        size.height = document.body.offsetHeight;
    }

    // IE can use depending on mode it is in
    if (document.compatMode === 'CSS1Compat' &&
        document.documentElement &&
        document.documentElement.offsetWidth ) {
        size.width = document.documentElement.offsetWidth;
        size.height = document.documentElement.offsetHeight;
    }

    // Most recent browsers use
    if (window.innerWidth && window.innerHeight) {
        size.width = window.innerWidth;
        size.height = window.innerHeight;
    }
    return (size);
};

// Easy way to bind multiple functions to window.onresize
// TODO: give a way to remove a function after its bound, other than removing alkl of them
// sucrose.utils.windowResize = function (fun)
// {
//   var oldresize = window.onresize;

//   window.onresize = function (e) {
//     if (typeof oldresize == 'function') oldresize(e);
//     fun(e);
//   }
// }

sucrose.utils.windowResize = function (fun) {
  if (window.attachEvent) {
      window.attachEvent('onresize', fun);
  }
  else if (window.addEventListener) {
      window.addEventListener('resize', fun, true);
  }
  else {
      //The browser does not support Javascript event binding
  }
};

sucrose.utils.windowUnResize = function (fun) {
  if (window.detachEvent) {
      window.detachEvent('onresize', fun);
  }
  else if (window.removeEventListener) {
      window.removeEventListener('resize', fun, true);
  }
  else {
      //The browser does not support Javascript event binding
  }
};

sucrose.utils.resizeOnPrint = function (fn) {
    if (window.matchMedia) {
        var mediaQueryList = window.matchMedia('print');
        mediaQueryList.addListener(function (mql) {
            if (mql.matches) {
                fn();
            }
        });
    } else if (window.attachEvent) {
      window.attachEvent("onbeforeprint", fn);
    } else {
      window.onbeforeprint = fn;
    }
    //TODO: allow for a second call back to undo using
    //window.attachEvent("onafterprint", fn);
};

sucrose.utils.unResizeOnPrint = function (fn) {
    if (window.matchMedia) {
        var mediaQueryList = window.matchMedia('print');
        mediaQueryList.removeListener(function (mql) {
            if (mql.matches) {
                fn();
            }
        });
    } else if (window.detachEvent) {
      window.detachEvent("onbeforeprint", fn);
    } else {
      window.onbeforeprint = null;
    }
};

// Backwards compatible way to implement more d3-like coloring of graphs.
// If passed an array, wrap it in a function which implements the old default
// behavior
sucrose.utils.getColor = function (color) {
    if (!arguments.length) { return sucrose.utils.defaultColor(); } //if you pass in nothing, get default colors back

    if (Object.prototype.toString.call( color ) === '[object Array]') {
        return function (d, i) { return d.color || color[i % color.length]; };
    } else {
        return color;
        //can't really help it if someone passes rubbish as color
    }
};

// Default color chooser uses the index of an object as before.
sucrose.utils.defaultColor = function () {
    var colors = d3.scaleOrdinal(d3.schemeCategory20).range();
    return function (d, i) {
      return d.color || colors[i % colors.length];
    };
};


// Returns a color function that takes the result of 'getKey' for each series and
// looks for a corresponding color from the dictionary,
sucrose.utils.customTheme = function (dictionary, getKey, defaultColors) {
  getKey = getKey || function (series) { return series.key; }; // use default series.key if getKey is undefined
  defaultColors = defaultColors || d3.scaleOrdinal(d3.schemeCategory20).range(); //default color function

  var defIndex = defaultColors.length; //current default color (going in reverse)

  return function (series, index) {
    var key = getKey(series);

    if (!defIndex) defIndex = defaultColors.length; //used all the default colors, start over

    if (typeof dictionary[key] !== "undefined") {
      return (typeof dictionary[key] === "function") ? dictionary[key]() : dictionary[key];
    } else {
      return defaultColors[--defIndex]; // no match in dictionary, use default color
    }
  };
};



// From the PJAX example on d3js.org, while this is not really directly needed
// it's a very cool method for doing pjax, I may expand upon it a little bit,
// open to suggestions on anything that may be useful
sucrose.utils.pjax = function (links, content) {
  d3.selectAll(links).on("click", function () {
    history.pushState(this.href, this.textContent, this.href);
    load(this.href);
    d3.event.preventDefault();
  });

  function load(href) {
    d3.html(href, function (fragment) {
      var target = d3.select(content).node();
      target.parentNode.replaceChild(d3.select(fragment).select(content).node(), target);
      sucrose.utils.pjax(links, content);
    });
  }

  d3.select(window).on("popstate", function () {
    if (d3.event.state) { load(d3.event.state); }
  });
};

/* Numbers that are undefined, null or NaN, convert them to zeros.
*/
sucrose.utils.NaNtoZero = function(n) {
    if (typeof n !== 'number'
        || isNaN(n)
        || n === null
        || n === Infinity) return 0;

    return n;
};

/*
Snippet of code you can insert into each sucrose.models.* to give you the ability to
do things like:
chart.options({
  showXAxis: true,
  tooltips: true
});

To enable in the chart:
chart.options = sucrose.utils.optionsFunc.bind(chart);
*/
sucrose.utils.optionsFunc = function(args) {
    if (args) {
      d3.map(args).forEach((function(key,value) {
        if (typeof this[key] === "function") {
           this[key](value);
        }
      }).bind(this));
    }
    return this;
};


//SUGAR ADDITIONS

//gradient color
sucrose.utils.colorLinearGradient = function (d, i, p, c, defs) {
  var id = 'lg_gradient_' + i;
  var grad = defs.select('#' + id);
  if ( grad.empty() )
  {
    if (p.position === 'middle')
    {
      sucrose.utils.createLinearGradient( id, p, defs, [
        { 'offset': '0%',  'stop-color': d3.rgb(c).darker().toString(),  'stop-opacity': 1 },
        { 'offset': '20%', 'stop-color': d3.rgb(c).toString(), 'stop-opacity': 1 },
        { 'offset': '50%', 'stop-color': d3.rgb(c).brighter().toString(), 'stop-opacity': 1 },
        { 'offset': '80%', 'stop-color': d3.rgb(c).toString(), 'stop-opacity': 1 },
        { 'offset': '100%','stop-color': d3.rgb(c).darker().toString(),  'stop-opacity': 1 }
      ]);
    }
    else
    {
      sucrose.utils.createLinearGradient( id, p, defs, [
        { 'offset': '0%',  'stop-color': d3.rgb(c).darker().toString(),  'stop-opacity': 1 },
        { 'offset': '50%', 'stop-color': d3.rgb(c).toString(), 'stop-opacity': 1 },
        { 'offset': '100%','stop-color': d3.rgb(c).brighter().toString(), 'stop-opacity': 1 }
      ]);
    }
  }
  return 'url(#'+ id +')';
};

// defs:definition container
// id:dynamic id for arc
// radius:outer edge of gradient
// stops: an array of attribute objects
sucrose.utils.createLinearGradient = function (id, params, defs, stops) {
  var x2 = params.orientation === 'horizontal' ? '0%' : '100%';
  var y2 = params.orientation === 'horizontal' ? '100%' : '0%';
  var attrs, stop;
  var grad = defs.append('linearGradient')
        .attr('id', id)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', x2 )
        .attr('y2', y2 )
        //.attr('gradientUnits', 'userSpaceOnUse')objectBoundingBox
        .attr('spreadMethod', 'pad');
  for (var i=0; i<stops.length; i+=1)
  {
    attrs = stops[i];
    stop = grad.append('stop');
    for (var a in attrs)
    {
      if ( attrs.hasOwnProperty(a) ) {
        stop.attr(a, attrs[a]);
      }
    }
  }
};

sucrose.utils.colorRadialGradient = function (d, i, p, c, defs) {
  var id = 'rg_gradient_' + i;
  var grad = defs.select('#' + id);
  if ( grad.empty() )
  {
    sucrose.utils.createRadialGradient( id, p, defs, [
      { 'offset': p.s, 'stop-color': d3.rgb(c).brighter().toString(), 'stop-opacity': 1 },
      { 'offset': '100%','stop-color': d3.rgb(c).darker().toString(), 'stop-opacity': 1 }
    ]);
  }
  return 'url(#' + id + ')';
};

sucrose.utils.createRadialGradient = function (id, params, defs, stops) {
  var attrs, stop;
  var grad = defs.append('radialGradient')
        .attr('id', id)
        .attr('r', params.r)
        .attr('cx', params.x)
        .attr('cy', params.y)
        .attr('gradientUnits', params.u)
        .attr('spreadMethod', 'pad');
  for (var i=0; i<stops.length; i+=1)
  {
    attrs = stops[i];
    stop = grad.append('stop');
    for (var a in attrs)
    {
      if ( attrs.hasOwnProperty(a) ) {
        stop.attr(a, attrs[a]);
      }
    }
  }
};

sucrose.utils.getAbsoluteXY = function (element) {
  var viewportElement = document.documentElement;
  var box = element.getBoundingClientRect();
  var scrollLeft = viewportElement.scrollLeft + document.body.scrollLeft;
  var scrollTop = viewportElement.scrollTop + document.body.scrollTop;
  var x = box.left + scrollLeft;
  var y = box.top + scrollTop;

  return {'left': x, 'top': y};
};

// Creates a rectangle with rounded corners
sucrose.utils.roundedRectangle = function (x, y, width, height, radius) {
  return "M" + x + "," + y +
       "h" + (width - radius * 2) +
       "a" + radius + "," + radius + " 0 0 1 " + radius + "," + radius +
       "v" + (height - 2 - radius * 2) +
       "a" + radius + "," + radius + " 0 0 1 " + -radius + "," + radius +
       "h" + (radius * 2 - width) +
       "a" + -radius + "," + radius + " 0 0 1 " + -radius + "," + -radius +
       "v" + ( -height + radius * 2 + 2 ) +
       "a" + radius + "," + radius + " 0 0 1 " + radius + "," + -radius +
       "z";
};

sucrose.utils.dropShadow = function (id, defs, options) {
  var opt = options || {}
    , h = opt.height || '130%'
    , o = opt.offset || 2
    , b = opt.blur || 1;

  if (defs.select('#' + id).empty()) {
    var filter = defs.append('filter')
          .attr('id',id)
          .attr('height',h);
    var offset = filter.append('feOffset')
          .attr('in','SourceGraphic')
          .attr('result','offsetBlur')
          .attr('dx',o)
          .attr('dy',o); //how much to offset
    var color = filter.append('feColorMatrix')
          .attr('in','offsetBlur')
          .attr('result','matrixOut')
          .attr('type','matrix')
          .attr('values','1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0');
    var blur = filter.append('feGaussianBlur')
          .attr('in','matrixOut')
          .attr('result','blurOut')
          .attr('stdDeviation',b); //stdDeviation is how much to blur
    var merge = filter.append('feMerge');
        merge.append('feMergeNode'); //this contains the offset blurred image
        merge.append('feMergeNode')
          .attr('in','SourceGraphic'); //this contains the element that the filter is applied to
  }
  return 'url(#' + id + ')';
};
// <svg xmlns="http://www.w3.org/2000/svg" version="1.1">
//   <defs>
//     <filter id="f1" x="0" y="0" width="200%" height="200%">
//       <feOffset result="offOut" in="SourceGraphic" dx="20" dy="20" />
//       <feColorMatrix result="matrixOut" in="offOut" type="matrix"
//       values="0.2 0 0 0 0 0 0.2 0 0 0 0 0 0.2 0 0 0 0 0 1 0" />
//       <feGaussianBlur result="blurOut" in="matrixOut" stdDeviation="10" />
//       <feBlend in="SourceGraphic" in2="blurOut" mode="normal" />
//     </filter>
//   </defs>
//   <rect width="90" height="90" stroke="green" stroke-width="3"
//   fill="yellow" filter="url(#f1)" />
// </svg>

sucrose.utils.stringSetLengths = function(_data, _container, _format, classes, styles) {
  var lengths = [],
      txt = _container.select('.tmp-text-strings').select('text');
  if (txt.empty()) {
    txt = _container.append('g').attr('class', 'tmp-text-strings').append('text');
  }
  txt.classed(classes, true);
  txt.style('display', 'inline');
  _data.forEach(function(d, i) {
      txt.text(_format(d, i));
      lengths.push(txt.node().getBoundingClientRect().width);
    });
  txt.text('').attr('class', 'tmp-text-strings').style('display', 'none');
  return lengths;
};

sucrose.utils.stringSetThickness = function(_data, _container, _format, classes, styles) {
  var thicknesses = [],
      txt = _container.select('.tmp-text-strings').select('text');
  if (txt.empty()) {
    txt = _container.append('g').attr('class', 'tmp-text-strings').append('text');
  }
  txt.classed(classes, true);
  txt.style('display', 'inline');
  _data.forEach(function(d, i) {
      txt.text(_format(d, i));
      thicknesses.push(txt.node().getBoundingClientRect().height);
    });
  txt.text('').attr('class', 'tmp-text-strings').style('display', 'none');
  return thicknesses;
};

sucrose.utils.maxStringSetLength = function(_data, _container, _format) {
  var lengths = sucrose.utils.stringSetLengths(_data, _container, _format);
  return d3.max(lengths);
};

sucrose.utils.stringEllipsify = function(_string, _container, _length) {
  var txt = _container.select('.tmp-text-strings').select('text'),
      str = _string,
      len = 0,
      ell = 0,
      strLen = 0;
  if (txt.empty()) {
    txt = _container.append('g').attr('class', 'tmp-text-strings').append('text');
  }
  txt.style('display', 'inline');
  txt.text('...');
  ell = txt.node().getBoundingClientRect().width;
  txt.text(str);
  len = txt.node().getBoundingClientRect().width;
  strLen = len;
  while (len > _length && len > 30) {
    str = str.slice(0, -1);
    txt.text(str);
    len = txt.node().getBoundingClientRect().width + ell;
  }
  txt.text('');
  return str + (strLen > _length ? '...' : '');
};

sucrose.utils.getTextBBox = function(text, floats) {
  var bbox = text.node().getBoundingClientRect(),
      size = {
        width: floats ? bbox.width : parseInt(bbox.width, 10),
        height: floats ? bbox.height : parseInt(bbox.height, 10)
      };
  return size;
};

sucrose.utils.getTextContrast = function(c, i, callback) {
  var back = c,
      backLab = d3.lab(back),
      backLumen = backLab.l,
      textLumen = backLumen > 60 ?
        backLab.darker(4 + (backLumen - 75) / 25).l : // (50..100)[1 to 3.5]
        backLab.brighter(4 + (18 - backLumen) / 25).l, // (0..50)[3.5..1]
      textLab = d3.lab(textLumen, 0, 0),
      text = textLab.toString();
  if (callback) {
    callback(backLab, textLab);
  }
  return text;
};

sucrose.utils.isRTLChar = function(c) {
  var rtlChars_ = '\u0591-\u07FF\uFB1D-\uFDFF\uFE70-\uFEFC',
      rtlCharReg_ = new RegExp('[' + rtlChars_ + ']');
  return rtlCharReg_.test(c);
};

sucrose.utils.polarToCartesian = function(centerX, centerY, radius, angleInDegrees) {
  var angleInRadians = sucrose.utils.angleToRadians(angleInDegrees);
  var x = centerX + radius * Math.cos(angleInRadians);
  var y = centerY + radius * Math.sin(angleInRadians);
  return [x, y];
};

sucrose.utils.angleToRadians = function(angleInDegrees) {
  return angleInDegrees * Math.PI / 180.0;
};

sucrose.utils.angleToDegrees = function(angleInRadians) {
  return angleInRadians * 180.0 / Math.PI;
};

sucrose.utils.createTexture = function(defs, id, x, y) {
  var texture = '#sc-diagonalHatch-' + id,
      mask = '#sc-textureMask-' + id;

  defs
    .append('pattern')
      .attr('id', 'sc-diagonalHatch-' + id)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 8)
      .attr('height', 8)
      .append('path')
        .attr('d', 'M-1,1 l2,-2 M0,8 l8,-8 M7,9 l1,-1')
        .attr('class', 'texture-line')
        // .attr('class', classes)
        // .attr('stroke', fill)
        .attr('stroke', '#fff')
        .attr('stroke-linecap', 'square');

  defs
    .append('mask')
      .attr('id', 'sc-textureMask-' + id)
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', '100%')
      .attr('height', '100%')
      .append('rect')
        .attr('x', x || 0)
        .attr('y', y || -1)
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('fill', 'url(' + texture + ')');

  return mask;
};

sucrose.utils.numberFormatSI = function(d, p, c, l) {
    var fmtr, spec, si;
    if (isNaN(d)) {
        return d;
    }
    p = typeof p === 'undefined' ? 2 : p;
    c = typeof c === 'undefined' ? false : !!c;
    fmtr = typeof l === 'undefined' ? d3.format : d3.formatLocale(l).format;
    // d = d3.round(d, p);
    spec = c ? '$,' : ',';
    if (c && d < 1000 && d !== parseInt(d, 10)) {
        spec += '.2f';
    }
    if (d < 1 && d > -1) {
        spec += '.2s';
    }
    return fmtr(spec)(d);
};

sucrose.utils.numberFormatRound = function(d, p, c, l) {
    var fmtr, spec;
    if (isNaN(d)) {
        return d;
    }
    c = typeof c === 'undefined' ? false : !!c;
    p = typeof p === 'undefined' ? c ? 2 : 0 : p;
    fmtr = typeof l === 'undefined' ? d3.format : d3.formatLocale(l).format;
    spec = c ? '$,.' + p + 'f' : ',';
    return fmtr(spec)(d);
};

sucrose.utils.isValidDate = function(d) {
    var testDate;
    if (!d) {
        return false;
    }
    testDate = new Date(d);
    return testDate instanceof Date && !isNaN(testDate.valueOf());
};

sucrose.utils.dateFormat = function(d, p, l) {
    var date, locale, spec, fmtr;
    date = new Date(d);
    if (!(date instanceof Date) || isNaN(date.valueOf())) {
        return d;
    }
    if (l && l.hasOwnProperty('timeFormat')) {
        // Use rebuilt locale
        spec = p.indexOf('%') !== -1 ? p : '%x';
        fmtr = l.timeFormat;
    } else {
        // Ensure locality object has all needed properties
        // TODO: this is expensive so consider removing
        locale = sucrose.utils.buildLocality(l);
        fmtr = d3.timeFormatLocale(locale).format;
        spec = p.indexOf('%') !== -1 ? p : locale[p] || '%x';
        // TODO: if not explicit pattern provided, we should use .multi()
    }
    return fmtr(spec)(date);
};

sucrose.utils.buildLocality = function(l, d) {
    var locale = l || {},
        deep = !!d,
        unfer = function(a) {
            return a.join('|').split('|').map(function(b) {
                return !(b) ? '' : isNaN(b) ? b : +b;
            });
        },
        definition = {
            'decimal': '.',
            'thousands': ',',
            'grouping': [3],
            'currency': ['$', ''],
            'dateTime': '%B %-d, %Y at %X %p GMT%Z', //%c
            'date': '%b %-d, %Y', //%x
            'time': '%-I:%M:%S', //%X
            'periods': ['AM', 'PM'],
            'days': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            'shortDays': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            'months': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
            'shortMonths': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            // Custom patterns
            'full': '%A, %c',
            'long': '%c',
            'medium': '%x, %X %p',
            'short': '%-m/%-d/%y, %-I:%M %p',
            'yMMMEd': '%a, %x',
            'yMEd': '%a, %-m/%-d/%Y',
            'yMMMMd': '%B %-d, %Y',
            'yMMMd': '%x',
            'yMd': '%-m/%-d/%Y',
            'yMMMM': '%B %Y',
            'yMMM': '%b %Y',
            'MMMd': '%b %-d',
            'MMMM': '%B',
            'MMM': '%b',
            'y': '%Y'
        };

    for (var key in locale) {
        var d;
        if (l.hasOwnProperty(key)) {
            d = locale[key];
            definition[key] = !deep || !Array.isArray(d) ? d : unfer(d);
        }
    }

    return definition;
}
sucrose.models.axis = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var scale = d3.scaleLinear(),
      axisLabelText = null,
      showMaxMin = true,
      highlightZero = true,
      direction = 'ltr',
      orient = 'bottom',
      wrapTicks = false,
      staggerTicks = false,
      rotateTicks = 30, //one of (rotateTicks, staggerTicks, wrapTicks)
      reduceXTicks = false, // if false a tick will show for every data point
      rotateYLabel = true,
      hasRangeBand = false,
      textAnchor = null,
      ticks = null,
      tickPadding = 4,
      valueFormat = function(d) { return d; },
      axisLabelDistance = 8; //The larger this number is, the closer the axis label is to the axis.

  // Public Read-only Variables
  //------------------------------------------------------------
  var margin = {top: 0, right: 0, bottom: 0, left: 0},
      thickness = 0;

  var axis = d3.axisBottom();

  // Private Variables
  //------------------------------------------------------------
  var scale0;

  //============================================================

  function chart(selection) {
    selection.each(function(data) {

      var container = d3.select(this);
      var scaleCalc = axis.scale().copy();
      var marginCalc = {top: 0, right: 0, bottom: 0, left: 0};
      var extent = getRangeExtent();
      var scaleWidth = Math.abs(extent[1] - extent[0]);

      // Private
      scale0 = scale0 || axis.scale();

      var vertical = orient === 'left' || orient === 'right' ? true : false,
          reflect = orient === 'left' || orient === 'top' ? -1 : 1,
          maxLabelWidth = 0,
          maxLabelHeight = 0,
          tickGap = 6,
          tickSpacing = 0,
          labelThickness = 0;

      var tickDimensions = [],
          tickDimensionsHash = {},
          tickValueArray = [],
          minTickDimensions = {},
          maxTickDimensions = {};

      //------------------------------------------------------------
      // reset public readonly variables
      thickness = 0;

      if (ticks !== null) {
        axis.ticks(ticks);
      } else if (vertical) {
        axis.ticks(Math.ceil(scaleWidth / 48));
      } else {
        axis.ticks(Math.ceil(scaleWidth / 100));
      }

      // test to see if rotateTicks was passed as a boolean
      if (rotateTicks && !isFinite(String(rotateTicks))) {
        rotateTicks = 30;
      }

      // ordinal scales do not have max-min values
      if (hasRangeBand) {
        showMaxMin = false;
      }

      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap_bind = container.selectAll('g.sc-wrap.sc-axis')
            .data([data]);
      var wrap_entr = wrap_bind.enter()
            .append('g').attr('class', 'sucrose sc-wrap sc-axis')
            .append('g').attr('class', 'sc-axis-inner');
      var wrap = container.select('.sc-axis-inner')
            .merge(wrap_entr);

      wrap.call(axis);

      // Axis ticks
      var axisTicks = wrap.selectAll('g.tick');

      // Min Max ticks
      var axisMaxMin_data = showMaxMin ? d3.extent(scale.domain()) : [];
      var axisMaxMin_bind = wrap.selectAll('g.sc-axisMaxMin').data(axisMaxMin_data);
      var axisMaxMin_entr = axisMaxMin_bind.enter()
            .append('g').attr('class', 'sc-axisMaxMin');
      axisMaxMin_bind.exit().remove();
      var axisMaxMin = wrap.selectAll('g.sc-axisMaxMin').merge(axisMaxMin_entr);

      axisMaxMin_entr.append('text')
        .style('opacity', 0);
      axisMaxMin_entr.append('line')
        .style('opacity', 0);

      if (showMaxMin) {
        axisMaxMin.select('text')
          .text(function(d, i, selection) {
            return axis.tickFormat()(d, i, selection, false);
          });
      }

      // Get all axes and maxmin tick text for text handling functions
      var tickText = wrap.selectAll('g.tick, g.sc-axisMaxMin').select('text')
            .filter(function(d) {
              return this.getBoundingClientRect().width;
            })
            .each(function(d, i) {
              tickValueArray.push(d3.select(this).text());
            });

      // Axis label
      var axisLabel_data = !!axisLabelText ? [axisLabelText] : [];
      var axisLabel_bind = wrap.selectAll('text.sc-axislabel').data(axisLabel_data);
      var axisLabel_entr = axisLabel_bind.enter()
            .append('text').attr('class', 'sc-axislabel');
      axisLabel_bind.exit().remove();
      var axisLabel = wrap.selectAll('text.sc-axislabel').merge(axisLabel_entr);

      axisLabel
        .text(sucrose.identity);

      //------------------------------------------------------------
      // Tick label handling

      var wrapSucceeded = false,
          staggerSucceeded = false,
          rotateSucceeded = false;

      if (vertical) {
        resetTicks();

        tickText
          .style('text-anchor', rtlTextAnchor(textAnchor || (isMirrored() ? 'start' : 'end')));
      } else {
        //Not needed but keep for now
        // if (reduceXTicks) {
        //   axisTicks.each(function(d, i) {
        //       d3.select(this).selectAll('text,line')
        //         .style('opacity', i % Math.ceil(data[0].values.length / (scaleWidth / 100)) !== 0 ? 0 : 1);
        //     });
        // }
        resetTicks();
        recalcMargin();

        if (labelCollision(1)) {

          // if wrap is enabled, try it first (for ordinal scales only)
          if (wrapTicks) {
            resetTicks();
            handleWrap();
            recalcMargin();
            handleWrap();
            // check to see if we still have collisions
            if (!labelCollision(1)) {
              wrapSucceeded = true;
            }
          }

          // wrapping failed so fall back to stagger if enabled
          if (!wrapSucceeded && staggerTicks) {
            resetTicks();
            handleStagger();
            recalcMargin();
            handleStagger();
            // check to see if we still have collisions
            if (!labelCollision(2)) {
              staggerSucceeded = true;
            }
          }

          // if we still have a collision
          // add a test in the following if block to support opt-out of rotate method
          if (!wrapSucceeded && !staggerSucceeded) {
            if (!rotateTicks) {
              rotateTicks = 30;
            }
            resetTicks();
            handleRotation(rotateTicks);
            recalcMargin(rotateTicks);
            handleRotation(rotateTicks);
            rotateSucceeded = true;
          }
        }
      }

      //------------------------------------------------------------
      // Min Max values

      if (showMaxMin) {

        // only show max line
        axisMaxMin.select('line')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('y2', vertical ? 0 : (axis.tickSize() - marginCalc.bottom) * reflect)
          .attr('x2', vertical ? axis.tickSize() * reflect : 0)
          .style('opacity', function(d, i) {
            return isMirrored() ? (i ? 0 : 1) : (i ? 1 : 0);
          });

        //check if max and min overlap other values, if so, hide the values that overlap
        axisTicks.each(function(d, i) {
            var tick = d3.select(this),
                dim = tickDimensionsHash['key-' + d.toString()],
                collision = false;

            if (vertical) {
              collision = dim.bottom > minTickDimensions.top || dim.top < maxTickDimensions.bottom;
              tick.select('line')
                .style('opacity', 1 - collision);
            } else if (rotateSucceeded) {
              collision = false;
            } else if (staggerSucceeded) {
              collision = (dim.left < minTickDimensions.right + tickGap || dim.right > maxTickDimensions.left + tickGap) &&
                          (dim.bottom < minTickDimensions.top || dim.top > maxTickDimensions.bottom);
            } else {
              // collision = dim.left < minTickDimensions.right + tickGap || dim.right > maxTickDimensions.left + tickGap;
            }

            tick.select('text')
              .style('opacity', 1 - collision);
            // accounts for minor floating point errors... though could be problematic if the scale is EXTREMELY SMALL
            // if (d < 1e-10 && d > -1e-10) { // Don't remove the ZERO line!!
            //   tick.select('line')
            //     .style('opacity', 0);
            // }
          });

      } else {

        //highlight zero line ... Maybe should not be an option and should just be in CSS?
        axisTicks
          .filter(function(d) {
            // this is because sometimes the 0 tick is a very small fraction, TODO: think of cleaner technique
            // return !parseFloat(Math.round(d * 100000) / 1000000);
            return scaleCalc(d) === extent[0 + isMirrored()];
          })
          .classed('zero', highlightZero);

        // hide zero line if same as domain line
        axisTicks.select('line')
          .style('opacity', function(d, i) {
            return scaleCalc(d) === extent[0 + isMirrored()] ? 0 : 1;
          });

      }

      //------------------------------------------------------------
      // Axis label

      if (!!axisLabelText) {
        var axisLabelX = vertical ?
              rotateYLabel ? scaleWidth / -2 : (thickness + axisLabelDistance) * reflect :
              scaleWidth / 2;
        var axisLabelY = vertical ?
              rotateYLabel ? (thickness + axisLabelDistance) * reflect : scaleWidth / 2 :
              (thickness + axisLabelDistance) * reflect;

        axisLabel
          .attr('x', axisLabelX)
          .attr('y', axisLabelY)
          .attr('dy', (0.355 + 0.355 * reflect) + 'em')
          .attr('transform', vertical && rotateYLabel ? 'rotate(-90)' : '')
          .style('text-anchor', vertical && !rotateYLabel ? rtlTextAnchor('end') : 'middle');

        axisLabel.each(function(d, i) {
          labelThickness += vertical ?
            parseInt(this.getBoundingClientRect().width / 1.3, 10) :
            parseInt(this.getBoundingClientRect().height / 1.3, 10);
        });
        thickness += labelThickness + axisLabelDistance;
      }

      //------------------------------------------------------------
      // Set final margins

      //store old scales for use in transitions on update
      scale0 = scale.copy();
      margin = {top: marginCalc.top, right: marginCalc.right, bottom: marginCalc.bottom, left: marginCalc.left};
      margin[orient] = thickness;

      //------------------------------------------------------------
      // Private functions

      function getStepInterval() {
        return scaleCalc.range().length > 1 ? Math.abs(scaleCalc.range()[1] - scaleCalc.range()[0]) : 0;
      }

      function getPaddingRatio() {
        return scaleCalc.range().length > 1 ? Math.max(0.25, 1 - d3.round(scaleCalc.bandwidth() / getStepInterval(), 2)) : 0;
      }

      function getRangeExtent() {
        return typeof scaleCalc.rangeExtent === 'function' ? scaleCalc.rangeExtent() : scaleCalc.range();
      }

      function getBarWidth() {
        return hasRangeBand ? scaleCalc.bandwidth() : 0;
      }

      function getOuterPadding() {
        return hasRangeBand ? scaleCalc.range()[0] : 0;
      }

      function getOuterPaddingRatio() {
        return getOuterPadding() / getTickSpacing();
      }

      function getTickSpacing() {
        var tickSpacing = 0,
            tickArray;
        if (hasRangeBand) {
          tickSpacing = scaleCalc.range().length > 1 ? Math.abs(scaleCalc.range()[1] - scaleCalc.range()[0]) : d3.max(getRangeExtent()) / 2;
        } else {
          tickArray = scaleCalc.ticks(axisTicks.size());
          tickSpacing = scaleCalc(tickArray[tickArray.length - 1]) - scaleCalc(tickArray[tickArray.length - 2]);
        }
        return tickSpacing;
      }

      function rtlTextAnchor(anchor) {
        if (direction === 'rtl') {
          if (anchor === 'start') {
            return 'end';
          } else if (anchor === 'end') {
            return 'start';
          }
        }
        return anchor;
      }

      function isMirrored() {
        return orient !== 'left' && orient !== 'bottom';
      }

      function setThickness(s) {
        s = s || 1;
        thickness = axis.tickPadding() + (vertical ? maxLabelWidth : maxLabelHeight) * s;
      }

      // Calculate the longest tick width and height
      function calcMaxLabelSizes() {
        calcTickLabelSizes();

        maxLabelWidth = d3.max(tickDimensions, function(d) { return d.width; });
        maxLabelHeight = d3.max(tickDimensions, function(d) { return d.height; });
      }

      function calcTickLabelSizes() {
        tickDimensions = [];
        tickDimensionsHash = {};

        // reposition max/min ticks before calculating bbox
        if (showMaxMin) {
          axisMaxMin
            .style('opacity', 1)
            .attr('transform', function(d, i) {
              var trans = vertical ? '0,' + scaleCalc(d) : scaleCalc(d) + ',0';
              return 'translate(' + trans + ')';
            });
        }

        tickText.each(function(d, i) { //TODO: make everything relative to domain path
            var bbox = this.getBoundingClientRect();
            if (bbox.width > 0) {
              tickDimensions.push({
                key: d,
                width: parseInt(bbox.width, 10),
                height: parseInt(bbox.height / 1.2, 10),
                left: bbox.left,
                right: bbox.right,
                top: bbox.top,
                bottom: bbox.bottom
              });
            }
          });

        tickDimensions.sort(function(a, b) {
            return a.key - b.key;
          })
          .forEach(function(d, i) {
            d.index = i;
            tickDimensionsHash['key-' + d.key.toString()] = d;
          });
        minTickDimensions = tickDimensions[0];
        maxTickDimensions = tickDimensions[tickDimensions.length - 1];
      }

      function labelCollision(s) {
        // {0}   [2]   [4]   {6}
        //    [1]   [3]   [5]
        calcTickLabelSizes();
        var skip = showMaxMin ? 2 : s || 1;
        // this resets the maxLabelWidth for label collision detection
        for (var i = (showMaxMin ? 1 : 0), l = tickDimensions.length - skip; i < l; i += 1) {
          if (tickDimensions[i].right + tickGap > tickDimensions[i + s].left) {
            return true;
          }
        }
        return false;
      }

      function recalcMargin(a) {
        var normRotation = a ? (a + 180) % 180 : 0, // Normalize rotation: (-30 + 360) % 360 = 330; (30 + 360) % 360 = 30
            isRotatedLeft = normRotation > 90,
            dMin = null,
            dMax = null;

        // increase margins for min/max
        tickDimensions.forEach(function(d, i) {
          var isMin = dMin === null || d.left <= dMin,
              isMax = dMax === null || d.right >= dMax,
              textWidth = 0,
              tickPosition = 0,
              availableSpace = 0,
              textWidth = 0;

          if (!isMin && !isMax) {
            return;
          }

          textWidth = normRotation ? d.width - 6 : d.width / 2; // 6 is the cos(textHeight) @ 30
          tickPosition = scaleCalc(d.key) + (hasRangeBand * getBarWidth() / 2);
          if (isMin && (!normRotation || isRotatedLeft)) {
            dMin = d.left;
            availableSpace = Math.abs(extent[0] - tickPosition);
            marginCalc.left = Math.max(textWidth - availableSpace, 0);
          }
          if (isMax && (!normRotation || !isRotatedLeft)) {
            dMax = d.right;
            availableSpace = Math.abs(extent[1] - tickPosition);
            marginCalc.right = Math.max(textWidth - availableSpace, 0);
          }
        });
        // modify scale range
        if (!hasRangeBand) { //TODO: can we get rid of this for bar chart?
          var change = margin.right - Math.max(margin.right, marginCalc.right);
              change += margin.left - Math.max(margin.left, marginCalc.left);
          var newExtent = [extent[0], extent[1] + change]; // reduce operable width of axis by margins

          scaleCalc.range(newExtent);
          extent = getRangeExtent();
          scaleWidth = Math.abs(extent[1] - extent[0]);

          axis
            .scale(scaleCalc);
          wrap.call(axis);
        }
      }

      function resetTicks() {
        marginCalc = {top: 0, right: 0, bottom: 0, left: 0};

        scaleCalc = scale.copy();
        extent = getRangeExtent();
        scaleWidth = Math.abs(extent[1] - extent[0]);

        axis
          .scale(scale);

        wrap.call(axis);

        tickText.selectAll('tspan').remove();
        tickText
          .attr('dy', vertical ? '.32em' : 0.355 + 0.355 * reflect + 'em')
          .attr('x', vertical ? axis.tickPadding() * reflect : 0)
          .attr('y', vertical ? 0 : axis.tickPadding() * reflect)
          .attr('transform', 'translate(0,0)')
          .text(function(d, i) { return tickValueArray[i]; })
          .style('text-anchor', 'middle')
          .style('opacity', 1);

        calcMaxLabelSizes();
        setThickness();
      }

      function handleWrap() {
        var tickSpacing = getTickSpacing();

        tickText.each(function(d, i) {
          var textContent = axis.tickFormat()(d, i, selection, true),
              textNode = d3.select(this),
              isDate = sucrose.utils.isValidDate(textContent),
              textArray = (textContent && textContent !== '' ? isDate ? textContent : textContent.replace('/', '/ ') : []).split(' '),
              i = 0,
              l = textArray.length,
              dy = reflect === 1 ? 0.71 : -1; // TODO: wrong. fails on reflect with 3 lines of wrap

          // reset the tick text conent
          this.textContent = '';

          var textString,
              textSpan = textNode.append('tspan')
                .text(textArray[i] + ' ')
                .attr('dy', dy + 'em')
                .attr('x', 0);

          // reset vars
          i += 1;
          dy = 1; // TODO: wrong. fails on reflect with 3 lines of wrap

          while (i < l) {
            textSpan = textNode.append('tspan')
              .text(textArray[i] + ' ')
              .attr('dy', dy + 'em')
              .attr('x', 0);

            i += 1;

            while (i < l) {
              textString = textSpan.text();
              textSpan.text(textString + ' ' + textArray[i]);
              //TODO: this is different than collision test
              if (this.getBoundingClientRect().width <= tickSpacing) {
                i += 1;
              } else {
                textSpan.text(textString);
                break;
              }
            }
          }
        });

        calcMaxLabelSizes();
        setThickness();
      }

      function handleStagger() {
        tickText
          .attr('transform', function(d, i) {
            var yOffset = tickDimensionsHash['key-' + d.toString()].index % 2 * (maxLabelHeight + 2);
            return 'translate(0,' + yOffset + ')';
          });

        calcMaxLabelSizes();
        setThickness(2);
      }

      function handleRotation(a) {
        // 0..90 = IV, 90..180 = III, 180..270 = IV, 270..360 = III
        // 0..-90 = III, -90..-180 = IV, -180..-270 = III, -270..-360 = IV
        // Normalize rotation: (-30 + 180) % 180 = 150; (30 + 180) % 180 = 30
        var normRotation = (a + 180) % 180,
            isLeft = normRotation > 90,
            angle = (normRotation - (isLeft ? 180 : 0)) * reflect,
            tickAnchor = rtlTextAnchor(isLeft ? 'end' : 'start'),
            //Convert to radians before calculating sin.
            cos = Math.abs(Math.cos(a * Math.PI / 180));

        //Rotate all tickText
        tickText
          .attr('transform', function(d, i, j) {
            return 'translate(0,' + (axis.tickPadding() * reflect) + ') rotate(' + angle + ')';
          })
          .attr('y', '0')
          .style('text-anchor', tickAnchor);

        calcMaxLabelSizes();
        setThickness();
        thickness += cos * 11;
      }

      //------------------------------------------------------------
      // Public functions

      chart.resizeTickLines = function(dim) {
        wrap.selectAll('g.tick, g.sc-axisMaxMin').select('line')
          .attr(vertical ? 'x2' : 'y2', dim * reflect);
      };

      chart.labelThickness = function() {
        return labelThickness;
      };

    });

    return chart;
  }


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  // expose chart's sub-components
  chart.axis = axis;

  // fc.rebind(chart, axis, 'tickValues', 'tickSubdivide', 'tickSize', 'tickPadding', 'tickFormat');
  fc.rebind(chart, scale, 'domain', 'range', 'rangeBand', 'rangeBands'); //these are also accessible by chart.scale(), but added common ones directly for ease of use

  // read only
  chart.width = function(_) {
    if (!arguments.length) {
      return thickness;
    }
    return chart;
  };

  // read only
  chart.height = function(_) {
    if (!arguments.length) {
      return thickness;
    }
    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) {
      return margin;
    }
    margin = _;
    return chart;
  };

  chart.ticks = function(_) {
    if (!arguments.length) {
      return ticks;
    }
    ticks = _;
    return chart;
  };

  chart.axisLabel = function(_) {
    if (!arguments.length) {
      return axisLabelText;
    }
    axisLabelText = _;
    return chart;
  };

  chart.showMaxMin = function(_) {
    if (!arguments.length) {
      return showMaxMin;
    }
    showMaxMin = _;
    return chart;
  };

  chart.highlightZero = function(_) {
    if (!arguments.length) {
      return highlightZero;
    }
    highlightZero = _;
    return chart;
  };

  chart.wrapTicks = function(_) {
    if (!arguments.length) {
      return wrapTicks;
    }
    wrapTicks = _;
    return chart;
  };

  chart.rotateTicks = function(_) {
    if (!arguments.length) {
      return rotateTicks;
    }
    rotateTicks = _;
    return chart;
  };

  chart.staggerTicks = function(_) {
    if (!arguments.length) {
      return staggerTicks;
    }
    staggerTicks = _;
    return chart;
  };

  chart.reduceXTicks = function(_) {
    if (!arguments.length) {
      return reduceXTicks;
    }
    reduceXTicks = _;
    return chart;
  };

  chart.rotateYLabel = function(_) {
    if (!arguments.length) {
      return rotateYLabel;
    }
    rotateYLabel = _;
    return chart;
  };

  chart.axisLabelDistance = function(_) {
    if (!arguments.length) {
      return axisLabelDistance;
    }
    axisLabelDistance = _;
    return chart;
  };

  chart.maxLabelWidth = function(_) {
    if (!arguments.length) {
      return maxLabelWidth;
    }
    maxLabelWidth = _;
    return chart;
  };

  chart.textAnchor = function(_) {
    if (!arguments.length) {
      return textAnchor;
    }
    textAnchor = _;
    return chart;
  };

  chart.direction = function(_) {
    if (!arguments.length) {
      return direction;
    }
    direction = _;
    return chart;
  };

  chart.orient = function(_) {
    if (!arguments.length) {
      return orient;
    }
    orient = _;
    axis = orient === 'bottom' ? d3.axisBottom() :
           orient === 'right' ? d3.axisRight() :
           orient === 'left' ? d3.axisLeft() :
           orient === 'top' ? d3.axisTop() : d3.axisBottom();
    return chart;
  };

  // d3 properties extended
  chart.scale = function(_) {
    if (!arguments.length) {
      return scale;
    }
    scale = _;
    axis.scale(scale);
    hasRangeBand = typeof scale.padding === 'function';
    fc.rebind(chart, scale, 'domain', 'range', 'rangeBand', 'rangeBands');
    return chart;
  };
  chart.valueFormat = function(_) {
    if (!arguments.length) {
      return valueFormat;
    }
    valueFormat = _;
    axis.tickFormat(valueFormat);
    return chart;
  };
  chart.tickValues = function(_) {
    if (!arguments.length) {
      return tickValues;
    }
    tickValues = _;
    axis.tickValues(_);
    return chart;
  };
  chart.tickSize = function(_) {
    if (!arguments.length) {
      return tickSize;
    }
    tickSize = _;
    axis.tickSize(_);
    return chart;
  };
  chart.tickPadding = function(_) {
    if (!arguments.length) {
      return tickPadding;
    }
    tickPadding = _;
    axis.tickPadding(_);
    return chart;
  };
  chart.tickFormat = function(_) {
    if (!arguments.length) {
      return tickFormat;
    }
    tickFormat = _;
    axis.tickFormat(_);
    return chart;
  };
  chart.tickSizeInner = function(_) {
    if (!arguments.length) {
      return tickSizeInner;
    }
    tickSizeInner = _;
    axis.tickSizeInner(_);
    return chart;
  };
  chart.tickSizeOuter = function(_) {
    if (!arguments.length) {
      return tickSizeOuter;
    }
    tickSizeOuter = _;
    axis.tickSizeOuter(_);
    return chart;
  };

  //============================================================

  return chart;
};
sucrose.models.legend = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 10, right: 10, bottom: 15, left: 10},
      width = 0,
      height = 0,
      align = 'right',
      direction = 'ltr',
      position = 'start',
      radius = 6, // size of dot
      diameter = radius * 2, // diamter of dot plus stroke
      gutter = 10, // horizontal gap between keys
      spacing = 12, // vertical gap between keys
      textGap = 5, // gap between dot and label accounting for dot stroke
      equalColumns = true,
      showAll = false,
      showMenu = false,
      collapsed = false,
      rowsCount = 3, //number of rows to display if showAll = false
      enabled = false,
      strings = {
        close: 'Hide legend',
        type: 'Show legend',
        noLabel: 'undefined'
      },
      id = Math.floor(Math.random() * 10000), //Create semi-unique ID in case user doesn't select one
      getKey = function(d) {
        return d.key.length > 0 || (!isNaN(parseFloat(d.key)) && isFinite(d.key)) ? d.key : legend.strings().noLabel;
      },
      color = function(d, i) { return sucrose.utils.defaultColor()(d, i); },
      classes = function(d, i) { return ''; },
      dispatch = d3.dispatch('legendClick', 'legendMouseover', 'legendMouseout', 'toggleMenu', 'closeMenu');

  // Private Variables
  //------------------------------------------------------------

  var legendOpen = 0;

  var useScroll = false,
      scrollEnabled = true,
      scrollOffset = 0,
      overflowHandler = function(d) { return; };

  //============================================================

  function legend(selection) {

    selection.each(function(data) {

      var container = d3.select(this),
          containerWidth = width,
          containerHeight = height,
          keyWidths = [],
          legendHeight = 0,
          dropdownHeight = 0,
          type = '',
          inline = position === 'start' ? true : false,
          rtl = direction === 'rtl' ? true : false,
          lineSpacing = spacing * (inline ? 1 : 0.6),
          padding = gutter + (inline ? diameter + textGap : 0);

      if (!data || !data.length || !data.filter(function(d) { return !d.values || d.values.length; }).length) {
        return legend;
      }

      // enforce existence of series for static legend keys
      var iSeries = data.filter(function(d) { return d.hasOwnProperty('series'); }).length;
      data.filter(function(d) { return !d.hasOwnProperty('series'); }).map(function(d, i) {
        d.series = iSeries;
        iSeries += 1;
      });

      enabled = true;

      type = !data[0].type || data[0].type === 'bar' ? 'bar' : 'line';
      align = rtl && align !== 'center' ? align === 'left' ? 'right' : 'left' : align;

      //------------------------------------------------------------
      // Setup containers and skeleton of legend

      var wrap_bind = container.selectAll('g.sc-chart-legend').data([data]);
      var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sc-chart-legend');
      var wrap = container.select('g.sc-chart-legend').merge(wrap_entr);
      wrap.attr('transform', 'translate(0,0)');

      var defs_entr = wrap_entr.append('defs');
      var defs = wrap.select('defs').merge(defs_entr);

      var clip_entr = defs_entr.append('clipPath').attr('id', 'sc-edge-clip-' + id).append('rect');
      var clip = wrap.select('#sc-edge-clip-' + id + ' rect').merge(clip_entr);

      var back_entr = wrap_entr.append('rect').attr('class', 'sc-legend-background');
      var back = wrap.select('.sc-legend-background').merge(back_entr);
      var backFilter = sucrose.utils.dropShadow('legend_back_' + id, defs, {blur: 2});

      var link_entr = wrap_entr.append('text').attr('class', 'sc-legend-link');
      var link = wrap.select('.sc-legend-link').merge(link_entr);

      var mask_entr = wrap_entr.append('g').attr('class', 'sc-legend-mask');
      var mask = wrap.select('.sc-legend-mask').merge(mask_entr);
      var g_entr = mask_entr.append('g').attr('class', 'sc-legend');
      var g = wrap.select('.sc-legend').merge(g_entr);


      var series_bind = g.selectAll('.sc-series').data(sucrose.identity, function(d) { return d.key; });
      series_bind.exit().remove();
      var series_entr = series_bind.enter()
        .append('g').attr('class', 'sc-series')
          .on('mouseover', function(d, i) {
            // dispatch.legendMouseover(d, i);  //TODO: Make consistent with other event objects
            dispatch.call('legendMouseover', this, d);
          })
          .on('mouseout', function(d, i) {
            // dispatch.legendMouseout(d, i);
            dispatch.call('legendMouseout', this, d);
          })
          .on('click', function(d, i) {
            d3.event.preventDefault();
            d3.event.stopPropagation();
            // dispatch.legendClick(d, i);
            dispatch.call('legendClick', this, d);
          });
      var series = g.selectAll('.sc-series').merge(series_entr);

      series_entr
        .append('rect')
          .attr('x', (diameter + textGap) / -2)
          .attr('y', (diameter + lineSpacing) / -2)
          .attr('width', diameter + textGap)
          .attr('height', diameter + lineSpacing)
          .style('fill', '#FFE')
          .style('opacity', 0.1);


      var circles_bind = series_entr.selectAll('circle').data(function(d) { return type === 'line' ? [d, d] : [d]; });
      circles_bind.exit().remove();
      var circles_entr = circles_bind.enter()
        .append('circle')
          .attr('r', radius)
          .attr('stroke', '#fff')
          .style('stroke-width', 2);
      var circles = series.selectAll('circle').merge(circles_entr);

      var line_bind = series_entr.selectAll('line').data(type === 'line' ? function(d) { return [d]; } : []);
      line_bind.exit().remove();
      var lines_entr = line_bind.enter()
        .append('line')
          .attr('x0', 0)
          .attr('y0', 0)
          .attr('y1', 0)
          .style('stroke-width', '4px');
      var lines = series.selectAll('line').merge(lines_entr);

      var texts_entr = series_entr.append('text')
        .attr('dy', inline ? '.36em' : '.71em')
        .attr('dx', 0);
      var texts = series.selectAll('text').merge(texts_entr);

      //------------------------------------------------------------
      // Update legend attributes

      clip
        .attr('x', 0.5)
        .attr('y', 0.5)
        .attr('width', 0)
        .attr('height', 0);

      back
        .attr('x', 0.5)
        .attr('y', 0.5)
        .attr('width', 0)
        .attr('height', 0)
        .style('opacity', 0)
        .style('pointer-events', 'all')
        .on('click', function(d, i) {
          d3.event.stopPropagation();
        });

      link
        .text(legendOpen === 1 ? legend.strings().close : legend.strings().open)
        .attr('text-anchor', align === 'left' ? rtl ? 'end' : 'start' : rtl ? 'start' : 'end')
        .attr('dy', '.36em')
        .attr('dx', 0)
        .style('opacity', 0)
        .on('click', function(d, i) {
          d3.event.preventDefault();
          d3.event.stopPropagation();
          dispatch.call('toggleMenu', this, d, i);
        });

      circles
        .attr('class', function(d, i) {
          return classes(d, i);
        })
        .attr('fill', function(d, i) {
          return color(d, i);
        })
        .attr('stroke', function(d, i) {
          return color(d, i);
        });

      lines
        .attr('class', function(d, i) {
          return classes(d, i);
        })
        .attr('stroke', function(d, i) {
          return color(d, i);
        });

      texts
        .text(getKey);

      series.classed('disabled', function(d) {
        return d.disabled;
      });

      //------------------------------------------------------------

      //TODO: add ability to add key to legend
      //var label = g.append('text').text('Probability:').attr('class','sc-series-label').attr('transform','translate(0,0)');

      // store legend label widths
      legend.calculateWidth = function() {
        keyWidths = [];

        g.style('display', 'inline');

        texts.each(function(d, i) {
          var textWidth = d3.select(this).node().getBoundingClientRect().width;
          keyWidths.push(Math.max(Math.floor(textWidth), (type === 'line' ? 50 : 20)));
        });

        legend.width(d3.sum(keyWidths) + keyWidths.length * padding - gutter);

        return legend.width();
      };

      legend.getLineHeight = function() {
        g.style('display', 'inline');
        var lineHeightBB = Math.floor(texts.node().getBoundingClientRect().height);
        return lineHeightBB;
      };

      legend.arrange = function(containerWidth) {

        if (keyWidths.length === 0) {
          this.calculateWidth();
        }

        function keyWidth(i) {
          return keyWidths[i] + padding;
        }
        function keyWidthNoGutter(i) {
          return keyWidths[i] + padding - gutter;
        }
        function sign(bool) {
          return bool ? 1 : -1;
        }

        var keys = keyWidths.length,
            rows = 1,
            cols = keys,
            columnWidths = [],
            keyPositions = [],
            maxWidth = containerWidth - margin.left - margin.right,
            maxRowWidth = 0,
            minRowWidth = 0,
            textHeight = this.getLineHeight(),
            lineHeight = diameter + (inline ? 0 : textHeight) + lineSpacing,
            menuMargin = {top: 7, right: 7, bottom: 7, left: 7}, // account for stroke width
            xpos = 0,
            ypos = 0,
            i,
            mod,
            shift;

        if (equalColumns) {

          //keep decreasing the number of keys per row until
          //legend width is less than the available width
          while (cols > 0) {
            columnWidths = [];

            for (i = 0; i < keys; i += 1) {
              if (keyWidth(i) > (columnWidths[i % cols] || 0)) {
                columnWidths[i % cols] = keyWidth(i);
              }
            }

            if (d3.sum(columnWidths) - gutter < maxWidth) {
              break;
            }
            cols -= 1;
          }
          cols = cols || 1;

          rows = Math.ceil(keys / cols);
          maxRowWidth = d3.sum(columnWidths) - gutter;

          for (i = 0; i < keys; i += 1) {
            mod = i % cols;

            if (inline) {
              if (mod === 0) {
                xpos = rtl ? maxRowWidth : 0;
              } else {
                xpos += columnWidths[mod - 1] * sign(!rtl);
              }
            } else {
              if (mod === 0) {
                xpos = (rtl ? maxRowWidth : 0) + (columnWidths[mod] - gutter) / 2 * sign(!rtl);
              } else {
                xpos += (columnWidths[mod - 1] + columnWidths[mod]) / 2 * sign(!rtl);
              }
            }

            ypos = Math.floor(i / cols) * lineHeight;
            keyPositions[i] = {x: xpos, y: ypos};
          }

        } else {

          if (rtl) {

            xpos = maxWidth;

            for (i = 0; i < keys; i += 1) {
              if (xpos - keyWidthNoGutter(i) < 0) {
                maxRowWidth = Math.max(maxRowWidth, keyWidthNoGutter(i));
                xpos = maxWidth;
                if (i) {
                  rows += 1;
                }
              }
              if (xpos - keyWidthNoGutter(i) > maxRowWidth) {
                maxRowWidth = xpos - keyWidthNoGutter(i);
              }
              keyPositions[i] = {x: xpos, y: (rows - 1) * (lineSpacing + diameter)};
              xpos -= keyWidth(i);
            }

          } else {

            xpos = 0;

            for (i = 0; i < keys; i += 1) {
              if (i && xpos + keyWidthNoGutter(i) > maxWidth) {
                xpos = 0;
                rows += 1;
              }
              if (xpos + keyWidthNoGutter(i) > maxRowWidth) {
                maxRowWidth = xpos + keyWidthNoGutter(i);
              }
              keyPositions[i] = {x: xpos, y: (rows - 1) * (lineSpacing + diameter)};
              xpos += keyWidth(i);
            }

          }

        }

        if (!showMenu && (showAll || rows <= rowsCount)) {

          legendOpen = 0;
          collapsed = false;
          useScroll = false;

          legend
            .width(margin.left + maxRowWidth + margin.right)
            .height(margin.top + rows * lineHeight - lineSpacing + margin.bottom);

          switch (align) {
            case 'left':
              shift = 0;
              break;
            case 'center':
              shift = (containerWidth - legend.width()) / 2;
              break;
            case 'right':
              shift = 0;
              break;
          }

          clip
            .attr('y', 0)
            .attr('width', legend.width())
            .attr('height', legend.height());

          back
            .attr('x', shift)
            .attr('width', legend.width())
            .attr('height', legend.height())
            .attr('rx', 0)
            .attr('ry', 0)
            .attr('filter', 'none')
            .style('display', 'inline')
            .style('opacity', 0);

          mask
            .attr('clip-path', 'none')
            .attr('transform', function(d, i) {
              var xpos = shift + margin.left + (inline ? radius * sign(!rtl) : 0),
                  ypos = margin.top + menuMargin.top;
              return 'translate(' + xpos + ',' + ypos + ')';
            });

          g
            .style('opacity', 1)
            .style('display', 'inline');

          series
            .attr('transform', function(d) {
              var pos = keyPositions[d.series];
              return 'translate(' + pos.x + ',' + pos.y + ')';
            });

          series.select('rect')
            .attr('x', function(d) {
              var xpos = 0;
              if (inline) {
                xpos = (diameter + gutter) / 2 * sign(rtl);
                xpos -= rtl ? keyWidth(d.series) : 0;
              } else {
                xpos = keyWidth(d.series) / -2;
              }
              return xpos;
            })
            .attr('width', function(d) {
              return keyWidth(d.series);
            })
            .attr('height', lineHeight);

          circles
            .attr('r', function(d) {
              return d.type === 'dash' ? 0 : radius;
            })
            .attr('transform', function(d, i) {
              var xpos = inline || type === 'bar' ? 0 : radius * 3 * sign(i);
              return 'translate(' + xpos + ',0)';
            });

          lines
            .attr('x1', function(d) {
              return d.type === 'dash' ? radius * 8 : radius * 4;
            })
            .attr('transform', function(d) {
              var xpos = radius * (d.type === 'dash' ? -4 : -2);
              return 'translate(' + xpos + ',0)';
            })
            .style('stroke-dasharray', function(d) {
              return d.type === 'dash' ? '8, 8' : 'none';
            })
            .style('stroke-dashoffset', -4);

          texts
            .attr('dy', inline ? '.36em' : '.71em')
            .attr('text-anchor', position)
            .attr('transform', function(d) {
              var xpos = inline ? (radius + textGap) * sign(!rtl) : 0,
                  ypos = inline ? 0 : (diameter + lineSpacing) / 2;
              return 'translate(' + xpos + ',' + ypos + ')';
            });

        } else {

          collapsed = true;
          useScroll = true;

          legend
            .width(menuMargin.left + d3.max(keyWidths) + diameter + textGap + menuMargin.right)
            .height(margin.top + diameter + margin.top); //don't use bottom here because we want vertical centering

          legendHeight = menuMargin.top + diameter * keys + spacing * (keys - 1) + menuMargin.bottom;
          dropdownHeight = Math.min(containerHeight - legend.height(), legendHeight);

          clip
            .attr('x', 0.5 - menuMargin.top - radius)
            .attr('y', 0.5 - menuMargin.top - radius)
            .attr('width', legend.width())
            .attr('height', dropdownHeight);

          back
            .attr('x', 0.5)
            .attr('y', 0.5 + legend.height())
            .attr('width', legend.width())
            .attr('height', dropdownHeight)
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('filter', backFilter)
            .style('opacity', legendOpen * 0.9)
            .style('display', legendOpen ? 'inline' : 'none');

          link
            .attr('transform', function(d, i) {
              var xpos = align === 'left' ? 0.5 : 0.5 + legend.width(),
                  ypos = margin.top + radius;
              return 'translate(' + xpos + ',' + ypos + ')';
            })
            .style('opacity', 1);

          mask
            .attr('clip-path', 'url(#sc-edge-clip-' + id + ')')
            .attr('transform', function(d, i) {
              var xpos = menuMargin.left + radius,
                  ypos = legend.height() + menuMargin.top + radius;
              return 'translate(' + xpos + ',' + ypos + ')';
            });

          g
            .style('opacity', legendOpen)
            .style('display', legendOpen ? 'inline' : 'none')
            .attr('transform', function(d, i) {
              var xpos = rtl ? d3.max(keyWidths) + radius : 0;
              return 'translate(' + xpos + ',0)';
            });

          series
            .attr('transform', function(d, i) {
              var ypos = i * (diameter + spacing);
              return 'translate(0,' + ypos + ')';
            });

          series.select('rect')
            .attr('x', function(d) {
              var w = (diameter + gutter) / 2 * sign(rtl);
              w -= rtl ? keyWidth(d.series) : 0;
              return w;
            })
            .attr('width', function(d) {
              return keyWidth(d.series);
            })
            .attr('height', diameter + lineSpacing);

          circles
            .attr('r', function(d) {
              return d.type === 'dash' ? 0 : d.type === 'line' ? radius - 2 : radius;
            })
            .attr('transform', '');

          lines
            .attr('x1', 16)
            .attr('transform', 'translate(-8,0)')
            .style('stroke-dasharray', function(d) {
              return d.type === 'dash' ? '6, 4, 6' : 'none';
            })
            .style('stroke-dashoffset', 0);

          texts
            .attr('text-anchor', 'start')
            .attr('dy', '.36em')
            .attr('transform', function(d) {
              var xpos = (radius + textGap) * sign(!rtl);
              return 'translate(' + xpos + ',0)';
            });

        }

        //------------------------------------------------------------
        // Enable scrolling
        if (scrollEnabled) {
          var diff = dropdownHeight - legendHeight;

          var assignScrollEvents = function(enable) {
            if (enable) {

              var zoom = d3.zoom()
                    .on('zoom', panLegend);
              var drag = d3.drag()
                    .subject(function(d) { return d; })
                    .on('drag', panLegend);

              back.call(zoom);
              g.call(zoom);

              back.call(drag);
              g.call(drag);

            } else {

              back
                  .on("mousedown.zoom", null)
                  .on("mousewheel.zoom", null)
                  .on("mousemove.zoom", null)
                  .on("DOMMouseScroll.zoom", null)
                  .on("dblclick.zoom", null)
                  .on("touchstart.zoom", null)
                  .on("touchmove.zoom", null)
                  .on("touchend.zoom", null)
                  .on("wheel.zoom", null);
              g
                  .on("mousedown.zoom", null)
                  .on("mousewheel.zoom", null)
                  .on("mousemove.zoom", null)
                  .on("DOMMouseScroll.zoom", null)
                  .on("dblclick.zoom", null)
                  .on("touchstart.zoom", null)
                  .on("touchmove.zoom", null)
                  .on("touchend.zoom", null)
                  .on("wheel.zoom", null);

              back
                  .on("mousedown.drag", null)
                  .on("mousewheel.drag", null)
                  .on("mousemove.drag", null)
                  .on("DOMMouseScroll.drag", null)
                  .on("dblclick.drag", null)
                  .on("touchstart.drag", null)
                  .on("touchmove.drag", null)
                  .on("touchend.drag", null)
                  .on("wheel.drag", null);
              g
                  .on("mousedown.drag", null)
                  .on("mousewheel.drag", null)
                  .on("mousemove.drag", null)
                  .on("DOMMouseScroll.drag", null)
                  .on("dblclick.drag", null)
                  .on("touchstart.drag", null)
                  .on("touchmove.drag", null)
                  .on("touchend.drag", null)
                  .on("wheel.drag", null);
            }
          };

          var panLegend = function() {
            var distance = 0,
                overflowDistance = 0,
                translate = '',
                x = 0,
                y = 0;

            // don't fire on events other than zoom and drag
            // we need click for handling legend toggle
            if (d3.event) {
              if (d3.event.type === 'zoom' && d3.event.sourceEvent) {
                x = d3.event.sourceEvent.deltaX || 0;
                y = d3.event.sourceEvent.deltaY || 0;
                distance = (Math.abs(x) > Math.abs(y) ? x : y) * -1;
              } else if (d3.event.type === 'drag') {
                x = d3.event.dx || 0;
                y = d3.event.dy || 0;
                distance = y;
              } else if (d3.event.type !== 'click') {
                return 0;
              }
              overflowDistance = (Math.abs(y) > Math.abs(x) ? y : 0);
            }

            // reset value defined in panMultibar();
            scrollOffset = Math.min(Math.max(scrollOffset + distance, diff), 0);
            translate = 'translate(' + (rtl ? d3.max(keyWidths) + radius : 0) + ',' + scrollOffset + ')';

            if (scrollOffset + distance > 0 || scrollOffset + distance < diff) {
              overflowHandler(overflowDistance);
            }

            g.attr('transform', translate);
          };

          assignScrollEvents(useScroll);
        }

      };

      //============================================================
      // Event Handling/Dispatching (in chart's scope)
      //------------------------------------------------------------

      function displayMenu() {
        back
          .style('opacity', legendOpen * 0.9)
          .style('display', legendOpen ? 'inline' : 'none');
        g
          .style('opacity', legendOpen)
          .style('display', legendOpen ? 'inline' : 'none');
        link
          .text(legendOpen === 1 ? legend.strings().close : legend.strings().open);
      }

      dispatch.on('toggleMenu', function(d) {
        d3.event.stopPropagation();
        legendOpen = 1 - legendOpen;
        displayMenu();
      });

      dispatch.on('closeMenu', function(d) {
        if (legendOpen === 1) {
          legendOpen = 0;
          displayMenu();
        }
      });

    });

    return legend;
  }


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  legend.dispatch = dispatch;

  legend.margin = function(_) {
    if (!arguments.length) { return margin; }
    margin.top    = typeof _.top    !== 'undefined' ? _.top    : margin.top;
    margin.right  = typeof _.right  !== 'undefined' ? _.right  : margin.right;
    margin.bottom = typeof _.bottom !== 'undefined' ? _.bottom : margin.bottom;
    margin.left   = typeof _.left   !== 'undefined' ? _.left   : margin.left;
    return legend;
  };

  legend.width = function(_) {
    if (!arguments.length) {
      return width;
    }
    width = Math.round(_);
    return legend;
  };

  legend.height = function(_) {
    if (!arguments.length) {
      return height;
    }
    height = Math.round(_);
    return legend;
  };

  legend.id = function(_) {
    if (!arguments.length) {
      return id;
    }
    id = _;
    return legend;
  };

  legend.key = function(_) {
    if (!arguments.length) {
      return getKey;
    }
    getKey = _;
    return legend;
  };

  legend.color = function(_) {
    if (!arguments.length) {
      return color;
    }
    color = sucrose.utils.getColor(_);
    return legend;
  };

  legend.classes = function(_) {
    if (!arguments.length) {
      return classes;
    }
    classes = _;
    return legend;
  };

  legend.align = function(_) {
    if (!arguments.length) {
      return align;
    }
    align = _;
    return legend;
  };

  legend.position = function(_) {
    if (!arguments.length) {
      return position;
    }
    position = _;
    return legend;
  };

  legend.showAll = function(_) {
    if (!arguments.length) { return showAll; }
    showAll = _;
    return legend;
  };

  legend.showMenu = function(_) {
    if (!arguments.length) { return showMenu; }
    showMenu = _;
    return legend;
  };

  legend.collapsed = function(_) {
    return collapsed;
  };

  legend.rowsCount = function(_) {
    if (!arguments.length) {
      return rowsCount;
    }
    rowsCount = _;
    return legend;
  };

  legend.spacing = function(_) {
    if (!arguments.length) {
      return spacing;
    }
    spacing = _;
    return legend;
  };

  legend.gutter = function(_) {
    if (!arguments.length) {
      return gutter;
    }
    gutter = _;
    return legend;
  };

  legend.radius = function(_) {
    if (!arguments.length) {
      return radius;
    }
    radius = _;
    return legend;
  };

  legend.strings = function(_) {
    if (!arguments.length) {
      return strings;
    }
    strings = _;
    return legend;
  };

  legend.equalColumns = function(_) {
    if (!arguments.length) {
      return equalColumns;
    }
    equalColumns = _;
    return legend;
  };

  legend.enabled = function(_) {
    if (!arguments.length) {
      return enabled;
    }
    enabled = _;
    return legend;
  };

  legend.direction = function(_) {
    if (!arguments.length) {
      return direction;
    }
    direction = _;
    return legend;
  };

  //============================================================


  return legend;
};

sucrose.models.scroll = function() {

  //============================================================
  // Public Variables
  //------------------------------------------------------------

  var id,
      margin = {},
      vertical,
      width,
      height,
      minDimension,
      panHandler,
      overflowHandler,
      enable;

  //============================================================

  function scroll(g, g_enter, scrollWrap, xAxis) {

      var defs = g.select('defs'),
          defs_enter = g_enter.select('defs'),
          scrollMask,
          scrollTarget,
          xAxisWrap = scrollWrap.select('.sc-x.sc-axis'),
          barsWrap = scrollWrap.select('.sc-barsWrap'),
          backShadows,
          foreShadows;

      var scrollOffset = 0;

      scroll.init = function(offset, overflow) {

        scrollOffset = offset;
        overflowHandler = overflow;

        this.gradients(enable);
        this.mask(enable);
        this.scrollTarget(enable);
        this.backShadows(enable);
        this.foreShadows(enable);

        this.assignEvents(enable);

        this.resize(enable);
      };

      scroll.pan = function(diff) {
        var distance = 0,
            overflowDistance = 0,
            translate = '',
            x = 0,
            y = 0;

        // don't fire on events other than zoom and drag
        // we need click for handling legend toggle
        if (d3.event) {
          if (d3.event.type === 'zoom' && d3.event.sourceEvent) {
            x = d3.event.sourceEvent.deltaX || 0;
            y = d3.event.sourceEvent.deltaY || 0;
            distance = (Math.abs(x) > Math.abs(y) ? x : y) * -1;
          } else if (d3.event.type === 'drag') {
            x = d3.event.dx || 0;
            y = d3.event.dy || 0;
            distance = vertical ? x : y;
          } else if (d3.event.type !== 'click') {
            return 0;
          }
          overflowDistance = (Math.abs(y) > Math.abs(x) ? y : 0);
        }

        // reset value defined in panMultibar();
        scrollOffset = Math.min(Math.max(scrollOffset + distance, diff), -1);
        translate = 'translate(' + (vertical ? scrollOffset + ',0' : '0,' + scrollOffset) + ')';

        if (scrollOffset + distance > 0 || scrollOffset + distance < diff) {
          overflowHandler(overflowDistance);
        }

        foreShadows
          .attr('transform', translate);
        barsWrap
          .attr('transform', translate);
        xAxisWrap.select('.sc-wrap.sc-axis')
          .attr('transform', translate);

        return scrollOffset;
      };

      scroll.assignEvents = function(enable) {
        if (enable) {

          var zoom = d3.zoom()
                .on('zoom', panHandler);
          var drag = d3.drag()
                .subject(function(d) { return d; })
                .on('drag', panHandler);

          scrollWrap
            .call(zoom);
          scrollTarget
            .call(zoom);

          scrollWrap
            .call(drag);
          scrollTarget
            .call(drag);

        } else {

          scrollWrap
              .on("mousedown.zoom", null)
              .on("mousewheel.zoom", null)
              .on("mousemove.zoom", null)
              .on("DOMMouseScroll.zoom", null)
              .on("dblclick.zoom", null)
              .on("touchstart.zoom", null)
              .on("touchmove.zoom", null)
              .on("touchend.zoom", null)
              .on("wheel.zoom", null);
          scrollTarget
              .on("mousedown.zoom", null)
              .on("mousewheel.zoom", null)
              .on("mousemove.zoom", null)
              .on("DOMMouseScroll.zoom", null)
              .on("dblclick.zoom", null)
              .on("touchstart.zoom", null)
              .on("touchmove.zoom", null)
              .on("touchend.zoom", null)
              .on("wheel.zoom", null);

          scrollWrap
              .on("mousedown.drag", null)
              .on("mousewheel.drag", null)
              .on("mousemove.drag", null)
              .on("DOMMouseScroll.drag", null)
              .on("dblclick.drag", null)
              .on("touchstart.drag", null)
              .on("touchmove.drag", null)
              .on("touchend.drag", null)
              .on("wheel.drag", null);
          scrollTarget
              .on("mousedown.drag", null)
              .on("mousewheel.drag", null)
              .on("mousemove.drag", null)
              .on("DOMMouseScroll.drag", null)
              .on("dblclick.drag", null)
              .on("touchstart.drag", null)
              .on("touchmove.drag", null)
              .on("touchend.drag", null)
              .on("wheel.drag", null);
        }
      };

      scroll.resize = function(enable) {

        if (!enable) {
          return;
        }
        var labelOffset = xAxis.labelThickness() + xAxis.tickPadding() / 2,
            v = vertical,
            x = v ? margin.left : labelOffset,
            y = margin.top,
            scrollWidth = width + (v ? 0 : margin[xAxis.orient()] - labelOffset),
            scrollHeight = height + (v ? margin[xAxis.orient()] - labelOffset : 0),
            dim = v ? 'height' : 'width',
            val = v ? scrollHeight : scrollWidth;

        scrollMask
          .attr('x', v ? 2 : -margin.left)
          .attr('y', v ? 0 : 2)
          .attr('width', width + (v ? -2 : margin.left))
          .attr('height', height + (v ? margin.bottom : -2));

        scrollTarget
          .attr('x', x)
          .attr('y', y)
          .attr('width', scrollWidth)
          .attr('height', scrollHeight);

        backShadows.select('.sc-back-shadow-prev')
          .attr('x', x)
          .attr('y', y)
          .attr(dim, val);

        backShadows.select('.sc-back-shadow-more')
          .attr('x', x + (v ? width - 5 : 1))
          .attr('y', y + (v ? 0 : height - 6))
          .attr(dim, val);

        foreShadows.select('.sc-fore-shadow-prev')
          .attr('x', x + (v ? 1 : 0))
          .attr('y', y + (v ? 0 : 1))
          .attr(dim, val);

        foreShadows.select('.sc-fore-shadow-more')
          .attr('x', x + (v ? minDimension - 17 : 0))
          .attr('y', y + (v ? 0 : minDimension - 19))
          .attr(dim, val);
      };

      /* Background gradients */
      scroll.gradients = function(enable) {
        defs_enter
          .append('linearGradient')
          .attr('class', 'sc-scroll-gradient')
          .attr('id', 'sc-back-gradient-prev-' + id);
        var bgpEnter = defs_enter.select('#sc-back-gradient-prev-' + id);

        defs_enter
          .append('linearGradient')
          .attr('class', 'sc-scroll-gradient')
          .attr('id', 'sc-back-gradient-more-' + id);
        var bgmEnter = defs_enter.select('#sc-back-gradient-more-' + id);

        /* Foreground gradients */
        defs_enter
          .append('linearGradient')
          .attr('class', 'sc-scroll-gradient')
          .attr('id', 'sc-fore-gradient-prev-' + id);
        var fgpEnter = defs_enter.select('#sc-fore-gradient-prev-' + id);

        defs_enter
          .append('linearGradient')
          .attr('class', 'sc-scroll-gradient')
          .attr('id', 'sc-fore-gradient-more-' + id);
        var fgmEnter = defs_enter.select('#sc-fore-gradient-more-' + id);

        defs.selectAll('.sc-scroll-gradient')
          .attr('gradientUnits', 'objectBoundingBox')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('x2', vertical ? 1 : 0)
          .attr('y2', vertical ? 0 : 1);

        bgpEnter
          .append('stop')
          .attr('stop-color', '#000')
          .attr('stop-opacity', '0.3')
          .attr('offset', 0);
        bgpEnter
          .append('stop')
          .attr('stop-color', '#FFF')
          .attr('stop-opacity', '0')
          .attr('offset', 1);
        bgmEnter
          .append('stop')
          .attr('stop-color', '#FFF')
          .attr('stop-opacity', '0')
          .attr('offset', 0);
        bgmEnter
          .append('stop')
          .attr('stop-color', '#000')
          .attr('stop-opacity', '0.3')
          .attr('offset', 1);

        fgpEnter
          .append('stop')
          .attr('stop-color', '#FFF')
          .attr('stop-opacity', '1')
          .attr('offset', 0);
        fgpEnter
          .append('stop')
          .attr('stop-color', '#FFF')
          .attr('stop-opacity', '0')
          .attr('offset', 1);
        fgmEnter
          .append('stop')
          .attr('stop-color', '#FFF')
          .attr('stop-opacity', '0')
          .attr('offset', 0);
        fgmEnter
          .append('stop')
          .attr('stop-color', '#FFF')
          .attr('stop-opacity', '1')
          .attr('offset', 1);
      };

      scroll.mask = function(enable) {
        defs_enter.append('clipPath')
          .attr('class', 'sc-scroll-mask')
          .attr('id', 'sc-edge-clip-' + id)
          .append('rect');

        scrollMask = defs.select('.sc-scroll-mask rect');

        scrollWrap.attr('clip-path', enable ? 'url(#sc-edge-clip-' + id + ')' : '');
      };

      scroll.scrollTarget = function(enable) {
        g_entr.select('.sc-scroll-background')
          .append('rect')
          .attr('class', 'sc-scroll-target')
          //.attr('fill', '#FFF');
          .attr('fill', 'transparent');

        scrollTarget = g.select('.sc-scroll-target');
      };

      /* Background shadow rectangles */
      scroll.backShadows = function(enable) {
        var shadowWrap = g_entr.select('.sc-scroll-background')
              .append('g')
              .attr('class', 'sc-back-shadow-wrap');

        shadowWrap
          .append('rect')
          .attr('class', 'sc-back-shadow-prev');
        shadowWrap
          .append('rect')
          .attr('class', 'sc-back-shadow-more');

        backShadows = g.select('.sc-back-shadow-wrap');

        if (enable) {
          var dimension = vertical ? 'width' : 'height';

          backShadows.select('rect.sc-back-shadow-prev')
            .attr('fill', 'url(#sc-back-gradient-prev-' + id + ')')
            .attr(dimension, 7);

          backShadows.select('rect.sc-back-shadow-more')
            .attr('fill', 'url(#sc-back-gradient-more-' + id + ')')
            .attr(dimension, 7);
        } else {
          backShadows.selectAll('rect').attr('fill', 'transparent');
        }
      };

      /* Foreground shadow rectangles */
      scroll.foreShadows = function(enable) {
        var shadowWrap = g_entr.select('.sc-scroll-background')
              .insert('g')
              .attr('class', 'sc-fore-shadow-wrap');

        shadowWrap
          .append('rect')
          .attr('class', 'sc-fore-shadow-prev');
        shadowWrap
          .append('rect')
          .attr('class', 'sc-fore-shadow-more');

        foreShadows = g.select('.sc-fore-shadow-wrap');

        if (enable) {
          var dimension = vertical ? 'width' : 'height';

          foreShadows.select('rect.sc-fore-shadow-prev')
            .attr('fill', 'url(#sc-fore-gradient-prev-' + id + ')')
            .attr(dimension, 20);

          foreShadows.select('rect.sc-fore-shadow-more')
            .attr('fill', 'url(#sc-fore-gradient-more-' + id + ')')
            .attr(dimension, 20);
        } else {
          foreShadows.selectAll('rect').attr('fill', 'transparent');
        }
      };

    return scroll;
  }


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  scroll.id = function(_) {
    if (!arguments.length) {
      return id;
    }
    id = _;
    return scroll;
  };

  scroll.margin = function(_) {
    if (!arguments.length) {
      return margin;
    }
    margin.top    = typeof _.top    != 'undefined' ? _.top    : margin.top;
    margin.right  = typeof _.right  != 'undefined' ? _.right  : margin.right;
    margin.bottom = typeof _.bottom != 'undefined' ? _.bottom : margin.bottom;
    margin.left   = typeof _.left   != 'undefined' ? _.left   : margin.left;
    return scroll;
  };

  scroll.width = function(_) {
    if (!arguments.length) {
      return width;
    }
    width = _;
    return scroll;
  };

  scroll.height = function(_) {
    if (!arguments.length) {
      return height;
    }
    height = _;
    return scroll;
  };

  scroll.vertical = function(_) {
    if (!arguments.length) {
      return vertical;
    }
    vertical = _;
    return scroll;
  };

  scroll.minDimension = function(_) {
    if (!arguments.length) {
      return minDimension;
    }
    minDimension = _;
    return scroll;
  };

  scroll.panHandler = function(_) {
    if (!arguments.length) {
      return panHandler;
    }
    panHandler = sucrose.functor(_);
    return scroll;
  };

  scroll.enable = function(_) {
    if (!arguments.length) {
      return enable;
    }
    enable = _;
    return scroll;
  };

  //============================================================

  return scroll;
};
sucrose.models.scatter = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 0, right: 0, bottom: 0, left: 0},
      width = 960,
      height = 500,
      color = function(d, i) { return sucrose.utils.defaultColor()(d, d.series); }, // chooses color
      fill = color,
      classes = function(d, i) { return 'sc-group sc-series-' + d.series; },
      id = Math.floor(Math.random() * 100000), //Create semi-unique ID incase user doesn't select one
      x = d3.scaleLinear(),
      y = d3.scaleLinear(),
      z = d3.scaleLinear(), //linear because d3.svg.shape.size is treated as area
      getX = function(d) { return d.x; }, // accessor to get the x value
      getY = function(d) { return d.y; }, // accessor to get the y value
      getSize = function(d) { return d.size || 1; }, // accessor to get the point size
      getShape = function(d) { return d.shape || 'circle'; }, // accessor to get point shape
      locality = sucrose.utils.buildLocality(),
      onlyCircles = true, // Set to false to use shapes
      forceX = [], // List of numbers to Force into the X scale (ie. 0, or a max / min, etc.)
      forceY = [], // List of numbers to Force into the Y scale
      forceSize = [], // List of numbers to Force into the Size scale
      interactive = true, // If true, plots a voronoi overlay for advanced point intersection
      pointActive = function(d) { return !d.notActive; }, // any points that return false will be filtered out
      padData = false, // If true, adds half a data points width to front and back, for lining up a line chart with a bar chart
      padDataOuter = 0.1, //outerPadding to imitate ordinal scale outer padding
      clipEdge = false, // if true, masks points within x and y scale
      useVoronoi = true,
      clipVoronoi = true, // if true, masks each point with a circle... can turn off to slightly increase performance
      circleRadius = function(d, i) {
        return Math.sqrt(z(getSize(d, i)) / Math.PI);
      }, // function to get the radius for voronoi point clips
      symbolSize = function(d, i) {
        return z(getSize(d, i));
      },
      xDomain = null, // Override x domain (skips the calculation from data)
      yDomain = null, // Override y domain
      sizeDomain = null, // Override point size domain
      sizeRange = [16, 256],
      singlePoint = false,
      dispatch = d3.dispatch('elementClick', 'elementMouseover', 'elementMouseout', 'elementMousemove'),
      nice = false;

  //============================================================


  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var x0, y0, z0, // used to store previous scales
      timeoutID,
      needsUpdate = false; // Flag for when the points are visually updating, but the interactive layer is behind, to disable tooltips

  //============================================================


  function chart(selection) {
    selection.each(function(data) {
      var availableWidth = width - margin.left - margin.right,
          availableHeight = height - margin.top - margin.bottom,
          container = d3.select(this);

      //add series index to each data point for reference
      data = data.map(function(series, i) {
        series.values = series.values.map(function(point) {
          point.series = i;
          return point;
        });
        return series;
      });

      //------------------------------------------------------------
      // Setup Scales

      // remap and flatten the data for use in calculating the scales' domains
      var seriesData = (xDomain && yDomain && sizeDomain) ? [] : // if we know xDomain and yDomain and sizeDomain, no need to calculate.... if Size is constant remember to set sizeDomain to speed up performance
            d3.merge(
              data.map(function(d) {
                return d.values.map(function(d, i) {
                  return { x: getX(d, i), y: getY(d, i), size: getSize(d, i) };
                });
              })
            );

      chart.resetDimensions = function(w, h) {
        width = w;
        height = h;
        availableWidth = w - margin.left - margin.right;
        availableHeight = h - margin.top - margin.bottom;
        resetScale();
      };

      function resetScale() {
        x.domain(xDomain || d3.extent(seriesData.map(function(d) { return d.x; }).concat(forceX)));
        y.domain(yDomain || d3.extent(seriesData.map(function(d) { return d.y; }).concat(forceY)));

        if (padData && data[0]) {
          if (padDataOuter === -1) {
            // shift range so that largest bubble doesn't cover scales
            var largestPossible = Math.sqrt(sizeRange[1] / Math.PI);
            x.range([
              0 + largestPossible,
              availableWidth - largestPossible
            ]);
            y.range([
              availableHeight - largestPossible,
              0 + largestPossible
            ]);
          } else if (padDataOuter < 1) {
            // adjust range to line up with value bars
            x.range([
              (availableWidth * padDataOuter + availableWidth) / (2 * data[0].values.length),
              availableWidth - availableWidth * (1 + padDataOuter) / (2 * data[0].values.length)
            ]);
            y.range([availableHeight, 0]);
          } else {
            x.range([
              padDataOuter,
              availableWidth - padDataOuter
            ]);
            y.range([
              availableHeight - padDataOuter,
              padDataOuter
            ]);
          }
          // From original sucrose
          //x.range([
          //   availableWidth * .5 / data[0].values.length,
          //   availableWidth * (data[0].values.length - .5) / data[0].values.length
          // ]);
        } else {
          x.range([0, availableWidth]);
          y.range([availableHeight, 0]);
        }

        if (nice) {
          y.nice();
        }

        z.domain(sizeDomain || d3.extent(seriesData.map(function(d) { return d.size; }).concat(forceSize)))
         .range(sizeRange);

        // If scale's domain don't have a range, slightly adjust to make one... so a chart can show a single data point
        if (x.domain()[0] === x.domain()[1] || y.domain()[0] === y.domain()[1]) singlePoint = true;
        if (x.domain()[0] === x.domain()[1])
          x.domain()[0] ?
              x.domain([x.domain()[0] - x.domain()[0] * 0.1, x.domain()[1] + x.domain()[1] * 0.1]) :
              x.domain([-1, 1]);

        if (y.domain()[0] === y.domain()[1])
          y.domain()[0] ?
              y.domain([y.domain()[0] - y.domain()[0] * 0.1, y.domain()[1] + y.domain()[1] * 0.1]) :
              y.domain([-1, 1]);

        if (z.domain().length < 2) {
          z.domain([0, z.domain()]);
        }

        x0 = x0 || x;
        y0 = y0 || y;
        z0 = z0 || z;
      }

      resetScale();

      //------------------------------------------------------------

      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap_bind = container.selectAll('g.sc-wrap.sc-scatter').data([data]);
      var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-scatter sc-chart-' + id);
      var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
      var defs_entr = wrap_entr.append('defs');
      var g_entr =wrap_entr.append('g').attr('class', 'sc-chart-wrap');
      var g = container.select('g.sc-chart-wrap').merge(g_entr);

      //set up the gradient constructor function
      chart.gradient = function(d, i) {
        return sucrose.utils.colorRadialGradient(d, id + '-' + i, {x: 0.5, y: 0.5, r: 0.5, s: 0, u: 'objectBoundingBox'}, color(d, i), wrap.select('defs'));
      };

      g_entr.append('g').attr('class', 'sc-groups');
      g_entr.append('g').attr('class', 'sc-point-paths');

      wrap
        .classed('sc-single-point', singlePoint)
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      //------------------------------------------------------------

      defs_entr.append('clipPath')
        .attr('id', 'sc-edge-clip-' + id)
        .append('rect');
      defs_entr.append('clipPath')
        .attr('id', 'sc-points-clip-' + id)
        .attr('class', 'sc-point-clips');

      wrap.select('#sc-edge-clip-' + id + ' rect')
          .attr('width', availableWidth)
          .attr('height', availableHeight);

      g.attr('clip-path', clipEdge ? 'url(#sc-edge-clip-' + id + ')' : '');


      var t = d3.transition('scatter')
          .duration(400)
          .ease(d3.easeLinear);

      function updateInteractiveLayer() {

        if (!interactive) {
          return false;
        }

        function buildEventObject(e, d, i, j) {
          var seriesData = data[j];
          return {
              series: seriesData,
              point: seriesData.values[i],
              pointIndex: i,
              seriesIndex: seriesData.series,
              id: id,
              e: e
            };
        }

        //inject series and point index for reference into voronoi
        if (useVoronoi === true) {

          var vertices = d3.merge(data.map(function(group, groupIndex) {
              return group.values
                .map(function(point, pointIndex) {
                  // *Adding noise to make duplicates very unlikely
                  // *Injecting series and point index for reference
                  /* *Adding a 'jitter' to the points, because there's an issue in d3.geom.voronoi.
                   */
                  var pX = getX(point, pointIndex);
                  var pY = getY(point, pointIndex);

                  return [x(pX) + Math.random() * 1e-4,
                          y(pY) + Math.random() * 1e-4,
                      groupIndex,
                      pointIndex, point]; //temp hack to add noise until I think of a better way so there are no duplicates
                })
                .filter(function(pointArray, pointIndex) {
                  return pointActive(pointArray[4], pointIndex); // Issue #237.. move filter to after map, so pointIndex is correct!
                });
            })
          );

          if (clipVoronoi) {
            var clips_bind = wrap.select('#sc-points-clip-' + id).selectAll('circle')
                  .data(vertices);
            var clips_entr = clips_bind.enter().append('circle');
            var clips = wrap.select('#sc-points-clip-' + id).selectAll('circle')
                  .merge(clips_entr);
            clips
              .attr('cx', function(d) { return d[0] })
              .attr('cy', function(d) { return d[1] })
              .attr('r', function(d, i) {
                return circleRadius(d[4], i);
              });
            clips_bind.exit().remove();

            wrap.select('.sc-point-paths')
                .attr('clip-path', 'url(#sc-points-clip-' + id + ')');
          }

          if (vertices.length <= 3) {
            // Issue #283 - Adding 2 dummy points to the voronoi b/c voronoi requires min 3 points to work
            vertices.push([x.range()[0] - 20, y.range()[0] - 20, null, null]);
            vertices.push([x.range()[1] + 20, y.range()[1] + 20, null, null]);
            vertices.push([x.range()[0] - 20, y.range()[0] + 20, null, null]);
            vertices.push([x.range()[1] + 20, y.range()[1] - 20, null, null]);
          }

          var voronoi = d3.voronoi()
                .extent([[-10, -10], [width + 10, height + 10]])
                .polygons(vertices)
                .map(function(d, i) {
                  return {
                    'data': d,
                    'series': vertices[i][2],
                    'point': vertices[i][3]
                  };
                })
                .filter(function(d) { return d.series !== null; });

          var paths_bind = wrap.select('.sc-point-paths').selectAll('path')
                .data(voronoi);
          var paths_entr = paths_bind.enter().append('path')
                .attr('class', function(d, i) { return 'sc-path-' + i; });
          var paths = wrap.select('.sc-point-paths').selectAll('path')
                .merge(paths_entr);
          paths
            .attr('d', function(d) { return d ? 'M' + d.data.join('L') + 'Z' : null; });
          paths_bind.exit().remove();

          paths
            .on('mouseover', function(d) {
              if (needsUpdate) return 0;
              var eo = buildEventObject(d3.event, d, d.point, d.series);
              dispatch.call('elementMouseover', this, eo);
            })
            .on('mousemove', function(d, i) {
              var e = d3.event;
              dispatch.call('elementMousemove', this, e);
            })
            .on('mouseout', function(d, i) {
              if (needsUpdate) return 0;
              dispatch.call('elementMouseout', this);
            })
            .on('click', function(d) {
              if (needsUpdate) return 0;
              var eo = buildEventObject(d3.event, d, d.point, d.series);
              dispatch.call('elementClick', this, eo);
            });

        } else {

          // add event handlers to points instead voronoi paths
          wrap.select('.sc-groups').selectAll('.sc-group')
            .selectAll('.sc-point')
              //.data(dataWithPoints)
              .style('pointer-events', 'auto') // recativate events, disabled by css
              .on('mouseover', function(d, i) {
                if (needsUpdate || !data[d.series]) return 0; //check if this is a dummy point
                var eo = buildEventObject(d3.event, d, i, d.series);
                dispatch.call('elementMouseover', this, eo);
              })
              .on('mousemove', function(d, i) {
                var e = d3.event;
                dispatch.call('elementMousemove', this, e);
              })
              .on('mouseout', function(d, i) {
                if (needsUpdate || !data[d.series]) return 0; //check if this is a dummy point
                dispatch.call('elementMouseout', this);
              })
              .on('click', function(d, i) {
                if (needsUpdate || !data[d.series]) return 0; //check if this is a dummy point
                var eo = buildEventObject(d3.event, d, i, d.series);
                dispatch.call('elementClick', this, eo);
              });

        }

        needsUpdate = false;
      }

      needsUpdate = true;

      var groups_bind = wrap.select('.sc-groups').selectAll('.sc-group')
            .data(function(d) { return d; }, function(d) { return d.series; });
      var groups_entr = groups_bind.enter().append('g')
            .attr('class', 'sc-group')
            .style('stroke-opacity', 1e-6)
            .style('fill-opacity', 1e-6);
      var groups = wrap.select('.sc-groups').selectAll('.sc-group')
            .merge(groups_entr);

      groups
        .attr('class', function(d, i) { return classes(d, d.series); })
        .attr('fill', function(d, i) { return fill(d, d.series); })
        .attr('stroke', function(d, i) { return fill(d, d.series); })
        .classed('hover', function(d) { return d.hover; });
      groups
        .transition(t)
          .style('stroke-opacity', 1)
          .style('fill-opacity', 0.5);
      groups_bind.exit()
        .transition(t)
          .style('stroke-opacity', 1e-6)
          .style('fill-opacity', 1e-6)
          .remove();

      if (onlyCircles) {

        var points_bind = groups.selectAll('circle.sc-point')
              .data(function(d) { return d.values; });
        var points_entr = points_bind.enter().append('circle')
              .attr('class', function(d, i) { return 'sc-point sc-enter sc-point-' + i; })
              .attr('r', circleRadius);
        var points = groups.selectAll('.sc-point')
              .merge(points_entr);

        points
          .filter(function(d) {
            return d3.select(this).classed('sc-enter');
          })
          .attr('cx', function(d, i) { return x(getX(d, i)); })
          .attr('cy', function(d, i) { return y(0); });
        points
          .transition(t)
            .attr('cx', function(d, i) { return x(getX(d, i)); })
            .attr('cy', function(d, i) { return y(getY(d, i)); })
            .on('end', function(d) {
              d3.select(this).classed('sc-enter', false);
            });

        groups_bind.exit()
          .transition(t).selectAll('.sc-point')
            .attr('cx', function(d, i) { return x(getX(d, i)); })
            .attr('cy', function(d, i) { return y(0); })
            .remove();

      } else {

        var points_bind = groups.selectAll('path.sc-point')
              .data(function(d) { return d.values; });
        var points_enter = points_bind.enter().append('path')
              .attr('class', function(d, i) { return 'sc-point sc-enter sc-point-' + i; })
              .attr('d',
                d3.svg.symbol()
                  .type(getShape)
                  .size(symbolSize)
              );
        var points = groups.selectAll('.sc-point')
              .merge(points_entr)

        points
          .filter(function(d) {
            return d3.select(this).classed('sc-enter');
          })
          .attr('transform', function(d, i) {
            return 'translate(' + x0(getX(d, i)) + ',' + y(0) + ')';
          })
        points
          .transition(t)
            .attr('transform', function(d, i) {
              return 'translate(' + x(getX(d, i)) + ',' + y(getY(d, i)) + ')';
            })
            .attr('d',
              d3.svg.symbol()
                .type(getShape)
                .size(symbolSize)
            );

        groups_bind.exit()
          .transition(t).selectAll('.sc-point')
            .attr('transform', function(d, i) {
              return 'translate(' + x(getX(d, i)) + ',' + y(0) + ')';
            })
            .remove();

      }


      // Delay updating the invisible interactive layer for smoother animation
      clearTimeout(timeoutID); // stop repeat calls to updateInteractiveLayer
      timeoutID = setTimeout(updateInteractiveLayer, 300);
      //updateInteractiveLayer();

      //store old scales for use in transitions on update
      x0 = x.copy();
      y0 = y.copy();
      z0 = z.copy();

    });

    return chart;
  }


  //============================================================
  // Event Handling/Dispatching (out of chart's scope)
  //------------------------------------------------------------

  // dispatch.on('elementMouseover.point', function(d) {
  //   if (interactive)
  //     d3.select('.sc-chart-' + id + ' .sc-series-' + d.seriesIndex + ' .sc-point-' + d.pointIndex)
  //         .classed('hover', true);
  // });

  // dispatch.on('elementMouseout.point', function(d) {
  //   if (interactive)
  //     d3.select('.sc-chart-' + id + ' .sc-series-' + d.seriesIndex + ' .sc-point-' + d.pointIndex)
  //         .classed('hover', false);
  // });

  //============================================================


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  chart.dispatch = dispatch;

  chart.color = function(_) {
    if (!arguments.length) return color;
    color = _;
    return chart;
  };
  chart.fill = function(_) {
    if (!arguments.length) return fill;
    fill = _;
    return chart;
  };
  chart.classes = function(_) {
    if (!arguments.length) return classes;
    classes = _;
    return chart;
  };
  chart.gradient = function(_) {
    if (!arguments.length) return gradient;
    gradient = _;
    return chart;
  };

  chart.x = function(_) {
    if (!arguments.length) return getX;
    getX = sucrose.functor(_);
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) return getY;
    getY = sucrose.functor(_);
    return chart;
  };

  chart.size = function(_) {
    if (!arguments.length) return getSize;
    getSize = sucrose.functor(_);
    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) return margin;
    margin.top    = typeof _.top    != 'undefined' ? _.top    : margin.top;
    margin.right  = typeof _.right  != 'undefined' ? _.right  : margin.right;
    margin.bottom = typeof _.bottom != 'undefined' ? _.bottom : margin.bottom;
    margin.left   = typeof _.left   != 'undefined' ? _.left   : margin.left;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return chart;
  };

  chart.xScale = function(_) {
    if (!arguments.length) return x;
    x = _;
    return chart;
  };

  chart.yScale = function(_) {
    if (!arguments.length) return y;
    y = _;
    return chart;
  };

  chart.zScale = function(_) {
    if (!arguments.length) return z;
    z = _;
    return chart;
  };

  chart.xDomain = function(_) {
    if (!arguments.length) return xDomain;
    xDomain = _;
    return chart;
  };

  chart.yDomain = function(_) {
    if (!arguments.length) return yDomain;
    yDomain = _;
    return chart;
  };

  chart.sizeDomain = function(_) {
    if (!arguments.length) return sizeDomain;
    sizeDomain = _;
    return chart;
  };

  chart.sizeRange = function(_) {
    if (!arguments.length) return sizeRange;
    sizeRange = _;
    return chart;
  };

  chart.forceX = function(_) {
    if (!arguments.length) return forceX;
    forceX = _;
    return chart;
  };

  chart.forceY = function(_) {
    if (!arguments.length) return forceY;
    forceY = _;
    return chart;
  };

  chart.forceSize = function(_) {
    if (!arguments.length) return forceSize;
    forceSize = _;
    return chart;
  };

  chart.interactive = function(_) {
    if (!arguments.length) return interactive;
    interactive = _;
    return chart;
  };

  chart.pointActive = function(_) {
    if (!arguments.length) return pointActive;
    pointActive = _;
    return chart;
  };

  chart.padData = function(_) {
    if (!arguments.length) return padData;
    padData = _;
    return chart;
  };

  chart.padDataOuter = function(_) {
    if (!arguments.length) return padDataOuter;
    padDataOuter = _;
    return chart;
  };

  chart.clipEdge = function(_) {
    if (!arguments.length) return clipEdge;
    clipEdge = _;
    return chart;
  };

  chart.clipVoronoi = function(_) {
    if (!arguments.length) return clipVoronoi;
    clipVoronoi = _;
    return chart;
  };

  chart.useVoronoi = function(_) {
    if (!arguments.length) return useVoronoi;
    useVoronoi = _;
    if (useVoronoi === false) {
        clipVoronoi = false;
    }
    return chart;
  };

  chart.circleRadius = function(_) {
    if (!arguments.length) return circleRadius;
    circleRadius = _;
    return chart;
  };

  chart.shape = function(_) {
    if (!arguments.length) return getShape;
    getShape = _;
    return chart;
  };

  chart.onlyCircles = function(_) {
    if (!arguments.length) return onlyCircles;
    onlyCircles = _;
    return chart;
  };

  chart.id = function(_) {
    if (!arguments.length) return id;
    id = _;
    return chart;
  };

  chart.singlePoint = function(_) {
    if (!arguments.length) return singlePoint;
    singlePoint = _;
    return chart;
  };

  chart.nice = function(_) {
    if (!arguments.length) {
      return nice;
    }
    nice = _;
    return chart;
  };

  chart.locality = function(_) {
    if (!arguments.length) {
      return locality;
    }
    locality = sucrose.utils.buildLocality(_);
    return chart;
  };

  //============================================================

  return chart;
};
sucrose.models.bubbleChart = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 10, right: 10, bottom: 10, left: 10},
      width = null,
      height = null,
      showTitle = false,
      showControls = false,
      showLegend = true,
      direction = 'ltr',
      getX = function(d) { return d.x; },
      getY = function(d) { return d.y; },
      forceY = [0], // 0 is forced by default.. this makes sense for the majority of bar graphs... user can always do chart.forceY([]) to remove
      xDomain,
      yDomain,
      delay = 200,
      groupBy = function(d) { return d.y; },
      filterBy = function(d) { return d.y; },
      clipEdge = false, // if true, masks lines within x and y scale
      seriesLength = 0,
      reduceYTicks = false, // if false a tick will show for every data point
      bubbleClick = function(e) { return; },
      format = d3.timeFormat('%Y-%m-%d'),
      tooltip = null,
      tooltips = true,
      tooltipContent = function(key, x, y, e, graph) {
        return '<h3>' + key + '</h3>' +
               '<p>' + y + ' on ' + x + '</p>';
      },
      x,
      y,
      state = {},
      strings = {
        legend: {close: 'Hide legend', open: 'Show legend'},
        controls: {close: 'Hide controls', open: 'Show controls'},
        noData: 'No Data Available.',
        noLabel: 'undefined'
      },
      dispatch = d3.dispatch('chartClick', 'tooltipShow', 'tooltipHide', 'tooltipMove', 'stateChange', 'changeState');

  //============================================================
  // Private Variables
  //------------------------------------------------------------
  var xValueFormat = function(d, labels, isDate) {
          var val = isNaN(parseInt(d, 10)) || !labels || !Array.isArray(labels) ?
            d : labels[parseInt(d, 10)] || d;
          return isDate ? sucrose.utils.dateFormat(val, 'MMM', chart.locality()) : val;
      };
  var yValueFormat = function(d, labels, isCurrency) {
          var val = isNaN(parseInt(d, 10)) || !labels || !Array.isArray(labels) ?
            d : labels[parseInt(d, 10)].key || d;
          return sucrose.utils.numberFormatSI(val, 2, isCurrency, chart.locality());
      };

  var scatter = sucrose.models.scatter()
        .padData(true)
        .padDataOuter(-1)
        .size(function(d) { return d.y; })
        .sizeRange([256, 1024])
        .singlePoint(true),
      xAxis = sucrose.models.axis(),
      yAxis = sucrose.models.axis(),
      legend = sucrose.models.legend()
        .align('center')
        .key(function(d) { return d.key + '%'; });

  var showTooltip = function(eo, offsetElement, properties) {
    var key = eo.series.key,
        x = eo.point.x,
        y = eo.point.y,
        content = tooltipContent(key, x, y, eo, chart),
        gravity = eo.value < 0 ? 'n' : 's';

    tooltip = sucrose.tooltip.show(eo.e, content, gravity, null, offsetElement);
  };

  //============================================================

  function chart(selection) {

    selection.each(function(chartData) {

      var that = this,
          container = d3.select(this);

      var properties = chartData ? chartData.properties : {},
          data = chartData ? chartData.data : null;

      var filteredData,
          timeExtent,
          xD,
          yD,
          yValues,
          xIsDatetime = chartData.properties.xDataType === 'datetime' || false,
          yIsCurrency = chartData.properties.yDataType === 'currency' || false;

      chart.container = this;

      chart.update = function() {
        container.transition().call(chart);
      };

      //------------------------------------------------------------
      // Private method for displaying no data message.

      function displayNoData(d) {
        if (d && d.length) {
          container.selectAll('.sc-noData').remove();
          return false;
        }

        container.select('.sucrose.sc-wrap').remove();

        var w = width || parseInt(container.style('width'), 10) || 960,
            h = height || parseInt(container.style('height'), 10) || 400,
            noDataText = container.selectAll('.sc-noData').data([chart.strings().noData]);

        noDataText.enter().append('text')
          .attr('class', 'sucrose sc-noData')
          .attr('dy', '-.7em')
          .style('text-anchor', 'middle');

        noDataText
          .attr('x', margin.left + w / 2)
          .attr('y', margin.top + h / 2)
          .text(function(d) {
            return d;
          });

        return true;
      }

      // Check to see if there's nothing to show.
      if (displayNoData(data)) {
        return chart;
      }

      //------------------------------------------------------------
      // Process data

      // set title display option
      showTitle = showTitle && properties.title;

      function getTimeDomain(data) {
        var timeExtent =
              d3.extent(
                d3.merge(
                  data.map(function(d) {
                    return d.values.map(function(d, i) {
                      return d3.timeParse('%Y-%m-%d')(getX(d));
                    });
                  })
                )
              );
        var timeRange = [
          d3.timeMonth.floor(timeExtent[0]),
          d3.timeDay.offset(d3.timeMonth.ceil(timeExtent[1]), -1)
        ];
        return timeRange;
      }

      // Calculate the x-axis ticks
      function getTimeTicks(timeDomain) {
        function daysInMonth(date) {
          return 32 - new Date(date.getFullYear(), date.getMonth(), 32).getDate();
        }
        var timeRange = d3.timeMonth.range(timeDomain[0], timeDomain[1]);
        var timeTicks =
              timeRange.map(function(d) {
                return d3.timeDay.offset(d3.timeMonth.floor(d), daysInMonth(d) / 2 - 1);
              });
        return timeTicks;
      }

      // Group data by groupBy function to prep data for calculating y-axis groups
      // and y scale value for points
      function getGroupTicks(data) {

        var groupedData = d3.nest()
              .key(groupBy)
              .entries(data);

        // Calculate y scale parameters
        var gHeight = 1000 / groupedData.length,
            gOffset = gHeight * 0.25,
            gDomain = [0, 1],
            gRange = [0, 1],
            gScale = d3.scaleLinear().domain(gDomain).range(gRange),
            yValues = [],
            total = 0;

        // Calculate total for each data group and
        // point y value
        groupedData
          .map(function(s, i) {
            s.total = 0;

            s.values = s.values.sort(function(a, b) {
                return b.y < a.y ? -1 : b.y > a.y ? 1 : 0;
              })
              .map(function(p) {
                s.total += p.y;
                return p;
              });

            s.group = i;
            return s;
          })
          .sort(function(a, b) {
            return a.total < b.total ? -1 : a.total > b.total ? 1 : 0;
          })
          .map(function(s, i) {
            total += s.total;

            gDomain = d3.extent(s.values.map(function(p) { return p.y; }));
            gRange = [gHeight * i + gOffset, gHeight * (i + 1) - gOffset];
            gScale.domain(gDomain).range(gRange);

            s.values = s.values
              .map(function(p) {
                p.group = s.group;
                p.opportunity = p.y;
                p.y = gScale(p.opportunity);
                return p;
              });

            yValues.push({y: d3.min(s.values.map(function(p) { return p.y; })), key: s.key});

            return s;
          });

        return yValues;
      }

      // set state.disabled
      state.disabled = data.map(function(d) { return !!d.disabled; });

      // Now that group calculations are done,
      // group the data by filter so that legend filters
      filteredData = d3.nest()
        .key(filterBy)
        .entries(data);

      //add series index to each data point for reference
      filteredData = filteredData
        .sort(function(a, b) {
          //sort legend by key
          return parseInt(a.key, 10) < parseInt(b.key, 10) ? -1 : parseInt(a.key, 10) > parseInt(b.key, 10) ? 1 : 0;
        })
        .map(function(d, i) {
          d.series = i;
          d.classes = d.values[0].classes;
          d.color = d.values[0].color;
          return d;
        });

      xD = getTimeDomain(filteredData);

      yValues = getGroupTicks(data);

      yD = d3.extent(
            d3.merge(
              filteredData.map(function(d) {
                return d.values.map(function(d, i) {
                  return getY(d, i);
                });
              })
            ).concat(forceY)
          );

      //------------------------------------------------------------
      // Setup Scales and Axes

      x = scatter.xScale();
      y = scatter.yScale();

      xAxis
        .orient('bottom')
        .valueFormat(xValueFormat)
        .tickSize(0)
        .tickPadding(4)
        .highlightZero(false)
        .showMaxMin(false)
        .ticks(d3.timeMonths, 1)
        .scale(x)
        .tickValues(getTimeTicks(xD));
      yAxis
        .orient('left')
        .valueFormat(yValueFormat)
        .tickPadding(7)
        .highlightZero(false)
        .showMaxMin(false)
        .scale(y)
        .ticks(yValues.length)
        .tickValues(yValues.map(function(d, i) {
          return yValues[i].y;
        }));

      //------------------------------------------------------------
      // Main chart draw

      chart.render = function() {

        // Chart layout variables
        var renderWidth = width || parseInt(container.style('width'), 10) || 960,
            renderHeight = height || parseInt(container.style('height'), 10) || 400,
            availableWidth = renderWidth - margin.left - margin.right,
            availableHeight = renderHeight - margin.top - margin.bottom,
            innerWidth = availableWidth,
            innerHeight = availableHeight,
            innerMargin = {top: 0, right: 0, bottom: 0, left: 0};

        // Header variables
        var maxBubbleSize = Math.sqrt(scatter.sizeRange()[1] / Math.PI),
            headerHeight = 0,
            titleBBox = {width: 0, height: 0},
            trans = '';

        //------------------------------------------------------------
        // Setup containers and skeleton of chart

        var wrap_bind = container.selectAll('.sucrose.sc-wrap').data([filteredData]);
        var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-bubble-chart');
        var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
        var g_entr = wrap_entr.append('g').attr('class', 'sc-chart-wrap');
        var g = container.select('g.sc-chart-wrap').merge(g_entr);

        g_entr.append('rect').attr('class', 'sc-background')
          .attr('x', -margin.left)
          .attr('y', -margin.top)
          .attr('fill', '#FFF');

        g.select('.sc-background')
          .attr('width', availableWidth + margin.left + margin.right)
          .attr('height', availableHeight + margin.top + margin.bottom);

        var title_entr = g_entr.append('g').attr('class', 'sc-title-wrap');
        var title_wrap = g.select('.sc-title-wrap').merge(title_entr);

        var xAxis_entr = g_entr.append('g').attr('class', 'sc-x sc-axis');
        var xAxis_wrap = g.select('.sc-x.sc-axis').merge(xAxis_entr);

        var yAxis_entr = g_entr.append('g').attr('class', 'sc-y sc-axis');
        var yAxis_wrap = g.select('.sc-y.sc-axis').merge(yAxis_entr);

        var bubbles_entr = g_entr.append('g').attr('class', 'sc-bubbles-wrap');
        var bubbles_wrap = g.select('.sc-bubbles-wrap').merge(bubbles_entr);

        var legend_entr = g_entr.append('g').attr('class', 'sc-legend-wrap');
        var legend_wrap = g.select('.sc-legend-wrap').merge(legend_entr);

        wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        //------------------------------------------------------------
        // Title & Legend

        title_wrap.select('.sc-title').remove();

        if (showTitle) {
          title_wrap
            .append('text')
              .attr('class', 'sc-title')
              .attr('x', direction === 'rtl' ? availableWidth : 0)
              .attr('y', 0)
              .attr('dy', '.75em')
              .attr('text-anchor', 'start')
              .text(properties.title)
              .attr('stroke', 'none')
              .attr('fill', 'black');

          titleBBox = sucrose.utils.getTextBBox(title_wrap.select('.sc-title'));
          headerHeight += titleBBox.height;
        }

        if (showLegend) {
          legend
            .id('legend_' + chart.id())
            .strings(chart.strings().legend)
            .align('center')
            .height(availableHeight - headerHeight);
          legend_wrap
            .datum(filteredData)
            .call(legend);

          legend
            .arrange(availableWidth);

          var legendLinkBBox = sucrose.utils.getTextBBox(legend_wrap.select('.sc-legend-link')),
              legendSpace = availableWidth - titleBBox.width - 6,
              legendTop = showTitle && legend.collapsed() && legendSpace > legendLinkBBox.width ? true : false,
              xpos = direction === 'rtl' || !legend.collapsed() ? 0 : availableWidth - legend.width(),
              ypos = titleBBox.height;
          if (legendTop) {
            ypos = titleBBox.height - legend.height() / 2 - legendLinkBBox.height / 2;
          } else if (!showTitle) {
            ypos = - legend.margin().top;
          }
          legend_wrap
            .attr('transform', 'translate(' + xpos + ',' + ypos + ')');

          headerHeight += legendTop ? 12 : legend.height();
        }

        // Recalc inner margins based on legend and control height
        innerHeight = availableHeight - headerHeight - innerMargin.top - innerMargin.bottom;

        //------------------------------------------------------------
        // Main Chart Components

        scatter
          .width(innerWidth)
          .height(innerHeight)
          .id(chart.id())
          .xDomain(xD)
          .yDomain(yD);

        bubbles_wrap
          .datum(filteredData.filter(function(d) {
            return !d.disabled;
          }))
          .transition().duration(chart.delay())
            .call(scatter);

        innerMargin.top += maxBubbleSize;

        //------------------------------------------------------------
        // Setup Axes

        var yAxisMargin = {top: 0, right: 0, bottom: 0, left: 0},
            xAxisMargin = {top: 0, right: 0, bottom: 0, left: 0};

        function setInnerMargins() {
          innerMargin.left = Math.max(xAxisMargin.left, yAxisMargin.left);
          innerMargin.right = Math.max(xAxisMargin.right, yAxisMargin.right);
          innerMargin.top = Math.max(xAxisMargin.top, yAxisMargin.top);
          innerMargin.bottom = Math.max(xAxisMargin.bottom, yAxisMargin.bottom);
        }

        function setInnerDimensions() {
          innerWidth = availableWidth - innerMargin.left - innerMargin.right;
          innerHeight = availableHeight - headerHeight - innerMargin.top - innerMargin.bottom;
          // Recalc chart dimensions and scales based on new inner dimensions
          scatter.resetDimensions(innerWidth, innerHeight);
        }

        // Y-Axis
        yAxis
          .margin(innerMargin)
          .tickFormat(function(d, i) {
            var label = yAxis.valueFormat()(i, yValues, yIsCurrency);
            return sucrose.utils.stringEllipsify(label, container, Math.max(availableWidth * 0.2, 75));
          });
        yAxis_wrap
          .call(yAxis);
        // reset inner dimensions
        yAxisMargin = yAxis.margin();
        setInnerMargins();
        setInnerDimensions();

        // X-Axis
        xAxis
          .tickSize(0)
          .margin(innerMargin)
          .tickFormat(function(d) {
            return xAxis.valueFormat()(d, null, xIsDatetime);
          });
        xAxis_wrap
          .call(xAxis);

        // reset inner dimensions
        xAxisMargin = xAxis.margin();
        setInnerMargins();
        setInnerDimensions();

        // recall y-axis to set final size based on new dimensions
        yAxis
          .tickSize(-innerWidth, 0)
          .margin(innerMargin);
        yAxis_wrap
          .call(yAxis);
        yAxis_wrap.select('path.domain')
          .attr('d', "M0,0V0.5H0V" + innerHeight);

        // final call to lines based on new dimensions
        bubbles_wrap
          .transition().duration(chart.delay())
            .call(scatter);

        //------------------------------------------------------------
        // Final repositioning

        innerMargin.top += headerHeight;

        trans = innerMargin.left + ',';
        trans += innerMargin.top + (xAxis.orient() === 'bottom' ? innerHeight : 0);
        xAxis_wrap
          .attr('transform', 'translate(' + trans + ')');

        trans = innerMargin.left + (yAxis.orient() === 'left' ? 0 : innerWidth) + ',';
        trans += innerMargin.top;
        yAxis_wrap
          .attr('transform', 'translate(' + trans + ')');

        bubbles_wrap
          .attr('transform', 'translate(' + innerMargin.left + ',' + innerMargin.top + ')');

      };

      //============================================================

      chart.render();

      //============================================================
      // Event Handling/Dispatching (in chart's scope)
      //------------------------------------------------------------

      legend.dispatch.on('legendClick', function(d, i) {
        d.disabled = !d.disabled;

        if (!filteredData.filter(function(d) { return !d.disabled; }).length) {
          filteredData.map(function(d) {
            d.disabled = false;
            container.selectAll('.sc-series').classed('disabled', false);
            return d;
          });
        }

        state.disabled = filteredData.map(function(d) { return !!d.disabled; });

        dispatch.call('stateChange', this, state);

        container.transition().call(chart.render);
      });

      dispatch.on('tooltipShow', function(eo) {
        if (tooltips) {
          showTooltip(eo, that.parentNode);
        }
      });

      dispatch.on('tooltipMove', function(e) {
        if (tooltip) {
          sucrose.tooltip.position(that.parentNode, tooltip, e, 's');
        }
      });

      dispatch.on('tooltipHide', function() {
        if (tooltips) {
          sucrose.tooltip.cleanup();
        }
      });

      // Update chart from a state object passed to event handler
      dispatch.on('changeState', function(eo) {
        if (typeof eo.disabled !== 'undefined') {
          data.forEach(function(series, i) {
            series.disabled = eo.disabled[i];
          });
          state.disabled = eo.disabled;
        }

        container.transition().call(chart);
      });

      dispatch.on('chartClick', function() {
        dispatch.call('tooltipHide', this);
        if (legend.enabled()) {
          legend.dispatch.call('closeMenu', this);
        }
      });

      scatter.dispatch.on('elementClick', function(eo) {
        dispatch.call('chartClick', this);
        bubbleClick(eo);
      });

    });

    return chart;
  }

  //============================================================
  // Event Handling/Dispatching (out of chart's scope)
  //------------------------------------------------------------

  scatter.dispatch.on('elementMouseover.tooltip', function(eo) {
    dispatch.call('tooltipShow', this, eo);
  });

  scatter.dispatch.on('elementMousemove.tooltip', function(e) {
    dispatch.call('tooltipMove', this, e);
  });

  scatter.dispatch.on('elementMouseout.tooltip', function() {
    dispatch.call('tooltipHide', this);
  });

  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  // expose chart's sub-components
  chart.dispatch = dispatch;
  chart.scatter = scatter;
  chart.legend = legend;
  chart.xAxis = xAxis;
  chart.yAxis = yAxis;

  fc.rebind(chart, scatter, 'id', 'x', 'y', 'xScale', 'yScale', 'xDomain', 'yDomain', 'forceX', 'forceY', 'clipEdge', 'delay', 'color', 'fill', 'classes', 'gradient', 'locality');
  fc.rebind(chart, scatter, 'size', 'zScale', 'sizeDomain', 'forceSize', 'interactive', 'clipVoronoi', 'clipRadius');
  fc.rebind(chart, xAxis, 'rotateTicks', 'reduceXTicks', 'staggerTicks', 'wrapTicks');

  chart.colorData = function(_) {
    var type = arguments[0],
        params = arguments[1] || {};
    var color = function(d, i) {
          return sucrose.utils.defaultColor()(d, d.series);
        };
    var classes = function(d, i) {
          return 'sc-group sc-series-' + d.series;
        };

    switch (type) {
      case 'graduated':
        color = function(d, i) {
          return d3.interpolateHsl(d3.rgb(params.c1), d3.rgb(params.c2))(d.series / params.l);
        };
        break;
      case 'class':
        color = function() {
          return 'inherit';
        };
        classes = function(d, i) {
          var iClass = (d.series * (params.step || 1)) % 14;
          iClass = (iClass > 9 ? '' : '0') + iClass;
          return 'sc-group sc-series-' + d.series + ' sc-fill' + iClass;
        };
        break;
      case 'data':
        color = function(d, i) {
          return d.classes ? 'inherit' : d.color || sucrose.utils.defaultColor()(d, d.series);
        };
        classes = function(d, i) {
          return 'sc-group sc-series-' + d.series + (d.classes ? ' ' + d.classes : '');
        };
        break;
    }

    var fill = (!params.gradient) ? color : function(d, i) {
      return scatter.gradient(d, d.series);
    };

    scatter.color(color);
    scatter.fill(fill);
    scatter.classes(classes);

    legend.color(color);
    legend.classes(classes);

    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) {
      return margin;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        margin[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) {
      return width;
    }
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) {
      return height;
    }
    height = _;
    return chart;
  };

  chart.showTitle = function(_) {
    if (!arguments.length) {
      return showTitle;
    }
    showTitle = _;
    return chart;
  };

  chart.showLegend = function(_) {
    if (!arguments.length) {
      return showLegend;
    }
    showLegend = _;
    return chart;
  };

  chart.tooltip = function(_) {
    if (!arguments.length) {
      return tooltip;
    }
    tooltip = _;
    return chart;
  };

  chart.tooltips = function(_) {
    if (!arguments.length) {
      return tooltips;
    }
    tooltips = _;
    return chart;
  };

  chart.tooltipContent = function(_) {
    if (!arguments.length) {
      return tooltipContent;
    }
    tooltipContent = _;
    return chart;
  };

  chart.state = function(_) {
    if (!arguments.length) {
      return state;
    }
    state = _;
    return chart;
  };

  chart.delay = function(_) {
    if (!arguments.length) {
      return delay;
    }
    delay = _;
    return chart;
  };

  chart.bubbleClick = function(_) {
    if (!arguments.length) {
      return bubbleClick;
    }
    bubbleClick = _;
    return chart;
  };

  chart.groupBy = function(_) {
    if (!arguments.length) {
      return groupBy;
    }
    groupBy = _;
    return chart;
  };

  chart.filterBy = function(_) {
    if (!arguments.length) {
      return filterBy;
    }
    filterBy = _;
    return chart;
  };

  chart.colorFill = function(_) {
    return chart;
  };

  chart.strings = function(_) {
    if (!arguments.length) {
      return strings;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        strings[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.direction = function(_) {
    if (!arguments.length) {
      return direction;
    }
    direction = _;
    yAxis.direction(_);
    legend.direction(_);
    return chart;
  };

  //============================================================

  return chart;
};

sucrose.models.funnel = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 0, right: 0, bottom: 0, left: 0},
      width = 960,
      height = 500,
      r = 0.3, // ratio of width to height (or slope)
      y = d3.scaleLinear(),
      id = Math.floor(Math.random() * 10000), //Create semi-unique ID in case user doesn't select one
      getX = function(d) { return d.x; },
      getY = function(d) { return d.y; },
      getH = function(d) { return d.height; },
      getV = function(d) { return d.value; },
      locality = sucrose.utils.buildLocality(),
      forceY = [0], // 0 is forced by default.. this makes sense for the majority of bar graphs... user can always do chart.forceY([]) to remove
      clipEdge = true,
      yDomain,
      delay = 0,
      wrapLabels = true,
      minLabelWidth = 75,
      durationMs = 0,
      fmtKey = function(d) { return d; },
      fmtValue = function(d) { return d; },
      fmtCount = function(d) { return (' (' + d + ')').replace(' ()', ''); },
      color = function(d, i) { return sucrose.utils.defaultColor()(d, d.series); },
      fill = color,
      textureFill = false,
      classes = function(d, i) { return 'sc-group sc-series-' + d.series; },
      dispatch = d3.dispatch('chartClick', 'elementClick', 'elementDblClick', 'elementMouseover', 'elementMouseout', 'elementMousemove');


  //============================================================
  // Private Variables
  //------------------------------------------------------------

  // These values are preserved between renderings
  var calculatedWidth = 0,
      calculatedHeight = 0,
      calculatedCenter = 0;

  //============================================================
  // Update chart

  function chart(selection) {
    selection.each(function(data) {
      var availableWidth = width - margin.left - margin.right,
          availableHeight = height - margin.top - margin.bottom,
          container = d3.select(this),

          labelGap = 5,
          labelSpace = 5,
          labelOffset = 0,
          funnelTotal = 0,
          funnelOffset = 0;

      // Add series index to each data point for reference
      data.forEach(function(series, i) {
        series.values.forEach(function(point) {
          //reset point index because raw data
          //may have disabled series
          point.index = i;
          funnelTotal += parseFloat(point.value);
        });
      });

      //------------------------------------------------------------
      // Setup scales

      function calcDimensions() {
        calculatedWidth = calcWidth(funnelOffset);
        calculatedHeight = calcHeight();
        calculatedCenter = calcCenter(funnelOffset);
      }

      function calcScales() {
        var funnelArea = areaTrapezoid(calculatedHeight, calculatedWidth),
            funnelShift = 0,
            funnelMinHeight = 4,
            _base = calculatedWidth - 2 * r * calculatedHeight,
            _bottom = calculatedHeight;

        //------------------------------------------------------------
        // Adjust points to compensate for parallax of slice
        // by increasing height relative to area of funnel

        // runs from bottom to top
        data.map(function(series, i) {
          series.values = series.values.map(function(point) {
            point._height = 0;

            if (funnelTotal > 0) {
              point._height = heightTrapezoid(funnelArea * point.value / funnelTotal, _base);
            }

            //TODO: not working
            if (point._height < funnelMinHeight) {
              funnelShift += point._height - funnelMinHeight;
              point._height = funnelMinHeight;
            } else if (funnelShift < 0 && point._height + funnelShift > funnelMinHeight) {
              point._height += funnelShift;
              funnelShift = 0;
            }

            point._base = _base;
            point._bottom = _bottom;
            point._top = point._bottom - point._height;

            _base += 2 * r * point._height;
            _bottom -= point._height;

            return point;
          });
          return series;
        });

        // Remap and flatten the data for use in calculating the scales' domains
        //TODO: this is no longer needed
        var seriesData = yDomain || // if we know yDomain, no need to calculate
              d3.extent(d3.merge(data.map(function(d) {
                return d.values.map(function(d, i) {
                  return d._top;
                });
              })).concat(forceY));

        y .domain(seriesData)
          .range([calculatedHeight, 0]);
      }

      calcDimensions();
      calcScales();

      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap_bind = container.selectAll('g.sc-wrap.sc-funnel').data([data]);
      var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-funnel');
      var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
      var defs_entr = wrap_entr.append('defs');
      var g_entr = wrap_entr.append('g').attr('class', 'sc-chart-wrap');
      var g = wrap.select('g.sc-chart-wrap').merge(g_entr);

      //set up the gradient constructor function
      chart.gradient = function(d, i, p) {
        return sucrose.utils.colorLinearGradient(d, id + '-' + i, p, color(d, i), wrap.select('defs'));
      };

      g_entr.append('g').attr('class', 'sc-groups');
      wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      //------------------------------------------------------------
      // Clip path

      defs_entr.append('clipPath')
        .attr('id', 'sc-edge-clip-' + id)
          .append('rect');
      wrap.select('#sc-edge-clip-' + id + ' rect')
        .attr('width', availableWidth + 4)
        .attr('height', availableHeight + 4)
        .attr('transform', 'translate(-2,-2)');
      g.attr('clip-path', clipEdge ? 'url(#sc-edge-clip-' + id + ')' : '');

      //------------------------------------------------------------

      if (textureFill) {
        var mask = sucrose.utils.createTexture(defs_entr, id);
      }

      //------------------------------------------------------------
      // Append major data series grouping containers

      var groups_entr = wrap.select('.sc-groups').selectAll('.sc-group')
            .data(data, function(d) { return d.series; });

      groups_entr.exit().transition().duration(durationMs)
        .selectAll('g.sc-slice')
        .delay(function(d, i) { return i * delay / data[0].values.length; })
          .attr('points', function(d) {
            return pointsTrapezoid(d, 0, calculatedWidth);
          })
          .style('stroke-opacity', 1e-6)
          .style('fill-opacity', 1e-6)
          .remove();

      groups_entr.exit().transition().duration(durationMs)
        .selectAll('g.sc-label-value')
        .delay(function(d, i) { return i * delay / data[0].values.length; })
          .attr('y', 0)
          .attr('transform', 'translate(' + calculatedCenter + ',0)')
          .style('stroke-opacity', 1e-6)
          .style('fill-opacity', 1e-6)
          .remove();

      groups_entr.exit().remove();
      groups_entr.enter().append('g').attr('class', 'sc-group');

      var groups = wrap.select('.sc-groups').selectAll('.sc-group')
            .merge(groups_entr);

      // groups
      //   .style('stroke-opacity', 1e-6)
      //   .style('fill-opacity', 1e-6);

      groups
        .attr('class', classes)
        .attr('fill', fill)
        .classed('hover', function(d) { return d.hover; })
        .classed('sc-active', function(d) { return d.active === 'active'; })
        .classed('sc-inactive', function(d) { return d.active === 'inactive'; })
        .style('stroke', '#FFFFFF')
        .style('stroke-width', 2);

      groups.transition().duration(durationMs)
          .style('stroke-opacity', 1)
          .style('fill-opacity', 1);

      //------------------------------------------------------------
      // Append polygons for funnel

      var slice_bind = groups.selectAll('g.sc-slice')
            .data(function(d) { return d.values; }, function(d) { return d.series; });
      slice_bind.exit().remove();
      var slice_entr = slice_bind.enter().append('g')
            .attr('class', 'sc-slice');
      var slices = groups.selectAll('g.sc-slice')
            .merge(slice_entr);

      slice_entr.append('polygon')
        .attr('class', 'sc-base');
      slices.selectAll('.sc-base')
        .attr('points', function(d) {
          return pointsTrapezoid(d, 0, calculatedWidth);
        });

      if (textureFill) {
        // For on click active bars
        slice_entr.append('polygon')
          .attr('class', 'sc-texture');
        slices.selectAll('.sc-texture')
          .attr('points', function(d) {
            return pointsTrapezoid(d, 0, calculatedWidth);
          })
          .style('mask', 'url(' + mask + ')');
      }

      slice_entr
        .on('mouseover', function(d, i) {
          d3.select(this).classed('hover', true);
          var eo = buildEventObject(d3.event, d, i);
          dispatch.call('elementMouseover', this, eo);
        })
        .on('mousemove', function(d, i) {
          var e = d3.event;
          dispatch.call('elementMousemove', this, e);
        })
        .on('mouseout', function(d, i) {
          d3.select(this).classed('hover', false);
          dispatch.call('elementMouseout', this);
        })
        .on('click', function(d, i) {
          d3.event.stopPropagation();
          var eo = buildEventObject(d3.event, d, i);
          dispatch.call('elementClick', this, eo);
        })
        .on('dblclick', function(d, i) {
          d3.event.stopPropagation();
          var eo = buildEventObject(d3.event, d, i);
          dispatch.call('elementDblClick', this, eo);
        });

      function buildEventObject(e, d, i) {
        return {
          value: getV(d, i),
          point: d,
          id: id,
          series: data[d.index],
          pointIndex: i,
          seriesIndex: d.series,
          e: e
        };
      }

      //------------------------------------------------------------
      // Append containers for labels

      var labels_bind = groups.selectAll('.sc-label-value')
            .data(function(d) { return d.values; }, function(d) { return d.series; });
      labels_bind.exit().remove();
      var labels_entr = labels_bind.enter().append('g')
            .attr('class', 'sc-label-value');
      var labels = groups.selectAll('g.sc-label-value')
            .merge(labels_entr);

      labels
        .attr('transform', 'translate(' + calculatedCenter + ',0)');

      var sideLabels = labels.filter('.sc-label-side');

      //------------------------------------------------------------
      // Update funnel labels

      function renderFunnelLabels() {
        // Remove responsive label elements
        labels.selectAll('polyline').remove();
        labels.selectAll('rect').remove();
        labels.selectAll('text').remove();

        labels.append('rect')
          .attr('class', 'sc-label-box')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', 0)
          .attr('height', 0)
          .attr('rx', 2)
          .attr('ry', 2)
          .style('pointer-events', 'none')
          .style('stroke-width', 0)
          .style('fill-opacity', 0);

        // Append label text and wrap if needed
        labels.append('text')
          .text(function(d) {
            return fmtKey(data[d.index].key);
          })
            .call(fmtLabel, 'sc-label', 0.85, 'middle', fmtFill);

        labels.select('.sc-label')
          .call(
            handleLabel,
            (wrapLabels ? wrapLabel : ellipsifyLabel),
            calcFunnelWidthAtSliceMidpoint,
            function(txt, dy) {
              fmtLabel(txt, 'sc-label', dy, 'middle', fmtFill);
            }
          );

        // Append value and count text
        labels.append('text')
          .text(function(d) {
            return fmtValue(d.value || d.label || d);
          })
            .call(fmtLabel, 'sc-value', 0.85, 'middle', fmtFill);

        labels.select('.sc-value')
          .append('tspan')
            .text(function(d) {
              return fmtCount(data[d.index].count);
            });

        labels
          .call(positionValue)
          // Position labels and identify side labels
          .call(calcFunnelLabelDimensions)
          .call(positionLabelBox);

        labels
          .classed('sc-label-side', function(d) { return d.tooTall || d.tooWide; });
      }

      //------------------------------------------------------------
      // Update side labels

      function renderSideLabels() {
        // Remove all responsive elements
        sideLabels = labels.filter('.sc-label-side');
        sideLabels.selectAll('.sc-label').remove();
        sideLabels.selectAll('rect').remove();
        sideLabels.selectAll('polyline').remove();

        // Position side labels
        sideLabels.append('text')
          .text(function(d) {
            return fmtKey(data[d.index].key);
          })
            .call(fmtLabel, 'sc-label', 0.85, 'start', '#555');

        sideLabels.select('.sc-label')
          .call(
            handleLabel,
            (wrapLabels ? wrapLabel : ellipsifyLabel),
            (wrapLabels ? calcSideWidth : maxSideLabelWidth),
            function(txt, dy) {
              fmtLabel(txt, 'sc-label', dy, 'start', '#555');
            }
          );

        sideLabels
          .call(positionValue);

        sideLabels.select('.sc-value')
          .style('text-anchor', 'start')
          .style('fill', '#555');

        sideLabels
          .call(calcSideLabelDimensions);

        // Reflow side label vertical position to prevent overlap
        var d0 = 0;

        // Top to bottom
        for (var groups = sideLabels.nodes(), j = groups.length - 1; j >= 0; --j) {
          var d = d3.select(groups[j]).data()[0];
          if (d) {
            if (!d0) {
              d.labelBottom = d.labelTop + d.labelHeight + labelSpace;
              d0 = d.labelBottom;
              continue;
            }

            d.labelTop = Math.max(d0, d.labelTop);
            d.labelBottom = d.labelTop + d.labelHeight + labelSpace;
            d0 = d.labelBottom;
          }
        }

        // And then...
        if (d0 && d0 - labelSpace > d3.max(y.range())) {

          d0 = 0;

          // Bottom to top
          for (var groups = sideLabels.nodes(), j = 0, m = groups.length; j < m; ++j) {
            var d = d3.select(groups[j]).data()[0];
            if (d) {
              if (!d0) {
                d.labelBottom = calculatedHeight - 1;
                d.labelTop = d.labelBottom - d.labelHeight;
                d0 = d.labelTop;
                continue;
              }

              d.labelBottom = Math.min(d0, d.labelBottom);
              d.labelTop = d.labelBottom - d.labelHeight - labelSpace;
              d0 = d.labelTop;
            }
          }

          // ok, FINALLY, so if we are above the top of the funnel,
          // we need to lower them all back down
          if (d0 < 0) {
            sideLabels.each(function(d, i) {
                d.labelTop -= d0;
                d.labelBottom -= d0;
              });
          }
        }

        d0 = 0;

        //------------------------------------------------------------
        // Recalculate funnel offset based on side label dimensions

        sideLabels
          .call(calcOffsets);
      }

      //------------------------------------------------------------
      // Calculate the width and position of labels which
      // determines the funnel offset dimension

      function renderLabels() {
        renderFunnelLabels();
        renderSideLabels();
      }

      renderLabels();
      calcDimensions();

      // Calls twice since the first call may create a funnel offset
      // which decreases the funnel width which impacts label position

      calcScales();
      renderLabels();
      calcDimensions();

      calcScales();
      renderLabels();
      calcDimensions();

      //------------------------------------------------------------
      // Reposition responsive elements

      slices.selectAll('polygon')
        .attr('points', function(d) {
          return pointsTrapezoid(d, 1, calculatedWidth);
        });

      if (textureFill) {
        slices.selectAll('.sc-texture')
          .style('fill', fmtFill);
      }

      labels
        .attr('transform', function(d) {
          var xTrans = d.tooTall ? 0 : calculatedCenter,
              yTrans = d.tooTall ? 0 : d.labelTop;
          return 'translate(' + xTrans + ',' + yTrans + ')';
        });

      sideLabels
        .attr('transform', function(d) {
          return 'translate(' + labelOffset + ',' + d.labelTop + ')';
        });

      sideLabels
        .append('polyline')
          .attr('class', 'sc-label-leader')
          .style('fill-opacity', 0)
          .style('stroke', '#999')
          .style('stroke-width', 1)
          .style('stroke-opacity', 0.5);

      sideLabels.selectAll('polyline')
        .call(pointsLeader);

      //------------------------------------------------------------
      // Utility functions

      // TODO: use scales instead of ratio algebra
      // var funnelScale = d3.scaleLinear()
      //       .domain([w / 2, minimum])
      //       .range([0, maxy1*thenscalethistopreventminimumfrompassing]);

      function wrapLabel(d, lbl, fnWidth, fmtLabel) {
        var text = lbl.text(),
            dy = parseFloat(lbl.attr('dy')),
            word,
            words = text.split(/\s+/).reverse(),
            line = [],
            lineNumber = 0,
            maxWidth = fnWidth(d, 0),
            parent = d3.select(lbl.node().parentNode);

        lbl.text(null);

        while (word = words.pop()) {
          line.push(word);
          lbl.text(line.join(' '));

          if (lbl.node().getComputedTextLength() > maxWidth && line.length > 1) {
            line.pop();
            lbl.text(line.join(' '));
            line = [word];
            lbl = parent.append('text');
            lbl.text(word)
              .call(fmtLabel, ++lineNumber * 1.1 + dy);
          }
        }
      }

      function handleLabel(lbls, fnFormat, fnWidth, fmtLabel) {
        lbls.each(function(d) {
          var lbl = d3.select(this);
          fnFormat(d, lbl, fnWidth, fmtLabel);
        });
      }

      function ellipsifyLabel(d, lbl, fnWidth, fmtLabel) {
        var text = lbl.text(),
            dy = parseFloat(lbl.attr('dy')),
            maxWidth = fnWidth(d);

        lbl.text(sucrose.utils.stringEllipsify(text, container, maxWidth))
          .call(fmtLabel, dy);
      }

      function maxSideLabelWidth(d) {
        // overall width of container minus the width of funnel top
        // or minLabelWidth, which ever is greater
        // this is also now as funnelOffset (maybe)
        var twenty = Math.max(availableWidth - availableHeight / 1.1, minLabelWidth),
            // bottom of slice
            sliceBottom = d._bottom,
            // x component of slope F at y
            base = sliceBottom * r,
            // total width at bottom of slice
            maxWidth = twenty + base,
            // height of sloped leader
            leaderHeight = Math.abs(d.labelBottom - sliceBottom),
            // width of the angled leader
            leaderWidth = leaderHeight * r,
            // total width of leader
            leaderTotal = labelGap + leaderWidth + labelGap + labelGap,
            // this is the distance from end of label plus spacing to F
            iOffset = maxWidth - leaderTotal;

        return Math.max(iOffset, minLabelWidth);
      }

      function pointsTrapezoid(d, h, w) {
        //MATH: don't delete
        // v = 1/2 * h * (b + b + 2*r*h);
        // 2v = h * (b + b + 2*r*h);
        // 2v = h * (2*b + 2*r*h);
        // 2v = 2*b*h + 2*r*h*h;
        // v = b*h + r*h*h;
        // v - b*h - r*h*h = 0;
        // v/r - b*h/r - h*h = 0;
        // b/r*h + h*h + b/r/2*b/r/2 = v/r + b/r/2*b/r/2;
        // h*h + b/r*h + b/r/2*b/r/2 = v/r + b/r/2*b/r/2;
        // (h + b/r/2)(h + b/r/2) = v/r + b/r/2*b/r/2;
        // h + b/r/2 = Math.sqrt(v/r + b/r/2*b/r/2);
        // h  = Math.abs(Math.sqrt(v/r + b/r/2*b/r/2)) - b/r/2;

        var y0 = d._bottom,
            y1 = d._top,
            w0 = w / 2 - r * y0,
            w1 = w / 2 - r * y1,
            c = calculatedCenter;

        return (
          (c - w0) + ',' + (y0 * h) + ' ' +
          (c - w1) + ',' + (y1 * h) + ' ' +
          (c + w1) + ',' + (y1 * h) + ' ' +
          (c + w0) + ',' + (y0 * h)
        );
      }

      function heightTrapezoid(a, b) {
        var x = b / r / 2;
        return Math.abs(Math.sqrt(a / r + x * x)) - x;
      }

      function areaTrapezoid(h, w) {
        return h * (w - h * r);
      }

      function calcWidth(offset) {
        return Math.round(Math.max(Math.min(availableHeight / 1.1, availableWidth - offset), 40));
      }

      function calcHeight() {
        // MATH: don't delete
        // h = 666.666
        // w = 600
        // m = 200
        // at what height is m = 200
        // w = h * 0.3 = 666 * 0.3 = 200
        // maxheight = ((w - m) / 2) / 0.3 = (w - m) / 0.6 = h
        // (600 - 200) / 0.6 = 400 / 0.6 = 666
        return Math.min(calculatedWidth * 1.1, (calculatedWidth - calculatedWidth * r) / (2 * r));
      }

      function calcCenter(offset) {
        return calculatedWidth / 2 + offset;
      }

      function calcFunnelWidthAtSliceMidpoint(d) {
        var b = calculatedWidth,
            v = d._bottom - d._height / 2; // mid point of slice
        return b - v * r * 2;
      }

      function calcSideWidth(d, offset) {
        var b = Math.max((availableWidth - calculatedWidth) / 2, offset),
            v = d._top; // top of slice
        return b + v * r;
      }

      function calcLabelBBox(lbl) {
        return d3.select(lbl).node().getBoundingClientRect();
      }

      function calcFunnelLabelDimensions(lbls) {
        lbls.each(function(d) {
          var bbox = calcLabelBBox(this);

          d.labelHeight = bbox.height;
          d.labelWidth = bbox.width;
          d.labelTop = (d._bottom - d._height / 2) - d.labelHeight / 2;
          d.labelBottom = d.labelTop + d.labelHeight + labelSpace;
          d.tooWide = d.labelWidth > calcFunnelWidthAtSliceMidpoint(d);
          d.tooTall = d.labelHeight > d._height - 4;
        });
      }

      function calcSideLabelDimensions(lbls) {
        lbls.each(function(d) {
          var bbox = calcLabelBBox(this);

          d.labelHeight = bbox.height;
          d.labelWidth = bbox.width;
          d.labelTop = d._top;
          d.labelBottom = d.labelTop + d.labelHeight + labelSpace;
        });
      }

      function pointsLeader(polylines) {
        // Mess with this function at your peril.
        var c = polylines.size();

        // run top to bottom
        for (var groups = polylines.nodes(), i = groups.length - 1; i >= 0; --i) {
          var node = d3.select(groups[i]);
          var d = node.data()[0];
          var // previous label
              p = i < c - 1 ? d3.select(groups[i + 1]).data()[0] : null,
              // next label
              n = i ? d3.select(groups[i - 1]).data()[0] : null,
              // label height
              h = Math.round(d.labelHeight) + 0.5,
              // slice bottom
              t = Math.round(d._bottom - d.labelTop) - 0.5,
              // previous width
              wp = p ? p.labelWidth - (d.labelBottom - p.labelBottom) * r : 0,
              // current width
              wc = d.labelWidth,
              // next width
              wn = n && h < t ? n.labelWidth : 0,
              // final width
              w = Math.round(Math.max(wp, wc, wn)) + labelGap,
              // funnel edge
              f = Math.round(calcSideWidth(d, funnelOffset)) - labelOffset - labelGap;

          // polyline points
          var points = 0 + ',' + h + ' ' +
                 w + ',' + h + ' ' +
                 (w + Math.abs(h - t) * r) + ',' + t + ' ' +
                 f + ',' + t;

          // this will be overridding the label width in data
          // referenced above as p.labelWidth
          d.labelWidth = w;
          node.attr('points', points);
        }
      }

      function calcOffsets(lbls) {
        var sideWidth = (availableWidth - calculatedWidth) / 2, // natural width of side
            offset = 0;

        lbls.each(function(d) {
          var // bottom of slice
              sliceBottom = d._bottom,
              // is slice below or above label bottom
              scalar = d.labelBottom >= sliceBottom ? 1 : 0,
              // the width of the angled leader
              // from bottom right of label to bottom of slice
              leaderSlope = Math.abs(d.labelBottom + labelGap - sliceBottom) * r,
              // this is the x component of slope F at y
              base = sliceBottom * r,
              // this is the distance from end of label plus spacing to F
              iOffset = d.labelWidth + leaderSlope + labelGap * 3 - base;
          // if this label sticks out past F
          if (iOffset >= offset) {
            // this is the minimum distance for F
            // has to be away from the left edge of labels
            offset = iOffset;
          }
        });

        // how far from chart edge is label left edge
        offset = Math.round(offset * 10) / 10;

        // there are three states:
        if (offset <= 0) {
        // 1. no label sticks out past F
          labelOffset = sideWidth;
          funnelOffset = sideWidth;
        } else if (offset > 0 && offset < sideWidth) {
        // 2. iOffset is > 0 but < sideWidth
          labelOffset = sideWidth - offset;
          funnelOffset = sideWidth;
        } else {
        // 3. iOffset is >= sideWidth
          labelOffset = 0;
          funnelOffset = offset;
        }
      }

      function fmtFill(d, i, j) {
        var backColor = d3.select(this.parentNode).style('fill');
        return sucrose.utils.getTextContrast(backColor, i);
      }

      function fmtDirection(d) {
        var m = sucrose.utils.isRTLChar(d.slice(-1)),
            dir = m ? 'rtl' : 'ltr';
        return 'ltr';
      }

      function fmtLabel(txt, classes, dy, anchor, fill) {
        txt
          .attr('x', 0)
          .attr('y', 0)
          .attr('dy', dy + 'em')
          .attr('class', classes)
          .attr('direction', function() {
            return fmtDirection(txt.text());
          })
          .style('pointer-events', 'none')
          .style('text-anchor', anchor)
          .style('fill', fill);
      }

      function positionValue(lbls) {
        lbls.each(function(d) {
          var lbl = d3.select(this);
          var cnt = lbl.selectAll('.sc-label').size() + 1;
          var dy = (.85 + cnt - 1) + 'em';
          lbl.select('.sc-value')
            .attr('dy', dy);
        });
      }

      function positionLabelBox(lbls) {
        lbls.each(function(d, i) {
          var lbl = d3.select(this);

          lbl.select('.sc-label-box')
            .attr('x', (d.labelWidth + 6) / -2)
            .attr('y', -2)
            .attr('width', d.labelWidth + 6)
            .attr('height', d.labelHeight + 4)
            .attr('rx', 2)
            .attr('ry', 2)
            .style('fill-opacity', 1);
        });
      }

    });

    return chart;
  }


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  chart.dispatch = dispatch;

  chart.color = function(_) {
    if (!arguments.length) return color;
    color = _;
    return chart;
  };
  chart.fill = function(_) {
    if (!arguments.length) return fill;
    fill = _;
    return chart;
  };
  chart.classes = function(_) {
    if (!arguments.length) return classes;
    classes = _;
    return chart;
  };
  chart.gradient = function(_) {
    if (!arguments.length) return gradient;
    gradient = _;
    return chart;
  };

  chart.x = function(_) {
    if (!arguments.length) return getX;
    getX = _;
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) return getY;
    getY = _;
    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) return margin;
    margin = _;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return chart;
  };

  chart.xScale = function(_) {
    if (!arguments.length) return x;
    x = _;
    return chart;
  };

  chart.yScale = function(_) {
    if (!arguments.length) return y;
    y = _;
    return chart;
  };

  chart.yDomain = function(_) {
    if (!arguments.length) return yDomain;
    yDomain = _;
    return chart;
  };

  chart.forceY = function(_) {
    if (!arguments.length) return forceY;
    forceY = _;
    return chart;
  };

  chart.id = function(_) {
    if (!arguments.length) return id;
    id = _;
    return chart;
  };

  chart.delay = function(_) {
    if (!arguments.length) return delay;
    delay = _;
    return chart;
  };

  chart.clipEdge = function(_) {
    if (!arguments.length) return clipEdge;
    clipEdge = _;
    return chart;
  };

  chart.fmtKey = function(_) {
    if (!arguments.length) return fmtKey;
    fmtKey = _;
    return chart;
  };

  chart.fmtValue = function(_) {
    if (!arguments.length) return fmtValue;
    fmtValue = _;
    return chart;
  };

  chart.fmtCount = function(_) {
    if (!arguments.length) return fmtCount;
    fmtCount = _;
    return chart;
  };

  chart.wrapLabels = function(_) {
    if (!arguments.length) return wrapLabels;
    wrapLabels = _;
    return chart;
  };

  chart.minLabelWidth = function(_) {
    if (!arguments.length) return minLabelWidth;
    minLabelWidth = _;
    return chart;
  };

  chart.textureFill = function(_) {
    if (!arguments.length) return textureFill;
    textureFill = _;
    return chart;
  };

  chart.locality = function(_) {
    if (!arguments.length) {
      return locality;
    }
    locality = sucrose.utils.buildLocality(_);
    return chart;
  };

  //============================================================

  return chart;
}

sucrose.models.funnelChart = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 10, right: 10, bottom: 10, left: 10},
      width = null,
      height = null,
      showTitle = false,
      showLegend = true,
      direction = 'ltr',
      tooltip = null,
      tooltips = true,
      tooltipContent = function(key, x, y, e, graph) {
        return '<h3>' + key + ' - ' + x + '</h3>' +
               '<p>' + y + '</p>';
      },
      x,
      y,
      durationMs = 0,
      state = {},
      strings = {
        legend: {close: 'Hide legend', open: 'Show legend'},
        controls: {close: 'Hide controls', open: 'Show controls'},
        noData: 'No Data Available.',
        noLabel: 'undefined'
      },
      dispatch = d3.dispatch('chartClick', 'elementClick', 'tooltipShow', 'tooltipHide', 'tooltipMove', 'stateChange', 'changeState');

  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var funnel = sucrose.models.funnel(),
      legend = sucrose.models.legend()
        .align('center'),
      yScale = d3.scaleLinear();

  var showTooltip = function(eo, offsetElement, properties) {
    var key = eo.series.key,
        x = properties.total ? (eo.point.value * 100 / properties.total).toFixed(1) : 100,
        y = eo.point.value,
        content = tooltipContent(key, x, y, eo, chart),
        gravity = eo.value < 0 ? 'n' : 's';
    tooltip = sucrose.tooltip.show(eo.e, content, gravity, null, offsetElement);
  };

  var seriesClick = function(data, e, chart) {
    return;
  };

  //============================================================

  function chart(selection) {

    selection.each(function(chartData) {

      var properties = chartData.properties,
          data = chartData.data,
          container = d3.select(this),
          that = this,
          availableWidth = (width || parseInt(container.style('width'), 10) || 960) - margin.left - margin.right,
          availableHeight = (height || parseInt(container.style('height'), 10) || 400) - margin.top - margin.bottom,
          innerWidth = availableWidth,
          innerHeight = availableHeight,
          innerMargin = {top: 0, right: 0, bottom: 0, left: 0},
          minSliceHeight = 30;

      chart.update = function() {
        container.transition().duration(durationMs).call(chart);
      };

      chart.dataSeriesActivate = function(eo) {
        var series = eo.series;

        series.active = (!series.active || series.active === 'inactive') ? 'active' : 'inactive';
        series.values[0].active = series.active;

        // if you have activated a data series, inactivate the rest
        if (series.active === 'active') {
          data
            .filter(function(d) {
              return d.active !== 'active';
            })
            .map(function(d) {
              d.active = 'inactive';
              return d;
            });
        }

        // if there are no active data series, inactivate them all
        if (!data.filter(function(d) { return d.active === 'active'; }).length) {
          data.map(function(d) {
            d.active = '';
            return d;
          });
        }

        container.call(chart);
      };

      chart.container = this;

      //------------------------------------------------------------
      // Display No Data message if there's nothing to show.

      if (!data || !data.length || !data.filter(function(d) {return d.values.length; }).length) {
        displayNoData();
        return chart;
      }

      //------------------------------------------------------------
      // Process data
      // add series index to each data point for reference
      data.forEach(function(s, i) {
        s.series = i;

        s.values.forEach(function(p, i) {
          p.series = s.series;
          p.index = i;
          if (typeof p.value == 'undefined') {
            p.value = p.y;
          }
        });

        s.total = d3.sum(s.values, function(p, i) {
          return p.value; //funnel.y()(d, i);
        });

        if (!s.total) {
          s.disabled = true;
        }
      });

      // only sum enabled series
      var funnelData = data.filter(function(d, i) {
              return !d.disabled;
            });

      if (!funnelData.length) {
        funnelData = [{values: []}];
      }

      var totalAmount = d3.sum(funnelData, function(d) {
              return d.total;
            });
      var totalCount = d3.sum(funnelData, function(d) {
              return d.count;
            });
      properties.total = totalAmount;

      //set state.disabled
      state.disabled = data.map(function(d) { return !!d.disabled; });

      //------------------------------------------------------------
      // Setup Scales

      y = funnel.yScale(); //see below

      //------------------------------------------------------------
      // Display No Data message if there's nothing to show.

      if (!totalAmount) {
        displayNoData();
        return chart;
      } else {
        container.selectAll('.sc-noData').remove();
      }

      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap_bind = container.selectAll('.sucrose.sc-wrap').data([funnelData]);
      var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-funnel-chart');
      var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
      var g_entr = wrap_entr.append('g').attr('class', 'sc-chart-wrap');
      var g = container.select('g.sc-chart-wrap').merge(g_entr);

      g_entr.append('rect').attr('class', 'sc-background')
        .attr('x', -margin.left)
        .attr('y', -margin.top)
        .attr('fill', '#FFF');

      g.select('.sc-background')
        .attr('width', availableWidth + margin.left + margin.right)
        .attr('height', availableHeight + margin.top + margin.bottom);

      var title_entr = g_entr.append('g').attr('class', 'sc-title-wrap');
      var title_wrap = g.select('.sc-title-wrap').merge(title_entr);

      var funnel_entr = g_entr.append('g').attr('class', 'sc-funnel-wrap');
      var funnel_wrap = g.select('.sc-funnel-wrap').merge(funnel_entr);

      var legend_entr = g_entr.append('g').attr('class', 'sc-legend-wrap');
      var legend_wrap = g.select('.sc-legend-wrap').merge(legend_entr);

      wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      //------------------------------------------------------------
      // Title & Legend

      var titleBBox = {width: 0, height: 0};
      title_wrap.select('.sc-title').remove();

      if (showTitle && properties.title) {
        title_wrap
          .append('text')
            .attr('class', 'sc-title')
            .attr('x', direction === 'rtl' ? availableWidth : 0)
            .attr('y', 0)
            .attr('dy', '.75em')
            .attr('text-anchor', 'start')
            .attr('stroke', 'none')
            .attr('fill', 'black')
            .text(properties.title);

        titleBBox = sucrose.utils.getTextBBox(title_wrap.select('.sc-title'));

        innerMargin.top += titleBBox.height + 12;
      }

      if (showLegend) {
        legend
          .id('legend_' + chart.id())
          .strings(chart.strings().legend)
          .align('center')
          .height(availableHeight - innerMargin.top);
        legend_wrap
          .datum(data)
          .call(legend);
        legend
          .arrange(availableWidth);

        var legendLinkBBox = sucrose.utils.getTextBBox(legend_wrap.select('.sc-legend-link')),
            legendSpace = availableWidth - titleBBox.width - 6,
            legendTop = showTitle && legend.collapsed() && legendSpace > legendLinkBBox.width ? true : false,
            xpos = direction === 'rtl' || !legend.collapsed() ? 0 : availableWidth - legend.width(),
            ypos = titleBBox.height;
        if (legendTop) {
          ypos = titleBBox.height - legend.height() / 2 - legendLinkBBox.height / 2;
        } else if (!showTitle) {
          ypos = - legend.margin().top;
        }

        legend_wrap
          .attr('transform', 'translate(' + xpos + ',' + ypos + ')');

        innerMargin.top += legendTop ? 0 : legend.height() - 12;
      }

      // Recalc inner margins
      innerHeight = availableHeight - innerMargin.top - innerMargin.bottom;

      //------------------------------------------------------------
      // Main Chart Component(s)

      funnel
        .width(innerWidth)
        .height(innerHeight);

      funnel_wrap
        .datum(funnelData)
        .attr('transform', 'translate(' + innerMargin.left + ',' + innerMargin.top + ')')
          .call(funnel);

      //------------------------------------------------------------
      // Setup Scales (again, not sure why it has to be here and not above?)

      var tickValues = resetScale(yScale, funnelData);

      function resetScale(scale, data) {
        var series1 = [[0]];
        var series2 = data.filter(function(d) {
                return !d.disabled;
              })
              .map(function(d) {
                return d.values.map(function(d, i) {
                  return d.y0 + d.y;
                });
              });
        var tickValues = d3.merge(series1.concat(series2));

        yScale
          .domain(tickValues)
          .range(tickValues.map(function(d) { return y(d); }));

        return tickValues;
      }

      function displayNoData() {
        container.select('.sucrose.sc-wrap').remove();
        var noDataText = container.selectAll('.sc-noData').data([chart.strings().noData]);

        noDataText.enter().append('text')
          .attr('class', 'sucrose sc-noData')
          .attr('dy', '-.7em')
          .style('text-anchor', 'middle');

        noDataText
          .attr('x', margin.left + availableWidth / 2)
          .attr('y', margin.top + availableHeight / 2)
          .text(function(d) {
            return d;
          });
      }

      //============================================================
      // Event Handling/Dispatching (in chart's scope)
      //------------------------------------------------------------

      legend.dispatch.on('legendClick', function(d, i) {
        d.disabled = !d.disabled;
        d.active = false;

        // if there are no enabled data series, enable them all
        if (!data.filter(function(d) { return !d.disabled; }).length) {
          data.map(function(d) {
            d.disabled = false;
            return d;
          });
        }

        // if there are no active data series, activate them all
        if (!data.filter(function(d) { return d.active === 'active'; }).length) {
          data.map(function(d) {
            d.active = '';
            return d;
          });
        }

        state.disabled = data.map(function(d) { return !!d.disabled; });
        dispatch.call('stateChange', this, state);

        container.transition().duration(durationMs).call(chart);
      });

      dispatch.on('tooltipShow', function(eo) {
        if (tooltips) {
          showTooltip(eo, that.parentNode, properties);
        }
      });

      dispatch.on('tooltipMove', function(e) {
        if (tooltip) {
          sucrose.tooltip.position(that.parentNode, tooltip, e);
        }
      });

      dispatch.on('tooltipHide', function() {
        if (tooltips) {
          sucrose.tooltip.cleanup();
        }
      });

      // Update chart from a state object passed to event handler
      dispatch.on('changeState', function(eo) {
        if (typeof eo.disabled !== 'undefined') {
          funnelData.forEach(function(series, i) {
            series.disabled = eo.disabled[i];
          });
          state.disabled = eo.disabled;
        }

        container.transition().duration(durationMs).call(chart);
      });

      dispatch.on('chartClick', function() {
        if (legend.enabled()) {
          legend.dispatch.call('closeMenu', this);
        }
      });

      funnel.dispatch.on('elementClick', function(eo) {
        dispatch.call('chartClick', this);
        seriesClick(data, eo, chart);
      });

    });

    return chart;
  }

  //============================================================
  // Event Handling/Dispatching (out of chart's scope)
  //------------------------------------------------------------

  funnel.dispatch.on('elementMouseover.tooltip', function(eo) {
    dispatch.call('tooltipShow', this, eo);
  });

  funnel.dispatch.on('elementMousemove.tooltip', function(e) {
    dispatch.call('tooltipMove', this, e);
  });

  funnel.dispatch.on('elementMouseout.tooltip', function() {
    dispatch.call('tooltipHide', this);
  });


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  // expose chart's sub-components
  chart.dispatch = dispatch;
  chart.funnel = funnel;
  chart.legend = legend;

  fc.rebind(chart, funnel, 'id', 'x', 'y', 'xDomain', 'yDomain', 'forceX', 'forceY', 'color', 'fill', 'classes', 'gradient', 'locality');
  fc.rebind(chart, funnel, 'fmtKey', 'fmtValue', 'fmtCount', 'clipEdge', 'delay', 'wrapLabels', 'minLabelWidth', 'textureFill');

  chart.colorData = function(_) {
    var type = arguments[0],
        params = arguments[1] || {};
    var color = function(d, i) {
          return sucrose.utils.defaultColor()(d, d.series);
        };
    var classes = function(d, i) {
          return 'sc-group sc-series-' + d.series;
        };

    switch (type) {
      case 'graduated':
        color = function(d, i) {
          return d3.interpolateHsl(d3.rgb(params.c1), d3.rgb(params.c2))(d.series / params.l);
        };
        break;
      case 'class':
        color = function() {
          return 'inherit';
        };
        classes = function(d, i) {
          var iClass = (d.series * (params.step || 1)) % 14;
          iClass = (iClass > 9 ? '' : '0') + iClass;
          return 'sc-group sc-series-' + d.series + ' sc-fill' + iClass;
        };
        break;
      case 'data':
        color = function(d, i) {
          return d.classes ? 'inherit' : d.color || sucrose.utils.defaultColor()(d, d.series);
        };
        classes = function(d, i) {
          return 'sc-group sc-series-' + d.series + (d.classes ? ' ' + d.classes : '');
        };
        break;
    }

    var fill = (!params.gradient) ? color : function(d, i) {
      var p = {orientation: params.orientation || 'vertical', position: params.position || 'middle'};
      return funnel.gradient(d, d.series, p);
    };

    funnel.color(color);
    funnel.fill(fill);
    funnel.classes(classes);

    legend.color(color);
    legend.classes(classes);

    return chart;
  };

  chart.x = function(_) {
    if (!arguments.length) { return funnel.x(); }
    funnel.x(_);
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) { return funnel.y(); }
    funnel.y(_);
    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) {
      return margin;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        margin[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) {
      return width;
    }
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) {
      return height;
    }
    height = _;
    return chart;
  };

  chart.showTitle = function(_) {
    if (!arguments.length) {
      return showTitle;
    }
    showTitle = _;
    return chart;
  };

  chart.showLegend = function(_) {
    if (!arguments.length) {
      return showLegend;
    }
    showLegend = _;
    return chart;
  };

  chart.tooltip = function(_) {
    if (!arguments.length) {
      return tooltip;
    }
    tooltip = _;
    return chart;
  };

  chart.tooltips = function(_) {
    if (!arguments.length) {
      return tooltips;
    }
    tooltips = _;
    return chart;
  };

  chart.tooltipContent = function(_) {
    if (!arguments.length) {
      return tooltipContent;
    }
    tooltipContent = _;
    return chart;
  };

  chart.state = function(_) {
    if (!arguments.length) {
      return state;
    }
    state = _;
    return chart;
  };

  chart.strings = function(_) {
    if (!arguments.length) {
      return strings;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        strings[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.seriesClick = function(_) {
    if (!arguments.length) {
      return seriesClick;
    }
    seriesClick = _;
    return chart;
  };

  chart.direction = function(_) {
    if (!arguments.length) {
      return direction;
    }
    direction = _;
    legend.direction(_);
    return chart;
  };

  //============================================================

  return chart;
};

sucrose.models.gauge = function() {
  /* original inspiration for this chart type is at http://bl.ocks.org/3202712 */
  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 0, right: 0, bottom: 0, left: 0}
    , width = null
    , height = null
    , clipEdge = true
    , getValues = function(d) { return d.values; }
    , getX = function(d) { return d.key; }
    , getY = function(d) { return d.y; }
    , locality = sucrose.utils.buildLocality()
    , id = Math.floor(Math.random() * 10000) //Create semi-unique ID in case user doesn't select one
    , labelFormat = d3.format(',g')
    , valueFormat = d3.format(',.f')
    , showLabels = true
    , showPointer = true
    , color = function (d, i) { return sucrose.utils.defaultColor()(d, d.series); }
    , fill = color
    , classes = function (d,i) { return 'sc-arc-path sc-series-' + d.series; }
    , dispatch = d3.dispatch('chartClick', 'elementClick', 'elementDblClick', 'elementMouseover', 'elementMouseout', 'elementMousemove')
  ;

  var ringWidth = 50
    , pointerWidth = 5
    , pointerTailLength = 5
    , pointerHeadLength = 90
    , minValue = 0
    , maxValue = 10
    , minAngle = -90
    , maxAngle = 90
    , transitionMs = 750
    , labelInset = 10
  ;

  //============================================================

  //colorScale = d3.scaleLinear().domain([0, .5, 1].map(d3.interpolate(min, max))).range(["green", "yellow", "red"]);

  function chart(selection)
  {
    selection.each(

    function(chartData) {

      var properties = chartData.properties
        , data = chartData.data;

        var availableWidth = width - margin.left - margin.right
          , availableHeight = height - margin.top - margin.bottom
          , radius =  Math.min( (availableWidth/2), availableHeight ) / (  (100+labelInset)/100  )
          , container = d3.select(this)
          , range = maxAngle - minAngle
          , scale = d3.scaleLinear().range([0,1]).domain([minValue, maxValue])
          , previousTick = 0
          , arcData = data.map( function(d,i){
              var rtn = {
                  key:d.key
                , series:d.series
                , y0:previousTick
                , y1:d.y
                , color:d.color
                , classes:d.classes
              };
              previousTick = d.y;
              return rtn;
            })
          , labelData = [0].concat( data.map( function(d){ return d.y; } ) )
          , prop = function(d){ return d*radius/100; }
          , pointerValue = properties.values[0].t
          ;

        //------------------------------------------------------------
        // Setup containers and skeleton of chart

        var wrap_bind = container.selectAll('g.sc-wrap.sc-gauge').data([data]);
        var wrap_entr = wrap_bind.enter().append('g').attr('class','sucrose sc-wrap sc-gauge');
        var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
        var defs_entr = wrap_entr.append('defs');
        var g_entr =wrap_entr.append('g').attr('class', 'sc-chart-wrap');
        var g = container.select('g.sc-chart-wrap').merge(g_entr);


        //set up the gradient constructor function
        chart.gradient = function(d,i) {
          return sucrose.utils.colorRadialGradient( d, id+'-'+i, {x:0, y:0, r:radius, s:ringWidth/100, u:'userSpaceOnUse'}, color(d,i), wrap.select('defs') );
        };

        g_entr.append('g').attr('class', 'sc-arc-group');
        g_entr.append('g').attr('class', 'sc-labels');
        g_entr.append('g').attr('class', 'sc-pointer');
        g_entr.append('g').attr('class', 'sc-odometer');

        wrap.attr('transform', 'translate('+ (margin.left/2 + margin.right/2 + prop(labelInset)) +','+ (margin.top + prop(labelInset)) +')');
        //g.select('.sc-arc-gauge').attr('transform', 'translate('+ availableWidth/2 +','+ availableHeight/2 +')');

        //------------------------------------------------------------

        // defs_entr.append('clipPath')
        //     .attr('id', 'sc-edge-clip-' + id)
        //   .append('rect');
        // wrap.select('#sc-edge-clip-' + id + ' rect')
        //     .attr('width', availableWidth)
        //     .attr('height', availableHeight);
        // g.attr('clip-path', clipEdge ? 'url(#sc-edge-clip-' + id + ')' : '');

        //------------------------------------------------------------
        // Gauge arcs
        var arc = d3.arc()
          .innerRadius( prop(ringWidth) )
          .outerRadius( radius )
          .startAngle(function(d, i) {
            return deg2rad( newAngle(d.y0) );
          })
          .endAngle(function(d, i) {
            return deg2rad( newAngle(d.y1) );
          });

        var ag = g.select('.sc-arc-group')
            .attr('transform', centerTx);

        ag.selectAll('.sc-arc-path')
            .data(arcData)
          .enter().append('path')
            .attr('class', 'sc-arc-path')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 3)
            .attr('d', arc)
            .on('mouseover', function(d, i) {
              d3.select(this).classed('hover', true);
              var eo = {
                point: d,
                pointIndex: i,
                e: d3.event,
                id: id
              };
              dispatch.call('elementMouseover', this, eo);
            })
            .on('mouseout', function(d, i) {
              d3.select(this).classed('hover', false);
              dispatch.call('elementMouseout', this);
            })
            .on('mousemove', function(d, i) {
              var e = d3.event;
              dispatch.call('elementMousemove', this, e);
            })
            .on('click', function(d, i) {
              var eo = {
                  point: d,
                  index: i,
                  e: d3.event,
                  id: id
              };
              d3.event.stopPropagation();
              dispatch.call('elementClick', this, eo);
            })
            .on('dblclick', function(d, i) {
              var eo = {
                  point: d,
                  index: i,
                  e: d3.event,
                  id: id
              };
              d3.event.stopPropagation();
              dispatch.call('elementDblClick', this, eo);
            });

        ag.selectAll('.sc-arc-path').transition().duration(10)
            .attr('class', classes)
            .attr('fill', fill)
            .attr('d', arc);

        //------------------------------------------------------------
        // Gauge labels
        var lg = g.select('.sc-labels')
            .attr('transform', centerTx);

        lg.selectAll('text').transition().duration(0)
            .attr('transform', function(d) {
              return 'rotate('+ newAngle(d) +') translate(0,'+ (-radius-prop(1.5)) +')';
            })
            .style('font-size', prop(0.6)+'em');

        lg.selectAll('text')
            .data(labelData)
          .enter().append('text')
            .attr('transform', function(d) {
              return 'rotate('+ newAngle(d) +') translate(0,'+ (-radius-prop(1.5)) +')';
            })
            .text(labelFormat)
            .style('text-anchor', 'middle')
            .style('font-size', prop(0.6)+'em');

        if (showPointer) {
          //------------------------------------------------------------
          // Gauge pointer
          var pointerData = [
                [ Math.round(prop(pointerWidth)/2),    0 ],
                [ 0, -Math.round(prop(pointerHeadLength))],
                [ -(Math.round(prop(pointerWidth)/2)), 0 ],
                [ 0, Math.round(prop(pointerWidth)) ],
                [ Math.round(prop(pointerWidth)/2),    0 ]
              ];

          var pg = g.select('.sc-pointer')
              .attr('transform', centerTx);

          pg.selectAll('path').transition().duration(120)
            .attr('d', d3.line().interpolate('monotone'));

          var pointer = pg.selectAll('path')
              .data([pointerData])
            .enter().append('path')
              .attr('d', d3.line().interpolate('monotone')/*function(d) { return pointerLine(d) +'Z';}*/ )
              .attr('transform', 'rotate('+ minAngle +')');

          setGaugePointer(pointerValue);

          //------------------------------------------------------------
          // Odometer readout
          g.selectAll('.sc-odom').remove();

          g.select('.sc-odomText').transition().duration(0)
              .style('font-size', prop(0.7)+'em');

          g.select('.sc-odometer')
            .append('text')
              .attr('class', 'sc-odom sc-odomText')
              .attr('x', 0)
              .attr('y', 0 )
              .attr('text-anchor', 'middle')
              .text( valueFormat(pointerValue) )
              .style('stroke', 'none')
              .style('fill', 'black')
              .style('font-size', prop(0.7)+'em')
            ;

          var bbox = g.select('.sc-odomText').node().getBoundingClientRect();

          g.select('.sc-odometer')
            .insert('path','.sc-odomText')
            .attr('class', 'sc-odom sc-odomBox')
            .attr("d",
              sucrose.utils.roundedRectangle(
                -bbox.width/2, -bbox.height+prop(1.5), bbox.width+prop(4), bbox.height+prop(2), prop(2)
              )
            )
            .attr('fill', '#eeffff')
            .attr('stroke','black')
            .attr('stroke-width','2px')
            .attr('opacity',0.8)
          ;

          g.select('.sc-odometer')
              .attr('transform', 'translate('+ radius +','+ ( margin.top + prop(70) + bbox.width ) +')');

        } else {
          g.select('.sc-odometer').select('.sc-odomText').remove();
          g.select('.sc-odometer').select('.sc-odomBox').remove();
          g.select('.sc-pointer').selectAll('path').remove();
        }

        //------------------------------------------------------------
        // private functions
        function setGaugePointer(d) {
          pointer.transition()
            .duration(transitionMs)
            .ease('elastic')
            .attr('transform', 'rotate('+ newAngle(d) +')');
        }

        function deg2rad(deg) {
          return deg * Math.PI/180;
        }

        function newAngle(d) {
          return minAngle + ( scale(d) * range );
        }

        // Center translation
        function centerTx() {
          return 'translate('+ radius +','+ radius +')';
        }

        chart.setGaugePointer = setGaugePointer;

      }

    );

    return chart;
  }


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  chart.dispatch = dispatch;

  chart.color = function(_) {
    if (!arguments.length) return color;
    color = _;
    return chart;
  };
  chart.fill = function(_) {
    if (!arguments.length) return fill;
    fill = _;
    return chart;
  };
  chart.classes = function(_) {
    if (!arguments.length) return classes;
    classes = _;
    return chart;
  };
  chart.gradient = function(_) {
    if (!arguments.length) return gradient;
    gradient = _;
    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) return margin;
    margin = _;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return chart;
  };

  chart.values = function(_) {
    if (!arguments.length) return getValues;
    getValues = _;
    return chart;
  };

  chart.x = function(_) {
    if (!arguments.length) return getX;
    getX = _;
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) return getY;
    getY = sucrose.functor(_);
    return chart;
  };

  chart.showLabels = function(_) {
    if (!arguments.length) return showLabels;
    showLabels = _;
    return chart;
  };

  chart.id = function(_) {
    if (!arguments.length) return id;
    id = _;
    return chart;
  };

  chart.valueFormat = function(_) {
    if (!arguments.length) return valueFormat;
    valueFormat = _;
    return chart;
  };

  chart.labelThreshold = function(_) {
    if (!arguments.length) return labelThreshold;
    labelThreshold = _;
    return chart;
  };

  // GAUGE
  chart.ringWidth = function(_) {
    if (!arguments.length) return ringWidth;
    ringWidth = _;
    return chart;
  };
  chart.pointerWidth = function(_) {
    if (!arguments.length) return pointerWidth;
    pointerWidth = _;
    return chart;
  };
  chart.pointerTailLength = function(_) {
    if (!arguments.length) return pointerTailLength;
    pointerTailLength = _;
    return chart;
  };
  chart.pointerHeadLength = function(_) {
    if (!arguments.length) return pointerHeadLength;
    pointerHeadLength = _;
    return chart;
  };
  chart.minValue = function(_) {
    if (!arguments.length) return minValue;
    minValue = _;
    return chart;
  };
  chart.maxValue = function(_) {
    if (!arguments.length) return maxValue;
    maxValue = _;
    return chart;
  };
  chart.minAngle = function(_) {
    if (!arguments.length) return minAngle;
    minAngle = _;
    return chart;
  };
  chart.maxAngle = function(_) {
    if (!arguments.length) return maxAngle;
    maxAngle = _;
    return chart;
  };
  chart.transitionMs = function(_) {
    if (!arguments.length) return transitionMs;
    transitionMs = _;
    return chart;
  };
  chart.labelFormat = function(_) {
    if (!arguments.length) return labelFormat;
    labelFormat = _;
    return chart;
  };
  chart.labelInset = function(_) {
    if (!arguments.length) return labelInset;
    labelInset = _;
    return chart;
  };
  chart.setPointer = function(_) {
    if (!arguments.length) return chart.setGaugePointer;
    chart.setGaugePointer(_);
    return chart;
  };
  chart.isRendered = function(_) {
    return (svg !== undefined);
  };
  chart.showPointer = function(_) {
    if (!arguments.length) return showPointer;
    showPointer = _;
    return chart;
  };

  chart.locality = function(_) {
    if (!arguments.length) {
      return locality;
    }
    locality = sucrose.utils.buildLocality(_);
    return chart;
  };

  //============================================================

  return chart;
}
sucrose.models.gaugeChart = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 10, right: 10, bottom: 10, left: 10},
      width = null,
      height = null,
      showTitle = false,
      showLegend = true,
      direction = 'ltr',
      tooltip = null,
      tooltips = true,
      tooltipContent = function(key, y, e, graph) {
        return '<h3>' + key + '</h3>' +
               '<p>' + y + '</p>';
      },
      x,
      y, //can be accessed via chart.yScale()
      strings = {
        legend: {close: 'Hide legend', open: 'Show legend'},
        controls: {close: 'Hide controls', open: 'Show controls'},
        noData: 'No Data Available.',
        noLabel: 'undefined'
      },
      dispatch = d3.dispatch('chartClick', 'tooltipShow', 'tooltipHide', 'tooltipMove');

  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var gauge = sucrose.models.gauge(),
      legend = sucrose.models.legend()
        .align('center');

  var showTooltip = function(eo, offsetElement) {
    var y = gauge.valueFormat()((eo.point.y1 - eo.point.y0)),
        content = tooltipContent(eo.point.key, y, eo, chart);

    tooltip = sucrose.tooltip.show(eo.e, content, null, null, offsetElement);
  };

  //============================================================

  function chart(selection) {

    selection.each(function(chartData) {

      var properties = chartData.properties,
          data = chartData.data,
          container = d3.select(this),
          that = this,
          availableWidth = (width || parseInt(container.style('width'), 10) || 960) - margin.left - margin.right,
          availableHeight = (height || parseInt(container.style('height'), 10) || 400) - margin.top - margin.bottom,
          innerWidth = availableWidth,
          innerHeight = availableHeight,
          innerMargin = {top: 0, right: 0, bottom: 0, left: 0};

      chart.update = function() {
        container.transition().call(chart);
      };

      chart.container = this;

      //------------------------------------------------------------
      // Display No Data message if there's nothing to show.

      if (!data || !data.length) {
        var noDataText = container.selectAll('.sc-noData').data([chart.strings().noData]);

        noDataText.enter().append('text')
          .attr('class', 'sucrose sc-noData')
          .attr('dy', '-.7em')
          .style('text-anchor', 'middle');

        noDataText
          .attr('x', margin.left + availableWidth / 2)
          .attr('y', margin.top + availableHeight / 2)
          .text(function(d) {
            return d;
          });

        return chart;
      } else {
        container.selectAll('.sc-noData').remove();
      }

      //------------------------------------------------------------
      // Process data
      //add series index to each data point for reference
      data.map(function(d, i) {
        d.series = i;
      });

      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap_bind = container.selectAll('g.sc-wrap.sc-gaugeChart').data([data]);
      var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-gaugeChart');
      var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
      var g_entr = wrap_entr.append('g').attr('class', 'sc-chart-wrap');
      var g = container.select('g.sc-chart-wrap').merge(g_entr);

      g_entr.append('rect').attr('class', 'sc-background')
        .attr('x', -margin.left)
        .attr('y', -margin.top)
        .attr('fill', '#FFF');

      g.select('.sc-background')
        .attr('width', availableWidth + margin.left + margin.right)
        .attr('height', availableHeight + margin.top + margin.bottom);

      g_entr.append('g').attr('class', 'sc-titleWrap');
      var titleWrap = g.select('.sc-titleWrap');
      g_entr.append('g').attr('class', 'sc-gaugeWrap');
      var gaugeWrap = g.select('.sc-gaugeWrap');
      g_entr.append('g').attr('class', 'sc-legendWrap');
      var legendWrap = g.select('.sc-legendWrap');

      wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      //------------------------------------------------------------
      // Title & Legend

      var titleBBox = {width: 0, height: 0};
      titleWrap.select('.sc-title').remove();

      if (showTitle && properties.title) {
        titleWrap
          .append('text')
            .attr('class', 'sc-title')
            .attr('x', direction === 'rtl' ? availableWidth : 0)
            .attr('y', 0)
            .attr('dy', '.75em')
            .attr('text-anchor', 'start')
            .text(properties.title)
            .attr('stroke', 'none')
            .attr('fill', 'black');

        titleBBox = sucrose.utils.getTextBBox(g.select('.sc-title'));

        innerMargin.top += titleBBox.height + 12;
      }

      var legendLinkBBox = {width: 0, height: 0};

      if (showLegend) {
        legend
          .id('legend_' + chart.id())
          .strings(chart.strings().legend)
          .align('center')
          .height(availableHeight - innerMargin.top);
        legendWrap
          .datum(data)
          .call(legend);

        legend
          .arrange(availableWidth);

        var legendLinkBBox = sucrose.utils.getTextBBox(legendWrap.select('.sc-legend-link')),
            legendSpace = availableWidth - titleBBox.width - 6,
            legendTop = showTitle && legend.collapsed() && legendSpace > legendLinkBBox.width ? true : false,
            xpos = direction === 'rtl' || !legend.collapsed() ? 0 : availableWidth - legend.width(),
            ypos = titleBBox.height;
        if (legendTop) {
          ypos = titleBBox.height - legend.height() / 2 - legendLinkBBox.height / 2;
        } else if (!showTitle) {
          ypos = - legend.margin().top;
        }

        legendWrap
          .attr('transform', 'translate(' + xpos + ',' + ypos + ')');

        innerMargin.top += legendTop ? 0 : legend.height() - 12;
      }

      // Recalc inner margins
      innerHeight = availableHeight - innerMargin.top - innerMargin.bottom;

      //------------------------------------------------------------
      // Main Chart Component(s)

      gauge
        .width(innerWidth)
        .height(innerHeight);

      gaugeWrap
        .datum(chartData)
        .attr('transform', 'translate(' + innerMargin.left + ',' + innerMargin.top + ')')
        .transition()
          .call(gauge);

      //gauge.setPointer(properties.value);

      //============================================================
      // Event Handling/Dispatching (in chart's scope)
      //------------------------------------------------------------

      dispatch.on('tooltipShow', function(eo) {
        if (tooltips) {
          showTooltip(eo, that.parentNode);
        }
      });

      dispatch.on('tooltipMove', function(e) {
        if (tooltip) {
          sucrose.tooltip.position(that.parentNode, tooltip, e);
        }
      });

      dispatch.on('tooltipHide', function() {
        if (tooltips) {
          sucrose.tooltip.cleanup();
        }
      });

      dispatch.on('chartClick', function() {
        if (legend.enabled()) {
          legend.dispatch.call('closeMenu', this);
        }
      });

    });

    return chart;
  }

  //============================================================
  // Event Handling/Dispatching (out of chart's scope)
  //------------------------------------------------------------

  gauge.dispatch.on('elementMouseover.tooltip', function(eo) {
    dispatch.call('tooltipShow', this, eo);
  });

  gauge.dispatch.on('elementMousemove.tooltip', function(e) {
    dispatch.call('tooltipMove', this, e);
  });

  gauge.dispatch.on('elementMouseout.tooltip', function() {
    dispatch.call('tooltipHide', this);
  });

  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  // expose chart's sub-components
  chart.dispatch = dispatch;
  chart.gauge = gauge;
  chart.legend = legend;

  fc.rebind(chart, gauge, 'id', 'x', 'y', 'color', 'fill', 'classes', 'gradient', 'locality');
  fc.rebind(chart, gauge, 'valueFormat', 'values', 'showLabels', 'showPointer', 'setPointer', 'ringWidth', 'labelThreshold', 'maxValue', 'minValue', 'transitionMs');

  chart.colorData = function(_) {
    var type = arguments[0],
        params = arguments[1] || {};
    var color = function(d, i) {
          return sucrose.utils.defaultColor()(d, d.series);
        };
    var classes = function(d, i) {
          return 'sc-arc-path sc-series-' + d.series;
        };

    switch (type) {
      case 'graduated':
        color = function(d, i) {
          return d3.interpolateHsl(d3.rgb(params.c1), d3.rgb(params.c2))(d.series / params.l);
        };
        break;
      case 'class':
        color = function() {
          return 'inherit';
        };
        classes = function(d, i) {
          var iClass = (d.series * (params.step || 1)) % 14;
          iClass = (iClass > 9 ? '' : '0') + iClass;
          return 'sc-arc-path sc-series-' + d.series + ' sc-fill' + iClass;
        };
        break;
      case 'data':
        color = function(d, i) {
          return d.classes ? 'inherit' : d.color || sucrose.utils.defaultColor()(d, d.series);
        };
        classes = function(d, i) {
          return 'sc-arc-path sc-series-' + d.series + (d.classes ? ' ' + d.classes : '');
        };
        break;
    }

    var fill = (!params.gradient) ? color : function(d, i) {
      return gauge.gradient(d, d.series);
    };

    gauge.color(color);
    gauge.fill(fill);
    gauge.classes(classes);

    legend.color(color);
    legend.classes(classes);

    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) {
      return margin;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        margin[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) {
      return width;
    }
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) {
      return height;
    }
    height = _;
    return chart;
  };

  chart.showTitle = function(_) {
    if (!arguments.length) {
      return showTitle;
    }
    showTitle = _;
    return chart;
  };

  chart.showLegend = function(_) {
    if (!arguments.length) {
      return showLegend;
    }
    showLegend = _;
    return chart;
  };

  chart.tooltip = function(_) {
    if (!arguments.length) {
      return tooltip;
    }
    tooltip = _;
    return chart;
  };

  chart.tooltips = function(_) {
    if (!arguments.length) {
      return tooltips;
    }
    tooltips = _;
    return chart;
  };

  chart.tooltipContent = function(_) {
    if (!arguments.length) {
      return tooltipContent;
    }
    tooltipContent = _;
    return chart;
  };

  chart.strings = function(_) {
    if (!arguments.length) {
      return strings;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        strings[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.direction = function(_) {
    if (!arguments.length) {
      return direction;
    }
    direction = _;
    legend.direction(_);
    return chart;
  };

  //============================================================

  return chart;
};

sucrose.models.globeChart = function() {

  // http://cldr.unicode.org/
  // http://www.geonames.org/countries/
  // http://www.naturalearthdata.com/downloads/
  // http://geojson.org/geojson-spec.html
  // http://bl.ocks.org/mbostock/4183330
  // http://bost.ocks.org/mike/map/
  // https://github.com/mbostock/topojson
  // https://github.com/mbostock/topojson/wiki/Command-Line-Reference
  // https://github.com/mbostock/us-atlas
  // https://github.com/mbostock/world-atlas
  // https://github.com/papandreou/node-cldr
  // https://github.com/melalj/topojson-map-generator
  // http://bl.ocks.org/mbostock/248bac3b8e354a9103c4#cubicInOut
  // https://www.jasondavies.com/maps/rotate/
  // https://www.jasondavies.com/maps/zoom/
  // http://www.kirupa.com/html5/animating_with_easing_functions_in_javascript.htm
  // http://www.jacklmoore.com/notes/mouse-position/

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var id = Math.floor(Math.random() * 10000), //Create semi-unique ID in case user doesn't select one,
      margin = {top: 0, right: 0, bottom: 0, left: 0},
      width = null,
      height = null,
      showTitle = false,
      showControls = false,
      showLegend = true,
      direction = 'ltr',
      tooltip = null,
      tooltips = true,
      initialTilt = 0,
      x,
      y,
      state = {},
      strings = {
        legend: {close: 'Hide legend', open: 'Show legend'},
        controls: {close: 'Hide controls', open: 'Show controls'},
        noData: 'No Data Available.'
      },
      showLabels = true,
      autoSpin = false,
      showGraticule = true,
      color = function(d, i) { return sucrose.utils.defaultColor()(d, i); },
      classes = function(d, i) { return 'sc-country-' + i; },
      fill = color,
      dispatch = d3.dispatch('chartClick', 'tooltipShow', 'tooltipHide', 'tooltipMove', 'stateChange', 'changeState', 'elementClick', 'elementDblClick', 'elementMouseover', 'elementMouseout');


  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var projection = d3.geo.orthographic()
        .clipAngle(90)
        .precision(0.1);

  var path = d3.geo.path();

  var graticule = d3.geo.graticule();

  var colorLimit = 0;

  function tooltipContent(d) {
    return '<p><b>' + d.name + '</b></p>' +
           '<p><b>Amount:</b> $' + d3.format(',.0f')(d.amount) + '</p>';
  }

  function showTooltip(eo, offsetElement) {
    var content = tooltipContent(eo);
    tooltip = sucrose.tooltip.show(eo.e, content, null, null, offsetElement);
  };


  var seriesClick = function(data, e, chart) {
    return;
  };

  //============================================================

  function chart(selection) {

    selection.each(function(chartData) {

      var that = this,
          node = d3.select('#' + id + ' svg').node(),
          container = d3.select(this);
      var properties = chartData ? chartData.properties : {},
          data = chartData ? chartData.data : null;

      var tooltips0 = tooltips,
          m0, n0, o0;

      // Header variables
      var maxControlsWidth = 0,
          maxLegendWidth = 0,
          widthRatio = 0,
          headerHeight = 0,
          titleBBox = {width: 0, height: 0},
          controlsHeight = 0,
          legendHeight = 0,
          trans = '';

      // Globe variables
      var world,
          active_country = false,
          world_map = [],
          country_map = {},
          country_label = {},
          world_view = {rotate: [100, initialTilt], scale: 1, zoom: 1},
          country_view = {rotate: [null, null], scale: null, zoom: null},
          iRotation;

      // Chart layout variables
      var renderWidth, renderHeight, availableWidth, availableHeight;

      chart.container = this;

      var fillGradient = function(d, i) {
            return sucrose.utils.colorRadialGradient(d, i, 0, 0, '35%', '35%', color(d, i), wrap.select('defs'));
          };

      //------------------------------------------------------------
      // Private method for displaying no data message.

      function displayNoData(d) {
        if (d && d.length) {
          container.selectAll('.sc-noData').remove();
          return false;
        }

        container.select('.sucrose.sc-wrap').remove();

        var w = width || parseInt(container.style('width'), 10) || 960,
            h = height || parseInt(container.style('height'), 10) || 400,
            noDataText = container.selectAll('.sc-noData').data([chart.strings().noData]);

        noDataText.enter().append('text')
          .attr('class', 'sucrose sc-noData')
          .attr('dy', '-.7em')
          .style('text-anchor', 'middle');

        noDataText
          .attr('x', margin.left + w / 2)
          .attr('y', margin.top + h / 2)
          .text(function(d) {
            return d;
          });

        return true;
      }

      // Check to see if there's nothing to show.
      if (displayNoData(data)) {
        return chart;
      }

      //------------------------------------------------------------
      // Process data
      var results = data[0];

      //------------------------------------------------------------
      // Setup svgs and skeleton of chart

      var wrap_bind = container.selectAll('g.sc-wrap.sc-globeChart').data([1]);
      var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-globeChart');
      var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
      var g_entr = wrap_entr.append('g').attr('class', 'sc-chart-wrap');
      var g = container.select('g.sc-chart-wrap').merge(g_entr);

      g_entr.append('defs');
      var defs = wrap.select('defs');




      g_entr.append('svg:rect')
        .attr('class', 'sc-chartBackground')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
      var backg = wrap.select('.sc-chartBackground');

      var globeEnter = g_entr.append('g')
            .attr('class', 'sc-globe');
      var globeChart = wrap.select('.sc-globe');

      globeEnter.append('path')
        .datum({type: 'Sphere'})
        .attr('class', 'sphere');
      var sphere = d3.select('.sphere');

      if (showGraticule) {
        globeEnter.append('path')
          .datum(graticule)
          .attr('class', 'graticule');
        var grid = d3.select('.graticule');
      }

      // zoom and pan
      var zoom = d3.zoom();
      zoom
        .on('zoom', function () {
          var scale = calcScale(d3.event.scale);
          projection.scale(scale);
          refresh();
        });
      globeChart.call(zoom);

      globeChart
        .on('mousedown', mousedown);

      wrap
        .on('mousemove', mousemove)
        .on('mouseup', mouseup);

      sphere
        .on('click', function () {
          unLoadCountry();
        });

      //------------------------------------------------------------
      // Main chart draw methods

      chart.update = function() {
        container.transition().call(chart);
      };

      chart.resize = function () {
        var scale, translate;
        calcDimensions();
        scale = calcScale(zoom.scale());
        translate = calcTranslate();
        backg
          .attr('width', availableWidth)
          .attr('height', availableHeight);
        projection
          .scale(scale)
          .translate(translate);
        refresh();
      }

      chart.render = function() {

        calcDimensions();

        projection
          .scale(calcScale(1))
          .translate(calcTranslate())
          .rotate(world_view.rotate);

        path.projection(projection);

        sphere
          .attr('d', path);

        if (showGraticule) {
          grid
            .attr('d', path)
        }

        backg
          .attr('width', availableWidth)
          .attr('height', availableHeight);

        refresh();
      };

      //============================================================

      chart.render();

      queue()
        .defer(d3.json, 'data/geo/world-countries-topo-110.json')
        .defer(d3.json, 'data/geo/usa-states-topo-110.json')
        .defer(d3.json, 'data/geo/cldr_en.json')
        .await(function (error, world, country, labels) {
          if (error) {
            return;
          }

          world_map = topojson.feature(world, world.objects.countries).features;
          country_map['USA'] = topojson.feature(country, country.objects.states).features;
          country_label = labels;

          loadChart(world_map, 'countries');

          if (autoSpin) {
            iRotation = setInterval(spin, 10);
          }
        });

      //------------------------------------------------------------
      // Internal functions

      function calcDimensions() {
        renderWidth = width || parseInt(container.style('width'), 10) || 960;
        renderHeight = height || parseInt(container.style('height'), 10) || 400;
        availableWidth = renderWidth - margin.left - margin.right;
        availableHeight = renderHeight - margin.top - margin.bottom;
      }

      function calcScale(s) {
        var scale = Math.min(Math.max(s, 0.75), 3),
            size = Math.min(availableHeight, availableWidth) / 2;
        return scale * size;
      }

      function calcTranslate() {
        return [availableWidth / 2 + margin.left, availableHeight / 2 + margin.top];
      }

      function loadChart(data, type) {
        colorLimit = results._total;

        world = globeEnter.append('g')
            .attr('class', type)
          .selectAll('path')
            .data(data)
          .enter().append('path')
            .attr('d', clip)
            .attr('class', classes)
            .style('fill', function (d, i) {
              d.amount = amount(d);
              return fill(d, d.properties.mapcolor13 || i);
            });

        world
          .on('click', loadCountry)
          .on('mouseover', function (d, i, j) {
            var eo = buildEventObject(d3.event, d, i, j);
            dispatch.call('tooltipShow', this, eo);
          })
          .on('mousemove', function(d, i, j) {
            var e = d3.event;
            dispatch.call('tooltipMove', this, e);
          })
          .on('mouseout', function () {
            dispatch.call('tooltipHide', this);
          });

        function buildEventObject(e, d, i, j) {
          var eo = {
              point: d,
              e: e,
              name: (country_label[d.properties.iso_a2] || d.properties.name),
              amount: amount(d)
          };
          return eo;
        }
      }

      function loadCountry(d) {
        if (active_country == d3.select(this)) {
          return;
        }

        unLoadCountry();

        // If we have country-specific geographic features.
        if (!country_map[d.id]) {
          return;
        }

        if (tooltips) {
          sucrose.tooltip.cleanup();
        }

        world_view = {
          rotate: projection.rotate(),
          scale: projection.scale(),
          zoom: zoom.scale()
        };

        var centroid = d3.geo.centroid(d);
        projection.rotate([-centroid[0], -centroid[1]]);

        var bounds = path.bounds(d);
        var hscale = availableWidth  / (bounds[1][0] - bounds[0][0]);
        var vscale = availableHeight / (bounds[1][1] - bounds[0][1]);

        if (availableWidth * hscale < availableHeight * vscale) {
          projection.scale(availableWidth * hscale / 2);
          zoom.scale(hscale);
        } else {
          projection.scale(availableHeight * vscale / 2);
          zoom.scale(vscale);
        }

        country_view = {
          rotate: projection.rotate(),
          scale: projection.scale(),
          zoom: zoom.scale()
        };

        // Flatten the results and include the state-level
        // results so that we don't need complex tooltip logic.
        var obj = region_results(d);
        obj.parent = results;
        results = obj;

        colorLimit = results._total;

        active_country = d3.select(this);

        loadChart(country_map[d.id], 'states');

        active_country.style('display', 'none');

        refresh();
      }

      function unLoadCountry() {
        if (!active_country) {
          return;
        }
        results = results.parent;
        colorLimit = results._total;
        active_country.style('display', 'inline');
        d3.select('.states').remove();
        active_country = false;
        country_view = {rotate: [null, null], scale: null, zoom: null};
        projection.rotate(world_view.rotate);
        projection.scale(world_view.scale);
        zoom.scale(world_view.zoom);
        refresh();
      }

      function region_results(d) {
        return (
          results._values[d.id] ||
          results._values[d.properties.name] ||
          {"_total": 0}
        );
      }

      function amount(d) {
        return region_results(d)._total || 0;
      }

      function clip(d) {
        return path(d) || 'M0,0Z';
      }

      function refresh(duration) {
        globeChart.selectAll('path')
          .attr('d', clip);
      }

      function spin() {
        var o0 = projection.rotate(),
            m1 = [10, 0],
            o1 = [o0[0] + m1[0] / 8, initialTilt];
        rotate(o1);
      }

      function rotate(o) {
        projection.rotate(o);
        refresh();
      }

      //============================================================
      // Event Handling/Dispatching (in chart's scope)
      //------------------------------------------------------------

      function mousedown() {
        d3.event.preventDefault();

        m0 = normalizeOffset(d3.event);
        n0 = projection.invert(m0);
        o0 = projection.rotate();

        if (tooltips) {
          sucrose.tooltip.cleanup();
          tooltips = false;
        }

        if (autoSpin) {
          clearInterval(iRotation);
        }
      }

      function normalizeOffset(e) {
        var rect = node.getBoundingClientRect(),
            offsetX = e.clientX - rect.left,
            offsetY = e.clientY - rect.top;
        return [offsetX, offsetY];
      }

      function mousemove() {
        var m1, n1, o1;

        if (!m0) {
          return;
        }

        m1 = normalizeOffset(d3.event);
        n1 = projection.invert(m1);

        if (!n1[0]) {
          return;
        }

        o1 = [o0[0] + n1[0] - n0[0], (country_view.rotate[1] || world_view.rotate[1])];
        o0 = [o1[0], o1[1]];

        rotate(o1);
      }

      function mouseup() {
        m0 = null;
        tooltips = tooltips0;
      }

      dispatch.on('tooltipShow', function(eo) {
          if (tooltips) {
            showTooltip(eo, that.parentNode);
          }
        });

      dispatch.on('tooltipMove', function(e) {
          if (tooltip) {
            sucrose.tooltip.position(that.parentNode, tooltip, e, 's');
          }
        });

      dispatch.on('tooltipHide', function() {
          if (tooltips) {
            sucrose.tooltip.cleanup();
          }
        });

      // Update chart from a state object passed to event handler
      dispatch.on('changeState', function(eo) {
          if (typeof eo.disabled !== 'undefined') {
            data.forEach(function(series, i) {
              series.disabled = eo.disabled[i];
            });
            state.disabled = eo.disabled;
          }

          if (typeof eo.stacked !== 'undefined') {
            multibar.stacked(eo.stacked);
            state.stacked = eo.stacked;
          }

          container.transition().call(chart);
        });

      // dispatch.on('chartClick', function() {
      //     if (controls.enabled()) {
      //       controls.dispatch.call('closeMenu', this);
      //     }
      //     if (legend.enabled()) {
      //       legend.dispatch.call('closeMenu', this);
      //     }
      //   });

    });

    return chart;
  }

  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  chart.dispatch = dispatch;
  chart.projection = projection;
  chart.path = path;
  chart.graticule = graticule;

  chart.colorData = function(_) {
    var type = arguments[0],
        params = arguments[1] || {};
    var color = function(d, i) {
          return sucrose.utils.defaultColor()(d, i);
        };
    var classes = function(d, i) {
          return 'sc-country-' + i + (d.classes ? ' ' + d.classes : '');
        };

    switch (type) {
      case 'graduated':
        color = function(d, i) {
          return d3.interpolateHsl(d3.rgb(params.c1), d3.rgb(params.c2))(i / params.l);
        };
        break;
      case 'class':
        color = function() {
          return '';
        };
        classes = function(d, i) {
          var iClass = (i * (params.step || 1)) % 14;
          iClass = (iClass > 9 ? '' : '0') + iClass; //TODO: use d3.formatNumber
          return 'sc-country-' + i + ' sc-fill' + iClass;
        };
        break;
      case 'data':
        color = function(d, i) {
          var r = d.amount || 0;
          return d3.interpolateHsl(d3.rgb(params.c1), d3.rgb(params.c2))(r / colorLimit);
        };
        break;
    }
    var fill = (!params.gradient) ? color : function(d, i) {
        return chart.gradient(d, i);
      };

    chart.color(color);
    chart.classes(classes);
    chart.fill(fill);

    return chart;
  };

  chart.color = function(_) {
    if (!arguments.length) return color;
    color = _;
    return chart;
  };
  chart.fill = function(_) {
    if (!arguments.length) return fill;
    fill = _;
    return chart;
  };
  chart.classes = function(_) {
    if (!arguments.length) return classes;
    classes = _;
    return chart;
  };
  chart.gradient = function(_) {
    if (!arguments.length) return gradient;
    gradient = _;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) {
      return margin;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        margin[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.tooltip = function(_) {
    if (!arguments.length) {
      return tooltip;
    }
    tooltip = _;
    return chart;
  };

  chart.tooltips = function(_) {
    if (!arguments.length) {
      return tooltips;
    }
    tooltips = _;
    return chart;
  };

  chart.tooltipContent = function(_) {
    if (!arguments.length) {
      return tooltipContent;
    }
    tooltipContent = _;
    return chart;
  };

  chart.state = function(_) {
    if (!arguments.length) {
      return state;
    }
    state = _;
    return chart;
  };

  chart.strings = function(_) {
    if (!arguments.length) {
      return strings;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        strings[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.values = function(_) {
    if (!arguments.length) return getValues;
    getValues = _;
    return chart;
  };

  chart.x = function(_) {
    if (!arguments.length) return getX;
    getX = _;
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) return getY;
    getY = sucrose.functor(_);
    return chart;
  };

  chart.showLabels = function(_) {
    if (!arguments.length) return showLabels;
    showLabels = _;
    return chart;
  };

  chart.autoSpin = function(_) {
    if (!arguments.length) return autoSpin;
    autoSpin = _;
    return chart;
  };

  chart.id = function(_) {
    if (!arguments.length) return id;
    id = _;
    return chart;
  };

  chart.valueFormat = function(_) {
    if (!arguments.length) return valueFormat;
    valueFormat = _;
    return chart;
  };

  chart.showTitle = function(_) {
    if (!arguments.length) {
      return showTitle;
    }
    showTitle = _;
    return chart;
  };

  //============================================================

  return chart;
};
sucrose.models.line = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var scatter = sucrose.models.scatter();

  var margin = {top: 0, right: 0, bottom: 0, left: 0},
      width = 960,
      height = 500,
      getX = function(d) { return d.x; }, // accessor to get the x value from a data point
      getY = function(d) { return d.y; }, // accessor to get the y value from a data point
      defined = function(d, i) { return !isNaN(getY(d, i)) && getY(d, i) !== null; }, // allows a line to be not continuous when it is not defined
      isArea = function(d) { return (d && d.area) || false; }, // decides if a line is an area or just a line
      clipEdge = false, // if true, masks lines within x and y scale
      x, //can be accessed via chart.xScale()
      y, //can be accessed via chart.yScale()
      interpolate = 'linear', // controls the line interpolation
      color = function(d, i) { return sucrose.utils.defaultColor()(d, d.series); },
      fill = color,
      classes = function(d, i) { return 'sc-group sc-series-' + d.series; };


  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var x0, y0; //used to store previous scales

  //============================================================


  function chart(selection) {
    selection.each(function(data) {
      var availableWidth = width - margin.left - margin.right,
          availableHeight = height - margin.top - margin.bottom,
          container = d3.select(this);

      var curve =
            interpolate === 'linear' ? d3.curveLinear :
            interpolate === 'cardinal' ? d3.curveCardinal :
            interpolate === 'monotone' ? d3.curveMonotoneX :
            interpolate === 'basis' ? d3.curveBasis : d3.natural;

      var t = d3.transition('scatter')
          .duration(400)
          .ease(d3.easeLinear);

      //set up the gradient constructor function
      chart.gradient = function(d, i, p) {
        return sucrose.utils.colorLinearGradient(d, chart.id() + '-' + i, p, color(d, i), wrap.select('defs'));
      };

      //------------------------------------------------------------
      // Setup Scales

      x = scatter.xScale();
      y = scatter.yScale();
      // x0 = x.copy();
      // y0 = y.copy();

      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap_bind = container.selectAll('g.sc-wrap.sc-line').data([data]);
      var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-line');
      var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
      var defs_entr = wrap_entr.append('defs');
      var g_entr = wrap_entr.append('g').attr('class', 'sc-chart-wrap');
      var g = container.select('g.sc-chart-wrap').merge(g_entr);

      g_entr.append('g').attr('class', 'sc-groups');
      g_entr.append('g').attr('class', 'sc-scatter-wrap');

      wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      //------------------------------------------------------------

      var scatter_wrap = wrap.select('.sc-scatter-wrap');
      scatter
        .width(availableWidth)
        .height(availableHeight);
      scatter_wrap.call(scatter);

      defs_entr.append('clipPath')
        .attr('id', 'sc-edge-clip-' + scatter.id())
          .append('rect');

      wrap.select('#sc-edge-clip-' + scatter.id() + ' rect')
          .attr('width', availableWidth)
          .attr('height', availableHeight);

      g.attr('clip-path', clipEdge ? 'url(#sc-edge-clip-' + scatter.id() + ')' : '');
      scatter_wrap.attr('clip-path', clipEdge ? 'url(#sc-edge-clip-' + scatter.id() + ')' : '');

      //------------------------------------------------------------
      // Groups

      var groups_bind = wrap.select('.sc-groups').selectAll('.sc-group')
            .data(function(d) { return d; }, function(d) { return d.series; });
      var groups_entr = groups_bind.enter().append('g')
            .attr('class', 'sc-group')
            .style('stroke-opacity', 1e-6)
            .style('fill-opacity', 1e-6);
      var groups = wrap.select('.sc-groups').selectAll('.sc-group')
            .merge(groups_entr);

      groups
        .classed('hover', function(d) { return d.hover; })
        .attr('class', classes)
        .attr('fill', color)
        .attr('stroke', color);
      groups
        .transition(t)
          .style('stroke-opacity', 1)
          .style('fill-opacity', 0.5);
      groups_bind.exit()
        .transition(t)
          .style('stroke-opacity', 1e-6)
          .style('fill-opacity', 1e-6)
          .remove();

      //------------------------------------------------------------
      // Areas

      var areas_bind = groups.selectAll('path.sc-area')
            .data(function(d) { return isArea(d) ? [d] : []; }); // this is done differently than lines because I need to check if series is an area
      var areas_entr = areas_bind.enter().append('path')
            .attr('class', 'sc-area sc-enter');
      var areas = groups.selectAll('.sc-area')
            .merge(areas_entr);

      areas
        .filter(function(d) {
          return d3.select(this).classed('sc-enter');
        })
        .attr('d', function(d) {
          return d3.area()
              .curve(curve)
              .defined(defined)
              .x(function(d, i) { return x(getX(d, i)); })
              .y0(function(d, i) { return y(0); })
              .y1(function(d, i) { return y(y.domain()[0] <= 0 ? y.domain()[1] >= 0 ? 0 : y.domain()[1] : y.domain()[0]); })
              .apply(this, [d.values]);
        });
      areas
        .transition(t)
          .attr('d', function(d) {
            return d3.area()
                .curve(curve)
                .defined(defined)
                .x(function(d, i) { return x(getX(d, i)); })
                .y0(function(d, i) { return y(getY(d, i)); })
                .y1(function(d, i) { return y(y.domain()[0] <= 0 ? y.domain()[1] >= 0 ? 0 : y.domain()[1] : y.domain()[0]); })
                .apply(this, [d.values]);
          })
          .on('end', function(d) {
            d3.select(this).classed('sc-enter', false);
          });
      // we need this exit remove call here to support
      // toggle between lines and areas
      areas_bind.exit().remove();

      groups_bind.exit()
        .transition(t).selectAll('.sc-area')
          .attr('d', function(d) {
            return d3.area()
                .curve(curve)
                .defined(defined)
                .x(function(d, i) { return x(getX(d, i)); })
                .y0(function(d, i) { return y(0); })
                .y1(function(d, i) { return y(y.domain()[0] <= 0 ? y.domain()[1] >= 0 ? 0 : y.domain()[1] : y.domain()[0]); })
                //.y1(function(d,i) { return y0(0) }) //assuming 0 is within y domain.. may need to tweak this
                .apply(this, [d.values]);
          })
          .remove();

      //------------------------------------------------------------
      // Lines
      function lineData(d) {
        // if there are no values, return null
        if (!d.values || !d.values.length) {
          return [null];
        }
        // if there is more than one point, return all values
        if (d.values.length > 1) {
          return [d.values];
        }
        // if there is only one single point in data array
        // extend it horizontally in both directions
        var values = x.domain().map(function(x, i) {
            // if data point is array, then it should be returned as an array
            // the getX and getY methods handle the internal mechanics of positioning
            if (Array.isArray(d.values[0])) {
              return [x, d.values[0][1]];
            } else {
              // sometimes the line data point is an object
              // so the values should be returned as an array of objects
              var newValue = JSON.parse(JSON.stringify(d.values[0]));
              newValue.x = x;
              return newValue;
            }
          });
        return [values];
      }

      var lines_bind = groups.selectAll('path.sc-line')
            .data(lineData, function(d) { return d.series; });
      var lines_entr = lines_bind.enter().append('path')
            .attr('class', 'sc-line sc-enter');
      var lines = groups.selectAll('.sc-line')
            .merge(lines_entr);

      lines
        .filter(function(d) {
          return d3.select(this).classed('sc-enter');
        })
        .attr('d',
          d3.line()
            .curve(curve)
            .defined(defined)
            .x(function(d, i) { return x(getX(d, i)); })
            .y(function(d, i) { return y(0); })
        );
      lines
        .transition(t)
          .attr('d',
            d3.line()
              .curve(curve)
              .defined(defined)
              .x(function(d, i) { return x(getX(d, i)); })
              .y(function(d, i) { return y(getY(d, i)); })
          )
          .on('end', function(d) {
            d3.select(this).classed('sc-enter', false);
          });
      groups_bind.exit()
        .transition(t).selectAll('.sc-line')
          .attr('d',
            d3.line()
              .curve(curve)
              .defined(defined)
              .x(function(d, i) { return x(getX(d, i)); })
              .y(function(d, i) { return y(0); })
          )
          .remove();

      //store old scales for use in transitions on update
      // x0 = x.copy();
      // y0 = y.copy();
    });

    return chart;
  }


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  chart.dispatch = scatter.dispatch;
  chart.scatter = scatter;

  fc.rebind(chart, scatter, 'id', 'interactive', 'size', 'xScale', 'yScale', 'zScale', 'xDomain', 'yDomain', 'sizeDomain', 'sizeRange', 'forceX', 'forceY', 'forceSize', 'useVoronoi', 'clipVoronoi', 'clipRadius', 'padData', 'padDataOuter', 'singlePoint', 'nice', 'locality');

  chart.color = function(_) {
    if (!arguments.length) { return color; }
    color = _;
    scatter.color(color);
    return chart;
  };
  chart.fill = function(_) {
    if (!arguments.length) { return fill; }
    fill = _;
    scatter.fill(fill);
    return chart;
  };
  chart.classes = function(_) {
    if (!arguments.length) { return classes; }
    classes = _;
    scatter.classes(classes);
    return chart;
  };
  chart.gradient = function(_) {
    if (!arguments.length) { return gradient; }
    gradient = _;
    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) { return margin; }
    margin.top    = typeof _.top    != 'undefined' ? _.top    : margin.top;
    margin.right  = typeof _.right  != 'undefined' ? _.right  : margin.right;
    margin.bottom = typeof _.bottom != 'undefined' ? _.bottom : margin.bottom;
    margin.left   = typeof _.left   != 'undefined' ? _.left   : margin.left;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) { return width; }
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) { return height; }
    height = _;
    return chart;
  };

  chart.x = function(_) {
    if (!arguments.length) { return getX; }
    getX = _;
    scatter.x(_);
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) { return getY; }
    getY = _;
    scatter.y(_);
    return chart;
  };

  chart.clipEdge = function(_) {
    if (!arguments.length) { return clipEdge; }
    clipEdge = _;
    return chart;
  };

  chart.interpolate = function(_) {
    if (!arguments.length) { return interpolate; }
    interpolate = _;
    return chart;
  };

  chart.defined = function(_) {
    if (!arguments.length) { return defined; }
    defined = _;
    return chart;
  };

  chart.isArea = function(_) {
    if (!arguments.length) { return isArea; }
    isArea = sucrose.functor(_);
    return chart;
  };

  //============================================================


  return chart;
};
sucrose.models.lineChart = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 10, right: 10, bottom: 10, left: 10},
      width = null,
      height = null,
      showTitle = false,
      showControls = false,
      showLegend = true,
      direction = 'ltr',
      tooltip = null,
      durationMs = 0,
      tooltips = true,
      x,
      y,
      state = {},
      strings = {
        legend: {close: 'Hide legend', open: 'Show legend'},
        controls: {close: 'Hide controls', open: 'Show controls'},
        noData: 'No Data Available.',
        noLabel: 'undefined'
      },
      pointRadius = 3,
      dispatch = d3.dispatch('chartClick', 'tooltipShow', 'tooltipHide', 'tooltipMove', 'stateChange', 'changeState');

  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var lines = sucrose.models.line()
        .clipEdge(true),
      xAxis = sucrose.models.axis(),
      yAxis = sucrose.models.axis(),
      legend = sucrose.models.legend()
        .align('right'),
      controls = sucrose.models.legend()
        .align('left')
        .color(['#444']);

  var tooltipContent = function(key, x, y, e, graph) {
    return '<h3>' + key + '</h3>' +
           '<p>' + y + ' on ' + x + '</p>';
  };

  var showTooltip = function(eo, offsetElement) {
    var key = eo.series.key,
        x = lines.x()(eo.point, eo.pointIndex),
        y = lines.y()(eo.point, eo.pointIndex),
        content = tooltipContent(key, x, y, eo, chart);

    tooltip = sucrose.tooltip.show(eo.e, content, null, null, offsetElement);
  };

  //============================================================

  function chart(selection) {

    selection.each(function(chartData) {

      var that = this,
          container = d3.select(this);

      var properties = chartData ? chartData.properties : {},
          data = chartData ? chartData.data : null,
          labels = properties.labels ? properties.labels.map(function(d) { return d.l || d; }) : [];

      var lineData = [],
          xTickLabels = [],
          totalAmount = 0,
          singlePoint = false,
          showMaxMin = false,
          isArrayData = true,
          xIsDatetime = chartData.properties.xDataType === 'datetime' || false,
          yIsCurrency = chartData.properties.yDataType === 'currency' || false;

      var xValueFormat = function(d, i, selection, noEllipsis) {
            var label = xIsDatetime ?
                          sucrose.utils.dateFormat(d, '%x', chart.locality()) :
                          isNaN(parseInt(d, 10)) || !xTickLabels || !Array.isArray(xTickLabels) ?
                            d :
                            xTickLabels[parseInt(d, 10)];
            return label;
          };

      var yValueFormat = function(d) {
            return sucrose.utils.numberFormatSI(d, 2, yIsCurrency, chart.locality());
          };

      chart.container = this;

      chart.update = function() {
        container.transition().duration(durationMs).call(chart);
      };

      //------------------------------------------------------------
      // Private method for displaying no data message.

      function displayNoData(d) {
        if (d && d.length && d.filter(function(d) { return d.values.length; }).length) {
          container.selectAll('.sc-noData').remove();
          return false;
        }

        container.select('.sucrose.sc-wrap').remove();

        var w = width || parseInt(container.style('width'), 10) || 960,
            h = height || parseInt(container.style('height'), 10) || 400,
            noDataText = container.selectAll('.sc-noData').data([chart.strings().noData]);

        noDataText.enter().append('text')
          .attr('class', 'sucrose sc-noData')
          .attr('dy', '-.7em')
          .style('text-anchor', 'middle');

        noDataText
          .attr('x', margin.left + w / 2)
          .attr('y', margin.top + h / 2)
          .text(function(d) {
            return d;
          });

        return true;
      }

      // Check to see if there's nothing to show.
      if (displayNoData(data)) {
        return chart;
      }

      //------------------------------------------------------------
      // Process data

      isArrayData = Array.isArray(data[0].values[0]);
      if (isArrayData) {
        lines.x(function(d) {
          return d ? d[0] : 0;
        });
        lines.y(function(d) { return d ? d[1] : 0; });
      } else {
        lines.x(function(d) { return d.x; });
        lines.y(function(d) { return d.y; });
      }

      // set title display option
      showTitle = showTitle && properties.title;

      // add series index to each data point for reference
      // and disable data series if total is zero
      data.map(function(d, i) {
        d.series = i;
        d.total = d3.sum(d.values, function(d, i) {
          return lines.y()(d, i);
        });
        if (!d.total) {
          d.disabled = true;
        }
      });

      xTickLabels = properties.labels ?
          properties.labels.map(function(d) { return [].concat(d.l)[0] || chart.strings().noLabel; }) :
          [];

      // TODO: what if the dimension is a numerical range?
      // xValuesAreDates = xTickLabels.length ?
      //       sucrose.utils.isValidDate(xTickLabels[0]) :
      //       sucrose.utils.isValidDate(lines.x()(data[0].values[0]));
      // xValuesAreDates = isArrayData && sucrose.utils.isValidDate(data[0].values[0][0]);

      // SAVE FOR LATER
      // isOrdinalSeries = !xValuesAreDates && labels.length > 0 && d3.min(lineData, function(d) {
      //   return d3.min(d.values, function(d, i) {
      //     return lines.x()(d, i);
      //   });
      // }) > 0;

      lineData = data.filter(function(d) {
          return !d.disabled;
        });

      // safety array
      lineData = lineData.length ? lineData : [{series: 0, total: 0, disabled: true, values: []}];

      totalAmount = d3.sum(lineData, function(d) {
          return d.total;
        });

      //------------------------------------------------------------
      // Display No Data message if there's nothing to show.

      if (!totalAmount) {
        displayNoData();
        return chart;
      }

      // set state.disabled
      state.disabled = lineData.map(function(d) { return !!d.disabled; });
      state.interpolate = lines.interpolate();
      state.isArea = lines.isArea()();

      var controlsData = [
        { key: 'Linear', disabled: lines.interpolate() !== 'linear' },
        { key: 'Basis', disabled: lines.interpolate() !== 'basis' },
        { key: 'Monotone', disabled: lines.interpolate() !== 'monotone' },
        { key: 'Cardinal', disabled: lines.interpolate() !== 'cardinal' },
        { key: 'Line', disabled: lines.isArea()() === true },
        { key: 'Area', disabled: lines.isArea()() === false }
      ];

      //------------------------------------------------------------
      // Setup Scales and Axes

      // Are all data series single points
      singlePoint = d3.max(lineData, function(d) {
          return d.values.length;
        }) === 1;

      lines
        //TODO: we need to reconsider use of padData
        // .padData(singlePoint ? false : true)
        // .padDataOuter(-1)
        .singlePoint(singlePoint)
        // set x-scale as time instead of linear
        .xScale(xIsDatetime && !xTickLabels.length ? d3.scaleTime() : d3.scaleLinear());

      if (singlePoint) {

        var xValues = d3.merge(lineData.map(function(d) {
                return d.values.map(function(d, i) {
                  return lines.x()(d, i);
                });
              }))
              .reduce(function(p, c) {
                if (p.indexOf(c) < 0) p.push(c);
                return p;
              }, [])
              .sort(function(a, b) {
                return a - b;
              }),
            xExtents = d3.extent(xValues),
            xOffset = 1 * (xIsDatetime && !xTickLabels.length ? 86400000 : 1);

        var yValues = d3.merge(lineData.map(function(d) {
                return d.values.map(function(d, i) {
                  return lines.y()(d, i);
                });
              })),
            yExtents = d3.extent(yValues),
            yOffset = lineData.length === 1 ? 2 : Math.min((yExtents[1] - yExtents[0]) / lineData.length, yExtents[0]);

        lines
          .xDomain([
            xExtents[0] - xOffset,
            xExtents[1] + xOffset
          ])
          .yDomain([
            yExtents[0] - yOffset,
            yExtents[1] + yOffset
          ]);

        xAxis
          .orient('bottom')
          .highlightZero(false)
          .showMaxMin(false)
          .ticks(xValues.length)
          .tickValues(xValues)
          .showMaxMin(false);
        yAxis
          .orient('left')
          .ticks(singlePoint ? 5 : null) //TODO: why 5?
          .showMaxMin(false)
          .highlightZero(false);

      } else {

        lines
          .xDomain(null)  //?why null?
          .yDomain(null);
        xAxis
          .orient('bottom')
          .ticks(null)
          .tickValues(null)
          .showMaxMin(xIsDatetime);
        yAxis
          .orient('left')
          .ticks(null)
          .showMaxMin(true)
          .highlightZero(true);

      }

      x = lines.xScale();
      y = lines.yScale();

      xAxis
        .scale(x)
        .tickPadding(6)
        .valueFormat(xValueFormat);
      yAxis
        .scale(y)
        .tickPadding(6)
        .valueFormat(yValueFormat);

      //------------------------------------------------------------
      // Main chart draw

      chart.render = function() {

        // Chart layout variables
        var renderWidth = width || parseInt(container.style('width'), 10) || 960,
            renderHeight = height || parseInt(container.style('height'), 10) || 400,
            availableWidth = renderWidth - margin.left - margin.right,
            availableHeight = renderHeight - margin.top - margin.bottom,
            innerWidth = availableWidth,
            innerHeight = availableHeight,
            innerMargin = {top: 0, right: 0, bottom: 0, left: 0};

        // Header variables
        var maxControlsWidth = 0,
            maxLegendWidth = 0,
            widthRatio = 0,
            headerHeight = 0,
            titleBBox = {width: 0, height: 0},
            controlsHeight = 0,
            legendHeight = 0,
            trans = '';

        var wrap_bind = container.selectAll('g.sc-wrap.sc-lineChart').data([lineData]);
        var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-line-chart');
        var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
        var g_entr = wrap_entr.append('g').attr('class', 'sc-chart-wrap');
        var g = container.select('g.sc-chart-wrap').merge(g_entr);

        g_entr.append('rect').attr('class', 'sc-background')
          .attr('x', -margin.left)
          .attr('y', -margin.top)
          .attr('fill', '#FFF');

        g.select('.sc-background')
          .attr('width', availableWidth + margin.left + margin.right)
          .attr('height', availableHeight + margin.top + margin.bottom);

        var title_entr = g_entr.append('g').attr('class', 'sc-title-wrap');
        var title_wrap = g.select('.sc-title-wrap').merge(title_entr);

        var xAxis_entr = g_entr.append('g').attr('class', 'sc-x sc-axis');
        var xAxis_wrap = g.select('.sc-x.sc-axis').merge(xAxis_entr);
        var yAxis_entr = g_entr.append('g').attr('class', 'sc-y sc-axis');
        var yAxis_wrap = g.select('.sc-y.sc-axis').merge(yAxis_entr);

        var lines_entr = g_entr.append('g').attr('class', 'sc-lines-wrap');
        var lines_wrap = g.select('.sc-lines-wrap').merge(lines_entr);

        var controls_entr = g_entr.append('g').attr('class', 'sc-controls-wrap');
        var controls_wrap = g.select('.sc-controls-wrap').merge(controls_entr);
        var legend_entr = g_entr.append('g').attr('class', 'sc-legend-wrap');
        var legend_wrap = g.select('.sc-legend-wrap').merge(legend_entr);

        wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        //------------------------------------------------------------
        // Title & Legend & Controls

        title_wrap.select('.sc-title').remove();

        if (showTitle) {
          title_wrap
            .append('text')
              .attr('class', 'sc-title')
              .attr('x', direction === 'rtl' ? availableWidth : 0)
              .attr('y', 0)
              .attr('dy', '.75em')
              .attr('text-anchor', 'start')
              .text(properties.title)
              .attr('stroke', 'none')
              .attr('fill', 'black');

          titleBBox = sucrose.utils.getTextBBox(g.select('.sc-title'));
          headerHeight += titleBBox.height;
        }

        if (showControls) {
          controls
            .id('controls_' + chart.id())
            .strings(chart.strings().controls)
            .align('left')
            .height(availableHeight - headerHeight);
          controls_wrap
            .datum(controlsData)
            .call(controls);

          maxControlsWidth = controls.calculateWidth();
        }

        if (showLegend) {
          legend
            .id('legend_' + chart.id())
            .strings(chart.strings().legend)
            .align('right')
            .height(availableHeight - headerHeight);
          legend_wrap
            .datum(data)
            .call(legend);

          maxLegendWidth = legend.calculateWidth();
        }

        // calculate proportional available space
        widthRatio = availableWidth / (maxControlsWidth + maxLegendWidth);
        maxControlsWidth = Math.floor(maxControlsWidth * widthRatio);
        maxLegendWidth = Math.floor(maxLegendWidth * widthRatio);

        if (showControls) {
          controls
            .arrange(maxControlsWidth);
          maxLegendWidth = availableWidth - controls.width();
        }
        if (showLegend) {
          legend
            .arrange(maxLegendWidth);
          maxControlsWidth = availableWidth - legend.width();
        }

        if (showControls) {
          var xpos = direction === 'rtl' ? availableWidth - controls.width() : 0,
              ypos = showTitle ? titleBBox.height : - legend.margin().top;
          controls_wrap
            .attr('transform', 'translate(' + xpos + ',' + ypos + ')');
          controlsHeight = controls.height();
        }

        if (showLegend) {
          var legendLinkBBox = sucrose.utils.getTextBBox(legend_wrap.select('.sc-legend-link')),
              legendSpace = availableWidth - titleBBox.width - 6,
              legendTop = showTitle && !showControls && legend.collapsed() && legendSpace > legendLinkBBox.width ? true : false,
              xpos = direction === 'rtl' ? 0 : availableWidth - legend.width(),
              ypos = titleBBox.height;
          if (legendTop) {
            ypos = titleBBox.height - legend.height() / 2 - legendLinkBBox.height / 2;
          } else if (!showTitle) {
            ypos = - legend.margin().top;
          }
          legend_wrap
            .attr('transform', 'translate(' + xpos + ',' + ypos + ')');
          legendHeight = legendTop ? 12 : legend.height();
        }

        // Recalc inner margins based on legend and control height
        headerHeight += Math.max(controlsHeight, legendHeight);
        innerHeight = availableHeight - headerHeight - innerMargin.top - innerMargin.bottom;

        //------------------------------------------------------------
        // Main Chart Component(s)

        var pointSize = Math.pow(pointRadius, 2) * Math.PI * (singlePoint ? 3 : 1);

        lines
          .width(innerWidth)
          .height(innerHeight)
          .id(chart.id())
          .size(pointSize) // default size set to 3
          .sizeRange([pointSize, pointSize])
          .sizeDomain([pointSize, pointSize]); //set to speed up calculation, needs to be unset if there is a custom size accessor
        lines_wrap
          .datum(lineData)
          .call(lines);


        //------------------------------------------------------------
        // Setup Axes

        var yAxisMargin = {top: 0, right: 0, bottom: 0, left: 0},
            xAxisMargin = {top: 0, right: 0, bottom: 0, left: 0};

        function setInnerMargins() {
          innerMargin.left = Math.max(xAxisMargin.left, yAxisMargin.left);
          innerMargin.right = Math.max(xAxisMargin.right, yAxisMargin.right);
          innerMargin.top = Math.max(xAxisMargin.top, yAxisMargin.top);
          innerMargin.bottom = Math.max(xAxisMargin.bottom, yAxisMargin.bottom);
        }

        function setInnerDimensions() {
          innerWidth = availableWidth - innerMargin.left - innerMargin.right;
          innerHeight = availableHeight - headerHeight - innerMargin.top - innerMargin.bottom;
          // Recalc chart dimensions and scales based on new inner dimensions
          lines.width(innerWidth).height(innerHeight);
          // This resets the scales for the whole chart
          // unfortunately we can't call this without until line instance is called
          lines.scatter.resetDimensions(innerWidth, innerHeight);
        }

        // Y-Axis
        yAxis
          .margin(innerMargin)
          .tickFormat(function(d, i) {
            return yAxis.valueFormat()(d, yIsCurrency);
          });
        yAxis_wrap
          .call(yAxis);
        // reset inner dimensions
        yAxisMargin = yAxis.margin();
        setInnerMargins();
        setInnerDimensions();

        // X-Axis
        // resize ticks based on new dimensions
        xAxis
          .tickSize(-innerHeight + (lines.padData() ? pointRadius : 0), 0)
          .margin(innerMargin)
          .tickFormat(function(d, i, noEllipsis) {
            return xAxis.valueFormat()(d - !isArrayData, xTickLabels, xIsDatetime);
          });
        xAxis_wrap
          .call(xAxis);
        xAxisMargin = xAxis.margin();
        setInnerMargins();
        setInnerDimensions();
        // xAxis
        //   .resizeTickLines(-innerHeight + (lines.padData() ? pointRadius : 0));

        // recall y-axis, x-axis and lines to set final size based on new dimensions
        yAxis
          .tickSize(-innerWidth + (lines.padData() ? pointRadius : 0), 0)
          .margin(innerMargin);
        yAxis_wrap
          .call(yAxis);

        xAxis
          .tickSize(-innerHeight + (lines.padData() ? pointRadius : 0), 0)
          .margin(innerMargin);
        xAxis_wrap
          .call(xAxis);

        lines
          .width(innerWidth)
          .height(innerHeight);
        lines_wrap
          .datum(lineData)
          .call(lines);

        // final call to lines based on new dimensions
        // lines_wrap
        //   .transition().duration(durationMs)
        //     .call(lines);

        //------------------------------------------------------------
        // Final repositioning

        innerMargin.top += headerHeight;

        trans = innerMargin.left + ',';
        trans += innerMargin.top + (xAxis.orient() === 'bottom' ? innerHeight : 0);
        xAxis_wrap
          .attr('transform', 'translate(' + trans + ')');

        trans = innerMargin.left + (yAxis.orient() === 'left' ? 0 : innerWidth) + ',';
        trans += innerMargin.top;
        yAxis_wrap
          .attr('transform', 'translate(' + trans + ')');

        lines_wrap
          .attr('transform', 'translate(' + innerMargin.left + ',' + innerMargin.top + ')');

      };

      //============================================================

      chart.render();

      //============================================================
      // Event Handling/Dispatching (in chart's scope)
      //------------------------------------------------------------

      legend.dispatch.on('legendClick', function(d, i) {
        d.disabled = !d.disabled;

        if (!data.filter(function(d) { return !d.disabled; }).length) {
          data.map(function(d) {
            d.disabled = false;
            container.selectAll('.sc-series').classed('disabled', false);
            return d;
          });
        }

        state.disabled = data.map(function(d) { return !!d.disabled; });
        dispatch.call('stateChange', this, state);

        container.transition().duration(durationMs).call(chart);
      });

      controls.dispatch.on('legendClick', function(d, i) {

        //if the option is currently enabled (i.e., selected)
        if (!d.disabled) {
          return;
        }

        //set the controls all to false
        controlsData = controlsData.map(function(s) {
          s.disabled = true;
          return s;
        });
        //activate the the selected control option
        d.disabled = false;

        switch (d.key) {
          case 'Basis':
            lines.interpolate('basis');
            break;
          case 'Linear':
            lines.interpolate('linear');
            break;
          case 'Monotone':
            lines.interpolate('monotone');
            break;
          case 'Cardinal':
            lines.interpolate('cardinal');
            break;
          case 'Line':
            lines.isArea(false);
            break;
          case 'Area':
            lines.isArea(true);
            break;
        }

        state.interpolate = lines.interpolate();
        state.isArea = lines.isArea();
        dispatch.call('stateChange', this, state);

        container.transition().duration(durationMs).call(chart);
      });

      dispatch.on('tooltipShow', function(eo) {
        if (tooltips) {
          showTooltip(eo, that.parentNode);
        }
      });

      dispatch.on('tooltipMove', function(e) {
        if (tooltip) {
          sucrose.tooltip.position(that.parentNode, tooltip, e, 's');
        }
      });

      dispatch.on('tooltipHide', function() {
        if (tooltips) {
          sucrose.tooltip.cleanup();
        }
      });

      // Update chart from a state object passed to event handler
      dispatch.on('changeState', function(eo) {
        if (typeof eo.disabled !== 'undefined') {
          data.forEach(function(series, i) {
            series.disabled = eo.disabled[i];
          });
          state.disabled = eo.disabled;
        }

        if (typeof eo.interpolate !== 'undefined') {
          lines.interpolate(eo.interpolate);
          state.interpolate = eo.interpolate;
        }

        if (typeof eo.isArea !== 'undefined') {
          lines.isArea(eo.isArea);
          state.isArea = eo.isArea;
        }

        container.transition().duration(durationMs).call(chart);
      });

      dispatch.on('chartClick', function() {
        if (controls.enabled()) {
          controls.dispatch.call('closeMenu', this);
        }
        if (legend.enabled()) {
          legend.dispatch.call('closeMenu', this);
        }
      });

    });

    return chart;
  }

  //============================================================
  // Event Handling/Dispatching (out of chart's scope)
  //------------------------------------------------------------

  lines.dispatch.on('elementMouseover.tooltip', function(eo) {
    dispatch.call('tooltipShow', this, eo);
  });

  lines.dispatch.on('elementMousemove.tooltip', function(e) {
    dispatch.call('tooltipMove', this, e);
  });

  lines.dispatch.on('elementMouseout.tooltip', function() {
    dispatch.call('tooltipHide', this);
  });

  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  // expose chart's sub-components
  chart.dispatch = dispatch;
  chart.lines = lines;
  chart.legend = legend;
  chart.controls = controls;
  chart.xAxis = xAxis;
  chart.yAxis = yAxis;

  fc.rebind(chart, lines, 'id', 'x', 'y', 'xScale', 'yScale', 'xDomain', 'yDomain', 'forceX', 'forceY', 'clipEdge', 'color', 'fill', 'classes', 'gradient', 'locality');
  fc.rebind(chart, lines, 'defined', 'isArea', 'interpolate', 'size', 'clipVoronoi', 'useVoronoi', 'interactive', 'nice');
  fc.rebind(chart, xAxis, 'rotateTicks', 'reduceXTicks', 'staggerTicks', 'wrapTicks');

  chart.colorData = function(_) {
    var type = arguments[0],
        params = arguments[1] || {};
    var color = function(d, i) {
          return sucrose.utils.defaultColor()(d, d.series);
        };
    var classes = function(d, i) {
          return 'sc-group sc-series-' + d.series;
        };

    switch (type) {
      case 'graduated':
        color = function(d, i) {
          return d3.interpolateHsl(d3.rgb(params.c1), d3.rgb(params.c2))(d.series / params.l);
        };
        break;
      case 'class':
        color = function() {
          return 'inherit';
        };
        classes = function(d, i) {
          var iClass = (d.series * (params.step || 1)) % 14;
          iClass = (iClass > 9 ? '' : '0') + iClass;
          return 'sc-group sc-series-' + d.series + ' sc-fill' + iClass + ' sc-stroke' + iClass;
        };
        break;
      case 'data':
        color = function(d, i) {
          return d.color || sucrose.utils.defaultColor()(d, d.series);
        };
        classes = function(d, i) {
          return 'sc-group sc-series-' + d.series + (d.classes ? ' ' + d.classes : '');
        };
        break;
    }

    var fill = (!params.gradient) ? color : function(d, i) {
      var p = {orientation: params.orientation || 'horizontal', position: params.position || 'base'};
      return lines.gradient(d, d.series, p);
    };

    lines.color(color);
    lines.fill(fill);
    lines.classes(classes);

    legend.color(color);
    legend.classes(classes);

    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) {
      return margin;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        margin[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) {
      return width;
    }
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) {
      return height;
    }
    height = _;
    return chart;
  };

  chart.showTitle = function(_) {
    if (!arguments.length) {
      return showTitle;
    }
    showTitle = _;
    return chart;
  };

  chart.showControls = function(_) {
    if (!arguments.length) {
      return showControls;
    }
    showControls = _;
    return chart;
  };

  chart.showLegend = function(_) {
    if (!arguments.length) {
      return showLegend;
    }
    showLegend = _;
    return chart;
  };

  chart.tooltip = function(_) {
    if (!arguments.length) {
      return tooltip;
    }
    tooltip = _;
    return chart;
  };

  chart.tooltips = function(_) {
    if (!arguments.length) {
      return tooltips;
    }
    tooltips = _;
    return chart;
  };

  chart.tooltipContent = function(_) {
    if (!arguments.length) {
      return tooltipContent;
    }
    tooltipContent = _;
    return chart;
  };

  chart.state = function(_) {
    if (!arguments.length) {
      return state;
    }
    state = _;
    return chart;
  };

  chart.strings = function(_) {
    if (!arguments.length) {
      return strings;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        strings[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.direction = function(_) {
    if (!arguments.length) {
      return direction;
    }
    direction = _;
    yAxis.direction(_);
    xAxis.direction(_);
    legend.direction(_);
    controls.direction(_);
    return chart;
  };

  chart.delay = function(_) {
    if (!arguments.length) { return durationMs; }
    durationMs = _;
    return chart;
  };

  //============================================================

  return chart;
};

sucrose.models.lineWithFocusChart = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var lines = sucrose.models.line()
    , lines2 = sucrose.models.line()
    , xAxis = sucrose.models.axis()
    , yAxis = sucrose.models.axis()
    , x2Axis = sucrose.models.axis()
    , y2Axis = sucrose.models.axis()
    , legend = sucrose.models.legend()
    , brush = d3.svg.brush()
    ;

  var margin = {top: 30, right: 30, bottom: 30, left: 60}
    , margin2 = {top: 0, right: 30, bottom: 20, left: 60}
    , color = sucrose.utils.defaultColor()
    , width = null
    , height = null
    , height2 = 100
    , x
    , y
    , x2
    , y2
    , showLegend = true
    , brushExtent = null
    , tooltips = true
    , tooltip = function(key, x, y, e, graph) {
        return '<h3>' + key + '</h3>' +
               '<p>' +  y + ' at ' + x + '</p>'
      }
    , noData = "No Data Available."
    , dispatch = d3.dispatch('tooltipShow', 'tooltipHide', 'brush')
    ;

  lines
    .clipEdge(true)
    ;
  lines2
    .interactive(false)
    ;
  xAxis
    .orient('bottom')
    .tickPadding(5)
    ;
  yAxis
    .orient('left')
    ;
  x2Axis
    .orient('bottom')
    .tickPadding(5)
    ;
  y2Axis
    .orient('left')
    ;
  //============================================================


  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var showTooltip = function(eo, offsetElement) {
    var key = eo.series.key,
        x = xAxis.tickFormat()(lines.x()(eo.point, eo.pointIndex)),
        y = yAxis.tickFormat()(lines.y()(eo.point, eo.pointIndex)),
        content = tooltip(key, x, y, eo, chart);

    sucrose.tooltip.show(eo.e, content, null, null, offsetElement);
  };

  //============================================================


  function chart(selection) {
    selection.each(function(data) {
      var container = d3.select(this),
          that = this;

      var availableWidth = (width  || parseInt(container.style('width')) || 960)
                             - margin.left - margin.right,
          availableHeight1 = (height || parseInt(container.style('height')) || 400)
                             - margin.top - margin.bottom - height2,
          availableHeight2 = height2 - margin2.top - margin2.bottom;

      chart.update = function() { chart(selection) };
      chart.container = this;


      //------------------------------------------------------------
      // Display No Data message if there's nothing to show.

      if (!data || !data.length || !data.filter(function(d) { return d.values.length }).length) {
        var noDataText = container.selectAll('.sc-noData').data([noData]);

        noDataText.enter().append('text')
          .attr('class', 'sucrose sc-noData')
          .attr('dy', '-.7em')
          .style('text-anchor', 'middle');

        noDataText
          .attr('x', margin.left + availableWidth / 2)
          .attr('y', margin.top + availableHeight1 / 2)
          .text(function(d) { return d });

        return chart;
      } else {
        container.selectAll('.sc-noData').remove();
      }

      //------------------------------------------------------------


      //------------------------------------------------------------
      // Setup Scales

      x = lines.xScale();
      y = lines.yScale();
      x2 = lines2.xScale();
      y2 = lines2.yScale();

      //------------------------------------------------------------


      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap_bind = container.selectAll('g.sc-wrap.sc-lineWithFocusChart').data([data]);
      var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-lineWithFocusChart');
      var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
      var g_entr = wrap_entr.append('g').attr('class', 'sc-chart-wrap');
      var g = container.select('g.sc-chart-wrap').merge(g_entr);

      g_entr.append('g').attr('class', 'sc-legendWrap');

      var focusEnter = g_entr.append('g').attr('class', 'sc-focus');
      focusEnter.append('g').attr('class', 'sc-x sc-axis');
      focusEnter.append('g').attr('class', 'sc-y sc-axis');
      focusEnter.append('g').attr('class', 'sc-linesWrap');

      var contextEnter = g_entr.append('g').attr('class', 'sc-context');
      contextEnter.append('g').attr('class', 'sc-x sc-axis');
      contextEnter.append('g').attr('class', 'sc-y sc-axis');
      contextEnter.append('g').attr('class', 'sc-linesWrap');
      contextEnter.append('g').attr('class', 'sc-brushBackground');
      contextEnter.append('g').attr('class', 'sc-x sc-brush');

      //------------------------------------------------------------


      //------------------------------------------------------------
      // Legend

      if (showLegend) {

        legend
          .id('legend_' + chart.id())
          .margin({top: 10, right: 10, bottom: 10, left: 10})
          .align('right')
          .height(availableHeight1 - margin.top);

        g.select('.sc-legendWrap')
            .datum(data)
            .call(legend);

        legend.arrange(availableWidth);

        if ( margin.top != legend.height()) {
          margin.top = legend.height();
          availableHeight1 = (height || parseInt(container.style('height')) || 400)
                             - margin.top - margin.bottom - height2;
        }

        g.select('.sc-legendWrap')
            .attr('transform', 'translate(0,' + (-margin.top) +')')
      }

      //------------------------------------------------------------


      wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');


      //------------------------------------------------------------
      // Main Chart Component(s)

      lines
        .width(availableWidth)
        .height(availableHeight1)
        .color(
          data
            .map(function(d,i) {
              return d.color || color(d, i);
            })
            .filter(function(d,i) {
              return !data[i].disabled;
          })
        );

      lines2
        .defined(lines.defined())
        .width(availableWidth)
        .height(availableHeight2)
        .color(
          data
            .map(function(d,i) {
              return d.color || color(d, i);
            })
            .filter(function(d,i) {
              return !data[i].disabled;
          })
        );

      g.select('.sc-context')
          .attr('transform', 'translate(0,' + ( availableHeight1 + margin.bottom + margin2.top) + ')')

      var contextLinesWrap = g.select('.sc-context .sc-linesWrap')
          .datum(data.filter(function(d) { return !d.disabled }))

      d3.transition(contextLinesWrap).call(lines2);

      //------------------------------------------------------------


      /*
      var focusLinesWrap = g.select('.sc-focus .sc-linesWrap')
          .datum(data.filter(function(d) { return !d.disabled }))

      d3.transition(focusLinesWrap).call(lines);
     */


      //------------------------------------------------------------
      // Setup Main (Focus) Axes

      xAxis
        .scale(x)
        .ticks( availableWidth / 100 )
        .tickSize(-availableHeight1, 0);

      yAxis
        .scale(y)
        .ticks( availableHeight1 / 36 )
        .tickSize( -availableWidth, 0);

      g.select('.sc-focus .sc-x.sc-axis')
          .attr('transform', 'translate(0,' + availableHeight1 + ')');

      //------------------------------------------------------------


      //------------------------------------------------------------
      // Setup Brush

      brush
        .x(x2)
        .on('brush', onBrush);

      if (brushExtent) brush.extent(brushExtent);

      var brushBG = g.select('.sc-brushBackground').selectAll('g')
          .data([brushExtent || brush.extent()])

      var brushBg_entr = brushBG.enter()
          .append('g');

      brushBg_entr.append('rect')
          .attr('class', 'left')
          .attr('x', 0)
          .attr('y', 0)
          .attr('height', availableHeight2);

      brushBg_entr.append('rect')
          .attr('class', 'right')
          .attr('x', 0)
          .attr('y', 0)
          .attr('height', availableHeight2);

      gBrush = g.select('.sc-x.sc-brush')
          .call(brush);
      gBrush.selectAll('rect')
          //.attr('y', -5)
          .attr('height', availableHeight2);
      gBrush.selectAll('.resize').append('path').attr('d', resizePath);

      onBrush();

      //------------------------------------------------------------


      //------------------------------------------------------------
      // Setup Secondary (Context) Axes

      x2Axis
        .scale(x2)
        .ticks( availableWidth / 100 )
        .tickSize(-availableHeight2, 0);

      g.select('.sc-context .sc-x.sc-axis')
          .attr('transform', 'translate(0,' + y2.range()[0] + ')');
      d3.transition(g.select('.sc-context .sc-x.sc-axis'))
          .call(x2Axis);


      y2Axis
        .scale(y2)
        .ticks( availableHeight2 / 36 )
        .tickSize( -availableWidth, 0);

      d3.transition(g.select('.sc-context .sc-y.sc-axis'))
          .call(y2Axis);

      g.select('.sc-context .sc-x.sc-axis')
          .attr('transform', 'translate(0,' + y2.range()[0] + ')');

      //------------------------------------------------------------


      //============================================================
      // Event Handling/Dispatching (in chart's scope)
      //------------------------------------------------------------

      legend.dispatch.on('legendClick', function(d,i) {
        d.disabled = !d.disabled;

        if (!data.filter(function(d) { return !d.disabled }).length) {
          data.map(function(d) {
            d.disabled = false;
            wrap.selectAll('.sc-series').classed('disabled', false);
            return d;
          });
        }

        selection.transition().call(chart);
      });

      dispatch.on('tooltipShow', function(e) {
        if (tooltips) showTooltip(e, that.parentNode);
      });

      //============================================================


      //============================================================
      // Functions
      //------------------------------------------------------------

      // Taken from crossfilter (http://square.github.com/crossfilter/)
      function resizePath(d) {
        var e = +(d == 'e'),
            x = e ? 1 : -1,
            y = availableHeight2 / 3;
        return 'M' + (.5 * x) + ',' + y
            + 'A6,6 0 0 ' + e + ' ' + (6.5 * x) + ',' + (y + 6)
            + 'V' + (2 * y - 6)
            + 'A6,6 0 0 ' + e + ' ' + (.5 * x) + ',' + (2 * y)
            + 'Z'
            + 'M' + (2.5 * x) + ',' + (y + 8)
            + 'V' + (2 * y - 8)
            + 'M' + (4.5 * x) + ',' + (y + 8)
            + 'V' + (2 * y - 8);
      }


      function updateBrushBG() {
        if (!brush.empty()) brush.extent(brushExtent);
        brushBG
            .data([brush.empty() ? x2.domain() : brushExtent])
            .each(function(d,i) {
              var leftWidth = x2(d[0]) - x.range()[0],
                  rightWidth = x.range()[1] - x2(d[1]);
              d3.select(this).select('.left')
                .attr('width',  leftWidth < 0 ? 0 : leftWidth);

              d3.select(this).select('.right')
                .attr('x', x2(d[1]))
                .attr('width', rightWidth < 0 ? 0 : rightWidth);
            });
      }


      function onBrush() {
        brushExtent = brush.empty() ? null : brush.extent();
        extent = brush.empty() ? x2.domain() : brush.extent();

        dispatch.call('brush', this, {extent: extent, brush: brush});

        updateBrushBG();

        // Update Main (Focus)
        var focusLinesWrap = g.select('.sc-focus .sc-linesWrap')
            .datum(
              data
                .filter(function(d) { return !d.disabled })
                .map(function(d,i) {
                  return {
                    key: d.key,
                    values: d.values.filter(function(d,i) {
                      return lines.x()(d,i) >= extent[0] && lines.x()(d,i) <= extent[1];
                    })
                  }
                })
            );
        d3.transition(focusLinesWrap).call(lines);


        // Update Main (Focus) Axes
        d3.transition(g.select('.sc-focus .sc-x.sc-axis'))
            .call(xAxis);
        d3.transition(g.select('.sc-focus .sc-y.sc-axis'))
            .call(yAxis);
      }

      //============================================================


    });

    return chart;
  }


  //============================================================
  // Event Handling/Dispatching (out of chart's scope)
  //------------------------------------------------------------

  lines.dispatch.on('elementMouseover.tooltip', function(eo) {
    dispatch.call('tooltipShow', this, eo);
  });

  lines.dispatch.on('elementMouseout.tooltip', function(e) {
    dispatch.call('tooltipHide', this);
  });

  dispatch.on('tooltipHide', function() {
    if (tooltips) sucrose.tooltip.cleanup();
  });

  //============================================================


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  // expose chart's sub-components
  chart.dispatch = dispatch;
  chart.legend = legend;
  chart.lines = lines;
  chart.lines2 = lines2;
  chart.xAxis = xAxis;
  chart.yAxis = yAxis;
  chart.x2Axis = x2Axis;
  chart.y2Axis = y2Axis;

  fc.rebind(chart, lines, 'defined', 'isArea', 'size', 'xDomain', 'yDomain', 'forceX', 'forceY', 'interactive', 'clipEdge', 'clipVoronoi', 'id');

  chart.x = function(_) {
    if (!arguments.length) return lines.x;
    lines.x(_);
    lines2.x(_);
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) return lines.y;
    lines.y(_);
    lines2.y(_);
    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) return margin;
    margin.top    = typeof _.top    != 'undefined' ? _.top    : margin.top;
    margin.right  = typeof _.right  != 'undefined' ? _.right  : margin.right;
    margin.bottom = typeof _.bottom != 'undefined' ? _.bottom : margin.bottom;
    margin.left   = typeof _.left   != 'undefined' ? _.left   : margin.left;
    return chart;
  };

  chart.margin2 = function(_) {
    if (!arguments.length) return margin2;
    margin2 = _;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return chart;
  };

  chart.height2 = function(_) {
    if (!arguments.length) return height2;
    height2 = _;
    return chart;
  };

  chart.color = function(_) {
    if (!arguments.length) return color;
    color =sucrose.utils.getColor(_);
    legend.color(color);
    return chart;
  };

  chart.showLegend = function(_) {
    if (!arguments.length) return showLegend;
    showLegend = _;
    return chart;
  };

  chart.tooltips = function(_) {
    if (!arguments.length) return tooltips;
    tooltips = _;
    return chart;
  };

  chart.tooltipContent = function(_) {
    if (!arguments.length) return tooltip;
    tooltip = _;
    return chart;
  };

  chart.interpolate = function(_) {
    if (!arguments.length) return lines.interpolate();
    lines.interpolate(_);
    lines2.interpolate(_);
    return chart;
  };

  chart.noData = function(_) {
    if (!arguments.length) return noData;
    noData = _;
    return chart;
  };

  // Chart has multiple similar Axes, to prevent code duplication, probably need to link all axis functions manually like below
  chart.xTickFormat = function(_) {
    if (!arguments.length) return xAxis.tickFormat();
    xAxis.tickFormat(_);
    x2Axis.tickFormat(_);
    return chart;
  };

  chart.yTickFormat = function(_) {
    if (!arguments.length) return yAxis.tickFormat();
    yAxis.tickFormat(_);
    y2Axis.tickFormat(_);
    return chart;
  };

  //============================================================


  return chart;
}
sucrose.models.multiBar = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 0, right: 0, bottom: 0, left: 0},
      width = 960,
      height = 500,
      x = d3.scaleBand(),
      y = d3.scaleLinear(),
      id = Math.floor(Math.random() * 10000), //Create semi-unique ID in case user doesn't select one
      getX = function(d) { return d.x; },
      getY = function(d) { return d.y; },
      locality = sucrose.utils.buildLocality(),
      forceY = [0], // 0 is forced by default.. this makes sense for the majority of bar graphs... user can always do chart.forceY([]) to remove
      stacked = true,
      barColor = null, // adding the ability to set the color for each rather than the whole group
      disabled, // used in conjunction with barColor to communicate to multiBarChart what series are disabled
      clipEdge = true,
      showValues = false,
      valueFormat = function(d) { return d; },
      withLine = false,
      vertical = true,
      baseDimension = 60,
      direction = 'ltr',
      delay = 200,
      xDomain,
      yDomain,
      nice = false,
      color = function(d, i) { return sucrose.utils.defaultColor()(d, d.series); },
      fill = color,
      textureFill = false,
      barColor = null, // adding the ability to set the color for each rather than the whole group
      classes = function(d, i) { return 'sc-group sc-series-' + d.series; },
      dispatch = d3.dispatch('chartClick', 'elementClick', 'elementDblClick', 'elementMouseover', 'elementMouseout', 'elementMousemove');

  //============================================================

  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var x0,
      y0; //used to store previous scales

  //============================================================

  function chart(selection) {
    selection.each(function(data) {

      // baseDimension = stacked ? vertical ? 72 : 30 : 20;

      var container = d3.select(this),
          orientation = vertical ? 'vertical' : 'horizontal',
          availableWidth = width - margin.left - margin.right,
          availableHeight = height - margin.top - margin.bottom,
          dimX = vertical ? 'width' : 'height',
          dimY = vertical ? 'height' : 'width',
          dimLabel = vertical ? 'width' : 'height',
          valX = vertical ? 'x' : 'y',
          valY = vertical ? 'y' : 'x',
          seriesCount = 0,
          groupCount = 0,
          minSeries = 0,
          maxSeries = data.length - 1,
          verticalLabels = false,
          labelPosition = showValues,
          labelLengths = [],
          labelThickness = 0;

      function barLength(d, i) {
        return Math.max(Math.round(Math.abs(y(getY(d, i)) - y(0))), 0);
      }
      function barThickness() {
        return x.bandwidth() / (stacked ? 1 : data.length);
      }
      function sign(bool) {
        return bool ? 1 : -1;
      }

      if (stacked) {
        // var stack = d3.stack()
        //      .offset('zero')
        //      .keys(data.map(function(d) { return d.key; }))
        //      .value(function(d) { return d.key; });
        // data = stack(data);
        // stacked bars can't have label position 'top'
        if (labelPosition === 'top' || labelPosition === true) {
          labelPosition = 'end';
        }
      } else if (labelPosition) {
        // grouped bars can't have label position 'total'
        if (labelPosition === 'total') {
          labelPosition = 'top';
        } else if (labelPosition === true) {
          labelPosition = 'end';
        }
        verticalLabels = vertical;
      }

      //------------------------------------------------------------
      // HACK for negative value stacking
      if (stacked) {
        var groupTotals = [];
        data[0].values.map(function(d, i) {
          var posBase = 0,
              negBase = 0;
          data.map(function(d) {
            var f = d.values[i];
            f.size = Math.abs(f.y);
            if (f.y < 0) {
              f.y0 = negBase - (vertical ? 0 : f.size);
              negBase -= f.size;
            } else {
              f.y0 = posBase + (vertical ? f.size : 0);
              posBase += f.size;
            }
          });
          groupTotals[i] = {neg: negBase, pos: posBase};
        });
      }

      //------------------------------------------------------------
      // Setup Scales

      // remap and flatten the data for use in calculating the scales' domains
      var seriesData = (xDomain && yDomain && !showValues) ?
            [] : // if we know xDomain and yDomain, no need to calculate
            d3.merge(data.map(function(d) {
              return d.values.map(function(d, i) {
                return {x: getX(d, i), y: getY(d, i), y0: d.y0, y0: d.y0};
              });
            }));

      groupCount = data[0].values.length;
      seriesCount = data.length;

      if (showValues) {
        var labelData = labelPosition === 'total' && stacked ?
              groupTotals.map(function(d) { return d.neg; }).concat(
                groupTotals.map(function(d) { return d.pos; })
              ) :
              seriesData.map(getY);

        var seriesExtents = d3.extent(data.map(function(d, i) { return d.series; }));
        minSeries = seriesExtents[0];
        maxSeries = seriesExtents[1];

        labelLengths = sucrose.utils.stringSetLengths(
            labelData,
            container,
            valueFormat,
            'sc-label-value'
          );

        labelThickness = sucrose.utils.stringSetThickness(
            [0123],
            container,
            valueFormat,
            'sc-label-value'
          )[0];
      }

      chart.resetDimensions = function(w, h) {
        width = w;
        height = h;
        availableWidth = w - margin.left - margin.right;
        availableHeight = h - margin.top - margin.bottom;
        resetScale();
      };

      function resetScale() {
        xDomain = xDomain || seriesData.map(function(d) { return d.x; });
        var maxX = vertical ? availableWidth : availableHeight,
            maxY = vertical ? availableHeight : availableWidth;

        var boundsWidth = stacked ? baseDimension : baseDimension * seriesCount + baseDimension,
            gap = baseDimension * (stacked ? 0.25 : 1),
            outerPadding = Math.max(0.25, (maxX - (groupCount * boundsWidth) - gap) / (2 * boundsWidth));

        if (withLine) {
          /*TODO: used in reports to keep bars from being too wide
            breaks pareto chart, so need to update line to adjust x position */
          x .domain(xDomain)
            .range([0, maxX])
            .paddingInner(0.3)
            .paddingOuter(outerPadding);
        } else {
          x .domain(xDomain)
            .range([0, maxX])
            .paddingInner(0.25)
            .paddingOuter(outerPadding);
        }

        var yDomain = yDomain || d3.extent(seriesData.map(function(d) {
                var posOffset = (vertical ? 0 : d.y),
                    negOffset = (vertical ? d.y : 0);
                return stacked ? (d.y > 0 ? d.y0 + posOffset : d.y0 + negOffset) : d.y;
              }).concat(forceY));

        var yRange = vertical ? [availableHeight, 0] : [0, availableWidth];

        // initial set of y scale based on full dimension
        y .domain(yDomain)
          .range(yRange);


        if (showValues) {
          // this must go here because barThickness varies
          if (vertical && stacked && d3.max(labelLengths) + 8 > barThickness()) {
            verticalLabels = true;
          }
          //       vlbl   hlbl
          // vrt:   N      Y
          // hrz:   N      N
          dimLabel = vertical && !verticalLabels ? 'labelHeight' : 'labelWidth';
        }

        //------------------------------------------------------------
        // recalculate y.range if grouped and show values

        if (labelPosition === 'top' || labelPosition === 'total') {
          var maxBarLength = maxY,
              minBarLength = 0,
              maxValuePadding = 0,
              minValuePadding = 0,
              gap = vertical ? verticalLabels ? 2 : -2 : 2;

          labelData.forEach(function(d, i) {
            var labelDim = labelPosition === 'total' && stacked && vertical && !verticalLabels ? labelThickness : labelLengths[i];
            if (vertical && d > 0 || !vertical && d < 0) {
              if (y(d) - labelDim < minBarLength) {
                minBarLength = y(d) - labelDim;
                minValuePadding = labelDim;
              }
            } else {
              if (y(d) + labelDim > maxBarLength) {
                maxBarLength = y(d) + labelDim;
                maxValuePadding = labelDim;
              }
            }
          });

          if (vertical) {
            y.range([
              maxY - (y.domain()[0] < 0 ? maxValuePadding + gap + 2 : 0),
                      y.domain()[1] > 0 ? minValuePadding + gap : 0
            ]);
          } else {
            y.range([
                      y.domain()[0] < 0 ? minValuePadding + gap + 4 : 0,
              maxY - (y.domain()[1] > 0 ? maxValuePadding + gap : 0)
            ]);
          }
        }

        if (nice) {
          y.nice();
        }

        x0 = x0 || x;
        y0 = y0 || y;
      }

      resetScale();


      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap_bind = container.selectAll('.sucrose.sc-wrap.sc-multibar').data([data]);
      var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-multibar');
      var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);

      var defs_entr = wrap_entr.append('defs');
      var g_entr = wrap_entr.append('g').attr('class', 'sc-groups');
      var g = container.select('.sc-groups').merge(g_entr);

      wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

      //set up the gradient constructor function
      chart.gradient = function(d, i, p) {
        return sucrose.utils.colorLinearGradient(d, id + '-' + i, p, color(d, i), wrap.select('defs'));
      };

      //------------------------------------------------------------

      if (clipEdge) {
        defs_entr.append('clipPath')
          .attr('id', 'sc-edge-clip-' + id)
          .append('rect');
        wrap.select('#sc-edge-clip-' + id + ' rect')
          .attr('width', availableWidth)
          .attr('height', availableHeight);
      }
      g .attr('clip-path', clipEdge ? 'url(#sc-edge-clip-' + id + ')' : '');


      if (textureFill) {
        var mask = sucrose.utils.createTexture(defs_entr, id);
      }


      //------------------------------------------------------------

      var groups_bind = g.selectAll('.sc-group').data(function(d) { return d; });
      var groups_entr = groups_bind.enter().append('g')
            .attr('class', classes)
            .style('stroke-opacity', 1e-6)
            .style('fill-opacity', 1e-6);
      groups_bind.exit().remove();
      var groups = wrap.selectAll('.sc-group').merge(groups_entr);

      // groups_bind.exit()
      //   .style('stroke-opacity', 1e-6)
      //   .style('fill-opacity', 1e-6)
      //     .selectAll('g.sc-bar')
      //       .attr('y', function(d) {
      //         return stacked ? y0(d.y0) : y0(0);
      //       })
      //       .attr(dimX, 0)
      //       .remove();

      groups
        .attr('fill', fill)
        .classed('hover', function(d) { return d.hover; })
        .classed('sc-active', function(d) { return d.active === 'active'; })
        .classed('sc-inactive', function(d) { return d.active === 'inactive'; })
        .style('stroke-opacity', 1)
        .style('fill-opacity', 1);

      groups
        .on('mouseover', function(d, i, j) { //TODO: figure out why j works above, but not here
          d3.select(this).classed('hover', true);
        })
        .on('mouseout', function(d, i, j) {
          d3.select(this).classed('hover', false);
        });

      //------------------------------------------------------------

      var bars_bind = groups.selectAll('.sc-bar').data(function(d) { return d.values; });
      var bars_entr = bars_bind.enter().append('g')
            .attr('class', 'sc-bar');
      bars_bind.exit().remove();
      var bars = groups.selectAll('.sc-bar').merge(bars_entr);

      // The actual bar rectangle
      bars_entr.append('rect')
        .attr('class', 'sc-base')
        .style('fill', 'inherit')
        .attr('x', 0)
        .attr('y', 0);

      if (textureFill) {
        // For on click active bars
        bars_entr.append('rect')
          .attr('class', 'sc-texture')
          .attr('x', 0)
          .attr('y', 0)
          .style('mask', 'url(' + mask + ')');
      }

      // For label background
      bars_entr.append('rect')
        .attr('class', 'sc-label-box')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0)
        .attr('rx', 2)
        .attr('ry', 2)
        .style('fill', 'transparent')
        .style('stroke-width', 0)
        .style('fill-opacity', 0);

      // For label text
      var barText_entr = bars_entr.append('text') // TODO: should this be inside labelPosition?
        .attr('class', 'sc-label-value');
      var barText = bars.select('.sc-label-value').merge(barText_entr);

      //------------------------------------------------------------

      bars
        .attr('class', function(d, i) {
          return 'sc-bar ' + (getY(d, i) < 0 ? 'negative' : 'positive');
        })
        .attr('transform', function(d, i, j) {
          var trans = stacked ? {
                x: Math.round(x(getX(d, i))),
                y: Math.round(y(d.y0))
              } :
              { x: Math.round(j * barThickness() + x(getX(d, i))),
                y: Math.round(getY(d, i) < 0 ? (vertical ? y(0) : y(getY(d, i))) : (vertical ? y(getY(d, i)) : y(0)))
              };
          return 'translate(' + trans[valX] + ',' + trans[valY] + ')';
        });

      bars
        .select('rect.sc-base')
          .attr(valX, 0)
          .attr(dimY, barLength)
          .attr(dimX, barThickness);

      if (textureFill) {
        bars
          .select('rect.sc-texture')
            .attr(valX, 0)
            .attr(dimY, barLength)
            .attr(dimX, barThickness)
            .style('fill', function(d, i) {
              var backColor = fill(d),
                  foreColor = sucrose.utils.getTextContrast(backColor, i);
              return foreColor;
            });
      }

      //------------------------------------------------------------
      // Assign events

      function buildEventObject(e, d, i) {
        return {
            value: getY(d, i),
            point: d,
            series: data[d.series],
            pointIndex: i,
            seriesIndex: d.series,
            groupIndex: d.group,
            id: id,
            e: e
          };
      }

      bars
        .on('mouseover', function(d, i) { //TODO: figure out why j works above, but not here
          var eo = buildEventObject(d3.event, d, i);
          dispatch.call('elementMouseover', this, eo);
        })
        .on('mousemove', function(d, i) {
          var e = d3.event;
          dispatch.call('elementMousemove', this, e);
        })
        .on('mouseout', function(d, i) {
          dispatch.call('elementMouseout', this);
        })
        .on('click', function(d, i) {
          d3.event.stopPropagation();
          var eo = buildEventObject(d3.event, d, i);
          dispatch.call('elementClick', this, eo);
        })
        .on('dblclick', function(d, i) {
          d3.event.stopPropagation();
          var eo = buildEventObject(d3.event, d, i);
          dispatch.call('elementDblClick', this, eo);
        });

      //------------------------------------------------------------
      // Bar text: begin, middle, end, top

      if (showValues) {

          barText
            .text(function(d, i) {
              var val = labelPosition === 'total' && stacked ?
                getY(d, i) < 0 ?
                  groupTotals[i].neg :
                  groupTotals[i].pos :
                getY(d, i);
              return valueFormat(val);
            })
            .each(function(d, i) {
              var bbox = this.get_bindingClientRect();
              d.labelWidth = Math.floor(bbox.width) + 4;
              d.labelHeight = Math.floor(bbox.height);
              d.barLength = barLength(d, i);
              d.barThickness = barThickness();
            });

          barText
            .attr('dy', '0.35em')
            .attr('text-anchor', function(d, i) {
              var anchor = 'middle',
                  negative = getY(d, i) < 0;
              if (vertical && !verticalLabels) {
                anchor = 'middle';
              } else {
                switch (labelPosition) {
                  case 'start':
                    anchor = negative ? 'end' : 'start';
                    break;
                  case 'middle':
                    anchor = 'middle';
                    break;
                  case 'end':
                    anchor = negative ? 'start' : 'end';
                    break;
                  case 'top':
                  case 'total':
                    anchor = negative ? 'end' : 'start';
                    break;
                }
                anchor = direction === 'rtl' && anchor !== 'middle' ? anchor === 'start' ? 'end' : 'start' : anchor;
              }
              return anchor;
            })
            .attr('transform', 'rotate(' + (verticalLabels ? -90 : 0) + ' 0,0)')
            .attr('x', function(d, i) {
              var offset = 0,
                  negative = getY(d, i) < 0 ? -1 : 1,
                  shift = negative < 0,
                  padding = (4 + (verticalLabels || !vertical) * 2) * negative;

              if (vertical && !verticalLabels) {
                offset = d.barThickness / 2;
              } else {
                switch (labelPosition) {
                  case 'start':
                    // vrt: neg 0 , pos -1
                    // hrz: neg 1 , pos  0
                    offset = d.barLength * (shift - verticalLabels) + padding;
                    break;
                  case 'middle':
                    offset = d.barLength * (verticalLabels ? -1 : 1) / 2;
                    break;
                  case 'end':
                    // vrt: neg -1 , pos 0.
                    // hrz: neg  0 , pos 1;
                    offset = d.barLength * (!verticalLabels - shift) - padding;
                    break;
                  case 'top':
                  case 'total':
                    offset = d.barLength * (!verticalLabels - shift) + 2 * negative;
                    break;
                }
              }
              return offset;
            })
            .attr('y', function(d, i) {
              var offset = 0,
                  negative = getY(d, i) < 0 ? -1 : 1,
                  shift = negative < 0,
                  padding = (d.labelHeight / 2 + (4 + verticalLabels * 2) * (labelPosition === 'total' ? 0 : 1)) * negative;

              if (vertical && !verticalLabels) {
                switch (labelPosition) {
                  case 'start':
                    offset = d.barLength * (1 - shift) - padding;
                    break;
                  case 'middle':
                    offset = d.barLength / 2;
                    break;
                  case 'end':
                    offset = d.barLength * (0 + shift) + padding;
                    break;
                  case 'total':
                    offset = d.barLength * (0 + shift) + padding * -1;
                    break;
                }
              } else {
                offset = d.barThickness / 2;
              }
              return offset;
            })
            .style('fill', function(d, i, j) {
              if (labelPosition === 'top' || labelPosition === 'total') {
                return '#000';
              }
              // var backColor = d3.select(this.previousSibling).style('fill'),
              var backColor = fill(d),
                  textColor = sucrose.utils.getTextContrast(backColor, i);
              return textColor;
            })
            .style('fill-opacity', function(d, i) {
              if (labelPosition === 'total') {
                if (d.series !== minSeries && d.series !== maxSeries) {
                  return 0;
                }
                var y = getY(d, i);
                return (y <  0 && groupTotals[i].neg === d.y0 + (vertical ? y : 0)) ||
                       (y >= 0 && groupTotals[i].pos === d.y0 + (vertical ? 0 : y)) ? 1 : 0;
              } else {
                var lengthOverlaps = d.barLength < (!vertical || verticalLabels ? d.labelWidth : d.labelHeight) + 8,
                    thicknessOverlaps = d.barThickness < (!vertical || verticalLabels ? d.labelHeight : d.labelWidth) + 4;
                return labelPosition !== 'top' && (lengthOverlaps || thicknessOverlaps) ? 0 : 1;
              }
            });

          function getLabelBoxOffset(d, i, s, gap) {
            var offset = 0,
                negative = getY(d, i) < 0 ? -1 : 1,
                shift = s === negative < 0 ? 1 : 0,
                barLength = d.barLength - d[dimLabel];
            if (s ? vertical : !vertical) {
              offset = (d.barThickness - (verticalLabels === s ? d.labelHeight : d.labelWidth)) / 2;
            } else {
              switch (labelPosition) {
                case 'start':
                  offset = barLength * (0 + shift) + gap * negative;
                  break;
                case 'middle':
                  offset = barLength / 2;
                  break;
                case 'end':
                  offset = barLength * (1 - shift) - gap * negative;
                  break;
                case 'top':
                  offset = d.barLength * (1 - shift) - d.labelWidth * (0 + shift);
                  break;
                case 'total':
                  offset = d.barLength * (1 - shift) - (verticalLabels === s ? d.labelHeight : d.labelWidth) * (0 + shift);
                  break;
              }
            }

            return offset;
          }

          //------------------------------------------------------------
          // Label background box
          // bars.filter(function(d, i) {
          //     return labelPosition === 'total' && stacked ? (d.series !== minSeries && d.series !== maxSeries) : false;
          //   })
          //   .select('rect.sc-label-box')
          //       .style('fill-opacity', 0);
          if (labelPosition === 'total' && stacked) {
            bars.select('rect.sc-label-box')
              .style('fill-opacity', 0);
          }
          bars.filter(function(d, i) {
              return labelPosition === 'total' && stacked ? (d.series === minSeries || d.series === maxSeries) : true;
            })
            .select('rect.sc-label-box')
                .attr('x', function(d, i) {
                  return getLabelBoxOffset(d, i, true, 4);
                })
                .attr('y', function(d, i) {
                  return getLabelBoxOffset(d, i, false, -4);
                })
                .attr('width', function(d, i) {
                  return verticalLabels ? d.labelHeight : d.labelWidth;
                })
                .attr('height', function(d, i) {
                  return verticalLabels ? d.labelWidth : d.labelHeight;
                })
                .style('fill', function(d, i) {
                  return labelPosition === 'top' || labelPosition === 'total' ? '#fff' : fill(d, i);
                })
                .style('fill-opacity', function(d, i) {
                  var lengthOverlaps = d.barLength < (!vertical || verticalLabels ? d.labelWidth : d.labelHeight) + 8,
                      thicknessOverlaps = d.barThickness < (!vertical || verticalLabels ? d.labelHeight : d.labelWidth) + 4;
                  return labelPosition !== 'top' && (lengthOverlaps || thicknessOverlaps) ? 0 : 1;
                });

      } else {
        barText
          .text('')
          .style('fill-opacity', 0);

        bars
          .select('rect.label-box')
            .style('fill-opacity', 0);
      }

      // TODO: fix way of passing in a custom color function
      // if (barColor) {
      //   if (!disabled) {
      //     disabled = data.map(function() { return true; });
      //   }
      //   bars
      //     //.style('fill', barColor)
      //     //.style('stroke', barColor)
      //     //.style('fill', function(d,i,j) { return d3.rgb(barColor(d,i)).darker(j).toString(); })
      //     //.style('stroke', function(d,i,j) { return d3.rgb(barColor(d,i)).darker(j).toString(); })
      //     .style('fill', function(d, i, j) {
      //       return d3.rgb(barColor(d, i))
      //                .darker(disabled.map(function(d, i) { return i; })
      //                .filter(function(d, i) { return !disabled[i]; })[j])
      //                .toString();
      //     })
      //     .style('stroke', function(d, i, j) {
      //       return d3.rgb(barColor(d, i))
      //                .darker(disabled.map(function(d, i) { return i; })
      //                .filter(function(d, i) { return !disabled[i]; })[j])
      //                .toString();
      //     });
      // }

      //store old scales for use in transitions on update
      x0 = x.copy();
      y0 = y.copy();

    });

    return chart;
  }


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  chart.dispatch = dispatch;

  chart.color = function(_) {
    if (!arguments.length) {
      return color;
    }
    color = _;
    return chart;
  };
  chart.fill = function(_) {
    if (!arguments.length) {
      return fill;
    }
    fill = _;
    return chart;
  };
  chart.classes = function(_) {
    if (!arguments.length) {
      return classes;
    }
    classes = _;
    return chart;
  };
  chart.gradient = function(_) {
    if (!arguments.length) {
      return gradient;
    }
    gradient = _;
    return chart;
  };

  chart.x = function(_) {
    if (!arguments.length) {
      return getX;
    }
    getX = _;
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) {
      return getY;
    }
    getY = _;
    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) {
      return margin;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        margin[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) {
      return width;
    }
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) {
      return height;
    }
    height = _;
    return chart;
  };

  chart.xScale = function(_) {
    if (!arguments.length) {
      return x;
    }
    x = _;
    return chart;
  };

  chart.yScale = function(_) {
    if (!arguments.length) {
      return y;
    }
    y = _;
    return chart;
  };

  chart.xDomain = function(_) {
    if (!arguments.length) {
      return xDomain;
    }
    xDomain = _;
    return chart;
  };

  chart.yDomain = function(_) {
    if (!arguments.length) {
      return yDomain;
    }
    yDomain = _;
    return chart;
  };

  chart.forceY = function(_) {
    if (!arguments.length) {
      return forceY;
    }
    forceY = _;
    return chart;
  };

  chart.stacked = function(_) {
    if (!arguments.length) {
      return stacked;
    }
    stacked = _;
    return chart;
  };

  chart.clipEdge = function(_) {
    if (!arguments.length) {
      return clipEdge;
    }
    clipEdge = _;
    return chart;
  };

  chart.barColor = function(_) {
    if (!arguments.length) {
      return barColor;
    }
    barColor = sucrose.utils.getColor(_);
    return chart;
  };

  chart.disabled = function(_) {
    if (!arguments.length) {
      return disabled;
    }
    disabled = _;
    return chart;
  };

  chart.id = function(_) {
    if (!arguments.length) {
      return id;
    }
    id = _;
    return chart;
  };

  chart.delay = function(_) {
    if (!arguments.length) {
      return delay;
    }
    delay = _;
    return chart;
  };

  chart.showValues = function(_) {
    if (!arguments.length) {
      return showValues;
    }
    showValues = isNaN(parseInt(_, 10)) ? _ : parseInt(_, 10) && true || false;
    return chart;
  };

  chart.valueFormat = function(_) {
    if (!arguments.length) {
      return valueFormat;
    }
    valueFormat = _;
    return chart;
  };

  chart.withLine = function(_) {
    if (!arguments.length) {
      return withLine;
    }
    withLine = _;
    return chart;
  };

  chart.vertical = function(_) {
    if (!arguments.length) {
      return vertical;
    }
    vertical = _;
    return chart;
  };

  chart.baseDimension = function(_) {
    if (!arguments.length) {
      return baseDimension;
    }
    baseDimension = _;
    return chart;
  };

  chart.direction = function(_) {
    if (!arguments.length) {
      return direction;
    }
    direction = _;
    return chart;
  };

  chart.nice = function(_) {
    if (!arguments.length) {
      return nice;
    }
    nice = _;
    return chart;
  };

  chart.textureFill = function(_) {
    if (!arguments.length) return textureFill;
    textureFill = _;
    return chart;
  };

  chart.locality = function(_) {
    if (!arguments.length) {
      return locality;
    }
    locality = sucrose.utils.buildLocality(_);
    return chart;
  };

  //============================================================

  return chart;
};
sucrose.models.multiBarChart = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var vertical = true,
      margin = {top: 10, right: 10, bottom: 10, left: 10},
      width = null,
      height = null,
      showTitle = false,
      showControls = false,
      showLegend = true,
      direction = 'ltr',
      tooltip = null,
      tooltips = true,
      scrollEnabled = true,
      overflowHandler = function(d) { return; },
      x,
      y,
      state = {},
      strings = {
        legend: {close: 'Hide legend', open: 'Show legend'},
        controls: {close: 'Hide controls', open: 'Show controls'},
        noData: 'No Data Available.',
        noLabel: 'undefined'
      },
      hideEmptyGroups = true,
      dispatch = d3.dispatch('chartClick', 'elementClick', 'tooltipShow', 'tooltipHide', 'tooltipMove', 'stateChange', 'changeState');

  //============================================================
  // Private Variables
  //------------------------------------------------------------

  // Scroll variables
  var useScroll = false,
      scrollOffset = 0;

  var multibar = sucrose.models.multiBar()
        .stacked(false)
        .clipEdge(false),
      xAxis = sucrose.models.axis(),//.orient('bottom'),
      yAxis = sucrose.models.axis(),//.orient('left'),
      legend = sucrose.models.legend(),
      controls = sucrose.models.legend()
        .color(['#444']),
      scroll = sucrose.models.scroll();

  var tooltipContent = function(eo, graph) {
    var key = eo.group.label,
        y = eo.point.y,
        x = Math.abs(y * 100 / eo.group._height).toFixed(1);
    return '<h3>' + key + '</h3>' +
           '<p>' + y + ' on ' + x + '</p>';
  };

  var showTooltip = function(eo, offsetElement) {
    var content = tooltipContent(eo, chart),
        gravity = eo.value < 0 ?
          vertical ? 'n' : 'e' :
          vertical ? 's' : 'w';

    tooltip = sucrose.tooltip.show(eo.e, content, gravity, null, offsetElement);
  };

  var seriesClick = function(data, e, chart) {
    return;
  };

  //============================================================

  function chart(selection) {

    selection.each(function(chartData) {

      var that = this,
          container = d3.select(this),
          className = vertical ? 'multibarChart' : 'multiBarHorizontalChart';

      var properties = chartData ? chartData.properties : {},
          data = chartData ? chartData.data : null;

      var seriesData = [],
          seriesCount = 0,
          groupData = [],
          groupLabels = [].
          groupCount = 0,
          totalAmount = 0,
          hasData = false,
          xIsDatetime = chartData.properties.xDataType === 'datetime' || false,
          yIsCurrency = chartData.properties.yDataType === 'currency' || false;

      var baseDimension = multibar.stacked() ? vertical ? 72 : 32 : 32;
      var availableWidth = width;
      var availableHeight = height;

      var xValueFormat = function(d, i, selection, noEllipsis) {
            // Set axis to use trimmed array rather than data
            var value = groupLabels && Array.isArray(groupLabels) ?
                          groupLabels[i] || d:
                          d;
            var label = xIsDatetime ?
                          sucrose.utils.dateFormat(value, '%x', chart.locality()) :
                          value;
            var width = Math.max(vertical ?
                          baseDimension * 2 :
                          availableWidth * 0.2, 75);
            return !noEllipsis ?
                      sucrose.utils.stringEllipsify(label, container, width) :
                      label;
          };

      var yValueFormat = function(d) {
            return sucrose.utils.numberFormatSI(d, 2, yIsCurrency, chart.locality());
          };

      chart.container = this;

      chart.update = function() {
        container.transition().call(chart);
      };

      //------------------------------------------------------------
      // Private method for displaying no data message.

      function displayNoData (d) {
        if (d && d.length && d.filter(function(d) { return d.values.length; }).length) {
          container.selectAll('.sc-noData').remove();
          return false;
        }

        container.select('.sucrose.sc-wrap').remove();

        var w = width || parseInt(container.style('width'), 10) || 960,
            h = height || parseInt(container.style('height'), 10) || 400,
            noDataText = container.selectAll('.sc-noData').data([chart.strings().noData]);

        noDataText.enter().append('text')
          .attr('class', 'sucrose sc-noData')
          .attr('dy', '-.7em')
          .style('text-anchor', 'middle');

        noDataText
          .attr('x', margin.left + w / 2)
          .attr('y', margin.top + h / 2)
          .text(function(d) {
            return d;
          });

        return true;
      }

      // Check to see if there's nothing to show.
      if (displayNoData(data)) {
        return chart;
      }

      //------------------------------------------------------------
      // Process data

      chart.dataSeriesActivate = function(eo) {
        var series = eo.series;

        series.active = (!series.active || series.active === 'inactive') ? 'active' : 'inactive';
        series.values.map(function(d) {
          d.active = series.active;
        });

        // if you have activated a data series, inactivate the rest
        if (series.active === 'active') {
          data
            .filter(function(d) {
              return d.active !== 'active';
            })
            .map(function(d) {
              d.active = 'inactive';
              d.values.map(function(d) {
                d.active = 'inactive';
              });
              return d;
            });
        }

        // if there are no active data series, activate them all
        if (!data.filter(function(d) { return d.active === 'active'; }).length) {
          data
            .map(function(d) {
              d.active = '';
              d.values.map(function(d) {
                d.active = '';
              });
              container.selectAll('.sc-series').classed('sc-inactive', false);
              return d;
            });
        }

        container.call(chart);
      };

      // add series index to each data point for reference
      // and disable data series if total is zero
      data.forEach(function(series, s) {
        // make sure untrimmed values array exists
        // and set immutable series values
        if (!series._values) {
          series._values = series.values.map(function(value, v) {
            return {
              'x': value.x,
              'y': value.y
            };
          });
        }

        series.series = s;

        series.values = series._values.map(function(value, v) {
            return {
                  'series': series.series,
                  'group': v,
                  'color': typeof series.color !== 'undefined' ? series.color : '',
                  'x': multibar.x()(value, v),
                  'y': multibar.y()(value, v),
                  'y0': value.y + (s > 0 ? data[series.series - 1].values[v].y0 : 0),
                  'active': typeof series.active !== 'undefined' ? series.active : ''
                };
          });

        series.total = d3.sum(series.values, function(value, v) {
            return value.y;
          });

        // disabled if all values in series are zero
        // or the series was disabled by the legend
        series.disabled = series.disabled || series.total === 0;
        // inherit values from series
        series.values.forEach(function(value, v) {
          // do not eval d.active because it can be false
          value.active = typeof series.active !== 'undefined' ? series.active : '';
        });
      });

      seriesData = data.filter(function(series, s) {
          return !series.disabled && (!series.type || series.type === 'bar');
        });

      seriesCount = seriesData.length;
      hasData = seriesCount > 0;

      // update groupTotal amounts based on enabled data series
      groupData = properties.groups.map(function(group, g) {
          group.total = 0;
          group._height = 0;
          // only sum enabled series
          seriesData.forEach(function(series, s) {
            series.values
              .filter(function(value, v) {
                return value.group === g;
              })
              .forEach(function(value, v) {
                group.total += value.y;
                group._height += Math.abs(value.y);
              });
          });
          return group;
        });

      totalAmount = d3.sum(groupData, function(group) { return group.total; });

      // build a trimmed array for active group only labels
      groupLabels = groupData
        .filter(function(group, g) {
          return hideEmptyGroups ? group._height !== 0 : true;
        })
        .map(function(group) {
          return group.label || chart.strings().noLabel;
        });

      groupCount = groupLabels.length;

      if (hideEmptyGroups) {
        // build a discrete array of data values for the multibar
        // based on enabled data series
        seriesData.forEach(function(series, s) {
          //reset series values to exlcude values for
          //groups that have all zero values
          series.values = series.values
            .filter(function(value, v) {
              return groupData[v]._height !== 0;
            })
            .map(function(value, v) {
              return {
                'series': value.series,
                'group': value.group,
                'color': value.color,
                'x': (v + 1),
                'y': value.y,
                'active': value.active
              };
            });
          return series;
        });
      }

      //------------------------------------------------------------
      // Display No Data message if there's nothing to show.

      if (!hasData) {
        displayNoData();
        return chart;
      }

      // safety array
      if (!seriesData.length) {
        seriesData = [{values: []}];
      }

      // set state.disabled
      state.disabled = data.map(function(d) { return !!d.disabled; });
      state.stacked = multibar.stacked();

      // set title display option
      showTitle = showTitle && properties.title;

      var controlsData = [
        { key: 'Grouped', disabled: state.stacked },
        { key: 'Stacked', disabled: !state.stacked }
      ];

      //------------------------------------------------------------
      // Setup Scales and Axes

      x = multibar.xScale();
      y = multibar.yScale();

      xAxis
        .orient(vertical ? 'bottom' : 'left') // any time orient is called it resets the d3-axis model and has to be reconfigured
        .scale(x)
        .valueFormat(xValueFormat)
        .tickSize(0)
        .tickPadding(4)
        .highlightZero(false)
        .showMaxMin(false);

      yAxis
        .orient(vertical ? 'left' : 'bottom')
        .scale(y)
        .valueFormat(yValueFormat)
        .tickPadding(4);

      //------------------------------------------------------------
      // Main chart draw

      chart.render = function() {

        // Chart layout variables
        var renderWidth = width || parseInt(container.style('width'), 10) || 960,
            renderHeight = height || parseInt(container.style('height'), 10) || 400,
            innerMargin = {top: 0, right: 0, bottom: 0, left: 0},
            innerWidth = availableWidth,
            innerHeight = availableHeight;

        availableWidth = renderWidth - margin.left - margin.right;
        availableHeight = renderHeight - margin.top - margin.bottom;

        // Header variables
        var maxControlsWidth = 0,
            maxLegendWidth = 0,
            widthRatio = 0,
            headerHeight = 0,
            titleBBox = {width: 0, height: 0},
            controlsHeight = 0,
            legendHeight = 0,
            trans = '';

        // Scroll variables
        // for stacked, baseDimension is width of bar plus 1/4 of bar for gap
        // for grouped, baseDimension is width of bar plus width of one bar for gap
        var boundsWidth = state.stacked ? baseDimension : baseDimension * seriesCount + baseDimension,
            gap = baseDimension * (state.stacked ? 0.25 : 1),
            minDimension = groupCount * boundsWidth + gap;

        //------------------------------------------------------------
        // Setup containers and skeleton of chart

        var wrap_bind = container.selectAll('.sucrose.sc-wrap').data([data]);
        var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-' + className);
        var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
        var g_entr = wrap_entr.append('g').attr('class', 'sc-chart-wrap');
        var g = container.select('g.sc-chart-wrap').merge(g_entr);

        /* Clipping box for scroll */
        g_entr.append('defs');

        /* Container for scroll elements */
        g_entr.append('g').attr('class', 'sc-scroll-background');

        var title_entr = g_entr.append('g').attr('class', 'sc-title-wrap');
        var title_wrap = g.select('.sc-title-wrap').merge(title_entr);

        var yAxis_entr = g_entr.append('g').attr('class', 'sc-y sc-axis');
        var yAxis_wrap = g.select('.sc-y.sc-axis').merge(yAxis_entr);

        /* Append scroll group with chart mask */
        var scroll_entr = g_entr.append('g').attr('class', 'sc-scroll-wrap');
        var scroll_wrap = g.select('.sc-scroll-wrap');

        var xAxis_entr = g_entr.select('.sc-scroll-wrap').append('g').attr('class', 'sc-x sc-axis');
        var xAxis_wrap = g.select('.sc-x.sc-axis').merge(xAxis_entr);

        var bars_entr = g_entr.select('.sc-scroll-wrap').append('g').attr('class', 'sc-bars-wrap');
        var bars_wrap = g.select('.sc-bars-wrap').merge(bars_entr);

        var controls_entr = g_entr.append('g').attr('class', 'sc-controls-wrap');
        var controls_wrap = g.select('.sc-controls-wrap').merge(controls_entr);
        var legend_entr = g_entr.append('g').attr('class', 'sc-legend-wrap');
        var legend_wrap = g.select('.sc-legend-wrap').merge(legend_entr);

        wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        //------------------------------------------------------------
        // Title & Legend & Controls

        title_wrap.select('.sc-title').remove();

        if (showTitle) {
          title_wrap
            .append('text')
              .attr('class', 'sc-title')
              .attr('x', direction === 'rtl' ? availableWidth : 0)
              .attr('y', 0)
              .attr('dy', '.75em')
              .attr('text-anchor', 'start')
              .attr('stroke', 'none')
              .attr('fill', 'black')
              .text(properties.title);

          titleBBox = sucrose.utils.getTextBBox(title_wrap.select('.sc-title'));
          headerHeight += titleBBox.height;
        }

        if (showControls) {
          controls
            .id('controls_' + chart.id())
            .strings(chart.strings().controls)
            .align('left')
            .height(availableHeight - headerHeight);
          controls_wrap
            .datum(controlsData)
            .call(controls);

          maxControlsWidth = controls.calculateWidth();
        }

        if (showLegend) {
          if (multibar.barColor()) {
            data.forEach(function(series, i) {
              series.color = d3.rgb('#ccc').darker(i * 1.5).toString();
            });
          }

          legend
            .id('legend_' + chart.id())
            .strings(chart.strings().legend)
            .align('right')
            .height(availableHeight - headerHeight);
          legend_wrap
            .datum(data)
            .call(legend);

          maxLegendWidth = legend.calculateWidth();
        }

        // calculate proportional available space
        widthRatio = availableWidth / (maxControlsWidth + maxLegendWidth);
        maxControlsWidth = Math.floor(maxControlsWidth * widthRatio);
        maxLegendWidth = Math.floor(maxLegendWidth * widthRatio);

        if (showControls) {
          controls
            .arrange(maxControlsWidth);
          maxLegendWidth = availableWidth - controls.width();
        }
        if (showLegend) {
          legend
            .arrange(maxLegendWidth);
          maxControlsWidth = availableWidth - legend.width();
        }

        if (showControls) {
          var xpos = direction === 'rtl' ? availableWidth - controls.width() : 0,
              ypos = showTitle ? titleBBox.height : - controls.margin().top;
          controls_wrap
            .attr('transform', 'translate(' + xpos + ',' + ypos + ')');
          controlsHeight = controls.height() - (showTitle ? 0 : controls.margin().top);
        }

        if (showLegend) {
          var legendLinkBBox = sucrose.utils.getTextBBox(legend_wrap.select('.sc-legend-link')),
              legendSpace = availableWidth - titleBBox.width - 6,
              legendTop = showTitle && !showControls && legend.collapsed() && legendSpace > legendLinkBBox.width ? true : false,
              xpos = direction === 'rtl' ? 0 : availableWidth - legend.width(),
              ypos = titleBBox.height;
          if (legendTop) {
            ypos = titleBBox.height - legend.height() / 2 - legendLinkBBox.height / 2;
          } else if (!showTitle) {
            ypos = - legend.margin().top;
          }
          legend_wrap
            .attr('transform', 'translate(' + xpos + ',' + ypos + ')');
          legendHeight = legendTop ? 12 : legend.height() - (showTitle ? 0 : legend.margin().top);
        }

        // Recalc inner margins based on legend and control height
        headerHeight += Math.max(controlsHeight, legendHeight);
        innerHeight = availableHeight - headerHeight - innerMargin.top - innerMargin.bottom;

        //------------------------------------------------------------
        // Main Chart Component(s)

        function getDimension(d) {
          if (d === 'width') {
            return vertical && scrollEnabled ? Math.max(innerWidth, minDimension) : innerWidth;
          } else if (d === 'height') {
            return !vertical && scrollEnabled ? Math.max(innerHeight, minDimension) : innerHeight;
          } else {
            return 0;
          }
        }

        multibar
          .vertical(vertical)
          .baseDimension(baseDimension)
          .disabled(data.map(function(series) { return series.disabled; }))
          .width(getDimension('width'))
          .height(getDimension('height'));
        bars_wrap
          .data([seriesData])
          .call(multibar);

        //------------------------------------------------------------
        // Setup Axes

        var yAxisMargin = {top: 0, right: 0, bottom: 0, left: 0},
            xAxisMargin = {top: 0, right: 0, bottom: 0, left: 0};

        function setInnerMargins() {
          innerMargin.left = Math.max(xAxisMargin.left, yAxisMargin.left);
          innerMargin.right = Math.max(xAxisMargin.right, yAxisMargin.right);
          innerMargin.top = Math.max(xAxisMargin.top, yAxisMargin.top);
          innerMargin.bottom = Math.max(xAxisMargin.bottom, yAxisMargin.bottom);
          setInnerDimensions();
        }

        function setInnerDimensions() {
          innerWidth = availableWidth - innerMargin.left - innerMargin.right;
          innerHeight = availableHeight - headerHeight - innerMargin.top - innerMargin.bottom;
          // Recalc chart dimensions and scales based on new inner dimensions
          multibar.resetDimensions(getDimension('width'), getDimension('height'));
        }

        // Y-Axis
        yAxis
          // .orient(vertical ? 'left' : 'bottom')
          .margin(innerMargin)
          .ticks(innerHeight / 48);
        yAxis_wrap
          .call(yAxis);

        // reset inner dimensions
        yAxisMargin = yAxis.margin();
        setInnerMargins();

        // X-Axis
        xAxis
          // .orient(vertical ? 'bottom' : 'left')
          .margin(innerMargin)

        trans = innerMargin.left + ',';
        trans += innerMargin.top + (xAxis.orient() === 'bottom' ? innerHeight : 0);

        xAxis_wrap
          .attr('transform', 'translate(' + trans + ')');
        xAxis_wrap
          .call(xAxis);

        // reset inner dimensions
        xAxisMargin = xAxis.margin();
        setInnerMargins();

        // resize ticks based on new dimensions
        xAxis
          .tickSize(0)
          .margin(innerMargin);
        xAxis_wrap
          .call(xAxis);

        // reset inner dimensions
        xAxisMargin = xAxis.margin();
        setInnerMargins();

        // recall y-axis to set final size based on new dimensions
        yAxis
          .tickSize(vertical ? -innerWidth : -innerHeight, 0)
          .margin(innerMargin);
        yAxis_wrap
          .call(yAxis);

        // reset inner dimensions
        yAxisMargin = yAxis.margin();
        setInnerMargins();

        // final call to lines based on new dimensions
        bars_wrap
          .transition()
            .call(multibar);

        //------------------------------------------------------------
        // Final repositioning

        innerMargin.top += headerHeight;

        trans = (vertical || xAxis.orient() === 'left' ? 0 : innerWidth) + ',';
        trans += (vertical && xAxis.orient() === 'bottom' ? innerHeight + 2 : -2);
        xAxis_wrap
          .attr('transform', 'translate(' + trans + ')');

        trans = innerMargin.left + (vertical || yAxis.orient() === 'bottom' ? 0 : innerWidth) + ',';
        trans += innerMargin.top + (vertical || yAxis.orient() === 'left' ? 0 : innerHeight);
        yAxis_wrap
          .attr('transform', 'translate(' + trans + ')');

        scroll_wrap
          .attr('transform', 'translate(' + innerMargin.left + ',' + innerMargin.top + ')');

        //------------------------------------------------------------
        // Enable scrolling

        if (scrollEnabled) {

          useScroll = minDimension > (vertical ? innerWidth : innerHeight);

          xAxis_wrap.select('.sc-axislabel')
            .attr('x', (vertical ? innerWidth : -innerHeight) / 2);

          var diff = (vertical ? innerWidth : innerHeight) - minDimension,
              panMultibar = function() {
                dispatch.call('tooltipHide', this);
                scrollOffset = scroll.pan(diff);
                xAxis_wrap.select('.sc-axislabel')
                  .attr('x', (vertical ? innerWidth - scrollOffset * 2 : scrollOffset * 2 - innerHeight) / 2);
              };

          scroll
            .id(chart.id())
            .enable(useScroll)
            .vertical(vertical)
            .width(innerWidth)
            .height(innerHeight)
            .margin(innerMargin)
            .minDimension(minDimension)
            .panHandler(panMultibar);

          scroll(g, g_entr, scroll_wrap, xAxis);

          scroll.init(scrollOffset, overflowHandler);

          // initial call to zoom in case of scrolled bars on window resize
          scroll.panHandler()();
        }
      };

      //============================================================

      chart.render();

      //============================================================
      // Event Handling/Dispatching (in chart's scope)
      //------------------------------------------------------------

      legend.dispatch.on('legendClick', function(d, i) {
        d.disabled = !d.disabled;
        d.active = false;

        // if there are no enabled data series, enable them all
        if (!data.filter(function(d) { return !d.disabled; }).length) {
          data.map(function(d) {
            d.disabled = false;
            return d;
          });
        }

        // if there are no active data series, activate them all
        if (!data.filter(function(d) { return d.active === 'active'; }).length) {
          data.map(function(d) {
            d.active = '';
            return d;
          });
        }

        state.disabled = data.map(function(d) { return !!d.disabled; });
        dispatch.call('stateChange', this, state);

        container.transition().call(chart);
      });

      controls.dispatch.on('legendClick', function(d, i) {
        //if the option is currently enabled (i.e., selected)
        if (!d.disabled) {
          return;
        }

        //set the controls all to false
        controlsData = controlsData.map(function(s) {
          s.disabled = true;
          return s;
        });
        //activate the the selected control option
        d.disabled = false;

        switch (d.key) {
          case 'Grouped':
            multibar.stacked(false);
            break;
          case 'Stacked':
            multibar.stacked(true);
            break;
        }

        state.stacked = multibar.stacked();
        dispatch.call('stateChange', this, state);

        container.transition().call(chart);
      });

      dispatch.on('tooltipShow', function(eo) {
        if (tooltips) {
          eo.group = groupData[eo.groupIndex];
          showTooltip(eo, that.parentNode, groupData);
        }
      });

      dispatch.on('tooltipMove', function(e) {
        if (tooltip) {
          sucrose.tooltip.position(that.parentNode, tooltip, e, vertical ? 's' : 'w');
        }
      });

      dispatch.on('tooltipHide', function() {
        if (tooltips) {
          sucrose.tooltip.cleanup();
        }
      });

      // Update chart from a state object passed to event handler
      dispatch.on('changeState', function(eo) {
        if (typeof eo.disabled !== 'undefined') {
          data.forEach(function(series, i) {
            series.disabled = eo.disabled[i];
          });
          state.disabled = eo.disabled;
        }

        if (typeof eo.stacked !== 'undefined') {
          multibar.stacked(eo.stacked);
          state.stacked = eo.stacked;
        }

        container.transition().call(chart);
      });

      dispatch.on('chartClick', function() {
        if (controls.enabled()) {
          controls.dispatch.call('closeMenu', this);
        }
        if (legend.enabled()) {
          legend.dispatch.call('closeMenu', this);
        }
      });

      multibar.dispatch.on('elementClick', function(eo) {
        dispatch.call('chartClick', this);
        seriesClick(data, eo, chart);
      });

    });

    return chart;
  }

  //============================================================
  // Event Handling/Dispatching (out of chart's scope)
  //------------------------------------------------------------

  multibar.dispatch.on('elementMouseover.tooltip', function(eo) {
    dispatch.call('tooltipShow', this, eo);
  });

  multibar.dispatch.on('elementMousemove.tooltip', function(e) {
    dispatch.call('tooltipMove', this, e);
  });

  multibar.dispatch.on('elementMouseout.tooltip', function() {
    dispatch.call('tooltipHide', this);
  });

  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  // expose chart's sub-components
  chart.dispatch = dispatch;
  chart.multibar = multibar;
  chart.legend = legend;
  chart.controls = controls;
  chart.xAxis = xAxis;
  chart.yAxis = yAxis;

  fc.rebind(chart, multibar, 'id', 'x', 'y', 'xScale', 'yScale', 'xDomain', 'yDomain', 'forceX', 'forceY', 'clipEdge', 'delay', 'color', 'fill', 'classes', 'gradient', 'locality');
  fc.rebind(chart, multibar, 'stacked', 'showValues', 'valueFormat', 'labelFormat', 'nice', 'textureFill');
  fc.rebind(chart, xAxis, 'rotateTicks', 'reduceXTicks', 'staggerTicks', 'wrapTicks');

  chart.colorData = function(_) {
    var type = arguments[0],
        params = arguments[1] || {};
    var color = function(d, i) {
          return sucrose.utils.defaultColor()(d, d.series);
        };
    var classes = function(d, i) {
          return 'sc-group sc-series-' + d.series;
        };

    switch (type) {
      case 'graduated':
        color = function(d, i) {
          return d3.interpolateHsl(d3.rgb(params.c1), d3.rgb(params.c2))(d.series / params.l);
        };
        break;
      case 'class':
        color = function() {
          return 'inherit';
        };
        classes = function(d, i) {
          var iClass = (d.series * (params.step || 1)) % 14;
          iClass = (iClass > 9 ? '' : '0') + iClass;
          return 'sc-group sc-series-' + d.series + ' sc-fill' + iClass;
        };
        break;
      case 'data':
        color = function(d, i) {
          return d.classes ? 'inherit' : d.color || sucrose.utils.defaultColor()(d, d.series);
        };
        classes = function(d, i) {
          return 'sc-group sc-series-' + d.series + (d.classes ? ' ' + d.classes : '');
        };
        break;
    }

    var fill = (!params.gradient) ? color : function(d, i) {
      var p = {orientation: params.orientation || (vertical ? 'vertical' : 'horizontal'), position: params.position || 'middle'};
      return multibar.gradient(d, d.series, p);
    };

    multibar.color(color);
    multibar.fill(fill);
    multibar.classes(classes);

    legend.color(color);
    legend.classes(classes);

    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) {
      return margin;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        margin[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.vertical = function(_) {
    if (!arguments.length) {
      return vertical;
    }
    vertical = _;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) {
      return width;
    }
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) {
      return height;
    }
    height = _;
    return chart;
  };

  chart.showTitle = function(_) {
    if (!arguments.length) {
      return showTitle;
    }
    showTitle = _;
    return chart;
  };

  chart.showControls = function(_) {
    if (!arguments.length) {
      return showControls;
    }
    showControls = _;
    return chart;
  };

  chart.showLegend = function(_) {
    if (!arguments.length) {
      return showLegend;
    }
    showLegend = _;
    return chart;
  };

  chart.tooltip = function(_) {
    if (!arguments.length) {
      return tooltip;
    }
    tooltip = _;
    return chart;
  };

  chart.tooltips = function(_) {
    if (!arguments.length) {
      return tooltips;
    }
    tooltips = _;
    return chart;
  };

  chart.tooltipContent = function(_) {
    if (!arguments.length) {
      return tooltipContent;
    }
    tooltipContent = _;
    return chart;
  };

  chart.state = function(_) {
    if (!arguments.length) {
      return state;
    }
    state = _;
    return chart;
  };

  chart.strings = function(_) {
    if (!arguments.length) {
      return strings;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        strings[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.allowScroll = function(_) {
    if (!arguments.length) {
      return scrollEnabled;
    }
    scrollEnabled = _;
    return chart;
  };

  chart.overflowHandler = function(_) {
    if (!arguments.length) {
      return overflowHandler;
    }
    overflowHandler = sucrose.functor(_);
    return chart;
  };

  chart.seriesClick = function(_) {
    if (!arguments.length) {
      return seriesClick;
    }
    seriesClick = _;
    return chart;
  };

  chart.hideEmptyGroups = function(_) {
    if (!arguments.length) {
      return hideEmptyGroups;
    }
    hideEmptyGroups = _;
    return chart;
  };

  chart.direction = function(_) {
    if (!arguments.length) {
      return direction;
    }
    direction = _;
    multibar.direction(_);
    xAxis.direction(_);
    yAxis.direction(_);
    legend.direction(_);
    controls.direction(_);
    return chart;
  };

  //============================================================

  return chart;
};
sucrose.models.paretoChart = function() {
    //'use strict';
    //============================================================
    // Public Variables with Default Settings
    //------------------------------------------------------------

    var margin = {top: 10, right: 10, bottom: 10, left: 10},
        width = null,
        height = null,
        getX = function(d) { return d.x; },
        getY = function(d) { return d.y; },
        locality = sucrose.utils.buildLocality(),
        showTitle = false,
        showLegend = true,
        tooltip = null,
        tooltips = true,
        direction = 'ltr',
        tooltipBar = function(key, x, y, e, graph) {
            return '<p><b>' + key + '</b></p>' +
                '<p><b>' + y + '</b></p>' +
                '<p><b>' + x + '%</b></p>';
        },
        tooltipLine = function(key, x, y, e, graph) {
            return '<p><p>' + key + ': <b>' + y + '</b></p>';
        },
        tooltipQuota = function(key, x, y, e, graph) {
            return '<p>' + e.key + ': <b>' + y + '</b></p>';
        },
        x,
        y,
        strings = {
            barlegend: {close: 'Hide bar legend', open: 'Show bar legend'},
            linelegend: {close: 'Hide line legend', open: 'Show line legend'},
            controls: {close: 'Hide controls', open: 'Show controls'},
            noData: 'No Data Available.',
            noLabel: 'undefined'
        },
        dispatch = d3.dispatch('chartClick', 'tooltipShow', 'tooltipHide', 'tooltipMove');

    //============================================================
    // Private Variables
    //------------------------------------------------------------

    var xValueFormat = function(d, labels, isDate) {
            var val = isNaN(parseInt(d, 10)) || !labels || !Array.isArray(labels) ?
                d : labels[parseInt(d, 10)] || d;
            return isDate ? sucrose.utils.dateFormat(val, 'yMMMM', chart.locality()) : val;
        };
    var yValueFormat = function(d, isCurrency) {
            return sucrose.utils.numberFormatSI(d, 2, isCurrency, chart.locality());
        };

    var multibar = sucrose.models.multiBar()
            .stacked(true)
            .clipEdge(false)
            .withLine(true)
            .nice(false),
        lines1 = sucrose.models.line()
            .color(function(d, i) { return '#FFF'; })
            .fill(function(d, i) { return '#FFF'; })
            .useVoronoi(false)
            .nice(false),
        lines2 = sucrose.models.line()
            .useVoronoi(false)
            .color('data')
            .nice(false),
        xAxis = sucrose.models.axis(),
        yAxis = sucrose.models.axis(),
        barLegend = sucrose.models.legend()
            .align('left')
            .position('middle'),
        lineLegend = sucrose.models.legend()
            .align('right')
            .position('middle');

    var showTooltip = function(eo, offsetElement, dataGroup) {
        var key = eo.series.key,
            per = (eo.point.y * 100 / dataGroup[eo.pointIndex].t).toFixed(1),
            amt = lines2.y()(eo.point, eo.pointIndex),
            content = eo.series.type === 'bar' ? tooltipBar(key, per, amt, eo, chart) : tooltipLine(key, per, amt, eo, chart);
        tooltip = sucrose.tooltip.show(eo.e, content, 's', null, offsetElement);
    };

    var showQuotaTooltip = function(eo, offsetElement) {
        var content = tooltipQuota(eo.key, 0, eo.val, eo, chart);
        tooltip = sucrose.tooltip.show(eo.e, content, 's', null, offsetElement);
    };

    var barClick = function(data, eo, chart, container) {
        return;
    };

    var getAbsoluteXY = function(element) {
        var viewportElement = document.documentElement,
            box = element.getBoundingClientRect(),
            scrollLeft = viewportElement.scrollLeft + document.body.scrollLeft,
            scrollTop = viewportElement.scrollTop + document.body.scrollTop,
            x = box.left + scrollLeft,
            y = box.top + scrollTop;

        return {'x': x, 'y': y};
    };

    //============================================================

    function chart(selection) {

        selection.each(function(chartData) {

            var properties = chartData.properties,
                data = chartData.data,
                container = d3.select(this),
                that = this,
                availableWidth = (width || parseInt(container.style('width'), 10) || 960) - margin.left - margin.right,
                availableHeight = (height || parseInt(container.style('height'), 10) || 400) - margin.top - margin.bottom,
                innerWidth = availableWidth,
                innerHeight = availableHeight,
                innerMargin = {top: 0, right: 0, bottom: 0, left: 0},
                maxBarLegendWidth = 0,
                maxLineLegendWidth = 0,
                widthRatio = 0,
                pointSize = Math.pow(6, 2) * Math.PI, // set default point size to 6
                xIsDatetime = chartData.properties.xDataType === 'datetime' || false,
                yIsCurrency = chartData.properties.yDataType === 'currency' || false;

            chart.update = function() {
                container.call(chart);
            };

            chart.container = this;

            //------------------------------------------------------------
            // Display No Data message if there's nothing to show.

            if (!data || !data.length || !data.filter(function(d) {
                return d.values.length;
            }).length) {
                var noDataText = container.selectAll('.sc-noData').data([chart.strings().noData]);

                noDataText.enter().append('text')
                    .attr('class', 'sucrose sc-noData')
                    .attr('dy', '-.7em')
                    .style('text-anchor', 'middle');

                noDataText
                    .attr('x', margin.left + availableWidth / 2)
                    .attr('y', margin.top + availableHeight / 2)
                    .text(function(d) {
                        return d;
                    });

                return chart;
            } else {
                container.selectAll('.sc-noData').remove();
            }

            //------------------------------------------------------------
            // Process data

            chart.dataSeriesActivate = function(eo) {
                var series = eo.series;

                series.active = (!series.active || series.active === 'inactive') ? 'active' : 'inactive';
                series.values.map(function(d) {
                    d.active = series.active;
                });

                // if you have activated a data series, inactivate the rest
                if (series.active === 'active') {
                    data
                        .filter(function(d) {
                            return d.active !== 'active';
                        })
                        .map(function(d) {
                            d.active = 'inactive';
                            d.values.map(function(d) {
                                d.active = 'inactive';
                            });
                            return d;
                        });
                }

                // if there are no active data series, activate them all
                if (!data.filter(function(d) { return d.active === 'active'; }).length) {
                    data
                        .map(function(d) {
                            d.active = '';
                            d.values.map(function(d) {
                                d.active = '';
                            });
                            container.selectAll('.sc-series').classed('sc-inactive', false);
                            return d;
                        });
                }

                container.call(chart);
            };

            var dataBars = data.filter(function(d) {
                    return !d.disabled && (!d.type || d.type === 'bar');
                });

            var dataLines = data.filter(function(d) {
                    return !d.disabled && d.type === 'line';
                }).map(function(lineData) {
                    if (!multibar.stacked()) {
                        lineData.values = lineData.valuesOrig.map(function(v, i) {
                            return {'series': v.series, 'x': (v.x + v.series * 0.25 - i * 0.25), 'y': v.y};
                        });
                    } else {
                        lineData.values.map(function(v) {
                            v.y = 0;
                        });
                        dataBars
                            .map(function(v, i) {
                                v.values.map(function(v, i) {
                                    lineData.values[i].y += v.y;
                                });
                            });
                        lineData.values.map(function(v, i) {
                            if (i > 0) {
                                v.y += lineData.values[i - 1].y;
                            }
                        });
                    }
                    return lineData;
                });

            var dataGroup = properties.groupData,
                groupLabels = dataGroup.map(function(d) {
                  return [].concat(d.l)[0] || chart.strings().noLabel;
                }),
                quotaValue = properties.quota || 0,
                quotaLabel = properties.quotaLabel || '',
                targetQuotaValue = properties.targetQuota || 0,
                targetQuotaLabel = properties.targetQuotaLabel || '';

            dataBars = dataBars.length ? dataBars : [{values: []}];
            dataLines = dataLines.length ? dataLines : [{values: []}];

            // line legend data
            var lineLegendData = data.filter(function(d) {
                    return d.type === 'line';
                });
            lineLegendData.push({
                'key': quotaLabel,
                'type': 'dash',
                'color': '#444',
                'series': lineLegendData.length,
                'values': {'series': lineLegendData.length, 'x': 0, 'y': 0}
            });
            if (targetQuotaValue > 0) {
                lineLegendData.push({
                    'key': targetQuotaLabel,
                    'type': 'dash',
                    'color': '#777',
                    'series': lineLegendData.length,
                    'values': {'series': lineLegendData.length + 1, 'x': 0, 'y': 0}
                });
            }

            var seriesX = data.filter(function(d) {
                    return !d.disabled;
                }).map(function(d) {
                    return d.valuesOrig.map(function(d, i) {
                        return getX(d, i);
                    });
                });

            var seriesY = data.map(function(d) {
                    return d.valuesOrig.map(function(d, i) {
                        return getY(d, i);
                    });
                });

            //------------------------------------------------------------
            // Setup Scales

            x = multibar.xScale();
            y = multibar.yScale();

            xAxis
                .valueFormat(xValueFormat)
                .orient('bottom')
                .tickSize(0)
                .tickPadding(4)
                .wrapTicks(true)
                .highlightZero(false)
                .showMaxMin(false)
                .tickFormat(function(d, i, noEllipsis) {
                  // Set xAxis to use trimmed array rather than data
                  var label = xAxis.valueFormat()(i, groupLabels, xIsDatetime);
                  if (!noEllipsis) {
                    label = sucrose.utils.stringEllipsify(label, container, Math.max(availableWidth * 0.2, 75));
                  }
                  return label;
                })
                .scale(x);
            yAxis
                .valueFormat(yValueFormat)
                .orient('left')
                .tickPadding(7)
                .showMaxMin(true)
                .tickFormat(function(d, i) {
                  return yAxis.valueFormat()(d, yIsCurrency);
                })
                .scale(y);

            //------------------------------------------------------------
            // Setup containers and skeleton of chart

            var wrap_bind = container.selectAll('g.sc-wrap.sc-multiBarWithLegend').data([data]);
            var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-multiBarWithLegend');
            var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
            var g_entr = wrap_entr.append('g').attr('class', 'sc-chart-wrap');
            var g = container.select('g.sc-chart-wrap').merge(g_entr);

            g_entr.append('rect').attr('class', 'sc-background')
                .attr('x', -margin.left)
                .attr('y', -margin.top)
                .attr('width', availableWidth + margin.left + margin.right)
                .attr('height', availableHeight + margin.top + margin.bottom)
                .attr('fill', '#FFF');

            g_entr.append('g').attr('class', 'sc-titleWrap');
            var titleWrap = g.select('.sc-titleWrap');
            g_entr.append('g').attr('class', 'sc-x sc-axis');
            var xAxisWrap = g.select('.sc-x.sc-axis');
            g_entr.append('g').attr('class', 'sc-y sc-axis');
            var yAxisWrap = g.select('.sc-y.sc-axis');
            g_entr.append('g').attr('class', 'sc-barsWrap');
            var barsWrap = g.select('.sc-barsWrap');
            g_entr.append('g').attr('class', 'sc-quotaWrap');
            var quotaWrap = g.select('.sc-quotaWrap');

            g_entr.append('g').attr('class', 'sc-linesWrap1');
            var linesWrap1 = g.select('.sc-linesWrap1');
            g_entr.append('g').attr('class', 'sc-linesWrap2');
            var linesWrap2 = g.select('.sc-linesWrap2');

            g_entr.append('g').attr('class', 'sc-legendWrap sc-barLegend');
            var barLegendWrap = g.select('.sc-legendWrap.sc-barLegend');
            g_entr.append('g').attr('class', 'sc-legendWrap sc-lineLegend');
            var lineLegendWrap = g.select('.sc-legendWrap.sc-lineLegend');

            wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            //------------------------------------------------------------
            // Title & Legend

            if (showTitle && properties.title) {
                titleWrap.select('.sc-title').remove();

                titleWrap
                    .append('text')
                    .text(properties.title)
                    .attr('class', 'sc-title')
                    .attr('x', direction === 'rtl' ? availableWidth : 0)
                    .attr('y', 0)
                    .attr('dy', '.75em')
                    .attr('text-anchor', 'start')
                    .attr('stroke', 'none')
                    .attr('fill', 'black');

                innerMargin.top += parseInt(g.select('.sc-title').node().getBoundingClientRect().height / 1.15, 10) +
                    parseInt(g.select('.sc-title').style('margin-top'), 10) +
                    parseInt(g.select('.sc-title').style('margin-bottom'), 10);
            }

            if (showLegend) {

                // bar series legend
                barLegend
                    .id('barlegend_' + chart.id())
                    .strings(chart.strings().barlegend)
                    .align('left')
                    .height(availableHeight - innerMargin.top);
                barLegendWrap
                    .datum(
                        data.filter(function(d) {
                            return d.type === 'bar';
                        })
                    )
                    .call(barLegend);

                maxBarLegendWidth = barLegend.calculateWidth();

                // line series legend
                lineLegend
                    .id('linelegend_' + chart.id())
                    .strings(chart.strings().linelegend)
                    .align('right')
                    .height(availableHeight - innerMargin.top);
                lineLegendWrap
                    .datum(lineLegendData)
                    .call(lineLegend);

                maxLineLegendWidth = lineLegend.calculateWidth();

                // calculate proportional available space
                widthRatio = availableWidth / (maxBarLegendWidth + maxLineLegendWidth);

                barLegend
                    .arrange(Math.floor(widthRatio * maxBarLegendWidth));

                lineLegend
                    .arrange(Math.floor(widthRatio * maxLineLegendWidth));

                barLegendWrap
                    .attr('transform', 'translate(' + (direction === 'rtl' ? availableWidth - barLegend.width() : 0) + ',' + innerMargin.top + ')');
                lineLegendWrap
                    .attr('transform', 'translate(' + (direction === 'rtl' ? 0 : availableWidth - lineLegend.width()) + ',' + innerMargin.top + ')');
            }

            //------------------------------------------------------------
            // Recalculate inner margins based on legend size

            innerMargin.top += Math.max(barLegend.height(), lineLegend.height()) + 4;
            innerHeight = availableHeight - innerMargin.top - innerMargin.bottom;

            //------------------------------------------------------------
            // Initial call of Main Chart Components

            var lx = x.domain(d3.merge(seriesX)).rangeBands([0, availableWidth - margin.left - margin.right], 0.3),
                ly = Math.max(d3.max(d3.merge(seriesY)), quotaValue, targetQuotaValue || 0),
                forceY = Math.ceil(ly * 0.1) * 10,
                lOffset = lx(1) + lx.rangeBand() / (multibar.stacked() || dataLines.length === 1 ? 2 : 4);

            // Main Bar Chart
            multibar
                .width(innerWidth)
                .height(innerHeight)
                .forceY([0, forceY])
                .id(chart.id());
            barsWrap
                .datum(dataBars)
                .call(multibar);

            // Main Line Chart
            lines1
                .margin({top: 0, right: lOffset, bottom: 0, left: lOffset})
                .width(innerWidth)
                .height(innerHeight)
                .forceY([0, forceY])
                .useVoronoi(false)
                .id('outline_' + chart.id());
            lines2
                .margin({top: 0, right: lOffset, bottom: 0, left: lOffset})
                .width(innerWidth)
                .height(innerHeight)
                .forceY([0, forceY])
                .useVoronoi(false)
                .size(pointSize)
                .sizeRange([pointSize, pointSize])
                .sizeDomain([pointSize, pointSize])
                .id('foreground_' + chart.id());
            linesWrap1
                .datum(dataLines)
                .call(lines1);
            linesWrap2
                .datum(dataLines)
                .call(lines2);

            // Axes
            xAxisWrap
                .call(xAxis);
            var xAxisMargin = xAxis.margin();

            yAxisWrap
                .style('opacity', dataBars.length ? 1 : 0)
                .call(yAxis);
            var yAxisMargin = yAxis.margin();


            //------------------------------------------------------------
            // Quota Line

            quotaWrap.selectAll('line').remove();
            yAxisWrap.selectAll('text.sc-quotaValue').remove();
            yAxisWrap.selectAll('text.sc-targetQuotaValue').remove();

            var quotaTextWidth = 0,
                quotaTextHeight = 14;

            // Target Quota Line
            if (targetQuotaValue > 0) {
                quotaWrap.append('line')
                    .attr('class', 'sc-quotaLineTarget')
                    .attr('x1', 0)
                    .attr('y1', 0)
                    .attr('x2', innerWidth)
                    .attr('y2', 0)
                    .attr('transform', 'translate(0,' + y(targetQuotaValue) + ')')
                    .style('stroke-dasharray', '8, 8');

                quotaWrap.append('line')
                    .datum({key: targetQuotaLabel, val: targetQuotaValue})
                    .attr('class', 'sc-quotaLineTarget sc-quotaLineBackground')
                    .attr('x1', 0)
                    .attr('y1', 0)
                    .attr('x2', innerWidth)
                    .attr('y2', 0)
                    .attr('transform', 'translate(0,' + y(targetQuotaValue) + ')');

                // Target Quota line label
                yAxisWrap.append('text')
                    .text(yAxis.valueFormat()(targetQuotaValue, true))
                    .attr('class', 'sc-targetQuotaValue')
                    .attr('dy', '.36em')
                    .attr('dx', '0')
                    .attr('text-anchor', direction === 'rtl' ? 'start' : 'end')
                    .attr('transform', 'translate(' + (0 - yAxis.tickPadding()) + ',' + y(targetQuotaValue) + ')');

                quotaTextWidth = Math.round(g.select('text.sc-targetQuotaValue').node().getBoundingClientRect().width + yAxis.tickPadding());
            }

            if (quotaValue > 0) {
                quotaWrap.append('line')
                    .attr('class', 'sc-quotaLine')
                    .attr('x1', 0)
                    .attr('y1', 0)
                    .attr('x2', innerWidth)
                    .attr('y2', 0)
                    .attr('transform', 'translate(0,' + y(quotaValue) + ')')
                    .style('stroke-dasharray', '8, 8');

                quotaWrap.append('line')
                    .datum({key: quotaLabel, val: quotaValue})
                    .attr('class', 'sc-quotaLine sc-quotaLineBackground')
                    .attr('x1', 0)
                    .attr('y1', 0)
                    .attr('x2', innerWidth)
                    .attr('y2', 0)
                    .attr('transform', 'translate(0,' + y(quotaValue) + ')');

                // Quota line label
                yAxisWrap.append('text')
                    .text(yAxis.valueFormat()(quotaValue, true))
                    .attr('class', 'sc-quotaValue')
                    .attr('dy', '.36em')
                    .attr('dx', '0')
                    .attr('text-anchor', direction === 'rtl' ? 'start' : 'end')
                    .attr('transform', 'translate(' + -yAxis.tickPadding() + ',' + y(quotaValue) + ')');

                quotaTextWidth = Math.max(quotaTextWidth, Math.round(g.select('text.sc-quotaValue').node().getBoundingClientRect().width + yAxis.tickPadding()));
            }

            //------------------------------------------------------------
            // Calculate intial dimensions based on first Axis call

            // Temporarily reset inner dimensions
            innerWidth = availableWidth - innerMargin.left - Math.max(quotaTextWidth, yAxisMargin.left) - innerMargin.right - yAxisMargin.right;
            innerHeight = availableHeight - innerMargin.top - yAxisMargin.top - innerMargin.bottom - yAxisMargin.bottom;

            //------------------------------------------------------------
            // Recall Main Chart and Axis

            multibar
                .width(innerWidth)
                .height(innerHeight);
            barsWrap
                .call(multibar);
            xAxisWrap
                .call(xAxis);
            yAxisWrap
                .call(yAxis);

            xAxisMargin = xAxis.margin();
            yAxisMargin = yAxis.margin();

            //------------------------------------------------------------
            // Recalculate final dimensions based on new Axis size

            // Reset inner margins
            innerMargin.left += Math.max(quotaTextWidth, xAxisMargin.left, yAxisMargin.left);
            innerMargin.right += Math.max(xAxisMargin.right, yAxisMargin.right);
            innerMargin.top += Math.max(xAxisMargin.top, yAxisMargin.top);
            innerMargin.bottom += Math.max(xAxisMargin.bottom, yAxisMargin.bottom);

            // Reset inner dimensions
            innerWidth = availableWidth - innerMargin.left - innerMargin.right;
            innerHeight = availableHeight - innerMargin.top - innerMargin.bottom;

            //------------------------------------------------------------
            // Recall Main Chart Components based on final dimensions

            multibar
                .width(innerWidth)
                .height(innerHeight);

            barsWrap
                .attr('transform', 'translate(' + innerMargin.left + ',' + innerMargin.top + ')')
                .call(multibar);

            lines1
                .width(innerWidth)
                .height(innerHeight);
            lines2
                .width(innerWidth)
                .height(innerHeight);

            linesWrap1
                .attr('transform', 'translate(' + innerMargin.left + ',' + innerMargin.top + ')')
                .call(lines1);
            linesWrap2
                .attr('transform', 'translate(' + innerMargin.left + ',' + innerMargin.top + ')')
                .call(lines2);

            quotaWrap
                .attr('transform', 'translate(' + innerMargin.left + ',' + innerMargin.top + ')')
                .selectAll('line')
                    .attr('x2', innerWidth);

            xAxisWrap
                .attr('transform', 'translate(' + innerMargin.left + ',' + (xAxis.orient() === 'bottom' ? innerHeight + innerMargin.top : innerMargin.top) + ')')
                .call(xAxis);

            yAxis
                .ticks(Math.ceil(innerHeight / 48))
                .tickSize(-innerWidth, 0);

            yAxisWrap
                .attr('transform', 'translate(' + (yAxis.orient() === 'left' ? innerMargin.left : innerMargin.left + innerWidth) + ',' + innerMargin.top + ')')
                .call(yAxis);

            if (targetQuotaValue > 0) {

                quotaWrap.select('line.sc-quotaLineTarget')
                    .attr('x2', innerWidth)
                    .attr('transform', 'translate(0,' + y(targetQuotaValue) + ')');
                yAxisWrap.select('text.sc-targetQuotaValue')
                    .attr('transform', 'translate(' + (0 - yAxis.tickPadding()) + ',' + y(targetQuotaValue) + ')');

                quotaTextHeight = Math.round(parseInt(g.select('text.sc-targetQuotaValue').node().getBoundingClientRect().height, 10) / 1.15);

                //check if tick lines overlap quota values, if so, hide the values that overlap
                yAxisWrap.selectAll('g.tick, g.sc-axisMaxMin')
                    .each(function(d, i) {
                        if (Math.abs(y(d) - y(targetQuotaValue)) <= quotaTextHeight) {
                            d3.select(this).style('opacity', 0);
                        }
                    });
            }

            if (quotaValue > 0) {

                quotaWrap.select('line.sc-quotaLine')
                    .attr('x2', innerWidth)
                    .attr('transform', 'translate(0,' + y(quotaValue) + ')');
                yAxisWrap.select('text.sc-quotaValue')
                    .attr('transform', 'translate(' + (0 - yAxis.tickPadding()) + ',' + y(quotaValue) + ')');

                quotaTextHeight = Math.round(parseInt(g.select('text.sc-quotaValue').node().getBoundingClientRect().height, 10) / 1.15);

                //check if tick lines overlap quota values, if so, hide the values that overlap
                yAxisWrap.selectAll('g.tick, g.sc-axisMaxMin')
                    .each(function(d, i) {
                        if (Math.abs(y(d) - y(quotaValue)) <= quotaTextHeight) {
                            d3.select(this).style('opacity', 0);
                        }
                    });

                // if there is a quota and an adjusted quota
                // check to see if the adjusted collides
                if (targetQuotaValue > 0) {
                    if (Math.abs(y(quotaValue) - y(targetQuotaValue)) <= quotaTextHeight) {
                        yAxisWrap.select('.sc-targetQuotaValue').style('opacity', 0);
                    }
                }
            }

            //============================================================
            // Event Handling/Dispatching (in chart's scope)
            //------------------------------------------------------------

            quotaWrap.selectAll('line.sc-quotaLineBackground')
                .on('mouseover', function(d) {
                    if (tooltips) {
                        var eo = {
                            val: d.val,
                            key: d.key,
                            e: d3.event
                        };
                        showQuotaTooltip(eo, that.parentNode);
                    }
                })
                .on('mousemove', function() {
                    var e = d3.event;
                    dispatch.call('tooltipMove', this, e);
                })
                .on('mouseout', function() {
                    dispatch.call('tooltipHide', this);
                });

            barLegend.dispatch.on('legendClick', function(d, i) {
                var selectedSeries = d.series;

                //swap bar disabled
                d.disabled = !d.disabled;
                //swap line disabled for same series
                if (!chart.stacked()) {
                    data.filter(function(d) {
                            return d.series === selectedSeries && d.type === 'line';
                        }).map(function(d) {
                            d.disabled = !d.disabled;
                            return d;
                        });
                }
                // if there are no enabled data series, enable them all
                if (!data.filter(function(d) {
                    return !d.disabled && d.type === 'bar';
                }).length) {
                    data.map(function(d) {
                        d.disabled = false;
                        g.selectAll('.sc-series').classed('disabled', false);
                        return d;
                    });
                }
                container.call(chart);
            });

            dispatch.on('tooltipShow', function(eo) {
                if (tooltips) {
                    showTooltip(eo, that.parentNode, dataGroup);
                }
            });

            dispatch.on('tooltipMove', function(e) {
                if (tooltip) {
                    sucrose.tooltip.position(that.parentNode, tooltip, e, 's');
                }
            });

            dispatch.on('tooltipHide', function() {
                if (tooltips) {
                    sucrose.tooltip.cleanup();
                }
            });

            dispatch.on('chartClick', function() {
                if (barLegend.enabled()) {
                    barLegend.dispatch.closeMenu();
                }
                if (lineLegend.enabled()) {
                    lineLegend.dispatch.closeMenu();
                }
            });

            multibar.dispatch.on('elementClick', function(eo) {
                dispatch.call('chartClick', this);
                barClick(data, eo, chart, container);
            });

        });

        return chart;
    }

    //============================================================
    // Event Handling/Dispatching (out of chart's scope)
    //------------------------------------------------------------

    lines2.dispatch.on('elementMouseover.tooltip', function(eo) {
        dispatch.call('tooltipShow', this, eo);
    });

    lines2.dispatch.on('elementMousemove', function(e) {
        dispatch.call('tooltipMove', this, e);
    });

    lines2.dispatch.on('elementMouseout.tooltip', function() {
        dispatch.call('tooltipHide', this);
    });

    multibar.dispatch.on('elementMouseover.tooltip', function(eo) {
        dispatch.call('tooltipShow', this, eo);
    });

    multibar.dispatch.on('elementMousemove', function(e) {
        dispatch.call('tooltipMove', this, e);
    });

    multibar.dispatch.on('elementMouseout.tooltip', function() {
        dispatch.call('tooltipHide', this);
    });


    //============================================================
    // Expose Public Variables
    //------------------------------------------------------------

    // expose chart's sub-components
    chart.dispatch = dispatch;
    chart.lines1 = lines1;
    chart.lines2 = lines2;
    chart.multibar = multibar;
    chart.barLegend = barLegend;
    chart.lineLegend = lineLegend;
    chart.xAxis = xAxis;
    chart.yAxis = yAxis;

    fc.rebind(chart, multibar, 'id', 'x', 'y', 'xScale', 'yScale', 'xDomain', 'yDomain', 'forceX', 'forceY', 'clipEdge', 'color', 'fill', 'classes', 'gradient');
    fc.rebind(chart, multibar, 'stacked', 'showValues', 'valueFormat', 'nice');
    fc.rebind(chart, xAxis, 'rotateTicks', 'reduceXTicks', 'staggerTicks', 'wrapTicks');

    chart.colorData = function(_) {
        var type = arguments[0],
            params = arguments[1] || {};
        var barColor = function(d, i) {
            return sucrose.utils.defaultColor()(d, d.series);
        };
        var barClasses = function(d, i) {
            return 'sc-group sc-series-' + d.series;
        };
        var lineColor = function(d, i) {
            var p = params.lineColor ? params.lineColor : {
                c1: '#1A8221',
                c2: '#62B464',
                l: 1
            };
            return d.color || d3.interpolateHsl(d3.rgb(p.c1), d3.rgb(p.c2))(d.series / 2);
        };
        var lineClasses = function(d, i) {
            return 'sc-group sc-series-' + d.series;
        };

        switch (type) {
            case 'graduated':
                barColor = function(d, i) {
                    return d3.interpolateHsl(d3.rgb(params.barColor.c1), d3.rgb(params.barColor.c2))(d.series / params.barColor.l);
                };
                break;
            case 'class':
                barColor = function() {
                    return 'inherit';
                };
                barClasses = function(d, i) {
                    var iClass = (d.series * (params.step || 1)) % 14;
                    iClass = (iClass > 9 ? '' : '0') + iClass;
                    return 'sc-group sc-series-' + d.series + ' sc-fill' + iClass;
                };
                lineClasses = function(d, i) {
                    var iClass = (d.series * (params.step || 1)) % 14;
                    iClass = (iClass > 9 ? '' : '0') + iClass;
                    return 'sc-group sc-series-' + d.series + ' sc-fill' + iClass + ' sc-stroke' + iClass;
                };
                break;
            case 'data':
                barColor = function(d, i) {
                    return d.classes ? 'inherit' : d.color || sucrose.utils.defaultColor()(d, d.series);
                };
                barClasses = function(d, i) {
                    return 'sc-group sc-series-' + d.series + (d.classes ? ' ' + d.classes : '');
                };
                lineClasses = function(d, i) {
                    return 'sc-group sc-series-' + d.series + (d.classes ? ' ' + d.classes : '');
                };
                break;
        }

        var barFill = (!params.gradient) ? barColor : function(d, i) {
            var p = {orientation: params.orientation || 'vertical', position: params.position || 'middle'};
            return multibar.gradient(d, d.series, p);
        };

        multibar.color(barColor);
        multibar.fill(barFill);
        multibar.classes(barClasses);

        lines2.color(lineColor);
        lines2.fill(lineColor);
        lines2.classes(lineClasses);

        barLegend.color(barColor);
        barLegend.classes(barClasses);

        lineLegend.color(lineColor);
        lineLegend.classes(lineClasses);

        return chart;
    };

    chart.x = function(_) {
        if (!arguments.length) {
            return getX;
        }
        getX = _;
        lines.x(_);
        multibar.x(_);
        return chart;
    };

    chart.y = function(_) {
        if (!arguments.length) {
            return getY;
        }
        getY = _;
        lines.y(_);
        multibar.y(_);
        return chart;
    };

    chart.margin = function(_) {
        if (!arguments.length) {
            return margin;
        }
        for (var prop in _) {
            if (_.hasOwnProperty(prop)) {
                margin[prop] = _[prop];
            }
        }
        return chart;
    };

    chart.width = function(_) {
        if (!arguments.length) {
            return width;
        }
        width = _;
        return chart;
    };

    chart.height = function(_) {
        if (!arguments.length) {
            return height;
        }
        height = _;
        return chart;
    };

    chart.showTitle = function(_) {
        if (!arguments.length) {
            return showTitle;
        }
        showTitle = _;
        return chart;
    };

    chart.showLegend = function(_) {
        if (!arguments.length) {
            return showLegend;
        }
        showLegend = _;
        return chart;
    };

    chart.showControls = function(_) {
        if (!arguments.length) {
            return false;
        }
        return chart;
    };

    chart.tooltipBar = function(_) {
        if (!arguments.length) {
            return tooltipBar;
        }
        tooltipBar = _;
        return chart;
    };

    chart.tooltipLine = function(_) {
        if (!arguments.length) {
            return tooltipLine;
        }
        tooltipLine = _;
        return chart;
    };

    chart.tooltipQuota = function(_) {
        if (!arguments.length) {
            return tooltipQuota;
        }
        tooltipQuota = _;
        return chart;
    };

    chart.tooltip = function(_) {
        if (!arguments.length) {
            return tooltip;
        }
        tooltip = _;
        return chart;
    };

    chart.tooltips = function(_) {
        if (!arguments.length) {
            return tooltips;
        }
        tooltips = _;
        return chart;
    };

    chart.tooltipContent = function(_) {
        if (!arguments.length) {
            return tooltipContent;
        }
        tooltipContent = _;
        return chart;
    };

    chart.barClick = function(_) {
        if (!arguments.length) {
            return barClick;
        }
        barClick = _;
        return chart;
    };

    chart.colorFill = function(_) {
        return chart;
    };

    chart.strings = function(_) {
        if (!arguments.length) {
            return strings;
        }
        for (var prop in _) {
            if (_.hasOwnProperty(prop)) {
                strings[prop] = _[prop];
            }
        }
        return chart;
    };

    chart.direction = function(_) {
        if (!arguments.length) {
            return direction;
        }
        direction = _;
        multibar.direction(_);
        yAxis.direction(_);
        barLegend.direction(_);
        lineLegend.direction(_);
        return chart;
    };

    chart.locality = function(_) {
        if (!arguments.length) {
            return locality;
        }
        locality = sucrose.utils.buildLocality(_);
        multibar.locality(_);
        lines1.locality(_);
        return chart;
    };
    //============================================================

    return chart;
};
sucrose.models.pie = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 0, right: 0, bottom: 0, left: 0},
      width = 500,
      height = 500,
      id = Math.floor(Math.random() * 10000), //Create semi-unique ID in case user doesn't select one
      getValues = function(d) { return d; },
      getX = function(d) { return d.key; },
      getY = function(d) { return d.value; },
      locality = sucrose.utils.buildLocality(),
      getDescription = function(d) { return d.description; },
      valueFormat = function(d) { return d.data ? getY(d.data) : d; },
      labelFormat = function(d) { return d.data ? getX(d.data) : d; },
      showLabels = true,
      showLeaders = true,
      pieLabelsOutside = true,
      donutLabelsOutside = true,
      labelThreshold = 0.01, //if slice percentage is under this, don't show label
      donut = false,
      hole = false,
      holeFormat = function(hole_wrap, data) {
        var hole_bind = hole_wrap.selectAll('.sc-hole-container').data(data),
            hole_entr = hole_bind.enter().append('g').attr('class', 'sc-hole-container');
        hole_entr.append('text')
          .text(data)
          .attr('class', 'sc-pie-hole-value')
          .attr('dy', '.35em')
          .attr('text-anchor', 'middle')
          .style('font-size', '50px');
        hole_bind.exit().remove();
      },
      labelSunbeamLayout = false,
      leaderLength = 20,
      textOffset = 5,
      arcDegrees = 360,
      rotateDegrees = 0,
      startAngle = function(d) {
        // DNR (Math): simplify d.startAngle - ((rotateDegrees * Math.PI / 180) * (360 / arcDegrees)) * (arcDegrees / 360);
        return d.startAngle * arcDegrees / 360 + sucrose.utils.angleToRadians(rotateDegrees);
      },
      endAngle = function(d) {
        return d.endAngle * arcDegrees / 360 + sucrose.utils.angleToRadians(rotateDegrees);
      },
      donutRatio = 0.447,
      minRadius = 75,
      maxRadius = 250,
      fixedRadius = function(chart) { return null; },
      durationMs = 0,
      direction = 'ltr',
      color = function(d, i) { return sucrose.utils.defaultColor()(d, d.series); },
      fill = color,
      textureFill = false,
      classes = function(d, i) { return 'sc-slice sc-series-' + d.series; },
      dispatch = d3.dispatch('chartClick', 'elementClick', 'elementDblClick', 'elementMouseover', 'elementMouseout', 'elementMousemove');

  //============================================================


  function chart(selection) {
    selection.each(function(data) {

      var availableWidth = width - margin.left - margin.right,
          availableHeight = height - margin.top - margin.bottom,
          container = d3.select(this);

      // Setup the Pie chart and choose the data element
      var pie = d3.pie()
            .sort(null)
            .value(function(d) { return d.disabled ? 0 : getY(d); });

      //------------------------------------------------------------
      // recalculate width and height based on label length
      var labelLengths = [],
          doLabels = showLabels && pieLabelsOutside ? true : false;
      if (doLabels) {
        labelLengths = sucrose.utils.stringSetLengths(
            data.map(getX),
            container,
            labelFormat,
            'sc-label'
          );
      }

      //------------------------------------------------------------
      // Setup containers and skeleton of chart
      var wrap_bind = container.selectAll('.sc-wrap.sc-pie').data([data]);
      var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-pie sc-chart-' + id);
      var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
      var defs_entr = wrap_entr.append('defs');
      var g_entr = wrap_entr.append('g').attr('class', 'sc-chart-wrap');
      var g = container.select('g.sc-chart-wrap').merge(g_entr);

      //set up the gradient constructor function
      chart.gradient = function(d, i) {
        var params = {x: 0, y: 0, r: pieRadius, s: (donut ? (donutRatio * 100) + '%' : '0%'), u: 'userSpaceOnUse'};
        return sucrose.utils.colorRadialGradient(d, id + '-' + i, params, color(d, i), wrap.select('defs'));
      };

      var pie_enter = g_entr.append('g').attr('class', 'sc-pie');
      var pie_wrap = g.select('.sc-pie').merge(pie_enter);
      var hole_enter = g_entr.append('g').attr('class', 'sc-hole-wrap');
      var hole_wrap = g.select('.sc-hole-wrap').merge(hole_enter);

      wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
      pie_wrap.attr('transform', 'translate(' + (availableWidth / 2) + ',' + (availableHeight / 2) + ')');

      //------------------------------------------------------------

      if (textureFill) {
        var mask = sucrose.utils.createTexture(defs_entr, id, -availableWidth / 2, -availableHeight / 2);
      }

      //------------------------------------------------------------

      container
        .on('click', function(d, i) {
          dispatch.chartClick({
            data: d,
            index: i,
            pos: d3.event,
            id: id
          });
        });

      var slices_bind = pie_wrap.selectAll('.sc-slice')
            .data(pie);
      slices_bind.exit().remove();
      var slices_entr = slices_bind.enter().append('g')
            .attr('class', 'sc-slice');
      var slices = pie_wrap.selectAll('.sc-slice')
            .merge(slices_entr);

      slices_entr
        .style('stroke', '#ffffff')
        .style('stroke-width', 2)
        .style('stroke-opacity', 0)
        .on('mouseover', function(d, i) {
          d3.select(this).classed('hover', true);
          var eo = buildEventObject(d3.event, d, i);
          dispatch.call('elementMouseover', this, eo);
        })
        .on('mousemove', function(d, i) {
          var e = d3.event;
          dispatch.call('elementMousemove', this, e);
        })
        .on('mouseout', function(d, i) {
          d3.select(this).classed('hover', false);
          dispatch.call('elementMouseout', this);
        })
        .on('click', function(d, i) {
          d3.event.stopPropagation();
          var eo = buildEventObject(d3.event, d, i);
          dispatch.call('elementClick', this, eo);
        })
        .on('dblclick', function(d, i) {
          d3.event.stopPropagation();
          var eo = buildEventObject(d3.event, d, i);
          dispatch.call('elementDblClick', this, eo);
        });

      slices_entr.append('path')
          .attr('class', 'sc-base')
          .each(function(d, i) {
            this._current = d;
          });

      if (textureFill) {
        slices_entr.append('path')
            .attr('class', 'sc-texture')
            .each(function(d, i) {
              this._current = d;
            })
            .style('mask', 'url(' + mask + ')');
      }

      slices_entr.append('g')
          .attr('transform', 'translate(0,0)')
          .attr('class', 'sc-label');

      slices_entr.select('.sc-label')
          .append('rect')
          .style('fill-opacity', 0)
          .style('stroke-opacity', 0);
      slices_entr.select('.sc-label')
          .append('text')
          .style('fill-opacity', 0);

      slices_entr.append('polyline')
          .attr('class', 'sc-label-leader')
          .style('stroke-opacity', 0);


      // UPDATE
      //------------------------------------------------------------

      var maxWidthRadius = availableWidth / 2,
          maxHeightRadius = availableHeight / 2,
          extWidths = [],
          extHeights = [],
          verticalShift = 0,
          verticalReduction = doLabels ? 5 : 0,
          horizontalShift = 0,
          horizontalReduction = leaderLength + textOffset;

      // side effect :: resets extWidths, extHeights
      slices.select('.sc-base').call(calcScalars, maxWidthRadius, maxHeightRadius);

      // Donut Hole Text
      hole_wrap.call(holeFormat, hole ? [hole] : []);

      if (hole) {
        var heightHoleHalf = hole_wrap.node().getBoundingClientRect().height * 0.30,
            heightPieHalf = Math.abs(maxHeightRadius * d3.min(extHeights)),
            holeOffset = Math.round(heightHoleHalf - heightPieHalf);

        if (holeOffset > 0) {
          verticalReduction += holeOffset;
          verticalShift -= holeOffset / 2;
        }
      }

      var offsetHorizontal = availableWidth / 2,
          offsetVertical = availableHeight / 2;

      //first adjust the leaderLength to be proportional to radius
      if (doLabels) {
        leaderLength = Math.max(Math.min(Math.min(calcMaxRadius()) / 12, 20), 10);
      }

      if (fixedRadius(chart)) {
        minRadius = fixedRadius(chart);
        maxRadius = fixedRadius(chart);
      }

      var labelRadius = Math.min(Math.max(calcMaxRadius(), minRadius), maxRadius),
          pieRadius = labelRadius - (doLabels ? leaderLength : 0);

      offsetVertical += ((d3.max(extHeights) - d3.min(extHeights)) / 2 + d3.min(extHeights)) * ((labelRadius + verticalShift) / offsetVertical);
      offsetHorizontal += ((d3.max(extWidths) - d3.min(extWidths)) / 2 - d3.max(extWidths)) * (labelRadius / offsetHorizontal);

      offsetVertical += verticalShift / 2;

      pie_wrap
        .attr('transform', 'translate(' + offsetHorizontal + ',' + offsetVertical + ')');
      hole_wrap
        .attr('transform', 'translate(' + offsetHorizontal + ',' + offsetVertical + ')');
      pie_wrap.select(mask)
        .attr('x', -pieRadius / 2)
        .attr('y', -pieRadius / 2);

      var pieArc = d3.arc()
            .innerRadius(donut ? pieRadius * donutRatio : 0)
            .outerRadius(pieRadius)
            .startAngle(startAngle)
            .endAngle(endAngle);

      var labelArc = d3.arc()
            .innerRadius(0)
            .outerRadius(pieRadius)
            .startAngle(startAngle)
            .endAngle(endAngle);

      if (pieLabelsOutside) {
        if (!donut || donutLabelsOutside) {
          labelArc
            .innerRadius(labelRadius)
            .outerRadius(labelRadius);
        } else {
          labelArc
            .outerRadius(pieRadius * donutRatio);
        }
      }

      slices
        .attr('class', function(d) { return classes(d.data, d.data.series); })
        .attr('fill', function(d) { return fill(d.data, d.data.series); })
        .classed('sc-active', function(d) { return d.data.active === 'active'; })
        .classed('sc-inactive', function(d) { return d.data.active === 'inactive'; });

      // removed d3 transition in MACAROON-133 because
      // there is a "Maximum call stack size exceeded at Date.toString" error
      // in PMSE that stops d3 from calling transitions
      // this may be a logger issue or some recursion somewhere in PMSE
      // slices.select('path').transition().duration(durationMs)
      //   .attr('d', arc)
      //   .attrTween('d', arcTween);

      slices.select('.sc-base')
        .attr('d', pieArc)
        .style('stroke-opacity', function(d) {
          return startAngle(d) === endAngle(d) ? 0 : 1;
        });

      if (textureFill) {
        slices.select('.sc-texture')
          .attr('d', pieArc)
          .style('stroke-opacity', function(d) {
            return startAngle(d) === endAngle(d) ? 0 : 1;
          })
          .style('fill', function(d, i) {
            var backColor = d3.select(this.parentNode).style('fill');
            return sucrose.utils.getTextContrast(backColor, i);
          });
      }

      if (showLabels) {
        // This does the normal label
        slices.select('.sc-label')
          .attr('transform', function(d) {
            if (labelSunbeamLayout) {
              d.outerRadius = pieRadius + 10; // Set Outer Coordinate
              d.innerRadius = pieRadius + 15; // Set Inner Coordinate
              var rotateAngle = (startAngle(d) + endAngle(d)) / 2 * (180 / Math.PI);
              rotateAngle += 90 * alignedRight(d, labelArc);
              return 'translate(' + labelArc.centroid(d) + ') rotate(' + rotateAngle + ')';
            } else {
              var labelsPosition = labelArc.centroid(d),
                  leadOffset = showLeaders ? (leaderLength + textOffset) * alignedRight(d, labelArc) : 0;
              return 'translate(' + [labelsPosition[0] + leadOffset, labelsPosition[1]] + ')';
            }
          });

        slices.select('.sc-label text')
          .text(function(d) {
            return labelFormat(d);
          })
          .attr('dy', '.35em')
          .style('fill', '#555')
          .style('fill-opacity', labelOpacity)
          .style('text-anchor', function(d) {
            //center the text on it's origin or begin/end if orthogonal aligned
            //labelSunbeamLayout ? ((d.startAngle + d.endAngle) / 2 < Math.PI ? 'start' : 'end') : 'middle'
            if (!pieLabelsOutside) {
              return 'middle';
            }
            var anchor = alignedRight(d, labelArc) === 1 ? 'start' : 'end';
            if (direction === 'rtl') {
              anchor = anchor === 'start' ? 'end' : 'start';
            }
            return anchor;
          });

        slices
          .each(function(d, i) {
            if (labelLengths[i] > minRadius || labelRadius === minRadius) {
              var theta = (startAngle(d) + endAngle(d)) / 2,
                  sin = Math.abs(Math.sin(theta)),
                  bW = labelRadius * sin + leaderLength + textOffset + labelLengths[i],
                  rW = (availableWidth / 2 - offsetHorizontal) + availableWidth / 2 - bW;
              if (rW < 0) {
                var label = sucrose.utils.stringEllipsify(labelFormat(d), container, labelLengths[i] + rW);
                d3.select(this).select('text').text(label);
              }
            }
          });

        if (!pieLabelsOutside) {
          slices.select('.sc-label')
            .each(function(d) {
              if (!labelOpacity(d)) {
                return;
              }
              var slice = d3.select(this),
                  textBox = slice.select('text').node().getBoundingClientRect();
              slice.select('rect')
                .attr('rx', 3)
                .attr('ry', 3)
                .attr('width', textBox.width + 10)
                .attr('height', textBox.height + 10)
                .attr('transform', function() {
                  return 'translate(' + [textBox.x - 5, textBox.y - 5] + ')';
                })
                .style('fill', '#fff')
                .style('fill-opacity', labelOpacity);
            });
        } else if (showLeaders) {
          slices.select('.sc-label-leader')
            .attr('points', function(d) {
              if (!labelOpacity(d)) {
                // canvg needs at least 2 points because the lib doesnt have
                // any defensive code around an array with 1 element, it expects 2+ els
                return '0,0 0,0';
              }
              var outerArc = d3.arc()
                    .innerRadius(pieRadius)
                    .outerRadius(pieRadius)
                    .startAngle(startAngle)
                    .endAngle(endAngle);
              var leadOffset = showLeaders ? leaderLength * alignedRight(d, outerArc) : 0,
                  outerArcPoints = outerArc.centroid(d),
                  labelArcPoints = labelArc.centroid(d),
                  leadArcPoints = [labelArcPoints[0] + leadOffset, labelArcPoints[1]];
              return outerArcPoints + ' ' + labelArcPoints + ' ' + leadArcPoints;
            })
            .style('stroke', '#aaa')
            .style('fill', 'none')
            .style('stroke-opacity', labelOpacity);
        }
      } else {
        slices.select('.sc-label-leader').style('stroke-opacity', 0);
        slices.select('.sc-label rect').style('fill-opacity', 0);
        slices.select('.sc-label text').style('fill-opacity', 0);
      }

      // Utility Methods
      //------------------------------------------------------------

      function buildEventObject(e, d, i) {
        return {
            label: labelFormat(d),
            value: valueFormat(d),
            point: d.data,
            pointIndex: i,
            id: id,
            e: e
          };
      }

      // calculate max and min height of slice vertices
      function calcScalars(slices, maxWidth, maxHeight) {
        var widths = [],
            heights = [],
            Pi = Math.PI,
            twoPi = 2 * Math.PI,
            north = 0,
            east = Math.PI / 2,
            south = Math.PI,
            west = 3 * Math.PI / 2,
            norm = 0;

        function normalize(a) {
          return (a + norm) % twoPi;
        }

        slices.each(function(d, i) {
          var aStart = (startAngle(d) + twoPi) % twoPi,
              aEnd = (endAngle(d) + twoPi) % twoPi;

          var wStart = Math.round(Math.sin(aStart) * 10000) / 10000,
              wEnd = Math.round(Math.sin(aEnd) * 10000) / 10000,
              hStart = Math.round(Math.cos(aStart) * 10000) / 10000,
              hEnd = Math.round(Math.cos(aEnd) * 10000) / 10000;

          // if angles go around the horn, normalize
          norm = aEnd < aStart ? twoPi - aStart : 0;

          if (aEnd === aStart) {
            aStart = 0;
            aEnd = twoPi;
          } else {
            aStart = normalize(aStart);
            aEnd = normalize(aEnd);
          }

          north = normalize(north);
          east = normalize(east);
          south = normalize(south);
          west = normalize(west);

          // North
          if (aStart % twoPi === 0 || aEnd % twoPi === 0) {
            heights.push(maxHeight);
            if (donut) {
              heights.push(maxHeight * donutRatio);
            }
          }
          // East
          if (aStart <= east && aEnd >= east) {
            widths.push(maxWidth);
            if (donut) {
              widths.push(maxWidth * donutRatio);
            }
          }
          // South
          if (aStart <= south && aEnd >= south) {
            heights.push(-maxHeight);
            if (donut) {
              heights.push(-maxHeight * donutRatio);
            }
          }
          // West
          if (aStart <= west && aEnd >= west) {
            widths.push(-maxWidth);
            if (donut) {
              widths.push(-maxWidth * donutRatio);
            }
          }

          widths.push(maxWidth * wStart);
          widths.push(maxWidth * wEnd);
          if (donut) {
            widths.push(maxWidth * donutRatio * wStart);
            widths.push(maxWidth * donutRatio * wEnd);
          } else {
            widths.push(0);
          }

          heights.push(maxHeight * hStart);
          heights.push(maxHeight * hEnd);
          if (donut) {
            heights.push(maxHeight * donutRatio * hStart);
            heights.push(maxHeight * donutRatio * hEnd);
          } else {
            heights.push(0);
          }
        });

        extWidths = d3.extent(widths);
        extHeights = d3.extent(heights);

        // scale up height radius to fill extents
        maxWidthRadius *= availableWidth / (d3.max(extWidths) - d3.min(extWidths));
        maxHeightRadius *= availableHeight / (d3.max(extHeights) - d3.min(extHeights));
      }

      // reduce width radius for width of labels
      function calcMaxRadius() {
        var widthRadius = [maxWidthRadius],
            heightRadius = [maxHeightRadius + leaderLength];

        slices.select('.sc-base').each(function(d, i) {
          if (!labelOpacity(d)) {
            return;
          }

          var theta = (startAngle(d) + endAngle(d)) / 2,
              sin = Math.sin(theta),
              cos = Math.cos(theta),
              bW = maxWidthRadius - horizontalReduction - labelLengths[i],
              bH = maxHeightRadius - verticalReduction,
              rW = sin ? bW / sin : bW, //don't divide by zero, fool
              rH = cos ? bH / cos : bH;

          widthRadius.push(rW);
          heightRadius.push(rH);
        });

        var radius = d3.min(widthRadius.concat(heightRadius).concat([]), function(d) { return Math.abs(d); });

        return radius;
      }

      function labelOpacity(d) {
        var percent = (endAngle(d) - startAngle(d)) / (2 * Math.PI);
        return percent > labelThreshold ? 1 : 0;
      }

      function alignedRight(d, arc) {
        var circ = Math.PI * 2,
            midArc = ((startAngle(d) + endAngle(d)) / 2 + circ) % circ;
        return midArc > 0 && midArc < Math.PI ? 1 : -1;
      }

      function arcTween(d) {
        if (!donut) {
          d.innerRadius = 0;
        }
        var i = d3.interpolate(this._current, d);
        this._current = i(0);

        return function(t) {
          var iData = i(t);
          return pieArc(iData);
        };
      }

      function tweenPie(b) {
        b.innerRadius = 0;
        var i = d3.interpolate({startAngle: 0, endAngle: 0}, b);
        return function(t) {
          return pieArc(i(t));
        };
      }

    });

    return chart;
  }


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  chart.dispatch = dispatch;

  chart.color = function(_) {
    if (!arguments.length) {
      return color;
    }
    color = _;
    return chart;
  };
  chart.fill = function(_) {
    if (!arguments.length) {
      return fill;
    }
    fill = _;
    return chart;
  };
  chart.classes = function(_) {
    if (!arguments.length) {
      return classes;
    }
    classes = _;
    return chart;
  };
  chart.gradient = function(_) {
    if (!arguments.length) {
      return gradient;
    }
    gradient = _;
    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) {
      return margin;
    }
    margin.top    = typeof _.top    != 'undefined' ? _.top    : margin.top;
    margin.right  = typeof _.right  != 'undefined' ? _.right  : margin.right;
    margin.bottom = typeof _.bottom != 'undefined' ? _.bottom : margin.bottom;
    margin.left   = typeof _.left   != 'undefined' ? _.left   : margin.left;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) {
      return width;
    }
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) {
      return height;
    }
    height = _;
    return chart;
  };

  chart.values = function(_) {
    if (!arguments.length) {
      return getValues;
    }
    getValues = _;
    return chart;
  };

  chart.x = function(_) {
    if (!arguments.length) {
      return getX;
    }
    getX = _;
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) {
      return getY;
    }
    getY = sucrose.functor(_);
    return chart;
  };

  chart.description = function(_) {
    if (!arguments.length) {
      return getDescription;
    }
    getDescription = _;
    return chart;
  };

  chart.showLabels = function(_) {
    if (!arguments.length) {
      return showLabels;
    }
    showLabels = _;
    return chart;
  };

  chart.labelSunbeamLayout = function(_) {
    if (!arguments.length) {
      return labelSunbeamLayout;
    }
    labelSunbeamLayout = _;
    return chart;
  };

  chart.donutLabelsOutside = function(_) {
    if (!arguments.length) {
      return donutLabelsOutside;
    }
    donutLabelsOutside = _;
    return chart;
  };

  chart.pieLabelsOutside = function(_) {
    if (!arguments.length) {
      return pieLabelsOutside;
    }
    pieLabelsOutside = _;
    return chart;
  };

  chart.showLeaders = function(_) {
    if (!arguments.length) {
      return showLeaders;
    }
    showLeaders = _;
    return chart;
  };

  chart.donut = function(_) {
    if (!arguments.length) {
      return donut;
    }
    donut = _;
    return chart;
  };

  chart.hole = function(_) {
    if (!arguments.length) {
      return hole;
    }
    hole = _;
    return chart;
  };

  chart.holeFormat = function(_) {
    if (!arguments.length) {
      return holeFormat;
    }
    holeFormat = sucrose.functor(_);
    return chart;
  };

  chart.donutRatio = function(_) {
    if (!arguments.length) {
      return donutRatio;
    }
    donutRatio = _;
    return chart;
  };

  chart.startAngle = function(_) {
    if (!arguments.length) {
      return startAngle;
    }
    startAngle = _;
    return chart;
  };

  chart.endAngle = function(_) {
    if (!arguments.length) {
      return endAngle;
    }
    endAngle = _;
    return chart;
  };

  chart.id = function(_) {
    if (!arguments.length) {
      return id;
    }
    id = _;
    return chart;
  };

  chart.valueFormat = function(_) {
    if (!arguments.length) {
      return valueFormat;
    }
    valueFormat = _;
    return chart;
  };

  chart.labelFormat = function(_) {
    if (!arguments.length) {
      return labelFormat;
    }
    labelFormat = _;
    return chart;
  };

  chart.labelThreshold = function(_) {
    if (!arguments.length) {
      return labelThreshold;
    }
    labelThreshold = _;
    return chart;
  };

  chart.direction = function(_) {
    if (!arguments.length) {
      return direction;
    }
    direction = _;
    return chart;
  };

  chart.arcDegrees = function(_) {
    if (!arguments.length) {
      return arcDegrees;
    }
    arcDegrees = Math.max(Math.min(_, 360), 1);
    return chart;
  };

  chart.rotateDegrees = function(_) {
    if (!arguments.length) {
      return rotateDegrees;
    }
    rotateDegrees = _ % 360;
    return chart;
  };

  chart.minRadius = function(_) {
    if (!arguments.length) {
      return minRadius;
    }
    minRadius = _;
    return chart;
  };

  chart.maxRadius = function(_) {
    if (!arguments.length) {
      return maxRadius;
    }
    maxRadius = _;
    return chart;
  };

  chart.fixedRadius = function(_) {
    if (!arguments.length) {
      return fixedRadius;
    }
    fixedRadius = sucrose.functor(_);
    return chart;
  };

  chart.textureFill = function(_) {
    if (!arguments.length) return textureFill;
    textureFill = _;
    return chart;
  };

  chart.locality = function(_) {
    if (!arguments.length) {
      return locality;
    }
    locality = sucrose.utils.buildLocality(_);
    return chart;
  };

  //============================================================

  return chart;
}
sucrose.models.pieChart = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 10, right: 10, bottom: 10, left: 10},
      width = null,
      height = null,
      showTitle = false,
      showLegend = true,
      direction = 'ltr',
      tooltip = null,
      durationMs = 0,
      tooltips = true,
      tooltipContent = function(key, x, y, e, graph) {
        return '<h3>' + key + ' - ' + x + '</h3>' +
               '<p>' + y + '</p>';
      },
      state = {},
      strings = {
        legend: {close: 'Hide legend', open: 'Show legend'},
        controls: {close: 'Hide controls', open: 'Show controls'},
        noData: 'No Data Available.',
        noLabel: 'undefined'
      },
      dispatch = d3.dispatch('chartClick', 'elementClick', 'tooltipShow', 'tooltipHide', 'tooltipMove', 'stateChange', 'changeState');

  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var pie = sucrose.models.pie(),
      legend = sucrose.models.legend()
        .align('center');

  var showTooltip = function(eo, offsetElement, properties) {
    var key = eo.point.key,
        x = properties.total ? (pie.y()(eo.point) * 100 / properties.total).toFixed(1) : 100,
        y = pie.y()(eo.point),
        content = tooltipContent(key, x, y, eo, chart);

    tooltip = sucrose.tooltip.show(eo.e, content, null, null, offsetElement);
  };

  var seriesClick = function(data, e, chart) {
    return;
  };

  //============================================================

  function chart(selection) {

    selection.each(function(chartData) {

      var properties = chartData.properties || {},
          data = chartData.data,
          container = d3.select(this),
          that = this,
          availableWidth = (width || parseInt(container.style('width'), 10) || 960) - margin.left - margin.right,
          availableHeight = (height || parseInt(container.style('height'), 10) || 400) - margin.top - margin.bottom,
          total = d3.sum(data.map(function(d) { return d.value; })),
          innerWidth = availableWidth,
          innerHeight = availableHeight,
          innerMargin = {top: 0, right: 0, bottom: 0, left: 0};

      chart.update = function() {
        container.transition().duration(durationMs).call(chart);
      };

      chart.dataSeriesActivate = function(eo) {
        var series = eo.point;

        series.active = (!series.active || series.active === 'inactive') ? 'active' : 'inactive';

        // if you have activated a data series, inactivate the rest
        if (series.active === 'active') {
          data
            .filter(function(d) {
              return d.active !== 'active';
            })
            .map(function(d) {
              d.active = 'inactive';
              return d;
            });
        }

        // if there are no active data series, inactivate them all
        if (!data.filter(function(d) { return d.active === 'active'; }).length) {
          data.map(function(d) {
            d.active = '';
            return d;
          });
        }

        container.call(chart);
      };

      chart.container = this;

      //------------------------------------------------------------
      // Display No Data message if there's nothing to show.
      if (!data || !data.length) {
        displayNoData();
        return chart;
      }

      //------------------------------------------------------------
      // Process data
      //add series index to each data point for reference
      var pieData = data.map(function(d, i) {
            d.series = i;
            if (!d.value && !d.values) {
              d.value = 0;
              d.disabled = true;
            } else {
              d.value = d.value || d3.sum(d.values, function(d) { return d.y || d; });
              d.disabled = d.disabled || d.value === 0;
            }
            return d;
          });

      var totalAmount = d3.sum(
            // only sum enabled series
            pieData
              .filter(function(d, i) {
                return !d.disabled;
              })
              .map(function(d, i) {
                return d.value;
              })
          );

      properties.total = totalAmount;

      //set state.disabled
      state.disabled = pieData.map(function(d) { return !!d.disabled; });

      //------------------------------------------------------------
      // Display No Data message if there's nothing to show.

      if (!totalAmount) {
        displayNoData();
        return chart;
      } else {
        container.selectAll('.sc-noData').remove();
      }

      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap_bind = container.selectAll('.sucrose.sc-wrap').data([pieData]);
      var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-pie-chart');
      var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
      var g_entr = wrap_entr.append('g').attr('class', 'sc-chart-wrap');
      var g = container.select('g.sc-chart-wrap').merge(g_entr);

      g_entr.append('rect').attr('class', 'sc-background')
        .attr('x', -margin.left)
        .attr('y', -margin.top)
        .attr('fill', '#FFF');

      g.select('.sc-background')
        .attr('width', availableWidth + margin.left + margin.right)
        .attr('height', availableHeight + margin.top + margin.bottom);

      g_entr.append('g').attr('class', 'sc-title-wrap');
      var title_wrap = g.select('.sc-title-wrap');
      g_entr.append('g').attr('class', 'sc-pie-wrap');
      var pie_wrap = g.select('.sc-pie-wrap');
      g_entr.append('g').attr('class', 'sc-legend-wrap');
      var legend_wrap = g.select('.sc-legend-wrap');

      wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      //------------------------------------------------------------
      // Title & Legend

      var titleBBox = {width: 0, height: 0};
      title_wrap.select('.sc-title').remove();

      if (showTitle && properties.title) {
        title_wrap
          .append('text')
            .attr('class', 'sc-title')
            .attr('x', direction === 'rtl' ? availableWidth : 0)
            .attr('y', 0)
            .attr('dy', '.75em')
            .attr('text-anchor', 'start')
            .text(properties.title)
            .attr('stroke', 'none')
            .attr('fill', 'black');

        titleBBox = sucrose.utils.getTextBBox(g.select('.sc-title'));

        innerMargin.top += titleBBox.height + 12;
      }

      if (showLegend) {
        legend
          .id('legend_' + chart.id())
          .strings(chart.strings().legend)
          .align('center')
          .height(availableHeight - innerMargin.top);
        legend_wrap
          .datum(pieData)
          .call(legend);
        legend
          .arrange(availableWidth);

        var legendLinkBBox = sucrose.utils.getTextBBox(legend_wrap.select('.sc-legend-link')),
            legendSpace = availableWidth - titleBBox.width - 6,
            legendTop = showTitle && legend.collapsed() && legendSpace > legendLinkBBox.width ? true : false,
            xpos = direction === 'rtl' || !legend.collapsed() ? 0 : availableWidth - legend.width(),
            ypos = titleBBox.height;
        if (legendTop) {
          ypos = titleBBox.height - legend.height() / 2 - legendLinkBBox.height / 2;
        } else if (!showTitle) {
          ypos = - legend.margin().top;
        }

        legend_wrap
          .attr('transform', 'translate(' + xpos + ',' + ypos + ')');

        innerMargin.top += legendTop ? 0 : legend.height() - 12;
      }

      // Recalc inner margins
      innerHeight = availableHeight - innerMargin.top - innerMargin.bottom;
      innerWidth = availableWidth - innerMargin.left - innerMargin.right;

      //------------------------------------------------------------
      // Main Chart Component(s)

      pie
        .width(innerWidth)
        .height(innerHeight);

      pie_wrap
        .datum(pieData.filter(function(d) { return !d.disabled; }))
        .attr('transform', 'translate(' + innerMargin.left + ',' + innerMargin.top + ')')
        .transition().duration(durationMs)
          .call(pie);

      function displayNoData() {
        container.select('.sucrose.sc-wrap').remove();
        var noDataText = container.selectAll('.sc-noData').data([chart.strings().noData]);

        noDataText.enter().append('text')
          .attr('class', 'sucrose sc-noData')
          .attr('dy', '-.7em')
          .style('text-anchor', 'middle');

        noDataText
          .attr('x', margin.left + availableWidth / 2)
          .attr('y', margin.top + availableHeight / 2)
          .text(function(d) {
            return d;
          });
      }

      //============================================================
      // Event Handling/Dispatching (in chart's scope)
      //------------------------------------------------------------

      legend.dispatch.on('legendClick', function(d, i) {
        d.disabled = !d.disabled;
        d.active = false;

        // if there are no enabled data series, enable them all
        if (!data.filter(function(d) { return !d.disabled; }).length) {
          data.map(function(d) {
            d.disabled = false;
            return d;
          });
        }

        // if there are no active data series, activate them all
        if (!data.filter(function(d) { return d.active === 'active'; }).length) {
          data.map(function(d) {
            d.active = '';
            return d;
          });
        }

        state.disabled = data.map(function(d) { return !!d.disabled; });
        dispatch.call('stateChange', this, state);

        container.transition().duration(durationMs).call(chart);
      });

      dispatch.on('tooltipShow', function(eo) {
        if (tooltips) {
          showTooltip(eo, that.parentNode, properties);
        }
      });

      dispatch.on('tooltipMove', function(e) {
        if (tooltip) {
          sucrose.tooltip.position(that.parentNode, tooltip, e);
        }
      });

      dispatch.on('tooltipHide', function() {
        if (tooltips) {
          sucrose.tooltip.cleanup();
        }
      });

      // Update chart from a state object passed to event handler
      dispatch.on('changeState', function(eo) {
        if (typeof eo.disabled !== 'undefined') {
          pieData.forEach(function(series, i) {
            series.disabled = eo.disabled[i];
          });
          state.disabled = eo.disabled;
        }

        container.transition().duration(durationMs).call(chart);
      });

      dispatch.on('chartClick', function() {
        if (legend.enabled()) {
          legend.dispatch.call('closeMenu', this);
        }
      });

      pie.dispatch.on('elementClick', function(eo) {
        dispatch.call('chartClick', this);
        seriesClick(data, eo, chart);
      });

    });

    return chart;
  }

  //============================================================
  // Event Handling/Dispatching (out of chart's scope)
  //------------------------------------------------------------

  pie.dispatch.on('elementMouseover.tooltip', function(eo) {
    dispatch.call('tooltipShow', this, eo);
  });

  pie.dispatch.on('elementMousemove.tooltip', function(e) {
    dispatch.call('tooltipMove', this, e);
  });

  pie.dispatch.on('elementMouseout.tooltip', function() {
    dispatch.call('tooltipHide', this);
  });

  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  // expose chart's sub-components
  chart.dispatch = dispatch;
  chart.pie = pie;
  chart.legend = legend;

  fc.rebind(chart, pie, 'id', 'x', 'y', 'color', 'fill', 'classes', 'gradient', 'locality', 'textureFill');
  fc.rebind(chart, pie, 'valueFormat', 'labelFormat', 'values', 'description', 'showLabels', 'showLeaders', 'donutLabelsOutside', 'pieLabelsOutside', 'labelThreshold');
  fc.rebind(chart, pie, 'arcDegrees', 'rotateDegrees', 'minRadius', 'maxRadius', 'fixedRadius', 'startAngle', 'endAngle', 'donut', 'hole', 'holeFormat', 'donutRatio');

  chart.colorData = function(_) {
    var type = arguments[0],
        params = arguments[1] || {};
    var color = function(d, i) {
          return sucrose.utils.defaultColor()(d, d.series);
        };
    var classes = function(d, i) {
          return 'sc-slice sc-series-' + d.series;
        };

    switch (type) {
      case 'graduated':
        color = function(d, i) {
          return d3.interpolateHsl(d3.rgb(params.c1), d3.rgb(params.c2))(d.series / params.l);
        };
        break;
      case 'class':
        color = function() {
          return 'inherit';
        };
        classes = function(d, i) {
          var iClass = (d.series * (params.step || 1)) % 14;
          iClass = (iClass > 9 ? '' : '0') + iClass;
          return 'sc-slice sc-series-' + d.series + ' sc-fill' + iClass;
        };
        break;
      case 'data':
        color = function(d, i) {
          return d.classes ? 'inherit' : d.color || sucrose.utils.defaultColor()(d, d.series);
        };
        classes = function(d, i) {
          return 'sc-slice sc-series-' + d.series + (d.classes ? ' ' + d.classes : '');
        };
        break;
    }

    var fill = (!params.gradient) ? color : function(d, i) {
      return pie.gradient(d, d.series);
    };

    pie.color(color);
    pie.fill(fill);
    pie.classes(classes);

    legend.color(color);
    legend.classes(classes);

    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) {
      return margin;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        margin[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) {
      return width;
    }
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) {
      return height;
    }
    height = _;
    return chart;
  };

  chart.showTitle = function(_) {
    if (!arguments.length) {
      return showTitle;
    }
    showTitle = _;
    return chart;
  };

  chart.showLegend = function(_) {
    if (!arguments.length) {
      return showLegend;
    }
    showLegend = _;
    return chart;
  };

  chart.tooltip = function(_) {
    if (!arguments.length) {
      return tooltip;
    }
    tooltip = _;
    return chart;
  };

  chart.tooltips = function(_) {
    if (!arguments.length) {
      return tooltips;
    }
    tooltips = _;
    return chart;
  };

  chart.tooltipContent = function(_) {
    if (!arguments.length) {
      return tooltipContent;
    }
    tooltipContent = _;
    return chart;
  };

  chart.state = function(_) {
    if (!arguments.length) {
      return state;
    }
    state = _;
    return chart;
  };

  chart.colorFill = function(_) {
    return chart;
  };

  chart.strings = function(_) {
    if (!arguments.length) {
      return strings;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        strings[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.seriesClick = function(_) {
    if (!arguments.length) {
      return seriesClick;
    }
    seriesClick = _;
    return chart;
  };

  chart.direction = function(_) {
    if (!arguments.length) {
      return direction;
    }
    direction = _;
    pie.direction(_);
    legend.direction(_);
    return chart;
  };

  //============================================================

  return chart;
};
d3.sankey = function() {
    var sankey = {},
    nodeWidth = 24,
        nodePadding = 8,
        size = [1, 1],
        nodes = [],
        links = [];

    sankey.nodeWidth = function(_) {
        if (!arguments.length) return nodeWidth;
        nodeWidth = +_;
        return sankey;
    };

    sankey.nodePadding = function(_) {
        if (!arguments.length) return nodePadding;
        nodePadding = +_;
        return sankey;
    };

    sankey.nodes = function(_) {
        if (!arguments.length) return nodes;
        nodes = _;
        return sankey;
    };

    sankey.links = function(_) {
        if (!arguments.length) return links;
        links = _;
        return sankey;
    };

    sankey.size = function(_) {
        if (!arguments.length) return size;
        size = _;
        return sankey;
    };

    sankey.layout = function(iterations) {
        computeNodeLinks();
        computeNodeValues();
        computeNodeBreadths();
        computeNodeDepths(iterations);
        computeLinkDepths();
        return sankey;
    };

    sankey.relayout = function() {
        computeLinkDepths();
        return sankey;
    };

    sankey.link = function() {
        var curvature = .5;

        function link(d) {
            var x0 = d.source.x + d.source.dx,
                x1 = d.target.x,
                xi = d3.interpolateNumber(x0, x1),
                x2 = xi(curvature),
                x3 = xi(1 - curvature),
                y0 = d.source.y + d.sy + d.dy / 2,
                y1 = d.target.y + d.ty + d.dy / 2;
            return "M" + x0 + "," + y0 + "C" + x2 + "," + y0 + " " + x3 + "," + y1 + " " + x1 + "," + y1;
        }

        link.curvature = function(_) {
            if (!arguments.length) return curvature;
            curvature = +_;
            return link;
        };

        return link;
    };

    // Populate the sourceLinks and targetLinks for each node.
    // Also, if the source and target are not objects, assume they are indices.
    function computeNodeLinks() {
        nodes.forEach(function(node) {
            node.sourceLinks = [];
            node.targetLinks = [];
        });
        links.forEach(function(link) {
            var source = link.source,
                target = link.target;
            if (typeof source === "number") source = link.source = nodes[link.source];
            if (typeof target === "number") target = link.target = nodes[link.target];
            source.sourceLinks.push(link);
            target.targetLinks.push(link);
        });
    }

    // Compute the value (size) of each node by summing the associated links.
    function computeNodeValues() {
        nodes.forEach(function(node) {
            node.value = Math.max(
            d3.sum(node.sourceLinks, value),
            d3.sum(node.targetLinks, value));
        });
    }

    // Iteratively assign the breadth (x-position) for each node.
    // Nodes are assigned the maximum breadth of incoming neighbors plus one;
    // nodes with no incoming links are assigned breadth zero, while
    // nodes with no outgoing links are assigned the maximum breadth.
    function computeNodeBreadths() {
        var remainingNodes = nodes,
            nextNodes,
            x = 0;

        while (remainingNodes.length) {
            nextNodes = [];
            remainingNodes.forEach(function(node) {
                node.x = x;
                node.dx = nodeWidth;
                node.sourceLinks.forEach(function(link) {
                    nextNodes.push(link.target);
                });
            });
            remainingNodes = nextNodes;
            ++x;
        }

        //
        moveSinksRight(x);
        scaleNodeBreadths((size[0] - nodeWidth) / (x - 1));
    }

    function moveSourcesRight() {
        nodes.forEach(function(node) {
            if (!node.targetLinks.length) {
                node.x = d3.min(node.sourceLinks, function(d) {
                    return d.target.x;
                }) - 1;
            }
        });
    }

    function moveSinksRight(x) {
        nodes.forEach(function(node) {
            if (!node.sourceLinks.length) {
                node.x = x - 1;
            }
        });
    }

    function scaleNodeBreadths(kx) {
        nodes.forEach(function(node) {
            node.x *= kx;
        });
    }

    function computeNodeDepths(iterations) {
        var nodesByBreadth = d3.nest()
            .key(function(d) {
                return d.x;
            })
            //.sortKeys(d3.ascending)
            .entries(nodes)
            .map(function(d) {
                return d.values;
            });

        //
        initializeNodeDepth();
        resolveCollisions();
        for (var alpha = 1; iterations > 0; --iterations) {
            relaxRightToLeft(alpha *= .99);
            resolveCollisions();
            // relaxLeftToRight(alpha);
            // resolveCollisions();
        }

        function initializeNodeDepth() {
            var ky = d3.min(nodesByBreadth, function(nodes) {
                return (size[1] - (nodes.length - 1) * nodePadding) / d3.sum(nodes, value);
            });

            nodesByBreadth.forEach(function(nodes) {
                nodes.forEach(function(node, i) {
                    node.y = i;
                    node.dy = node.value * ky;
                });
            });

            links.forEach(function(link) {
                link.dy = link.value * ky;
            });
        }

        function relaxLeftToRight(alpha) {
            nodesByBreadth.forEach(function(nodes, breadth) {
                nodes.forEach(function(node) {
                    if (node.targetLinks.length) {
                        var y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
                        node.y += (y - center(node)) * alpha;
                    }
                });
            });

            function weightedSource(link) {
                return center(link.source) * link.value;
            }
        }

        function relaxRightToLeft(alpha) {
            nodesByBreadth.slice()
                .reverse()
                .forEach(function(nodes) {
                    nodes.forEach(function(node) {
                        if (node.sourceLinks.length) {
                            var y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
                            node.y += (y - center(node)) * alpha;
                        }
                    });
                });

            function weightedTarget(link) {
                return center(link.target) * link.value;
            }
        }

        function resolveCollisions() {
            nodesByBreadth.forEach(function(nodes) {
                var node,
                dy,
                y0 = 0,
                    n = nodes.length,
                    i;

                // Push any overlapping nodes down.
                nodes.sort(ascendingDepth);
                for (i = 0; i < n; ++i) {
                    node = nodes[i];
                    dy = y0 - node.y;
                    if (dy > 0) node.y += dy;
                    y0 = node.y + node.dy + nodePadding;
                }

                // If the bottommost node goes outside the bounds, push it back up.
                dy = y0 - nodePadding - size[1];
                if (dy > 0) {
                    y0 = node.y -= dy;

                    // Push any overlapping nodes back up.
                    for (i = n - 2; i >= 0; --i) {
                        node = nodes[i];
                        dy = node.y + node.dy + nodePadding - y0;
                        if (dy > 0) node.y -= dy;
                        y0 = node.y;
                    }
                }
            });
        }

        function ascendingDepth(a, b) {

            return a.y - b.y;
        }
    }

    function computeLinkDepths() {
        // nodes.forEach(function(node) {
        //     node.sourceLinks.sort(ascendingTargetDepth);
        //     node.targetLinks.sort(ascendingSourceDepth);
        // });
        nodes.forEach(function(node) {
            var sy = 0,
                ty = 0;
            node.sourceLinks.forEach(function(link) {
                link.sy = sy;
                sy += link.dy;
            });
            node.targetLinks.forEach(function(link) {
                link.ty = ty;
                ty += link.dy;
            });
        });

        function ascendingSourceDepth(a, b) {
            return a.source.y - b.source.y;
        }

        function ascendingTargetDepth(a, b) {
            return a.target.y - b.target.y;
        }
    }

    function center(node) {
        return node.y + node.dy / 2;
    }

    function value(link) {
        return link.value;
    }

    return sankey;
};

sucrose.models.stackedArea = function () {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 0, right: 0, bottom: 0, left: 0},
      width = 960,
      height = 500,
      getX = function (d) { return d.x; }, // accessor to get the x value from a data point
      getY = function (d) { return d.y; }, // accessor to get the y value from a data point
      locality = sucrose.utils.buildLocality(),
      style = 'stack',
      offset = 'zero',
      order = 'default',
      interpolate = 'linear',  // controls the line interpolation
      clipEdge = false, // if true, masks lines within x and y scale
      x, //can be accessed via chart.xScale()
      y, //can be accessed via chart.yScale()
      delay = 200,
      scatter = sucrose.models.scatter(),
      color = function (d, i) { return sucrose.utils.defaultColor()(d, d.series); },
      fill = color,
      classes = function (d,i) { return 'sc-area sc-area-' + d.series; },
      dispatch =  d3.dispatch('tooltipShow', 'tooltipHide', 'tooltipMove', 'areaClick', 'areaMouseover', 'areaMouseout', 'areaMousemove');

  scatter
    .size(2.2) // default size
    .sizeDomain([2.2]); // all the same size by default

  /************************************
   * offset:
   *   'wiggle' (stream)
   *   'zero' (stacked)
   *   'expand' (normalize to 100%)
   *   'silhouette' (simple centered)
   *
   * order:
   *   'inside-out' (stream)
   *   'default' (input order)
   ************************************/

  //============================================================


  function chart(selection) {
    selection.each(function (data) {
      var availableWidth = width - margin.left - margin.right,
          availableHeight = height - margin.top - margin.bottom,
          container = d3.select(this);

      //------------------------------------------------------------
      // Setup Scales

      x = scatter.xScale();
      y = scatter.yScale();

      //------------------------------------------------------------


      // Injecting point index into each point because d3.layout.stack().out does not give index
      // ***Also storing getY(d,i) as stackedY so that it can be set to 0 if series is disabled
      data = data.map(function (aseries, i) {
        aseries.values = aseries.values.map(function (d, j) {
          d.index = j;
          d.stackedY = aseries.disabled ? 0 : getY(d, j);
          return d;
        });
        return aseries;
      });


      data = d3.stack()
        .order(order)
        .offset(offset)
        .values(function (d) { return d.values; })  //TODO: make values customizeable in EVERY model in this fashion
        .x(getX)
        .y(function (d) { return d.stackedY; })
        .out(function (d, y0, y) {
          d.display = {
            y: y,
            y0: y0
          };
        })(data);


      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap_bind = container.selectAll('g.sc-wrap.sc-stackedarea').data([data]);
      var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-stackedarea');
      var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
      var defs_entr = wrap_entr.append('defs');
      var g_entr =wrap_entr.append('g').attr('class', 'sc-chart-wrap');
      var g = container.select('g.sc-chart-wrap').merge(g_entr);

      //set up the gradient constructor function
      chart.gradient = function (d, i, p) {
        return sucrose.utils.colorLinearGradient( d, chart.id() + '-' + i, p, color(d, i), wrap.select('defs') );
      };

      g_entr.append('g').attr('class', 'sc-areaWrap');
      g_entr.append('g').attr('class', 'sc-scatterWrap');

      wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      //------------------------------------------------------------

      scatter
        .width(availableWidth)
        .height(availableHeight)
        .x(getX)
        .y(function (d) { return d.display.y + d.display.y0; })
        .forceY([0]);


      var scatterWrap = g.select('.sc-scatterWrap')
          .datum(data.filter(function (d) { return !d.disabled; }));

      //d3.transition(scatterWrap).call(scatter);
      scatterWrap.call(scatter);


      defs_entr.append('clipPath')
          .attr('id', 'sc-edge-clip-' + chart.id())
        .append('rect');

      wrap.select('#sc-edge-clip-' + chart.id() + ' rect')
          .attr('width', availableWidth)
          .attr('height', availableHeight);

      g   .attr('clip-path', clipEdge ? 'url(#sc-edge-clip-' + chart.id() + ')' : '');


      var area = d3.area()
          .x(function (d, i)  { return x(getX(d, i)); })
          .y0(function (d) { return y(d.display.y0); })
          .y1(function (d) { return y(d.display.y + d.display.y0); })
          .interpolate(interpolate);

      var zeroArea = d3.area()
          .x(function (d, i) { return x(getX(d, i)); })
          .y0(function (d) { return y(d.display.y0); })
          .y1(function (d) { return y(d.display.y0); });


      var path = g.select('.sc-areaWrap').selectAll('path.sc-area')
          .data(data);

      path.enter().append('path')
          .on('mouseover', function (d, i) {
            d3.select(this).classed('hover', true);
            dispatch.areaMouseover({
              point: d,
              series: d.key,
              seriesIndex: i,
              e: d3.event
            });
            g.select('.sc-chart-' + chart.id() + ' .sc-area-' + i).classed('hover', true);
          })
          .on('mouseout', function (d, i) {
            d3.select(this).classed('hover', false);
            dispatch.areaMouseout({
              point: d,
              series: d.key,
              seriesIndex: i,
              e: d3.event
            });
            g.select('.sc-chart-' + chart.id() + ' .sc-area-' + i).classed('hover', false);
          })
          .on('mousemove', function (d, i) {
            dispatch.areaMousemove(d3.event);
          })
          .on('click', function (d, i) {
            d3.select(this).classed('hover', false);
            dispatch.areaClick({
              point: d,
              series: d.key,
              seriesIndex: i,
              e: d3.event
            });
          });
      //d3.transition(path.exit())
      path.exit()
          .attr('d', function (d, i) { return zeroArea(d.values, i); })
          .remove();
      path
          .attr('class', classes)
          .attr('fill', color)
          .attr('stroke', color);
      //d3.transition(path)
      path
          .attr('d', function (d, i) { return area(d.values, i); });


      //============================================================
      // Event Handling/Dispatching (in chart's scope)
      //------------------------------------------------------------

      scatter.dispatch.on('elementMouseover.area', function (e) {
        g.select('.sc-chart-' + chart.id() + ' .sc-area-' + e.seriesIndex).classed('hover', true);
      });
      scatter.dispatch.on('elementMouseout.area', function (e) {
        g.select('.sc-chart-' + chart.id() + ' .sc-area-' + e.seriesIndex).classed('hover', false);
      });
      scatter.dispatch.on('elementClick.area', function (e) {
        dispatch.areaClick(e);
      });

      //============================================================

    });

    return chart;
  }


  //============================================================
  // Event Handling/Dispatching (out of chart's scope)
  //------------------------------------------------------------

  scatter.dispatch.on('elementMouseover.tooltip', function (e) {
    e.pos = [e.pos[0] + margin.left, e.pos[1] + margin.top];
    dispatch.call('tooltipShow', this, e);
  });
  scatter.dispatch.on('elementMouseout.tooltip', function (e) {
    dispatch.call('tooltipHide', this);
  });

  //============================================================


  //============================================================
  // Global getters and setters
  //------------------------------------------------------------

  chart.dispatch = dispatch;
  chart.scatter = scatter;

  fc.rebind(chart, scatter, 'interactive', 'size', 'id', 'xScale', 'yScale', 'zScale', 'xDomain', 'yDomain', 'sizeDomain', 'forceX', 'forceY', 'forceSize', 'clipVoronoi', 'useVoronoi', 'clipRadius', 'locality');

  chart.color = function (_) {
    if (!arguments.length) { return color; }
    color = _;
    scatter.color(color);
    return chart;
  };
  chart.fill = function (_) {
    if (!arguments.length) { return fill; }
    fill = _;
    scatter.fill(fill);
    return chart;
  };
  chart.classes = function (_) {
    if (!arguments.length) { return classes; }
    classes = _;
    scatter.classes(classes);
    return chart;
  };
  chart.gradient = function (_) {
    if (!arguments.length) { return gradient; }
    gradient = _;
    return chart;
  };

  chart.margin = function (_) {
    if (!arguments.length) { return margin; }
    margin.top    = typeof _.top    != 'undefined' ? _.top    : margin.top;
    margin.right  = typeof _.right  != 'undefined' ? _.right  : margin.right;
    margin.bottom = typeof _.bottom != 'undefined' ? _.bottom : margin.bottom;
    margin.left   = typeof _.left   != 'undefined' ? _.left   : margin.left;
    return chart;
  };

  chart.width = function (_) {
    if (!arguments.length) { return width; }
    width = _;
    return chart;
  };

  chart.height = function (_) {
    if (!arguments.length) { return height; }
    height = _;
    return chart;
  };

  chart.x = function (_) {
    if (!arguments.length) { return getX; }
    getX = _;
    scatter.x(_);
    return chart;
  };

  chart.y = function (_) {
    if (!arguments.length) { return getY; }
    getY = _;
    scatter.y(_);
    return chart;
  };

  chart.delay = function (_) {
    if (!arguments.length) { return delay; }
    delay = _;
    return chart;
  };

  chart.clipEdge = function (_) {
    if (!arguments.length) { return clipEdge; }
    clipEdge = _;
    return chart;
  };

  chart.offset = function (_) {
    if (!arguments.length) { return offset; }
    offset = _;
    return chart;
  };

  chart.order = function (_) {
    if (!arguments.length) { return order; }
    order = _;
    return chart;
  };

  //shortcut for offset + order
  chart.style = function (_) {
    if (!arguments.length) { return style; }
    style = _;

    switch (style) {
      case 'stack':
        chart.offset('zero');
        chart.order('default');
        break;
      case 'stream':
        chart.offset('wiggle');
        chart.order('inside-out');
        break;
      case 'stream-center':
          chart.offset('silhouette');
          chart.order('inside-out');
          break;
      case 'expand':
        chart.offset('expand');
        chart.order('default');
        break;
    }

    return chart;
  };

  chart.interpolate = function (_) {
    if (!arguments.length) { return interpolate; }
    interpolate = _;
    return interpolate;
  };

  chart.locality = function(_) {
    if (!arguments.length) {
      return locality;
    }
    locality = sucrose.utils.buildLocality(_);
    return chart;
  };

  //============================================================

  return chart;
};
sucrose.models.stackedAreaChart = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 10, right: 10, bottom: 10, left: 10},
      width = null,
      height = null,
      showTitle = false,
      showControls = false,
      showLegend = true,
      direction = 'ltr',
      tooltip = null,
      tooltips = true,
      x,
      y,
      state = {},
      strings = {
        legend: {close: 'Hide legend', open: 'Show legend'},
        controls: {close: 'Hide controls', open: 'Show controls'},
        noData: 'No Data Available.',
        noLabel: 'undefined'
      },
      dispatch = d3.dispatch('chartClick', 'tooltipShow', 'tooltipHide', 'tooltipMove', 'stateChange', 'changeState');

  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var xValueFormat = function(d, labels, isDate) {
          var val = isNaN(parseInt(d, 10)) || !labels || !Array.isArray(labels) ?
            d : labels[parseInt(d, 10)] || d;
          return isDate ? sucrose.utils.dateFormat(val, 'yMMMM', chart.locality()) : val;
        };
  var yValueFormat = function(d, isCurrency) {
          return stacked.offset() === 'expand' ? d3.format('%')(d) : sucrose.utils.numberFormatSI(d, 2, isCurrency, chart.locality());
        };

  var stacked = sucrose.models.stackedArea()
        .clipEdge(true),
      xAxis = sucrose.models.axis(),
      yAxis = sucrose.models.axis(),
      legend = sucrose.models.legend()
        .align('right'),
      controls = sucrose.models.legend()
        .align('left')
        .color(['#444']);

  var tooltipContent = function (key, eo, graph) {
    return '<h3>' + key + '</h3>';
  };

  stacked.scatter
    .pointActive(function (d) {
      return !!Math.round(stacked.y()(d) * 100);
    });

  var showTooltip = function(eo, offsetElement) {
    var content = tooltipContent(eo.series, eo, chart);

    tooltip = sucrose.tooltip.show(eo.e, content, null, null, offsetElement);
  };

  //============================================================

  function chart(selection) {

    selection.each(function (chartData) {

      var that = this,
          container = d3.select(this);

      var properties = chartData ? chartData.properties : {},
          data = chartData ? chartData.data : null,
          labels = properties.labels ? properties.labels.map(function(d) { return d.l || d; }) : [];

      var lineData = [],
          xTickLabels = [],
          totalAmount = 0,
          singlePoint = false,
          showMaxMin = false,
          isArrayData = true,
          xIsDatetime = chartData.properties.xDataType === 'datetime' || false,
          yIsCurrency = chartData.properties.yDataType === 'currency' || false;

      chart.container = this;

      chart.update = function () {
        container.transition().duration(chart.delay()).call(chart);
      };

      //------------------------------------------------------------
      // Private method for displaying no data message.

      function displayNoData(d) {
        if (d && d.length && d.filter(function(d) { return d.values.length; }).length) {
          container.selectAll('.sc-noData').remove();
          return false;
        }

        container.select('.sucrose.sc-wrap').remove();

        var w = width || parseInt(container.style('width'), 10) || 960,
            h = height || parseInt(container.style('height'), 10) || 400,
            noDataText = container.selectAll('.sc-noData').data([chart.strings().noData]);

        noDataText.enter().append('text')
          .attr('class', 'sucrose sc-noData')
          .attr('dy', '-.7em')
          .style('text-anchor', 'middle');

        noDataText
          .attr('x', margin.left + w / 2)
          .attr('y', margin.top + h / 2)
          .text(function(d) {
            return d;
          });

        return true;
      }

      // Check to see if there's nothing to show.
      if (displayNoData(data)) {
        return chart;
      }

      //------------------------------------------------------------
      // Process data

      isArrayData = Array.isArray(data[0].values[0]);
      if (isArrayData) {
        stacked.x(function(d) { return d[0]; });
        stacked.y(function(d) { return d[1]; });
      } else {
        stacked.x(function(d) { return d.x; });
        stacked.y(function(d) { return d.y; });
      }

      // set title display option
      showTitle = showTitle && properties.title;

      // add series index to each data point for reference
      // and disable data series if total is zero
      data.map(function (d, i) {
        d.series = i;
        d.total = d3.sum(d.values, function(d, i) {
          return stacked.y()(d, i);
        });
        if (!d.total) {
          d.disabled = true;
        }
      });

      xTickLabels = properties.labels ?
          properties.labels.map(function(d) { return [].concat(d.l)[0] || chart.strings().noLabel; }) :
          [];

      // TODO: what if the dimension is a numerical range?
      // xValuesAreDates = xTickLabels.length ?
      //       sucrose.utils.isValidDate(xTickLabels[0]) :
      //       sucrose.utils.isValidDate(stacked.x()(data[0].values[0]));
      // xValuesAreDates = isArrayData && sucrose.utils.isValidDate(data[0].values[0][0]);

      // SAVE FOR LATER
      // isOrdinalSeries = !xValuesAreDates && labels.length > 0 && d3.min(lineData, function(d) {
      //   return d3.min(d.values, function(d, i) {
      //     return stacked.x()(d, i);
      //   });
      // }) > 0;

      lineData = data.filter(function (d) {
          return !d.disabled;
        });

      // safety array
      lineData = lineData.length ? lineData : [{series: 0, total: 0, disabled: true, values: []}];

      totalAmount = d3.sum(lineData, function(d) {
          return d.total;
        });

      //------------------------------------------------------------
      // Display No Data message if there's nothing to show.

      if (!totalAmount) {
        displayNoData();
        return chart;
      }

      // set state.disabled
      state.disabled = lineData.map(function (d) { return !!d.disabled; });
      state.style = stacked.style();

      var controlsData = [
        { key: 'Stacked', disabled: stacked.offset() !== 'zero' },
        { key: 'Stream', disabled: stacked.offset() !== 'wiggle' },
        { key: 'Expanded', disabled: stacked.offset() !== 'expand' }
      ];

      //------------------------------------------------------------
      // Setup Scales

      x = stacked.xScale();
      y = stacked.yScale();

      xAxis
        .orient('bottom')
        .valueFormat(xValueFormat)
        .tickPadding(4)
        .highlightZero(false)
        .showMaxMin(false)
        .scale(x);
      yAxis
        .orient('left')
        .valueFormat(yValueFormat)
        .tickPadding(4)
        .scale(y);

      //------------------------------------------------------------
      // Main chart draw

      chart.render = function() {

        // Chart layout variables
        var renderWidth = width || parseInt(container.style('width'), 10) || 960,
            renderHeight = height || parseInt(container.style('height'), 10) || 400,
            availableWidth = renderWidth - margin.left - margin.right,
            availableHeight = renderHeight - margin.top - margin.bottom,
            innerWidth = availableWidth,
            innerHeight = availableHeight,
            innerMargin = {top: 0, right: 0, bottom: 0, left: 0};

        // Header variables
        var maxControlsWidth = 0,
            maxLegendWidth = 0,
            widthRatio = 0,
            headerHeight = 0,
            titleBBox = {width: 0, height: 0},
            controlsHeight = 0,
            legendHeight = 0,
            trans = '';

        var wrap_bind = container.selectAll('g.sc-wrap.sc-stackedAreaChart').data([data]);
        var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-stackedAreaChart');
        var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
        var g_entr = wrap_entr.append('g').attr('class', 'sc-chart-wrap');
        var g = container.select('g.sc-chart-wrap').merge(g_entr);

        g_entr.append('rect').attr('class', 'sc-background')
          .attr('x', -margin.left)
          .attr('y', -margin.top)
          .attr('fill', '#FFF');

        g.select('.sc-background')
          .attr('width', availableWidth + margin.left + margin.right)
          .attr('height', availableHeight + margin.top + margin.bottom);

        g_entr.append('g').attr('class', 'sc-titleWrap');
        var titleWrap = g.select('.sc-titleWrap');
        g_entr.append('g').attr('class', 'sc-x sc-axis');
        var xAxisWrap = g.select('.sc-x.sc-axis');
        g_entr.append('g').attr('class', 'sc-y sc-axis');
        var yAxisWrap = g.select('.sc-y.sc-axis');
        g_entr.append('g').attr('class', 'sc-stackedWrap');
        var stackedWrap = g.select('.sc-stackedWrap');
        g_entr.append('g').attr('class', 'sc-controlsWrap');
        var controlsWrap = g.select('.sc-controlsWrap');
        g_entr.append('g').attr('class', 'sc-legendWrap');
        var legendWrap = g.select('.sc-legendWrap');

        wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        //------------------------------------------------------------
        // Title & Legend & Controls

        titleWrap.select('.sc-title').remove();

        if (showTitle) {
          titleWrap
            .append('text')
              .attr('class', 'sc-title')
              .attr('x', direction === 'rtl' ? availableWidth : 0)
              .attr('y', 0)
              .attr('dy', '.75em')
              .attr('text-anchor', 'start')
              .text(properties.title)
              .attr('stroke', 'none')
              .attr('fill', 'black');

          titleBBox = sucrose.utils.getTextBBox(g.select('.sc-title'));
          headerHeight += titleBBox.height;
        }

        if (showControls) {
          controls
            .id('controls_' + chart.id())
            .strings(chart.strings().controls)
            .align('left')
            .height(availableHeight - headerHeight);
          controlsWrap
            .datum(controlsData)
            .call(controls);

          maxControlsWidth = controls.calculateWidth();
        }

        if (showLegend) {
          legend
            .id('legend_' + chart.id())
            .strings(chart.strings().legend)
            .align('right')
            .height(availableHeight - headerHeight);
          legendWrap
            .datum(data)
            .call(legend);

          maxLegendWidth = legend.calculateWidth();
        }

        // calculate proportional available space
        widthRatio = availableWidth / (maxControlsWidth + maxLegendWidth);
        maxControlsWidth = Math.floor(maxControlsWidth * widthRatio);
        maxLegendWidth = Math.floor(maxLegendWidth * widthRatio);

        if (showControls) {
          controls
            .arrange(maxControlsWidth);
          maxLegendWidth = availableWidth - controls.width();
        }
        if (showLegend) {
          legend
            .arrange(maxLegendWidth);
          maxControlsWidth = availableWidth - legend.width();
        }

        if (showControls) {
          var xpos = direction === 'rtl' ? availableWidth - controls.width() : 0,
              ypos = showTitle ? titleBBox.height : - legend.margin().top;
          controlsWrap
            .attr('transform', 'translate(' + xpos + ',' + ypos + ')');
          controlsHeight = controls.height();
        }

        if (showLegend) {
          var legendLinkBBox = sucrose.utils.getTextBBox(legendWrap.select('.sc-legend-link')),
              legendSpace = availableWidth - titleBBox.width - 6,
              legendTop = showTitle && !showControls && legend.collapsed() && legendSpace > legendLinkBBox.width ? true : false,
              xpos = direction === 'rtl' ? 0 : availableWidth - legend.width(),
              ypos = titleBBox.height;
          if (legendTop) {
            ypos = titleBBox.height - legend.height() / 2 - legendLinkBBox.height / 2;
          } else if (!showTitle) {
            ypos = - legend.margin().top;
          }
          legendWrap
            .attr('transform', 'translate(' + xpos + ',' + ypos + ')');
          legendHeight = legendTop ? 12 : legend.height();
        }

        // Recalc inner margins based on legend and control height
        headerHeight += Math.max(controlsHeight, legendHeight);
        innerHeight = availableHeight - headerHeight - innerMargin.top - innerMargin.bottom;

        //------------------------------------------------------------
        // Main Chart Component(s)

        stacked
          .width(innerWidth)
          .height(innerHeight)
          .id(chart.id());
        stackedWrap
          .datum(lineData)
          .call(stacked);


        //------------------------------------------------------------
        // Setup Axes

        var yAxisMargin = {top: 0, right: 0, bottom: 0, left: 0},
            xAxisMargin = {top: 0, right: 0, bottom: 0, left: 0};

        function setInnerMargins() {
          innerMargin.left = Math.max(xAxisMargin.left, yAxisMargin.left);
          innerMargin.right = Math.max(xAxisMargin.right, yAxisMargin.right);
          innerMargin.top = Math.max(xAxisMargin.top, yAxisMargin.top);
          innerMargin.bottom = Math.max(xAxisMargin.bottom, yAxisMargin.bottom);
        }

        function setInnerDimensions() {
          innerWidth = availableWidth - innerMargin.left - innerMargin.right;
          innerHeight = availableHeight - headerHeight - innerMargin.top - innerMargin.bottom;
          // Recalc chart dimensions and scales based on new inner dimensions
          stacked.width(innerWidth).height(innerHeight);
          stacked.scatter.resetDimensions(innerWidth, innerHeight);
        }

        // Y-Axis
        yAxis
          .margin(innerMargin)
          .tickFormat(function(d, i) {
            return yAxis.valueFormat()(d, yIsCurrency);
          });
        yAxisWrap
          .call(yAxis);
        // reset inner dimensions
        yAxisMargin = yAxis.margin();
        setInnerMargins();
        setInnerDimensions();

        // X-Axis
        trans = innerMargin.left + ',';
        trans += innerMargin.top + (xAxis.orient() === 'bottom' ? innerHeight : 0);
        xAxisWrap
          .attr('transform', 'translate(' + trans + ')');
        // resize ticks based on new dimensions
        xAxis
          .tickSize(-innerHeight, 0)
          .margin(innerMargin)
          .tickFormat(function(d, i, noEllipsis) {
            return xAxis.valueFormat()(d - !isArrayData, xTickLabels, xIsDatetime);
          });

        xAxisWrap
          .call(xAxis);
        xAxisMargin = xAxis.margin();
        setInnerMargins();
        setInnerDimensions();
        xAxis
          .resizeTickLines(-innerHeight);

        // recall y-axis to set final size based on new dimensions
        yAxis
          .tickSize(-innerWidth, 0)
          .margin(innerMargin);
        yAxisWrap
          .call(yAxis);

        // final call to stacked based on new dimensions
        stackedWrap
          .transition().duration(chart.delay())
            .call(stacked);

        //------------------------------------------------------------
        // Final repositioning

        innerMargin.top += headerHeight;

        trans = innerMargin.left + ',';
        trans += innerMargin.top + (xAxis.orient() === 'bottom' ? innerHeight : 0);
        xAxisWrap
          .attr('transform', 'translate(' + trans + ')');

        trans = innerMargin.left + (yAxis.orient() === 'left' ? 0 : innerWidth) + ',';
        trans += innerMargin.top;
        yAxisWrap
          .attr('transform', 'translate(' + trans + ')');

        stackedWrap
          .attr('transform', 'translate(' + innerMargin.left + ',' + innerMargin.top + ')');

      };

      //============================================================

      chart.render();

      //============================================================
      // Event Handling/Dispatching (in chart's scope)
      //------------------------------------------------------------

      stacked.dispatch.on('areaClick.toggle', function (e) {
        if (data.filter(function (d) { return !d.disabled; }).length === 1) {
          data = data.map(function (d) {
            d.disabled = false;
            return d;
          });
        } else {
          data = data.map(function (d,i) {
            d.disabled = (i !== e.seriesIndex);
            return d;
          });
        }

        state.disabled = data.map(function (d) { return !!d.disabled; });
        dispatch.call('stateChange', this, state);

        container.transition().duration(chart.delay()).call(chart);
      });

      legend.dispatch.on('legendClick', function (d, i) {
        d.disabled = !d.disabled;

        if (!data.filter(function (d) { return !d.disabled; }).length) {
          data.map(function (d) {
            d.disabled = false;
            container.selectAll('.sc-series').classed('disabled', false);
            return d;
          });
        }

        state.disabled = data.map(function (d) { return !!d.disabled; });
        dispatch.call('stateChange', this, state);

        container.transition().duration(chart.delay()).call(chart);
      });

      controls.dispatch.on('legendClick', function (d, i) {

        //if the option is currently enabled (i.e., selected)
        if (!d.disabled) {
          return;
        }

        //set the controls all to false
        controlsData = controlsData.map(function (s) {
          s.disabled = true;
          return s;
        });
        //activate the the selected control option
        d.disabled = false;

        switch (d.key) {
          case 'Stacked':
            stacked.style('stack');
            break;
          case 'Stream':
            stacked.style('stream');
            break;
          case 'Expanded':
            stacked.style('expand');
            break;
        }

        state.style = stacked.style();
        dispatch.call('stateChange', this, state);

        container.transition().duration(chart.delay()).call(chart);
      });

      dispatch.on('tooltipShow', function(eo) {
        if (tooltips) {
          showTooltip(eo, that.parentNode);
        }
      });

      dispatch.on('tooltipMove', function(e) {
        if (tooltip) {
          sucrose.tooltip.position(that.parentNode, tooltip, e, 's');
        }
      });

      dispatch.on('tooltipHide', function() {
        if (tooltips) {
          sucrose.tooltip.cleanup();
        }
      });

      // Update chart from a state object passed to event handler
      dispatch.on('changeState', function(eo) {
        if (typeof eo.disabled !== 'undefined') {
          data.forEach(function(series, i) {
            series.disabled = eo.disabled[i];
          });
          state.disabled = eo.disabled;
        }

        if (typeof eo.style !== 'undefined') {
          stacked.style(eo.style);
          state.style = eo.style;
        }

        container.transition().duration(chart.delay()).call(chart);
      });

      dispatch.on('chartClick', function() {
        if (controls.enabled()) {
          controls.dispatch.call('closeMenu', this);
        }
        if (legend.enabled()) {
          legend.dispatch.call('closeMenu', this);
        }
      });

    });

    return chart;
  }

  //============================================================
  // Event Handling/Dispatching (out of chart's scope)
  //------------------------------------------------------------

  stacked.dispatch.on('areaMouseover.tooltip', function(eo) {
    dispatch.call('tooltipShow', this, eo);
  });

  stacked.dispatch.on('areaMousemove.tooltip', function(e) {
    dispatch.call('tooltipMove', this, e);
  });

  stacked.dispatch.on('areaMouseout.tooltip', function() {
    dispatch.call('tooltipHide', this);
  });

  stacked.dispatch.on('tooltipShow', function(eo) {
    dispatch.call('tooltipShow', this, eo);
  });

  stacked.dispatch.on('tooltipHide', function() {
    dispatch.call('tooltipHide', this);
  });


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  // expose chart's sub-components
  chart.dispatch = dispatch;
  chart.stacked = stacked;
  chart.legend = legend;
  chart.controls = controls;
  chart.xAxis = xAxis;
  chart.yAxis = yAxis;

  fc.rebind(chart, stacked, 'id', 'x', 'y', 'xScale', 'yScale', 'xDomain', 'yDomain', 'forceX', 'forceY', 'clipEdge', 'delay', 'color', 'fill', 'classes', 'gradient', 'locality');
  fc.rebind(chart, stacked, 'size', 'sizeDomain', 'forceSize', 'offset', 'order', 'style', 'interactive', 'useVoronoi', 'clipVoronoi');
  fc.rebind(chart, xAxis, 'rotateTicks', 'reduceXTicks', 'staggerTicks', 'wrapTicks');

  chart.colorData = function(_) {
    var type = arguments[0],
        params = arguments[1] || {};
    var color = function(d, i) {
          return sucrose.utils.defaultColor()(d, d.series);
        };
    var classes = function(d, i) {
          return 'sc-area sc-area-' + d.series;
        };

    switch (type) {
      case 'graduated':
        color = function(d, i) {
          return d3.interpolateHsl(d3.rgb(params.c1), d3.rgb(params.c2))(d.series / params.l);
        };
        break;
      case 'class':
        color = function() {
          return 'inherit';
        };
        classes = function(d, i) {
          var iClass = (d.series * (params.step || 1)) % 14;
          iClass = (iClass > 9 ? '' : '0') + iClass;
          return 'sc-area sc-area-' + d.series + ' sc-fill' + iClass + ' sc-stroke' + iClass;
        };
        break;
      case 'data':
        color = function(d, i) {
          return d.color || sucrose.utils.defaultColor()(d, d.series);
        };
        classes = function(d, i) {
          return 'sc-area sc-area-' + d.series + (d.classes ? ' ' + d.classes : '');
        };
        break;
    }

    var fill = (!params.gradient) ? color : function(d, i) {
      var p = {orientation: params.orientation || 'horizontal', position: params.position || 'base'};
      return stacked.gradient(d, d.series, p);
    };

    stacked.color(color);
    stacked.fill(fill);
    stacked.classes(classes);

    legend.color(color);
    legend.classes(classes);

    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) {
      return margin;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        margin[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) {
      return width;
    }
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) {
      return height;
    }
    height = _;
    return chart;
  };

  chart.showTitle = function(_) {
    if (!arguments.length) {
      return showTitle;
    }
    showTitle = _;
    return chart;
  };

  chart.showControls = function(_) {
    if (!arguments.length) {
      return showControls;
    }
    showControls = _;
    return chart;
  };

  chart.showLegend = function(_) {
    if (!arguments.length) {
      return showLegend;
    }
    showLegend = _;
    return chart;
  };

  chart.tooltip = function(_) {
    if (!arguments.length) {
      return tooltip;
    }
    tooltip = _;
    return chart;
  };

  chart.tooltips = function(_) {
    if (!arguments.length) {
      return tooltips;
    }
    tooltips = _;
    return chart;
  };

  chart.tooltipContent = function(_) {
    if (!arguments.length) {
      return tooltipContent;
    }
    tooltipContent = _;
    return chart;
  };

  chart.state = function(_) {
    if (!arguments.length) {
      return state;
    }
    state = _;
    return chart;
  };

  chart.strings = function(_) {
    if (!arguments.length) {
      return strings;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        strings[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.direction = function(_) {
    if (!arguments.length) {
      return direction;
    }
    direction = _;
    yAxis.direction(_);
    xAxis.direction(_);
    legend.direction(_);
    controls.direction(_);
    return chart;
  };

  //============================================================

  return chart;
};

sucrose.models.table = function () {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 2, right: 0, bottom: 2, left: 0},
      width = 0,
      height = 0,
      animate = true,
      getX = function (d) { return d.x; },
      getY = function (d) { return d.y; },
      strings = {
        legend: {close: 'Hide legend', open: 'Show legend'},
        controls: {close: 'Hide controls', open: 'Show controls'},
        noData: 'No Data Available.'
      },
      color = sucrose.utils.getColor(['#000']);

  //============================================================


  function chart(selection) {
    selection.each(function (chartData) {
      var container = d3.select(this);

      //------------------------------------------------------------

      var properties = chartData ? chartData.properties : {},
          data = (chartData && chartData.data) ? chartData.data.map(function (d, i) {
            return {
              'key': d.key || 'Undefined',
              'type': d.type || null,
              'disabled': d.disabled || false,
              'series': d.series || i,
              'values': d._values || d.values
            };
          }) : null;

      var labels = properties.labels ||
            d3.range(
              1,
              d3.max(data.map(function (d) { return d.values.length; })) + 1
            )
            .map(function (d) {
              return {'group': d, 'l': 'Group ' + d};
            });

      var singleSeries = d3.max(data.map(function (d) {
            return d.values.length;
          })) === 1;

      function displayNoData(d) {
        if (d && d.length && d.filter(function (d) { return d.values.length; }).length) {
          container.selectAll('.sc-noData').remove();
          return false;
        }

        container.select('.sucrose').remove();
        var parentDimensions = container.node().parentNode.getBoundingClientRect();
        var w = width || parseInt(parentDimensions.width, 10) || 960,
            h = height || parseInt(parentDimensions.height, 10) || 400,
            noDataText = container.selectAll('.sc-noData').data([chart.strings().noData]);

        noDataText.enter().append('div')
          .attr('class', 'sucrose sc-noData')
          .style({'text-align': 'center', 'position': 'absolute', 'top': (h / 2) + 'px', 'width': w + 'px'})
          .text(function (d) {
            return d;
          });

        return true;
      }

      // Check to see if there's nothing to show.
      if (displayNoData(data)) {
        return chart;
      }
      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap_bind = container.selectAll('table').data([data]);
      var tableEnter = wrap.enter().append('table').attr('class', 'sucrose');

      //------------------------------------------------------------

      var theadEnter = tableEnter
            .append('thead').attr('class', 'sc-thead')
              .append('tr').attr('class', 'sc-groups');
      var thead = wrap.select('.sc-groups');
          theadEnter
            .append('th').attr('class', 'sc-th sc-series-state')
            .text('Enabled');
          theadEnter
            .append('th').attr('class', 'sc-th sc-series-keys')
            .text(properties.key || 'Series Key');

      var cols = thead.selectAll('.sc-group')
            .data(labels);
          cols.exit().remove();
          cols.enter()
            .append('th').attr('class', 'sc-th sc-group');
          thead.selectAll('.sc-group')
            .text(function (d) { return singleSeries ? 'Series Total' : d.l; });

        if (!singleSeries) {
          theadEnter
            .append('th').attr('class', 'sc-th sc-series-totals')
            .text('Series Total');
        }

      //------------------------------------------------------------

      var tfootEnter = tableEnter
            .append('tfoot').attr('class', 'sc-tfoot')
              .append('tr').attr('class', 'sc-sums');
      var tfoot = wrap.select('.sc-sums');
          tfootEnter
            .append('th').attr('class', 'sc-th sc-group-sums')
              .text('');
          tfootEnter
            .append('th').attr('class', 'sc-th sc-group-sums')
              .text(singleSeries ? 'Sum' : 'Group Sums');

      var sums = tfoot.selectAll('.sc-sum')
            .data(function (d) {
              return d
                .filter(function (f) {
                  return !f.disabled;
                })
                .map(function (a) {
                  return a.values.map(function (b) { return getY(b); });
                })
                .reduce(function (p, c) {
                  return p.map(function (d, i) {
                    return d + c[i];
                  });
                });
              });
          sums.exit().remove();
          sums.enter()
            .append('th').attr('class', 'sc-sum');
          tfoot.selectAll('.sc-sum')
            .text(function (d) { return d; });

        if (!singleSeries) {
          tfootEnter
            .append('th').attr('class', 'sc-th sc-sum-total');
          tfoot.select('.sc-sum-total')
            .text(function (d) {
              return d
                .filter(function (f) {
                  return !f.disabled;
                })
                .map(function (a) {
                  return a.values
                    .map(function (b) { return getY(b); })
                    .reduce(function (p, c) {
                      return p + c;
                    });
                })
                .reduce(function (p, c) {
                  return p + c;
                });
            });
        }

      //------------------------------------------------------------

          tableEnter
            .append('tbody').attr('class', 'sc-tbody');
      var tbody = wrap.select('.sc-tbody');

      var rows = tbody.selectAll('.sc-series')
            .data(function (d) { return d; });
          rows.exit().remove();
      var rowsEnter = rows.enter()
            .append('tr').attr('class', 'sc-series');
          rowsEnter
            .append('td').attr('class', 'sc-td sc-state')
            .attr('tabindex', -1)
            .attr('data-editable', false)
            .append('input')
              .attr('type', 'checkbox');
          rowsEnter
            .append('td').attr('class', 'sc-td sc-key');

      var series = tbody.selectAll('.sc-series')
            .style('color', function (d) { return d.disabled ? '#ddd' : '#000'; })
            .style('text-decoration', function (d) { return d.disabled ? 'line-through' : 'inherit'; });
          series.select('.sc-state input')
            .property('checked', function (d) { return d.disabled ? false : true; });
          series.select('.sc-key')
            .text(function (d) { return d.key; });

      var cells = series.selectAll('.sc-val')
            .data(function (d, i) {
              return d.values.map(function (g, j) {
                  var val = Array.isArray(g) ?
                    {
                      0: g[0],
                      1: g[1]
                    } :
                    {
                      x: g.x,
                      y: g.y
                    };
                  val.series = i;
                  val.index = j;
                  return val;
                });
            });
          cells.exit().remove();
          cells.enter()
            .append('td').attr('class', 'sc-td sc-val');
          tbody.selectAll('.sc-val')
            .text(function (d) {
              return getY(d);
            });

        if (!singleSeries) {
          rowsEnter
            .append('td').attr('class', 'sc-td sc-total')
              .attr('tabindex', -1)
              .attr('data-editable', false);
          series.select('.sc-total')
            .text(function (d) {
              return d.values
                .map(function (d) { return getY(d); })
                .reduce(function (p, c) {
                  return p + c;
                });
            });
        }

    });

    return chart;
  }


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  chart.margin = function (_) {
    if (!arguments.length) return margin;
    margin.top    = typeof _.top    != 'undefined' ? _.top    : margin.top;
    margin.right  = typeof _.right  != 'undefined' ? _.right  : margin.right;
    margin.bottom = typeof _.bottom != 'undefined' ? _.bottom : margin.bottom;
    margin.left   = typeof _.left   != 'undefined' ? _.left   : margin.left;
    return chart;
  };

  chart.width = function (_) {
    if (!arguments.length) return width;
    width = _;
    return chart;
  };

  chart.height = function (_) {
    if (!arguments.length) return height;
    height = _;
    return chart;
  };

  chart.x = function (_) {
    if (!arguments.length) return getX;
    getX = sucrose.functor(_);
    return chart;
  };

  chart.y = function (_) {
    if (!arguments.length) return getY;
    getY = sucrose.functor(_);
    return chart;
  };

  chart.strings = function (_) {
    if (!arguments.length) {
      return strings;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        strings[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.color = function (_) {
    if (!arguments.length) return color;
    color = sucrose.utils.getColor(_);
    return chart;
  };

  //============================================================


  return chart;
}

sucrose.models.tree = function() {

  // issues: 1. zoom slider doesn't zoom on chart center
  // orientation
  // bottom circles

  // all hail, stepheneb
  // https://gist.github.com/1182434
  // http://mbostock.github.com/d3/talk/20111018/tree.html
  // https://groups.google.com/forum/#!topic/d3-js/-qUd_jcyGTw/discussion
  // http://ajaxian.com/archives/foreignobject-hey-youve-got-html-in-my-svg
  // [possible improvements @ http://bl.ocks.org/robschmuecker/7880033]

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  // specific to org chart
  var r = 6,
    padding = {'top': 10, 'right': 10, 'bottom': 10, 'left': 10}, // this is the distance from the edges of the svg to the chart,
    duration = 300,
    zoomExtents = {'min': 0.25, 'max': 2},
    nodeSize = {'width': 100, 'height': 50},
    nodeImgPath = '../img/',
    nodeRenderer = function(d) { return '<div class="sc-tree-node"></div>'; },
    zoomCallback = function(d) { return; },
    nodeCallback = function(d) { return; },
    nodeClick = function(d) { return; },
    horizontal = false;

  var id = Math.floor(Math.random() * 10000), //Create semi-unique ID in case user doesn't select one,
    color = function (d, i) { return sucrose.utils.defaultColor()(d, i); },
    fill = function(d, i) { return color(d,i); },
    gradient = function(d, i) { return color(d,i); },

    setX = function(d, v) { d.x = v; },
    setY = function(d, v) { d.y = v; },
    setX0 = function(d, v) { if (horizontal) { d.y0 = v; } else { d.x0 = v; } },
    setY0 = function(d, v) { if (horizontal) { d.x0 = v; } else { d.y0 = v; } },

    getX = function(d) { return horizontal ? d.y : d.x; },
    getY = function(d) { return horizontal ? d.x : d.y; },
    getX0 = function(d) { return horizontal ? d.y0 : d.x0; },
    getY0 = function(d) { return horizontal ? d.x0 : d.y0; },

    getId = function(d) { return d.id; },

    fillGradient = function(d, i) {
        return sucrose.utils.colorRadialGradient(d, i, 0, 0, '35%', '35%', color(d, i), wrap.select('defs'));
    },
    useClass = false,
    valueFormat = sucrose.utils.numberFormatSI,
    showLabels = true,
    dispatch = d3.dispatch('chartClick', 'elementClick', 'elementDblClick', 'elementMouseover', 'elementMouseout');

  //============================================================

  function chart(selection)
  {
    selection.each(function(data) {

      var diagonal = d3.svg.diagonal()
            .projection(function(d) {
              return [getX(d), getY(d)];
            });

      var zoom = null;
      chart.setZoom = function() {
        zoom = d3.zoom()
                    .scaleExtent([zoomExtents.min, zoomExtents.max])
                    .on('zoom', function() {
                      treeWrapper.attr('transform', 'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')');
                      zoomCallback(d3.event.scale);
                    });
      };
      chart.setZoom();

      //------------------------------------------------------------
      // Setup svgs and skeleton of chart

      var svg = d3.select(this);
      var availableSize = { // the size of the svg container minus padding
            'width': parseInt(svg.style('width'), 10) - padding.left - padding.right,
            'height': parseInt(svg.style('height'), 10) - padding.top - padding.bottom
          };
      var container = d3.select(svg.node().parentNode);

      var wrap_bind = svg.selectAll('.sc-wrap').data([1]);
      var wrap_entr = wrap_bind.enter().append('g')
            .attr('class', 'sucrose sc-wrap sc-treeChart')
            .attr('id', 'sc-chart-' + id);
      var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);

      wrap.call(zoom);

      var defs_entr = wrap_entr.append('defs');
      var defs = wrap.select('defs').merge(defs_entr);
      var nodeShadow = sucrose.utils.dropShadow('node_back_' + id, defs, {blur: 2});

      wrap_entr.append('svg:rect')
            .attr('class', 'sc-chartBackground')
            .attr('width', availableSize.width)
            .attr('height', availableSize.height)
            .attr('transform', 'translate(' + padding.left + ',' + padding.top + ')')
            .style('fill', 'transparent');
      var backg = wrap.select('.sc-chartBackground');

      var g_entr = wrap_entr.append('g')
            .attr('class', 'sc-chartWrap');
      var treeWrapper = wrap.select('.sc-chartWrap');

      g_entr.append('g')
            .attr('class', 'sc-tree');
      var treeChart = wrap.select('.sc-tree');

      // Compute the new tree layout.
      var tree = d3.tree()
            .size(null)
            .nodeSize([(horizontal ? nodeSize.height : nodeSize.width), 1])
            .separation(function separation(a, b) {
              return a.parent == b.parent ? 1 : 1;
            });

      data.x0 = data.x0 || 0;
      data.y0 = data.y0 || 0;

      var _data = data;

      var nodes = null;

      chart.resize = function() {
        chart.reset();

        // the size of the svg container minus padding
        availableSize = {
          'width': parseInt(svg.style('width'), 10) - padding.left - padding.right,
          'height': parseInt(svg.style('height'), 10) - padding.top - padding.bottom
        };

        // the size of the chart itself
        var size = [
              Math.abs(d3.min(nodes, getX)) + Math.abs(d3.max(nodes, getX)) + nodeSize.width,
              Math.abs(d3.min(nodes, getY)) + Math.abs(d3.max(nodes, getY)) + nodeSize.height
            ],

            // initial chart scale to fit chart in container
            xScale = availableSize.width / size[0],
            yScale = availableSize.height / size[1],
            scale = d3.min([xScale, yScale]),

            // initial chart translation to position chart in the center of container
            center = [
              Math.abs(d3.min(nodes, getX)) +
                (xScale < yScale ? 0 : (availableSize.width / scale - size[0]) / 2),
              Math.abs(d3.min(nodes, getY)) +
                (xScale < yScale ? (availableSize.height / scale - size[1]) / 2 : 0)
            ],

            offset = [
              nodeSize.width / (horizontal ? 1 : 2),
              nodeSize.height / (horizontal ? 2 : 1)
            ],

            translate = [
              (center[0] + offset[0]) * scale + padding.left / (horizontal ? 2 : 1),
              (center[1] + offset[1]) * scale + padding.top / (horizontal ? 1 : 2)
            ];

        backg
          .attr('width', availableSize.width)
          .attr('height', availableSize.height);

        treeChart.attr('transform', 'translate(' + translate + ')scale(' + scale + ')');
      };

      chart.orientation = function(orientation) {
        horizontal = (orientation === 'horizontal' || !horizontal ? true : false);
        tree.nodeSize([(horizontal ? nodeSize.height : nodeSize.width), 1]);
        chart.update(_data);
      };

      chart.showall = function() {
        function expandAll(d) {
          if ((d.children && d.children.length) || (d._children && d._children.length)) {
            if (d._children && d._children.length) {
              d.children = d._children;
              d._children = null;
            }
            d.children.forEach(expandAll);
          }
        }
        expandAll(_data);
        chart.update(_data);
      };

      chart.reset = function() {
        chart.setZoom();
        zoom.translate([0, 0]).scale(1);
        wrap.call(zoom);
        treeWrapper.attr('transform', 'translate(' + [0, 0] + ')scale(' + 1 + ')');
      };

      chart.zoomStep = function(step) {
        var level = zoom.scale() + step;
        return this.zoomLevel(level);
      };

      chart.zoomLevel = function(level) {

        var scale = Math.min(Math.max(level, zoomExtents.min), zoomExtents.max),

            prevScale = zoom.scale(),
            prevTrans = zoom.translate(),
            treeBBox = backg.node().getBoundingClientRect(),

            size = [
              treeBBox.width,
              treeBBox.height
            ],

            offset = [
              (size[0] - size[0] * scale) / 2,
              (size[1] - size[1] * scale) / 2
            ],

            shift = [
              scale * (prevTrans[0] - (size[0] - size[0] * prevScale) / 2) / prevScale,
              scale * (prevTrans[1] - (size[1] - size[1] * prevScale) / 2) / prevScale
            ],

            translate = [
              offset[0] + shift[0],
              offset[1] + shift[1]
            ];

        zoom.translate(translate).scale(scale);
        treeWrapper.attr('transform', 'translate(' + translate + ')scale(' + scale + ')');

        return scale;
      };

      chart.zoomScale = function() {
        return zoom.scale();
      };

      chart.filter = function(node) {
        var __data = {}
          , found = false;

        function findNode(d) {
          if (getId(d) === node) {
            __data = d;
            found = true;
          } else if (!found && d.children) {
            d.children.forEach(findNode);
          }
        }

        // Initialize the display to show a few nodes.
        findNode(data);

        __data.x0 = 0;
        __data.y0 = 0;

        _data = __data;

        chart.update(_data);
      };

      chart.update = function(source) {
        // Click tree node.
        function leafClick(d) {
          toggle(d);
          chart.update(d);
        }

        // Toggle children.
        function toggle(d) {
          if (d.children) {
            d._children = d.children;
            d.children = null;
          } else {
            d.children = d._children;
            d._children = null;
          }
        }

        nodes = tree.nodes(_data);
        var root = nodes[0];

        nodes.forEach(function(d) {
          setY(d, d.depth * 2 * (horizontal ? nodeSize.width : nodeSize.height));
        });

        // Update the nodes…
        var node = treeChart.selectAll('g.sc-card')
              .data(nodes, getId);

        // Enter any new nodes at the parent's previous position.
        var nodeEnter = node.enter().append('svg:g')
              .attr('class', 'sc-card')
              .attr('id', function(d) { return 'sc-card-' + getId(d); })
              .attr('transform', function(d) {
                if (getY(source) === 0) {
                  return 'translate(' + getX(root) + ',' + getY(root) + ')';
                } else {
                  return 'translate(' + getX0(source) + ',' + getY0(source) + ')';
                }
              });

        var nodeOffsetX = (horizontal ? r - nodeSize.width : nodeSize.width / -2) + 'px',
            nodeOffsetY = (horizontal ? (r - nodeSize.height) / 2 : r * 2 - nodeSize.height) + 'px';

        nodeEnter.each(function(d) {
          if (defs.select('#myshape-' + getId(d)).empty()) {
            var nodeObject = defs.append('svg').attr('class', 'sc-foreign-object')
                  .attr('id', 'myshape-' + getId(d))
                  .attr('version', '1.1')
                  .attr('xmlns', 'http://www.w3.org/2000/svg')
                  .attr('xmlns:xlink', 'http://www.w3.org/1999/xlink')
                  .attr('x', nodeOffsetX)
                  .attr('y', nodeOffsetY)
                  .attr('width', nodeSize.width + 'px')
                  .attr('height', nodeSize.height + 'px')
                  .attr('viewBox', '0 0 ' + nodeSize.width + ' ' + nodeSize.height)
                  .attr('xml:space', 'preserve');

            var nodeContent = nodeObject.append('g').attr('class', 'sc-tree-node-content')
                  .attr('transform', 'translate(' + r + ',' + r + ')');

            nodeRenderer(nodeContent, d, nodeSize.width - r * 2, nodeSize.height - r * 3);

            nodeContent.on('click', nodeClick);

            nodeCallback(nodeObject);
          }
        });

        // node content
        nodeEnter.append('use')
            .attr('xlink:href', function(d) {
              return '#myshape-' + getId(d);
            })
            .attr('filter', nodeShadow);

        // node circle
        var xcCircle = nodeEnter.append('svg:g').attr('class', 'sc-expcoll')
              .style('opacity', 1e-6)
              .on('click', leafClick);
            xcCircle.append('svg:circle').attr('class', 'sc-circ-back')
              .attr('r', r);
            xcCircle.append('svg:line').attr('class', 'sc-line-vert')
              .attr('x1', 0).attr('y1', 0.5 - r).attr('x2', 0).attr('y2', r - 0.5)
              .style('stroke', '#bbb');
            xcCircle.append('svg:line').attr('class', 'sc-line-hrzn')
              .attr('x1', 0.5 - r).attr('y1', 0).attr('x2', r - 0.5).attr('y2', 0)
              .style('stroke', '#fff');

        //Transition nodes to their new position.
        var nodeUpdate = node.transition()
              .duration(duration)
              .attr('transform', function(d) {
                return 'translate(' + getX(d) + ',' + getY(d) + ')';
              });
            nodeUpdate.select('.sc-expcoll')
              .style('opacity', function(d) {
                return ((d.children && d.children.length) || (d._children && d._children.length)) ? 1 : 0;
              });
            nodeUpdate.select('.sc-circ-back')
              .style('fill', function(d) {
                return (d._children && d._children.length) ? '#777' : (d.children ? '#bbb' : 'none');
              });
            nodeUpdate.select('.sc-line-vert')
              .style('stroke', function(d) {
                return (d._children && d._children.length) ? '#fff' : '#bbb';
              });

            nodeUpdate.each(function(d) {
              container.select('#myshape-' + getId(d))
                .attr('x', nodeOffsetX)
                .attr('y', nodeOffsetY);
            });

        // Transition exiting nodes to the parent's new position.
        var nodeExit = node.exit().transition()
              .duration(duration)
              .attr('transform', function(d) {
                return 'translate(' + getX(source) + ',' + getY(source) + ')';
              })
              .remove();
            nodeExit.selectAll('.sc-expcoll')
              .style('stroke-opacity', 1e-6);
            nodeExit.selectAll('.sc-foreign-object')
              .attr('width', 1)
              .attr('height', 1)
              .attr('x', -1)
              .attr('y', -1);

        // Update the links
        var link = treeChart.selectAll('path.link')
              .data(tree.links(nodes), function(d) {
                return getId(d.source) + '-' + getId(d.target);
              });

            // Enter any new links at the parent's previous position.
            link.enter().insert('svg:path', 'g')
              .attr('class', 'link')
              .attr('d', function(d) {
                var o = getY(source) === 0 ? {x: source.x, y: source.y} : {x: source.x0, y: source.y0};
                return diagonal({ source: o, target: o });
              });

            // Transition links to their new position.
            link.transition()
              .duration(duration)
              .attr('d', diagonal);

            // Transition exiting nodes to the parent's new position.
            link.exit().transition()
              .duration(duration)
              .attr('d', function(d) {
                var o = { x: source.x, y: source.y };
                return diagonal({ source: o, target: o });
              })
              .remove();

        // Stash the old positions for transition.
        nodes
          .forEach(function(d) {
            setX0(d, getX(d));
            setY0(d, getY(d));
          });

        chart.resize();
      };

      chart.gradient(fillGradient);

      chart.update(_data);

    });

    return chart;
  }


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  chart.dispatch = dispatch;

  chart.color = function(_) {
    if (!arguments.length) return color;
    color = _;
    return chart;
  };
  chart.fill = function(_) {
    if (!arguments.length) return fill;
    fill = _;
    return chart;
  };
  chart.gradient = function(_) {
    if (!arguments.length) return gradient;
    gradient = _;
    return chart;
  };
  chart.useClass = function(_) {
    if (!arguments.length) return useClass;
    useClass = _;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return chart;
  };

  chart.values = function(_) {
    if (!arguments.length) return getValues;
    getValues = _;
    return chart;
  };

  chart.x = function(_) {
    if (!arguments.length) return getX;
    getX = _;
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) return getY;
    getY = sucrose.functor(_);
    return chart;
  };

  chart.showLabels = function(_) {
    if (!arguments.length) return showLabels;
    showLabels = _;
    return chart;
  };

  chart.id = function(_) {
    if (!arguments.length) return id;
    id = _;
    return chart;
  };

  chart.valueFormat = function(_) {
    if (!arguments.length) return valueFormat;
    valueFormat = _;
    return chart;
  };

  chart.labelThreshold = function(_) {
    if (!arguments.length) return labelThreshold;
    labelThreshold = _;
    return chart;
  };

  // ORG

  chart.radius = function(_) {
    if (!arguments.length) return r;
    r = _;
    return chart;
  };

  chart.duration = function(_) {
    if (!arguments.length) return duration;
    duration = _;
    return chart;
  };

  chart.zoomExtents = function(_) {
    if (!arguments.length) return zoomExtents;
    zoomExtents = _;
    return chart;
  };

  chart.zoomCallback = function(_) {
    if (!arguments.length) return zoomCallback;
    zoomCallback = _;
    return chart;
  };

  chart.padding = function(_) {
    if (!arguments.length) return padding;
    padding = _;
    return chart;
  };

  chart.nodeSize = function(_) {
    if (!arguments.length) return nodeSize;
    nodeSize = _;
    return chart;
  };

  chart.nodeImgPath = function(_) {
    if (!arguments.length) return nodeImgPath;
    nodeImgPath = _;
    return chart;
  };

  chart.nodeRenderer = function(_) {
    if (!arguments.length) return nodeRenderer;
    nodeRenderer = _;
    return chart;
  };

  chart.nodeCallback = function(_) {
    if (!arguments.length) return nodeCallback;
    nodeCallback = _;
    return chart;
  };

  chart.nodeClick = function(_) {
    if (!arguments.length) return nodeClick;
    nodeClick = _;
    return chart;
  };

  chart.horizontal = function(_) {
    if (!arguments.length) return horizontal;
    horizontal = _;
    return chart;
  };

  chart.getId = function(_) {
    if (!arguments.length) return getId;
    getId = _;
    return chart;
  };
  //============================================================

  return chart;
};

sucrose.models.treemap = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 20, right: 0, bottom: 0, left: 0},
      width = 0,
      height = 0,
      x = d3.scaleLinear(), //can be accessed via chart.xScale()
      y = d3.scaleLinear(), //can be accessed via chart.yScale()
      id = Math.floor(Math.random() * 10000), //Create semi-unique ID incase user doesn't select one
      getValue = function(d) { return d.size; }, // accessor to get the size value from a data point
      getKey = function(d) { return d.name; }, // accessor to get the name value from a data point
      groupBy = function(d) { return getKey(d); }, // accessor to get the name value from a data point
      clipEdge = true, // if true, masks lines within x and y scale
      duration = 500,
      leafClick = function() { return false; },
      // color = function(d, i) { return sucrose.utils.defaultColor()(d, i); },
      color = d3.scaleOrdinal().range(
                d3.schemeCategory20.map(function(c) {
                  c = d3.rgb(c);
                  c.opacity = 0.6;
                  return c;
                })
              ),
      fill = color,
      classes = function(d, i) { return 'sc-child'; },
      direction = 'ltr',
      dispatch = d3.dispatch('chartClick', 'elementClick', 'elementDblClick', 'elementMouseover', 'elementMouseout', 'elementMousemove');


  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var ROOT,
      TREE,
      NODES = [];

  // This is for data sets that don't include a colorIndex
  // Excludes leaves
  function reduceGroups(d) {
    var data = d.data ? d.data : d;
    var name = groupBy(data);
    var i, l;
    if (name && NODES.indexOf(name) === -1) {
      NODES.push(name);
      if (data.children) {
        l = data.children.length;
        for (i = 0; i < l; i += 1) {
          reduceGroups(data.children[i]);
        }
      }
    }
    return NODES;
  }

  //============================================================
  // TODO:
  // 1. title,
  // 2. colors,
  // 3. legend data change remove,
  // 4. change groupby,
  // 5. contrasting text

  function chart(selection) {
    selection.each(function(chartData) {

      var availableWidth = width - margin.left - margin.right,
          availableHeight = height - margin.top - margin.bottom,
          container = d3.select(this),
          transitioning;

      // Set up the gradient constructor function
      chart.gradient = function(d, i, p) {
        var iColor = (d.parent.colorIndex || NODES.indexOf(groupBy(d.parent)) || i);
        return sucrose.utils.colorLinearGradient(
          d,
          id + '-' + i,
          p,
          color(d, iColor, NODES.length),
          wrap.select('defs')
        );
      };

      // We only need to define TREE and NODES once on initial load
      // TREE is always available in its initial state and NODES is immutable
      TREE = TREE ||
        d3.hierarchy(chartData[0])
          .sum(function(d) { return getValue(d); })
          .sort(function(a, b) { return b.height - a.height || b.value - a.value; });

      NODES = NODES.length ? NODES : reduceGroups(TREE);

      // Recalcuate the treemap layout dimensions
      d3.treemap()
        .size([availableWidth, availableHeight])
        .round(false)
          (TREE);

      // We store the root on first render
      // which gets reused on resize
      // Transition will reset root when called
      ROOT = ROOT || TREE;

      x.domain([ROOT.x0, ROOT.x1])
       .range([0, availableWidth]);
      y.domain([ROOT.y0, ROOT.y1])
       .range([0, availableHeight]);

      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap_bind = container.selectAll('g.sc-wrap.sc-treemap').data([TREE]);
      var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-treemap');
      var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
      var defs_entr = wrap_entr.append('defs');
      var g_entr = wrap_entr.append('g').attr('class', 'sc-chart-wrap');
      var g = wrap.select('g.sc-chart-wrap').merge(g_entr);

      // wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      //------------------------------------------------------------
      // Clip Path

      defs_entr.append('clipPath')
        .attr('id', 'sc-edge-clip-' + id)
        .append('rect');
      wrap.select('#sc-edge-clip-' + id + ' rect')
        .attr('width', width)
        .attr('height', height);
      g.attr('clip-path', clipEdge ? 'url(#sc-edge-clip-' + id + ')' : '');

      //------------------------------------------------------------
      // Family Tree Path

      var treepath_bind = g_entr.selectAll('.sc-treepath').data([TREE]);
      var treepath_enter = treepath_bind.enter().append('g').attr('class', 'sc-treepath');
      var treepath = g.selectAll('.sc-treepath').merge(treepath_enter);

      treepath_enter.append('rect')
        .attr('class', 'sc-target')
        .on('click', transition);

      treepath_enter.append('text')
        .attr('x', direction === 'rtl' ? width - 6 : 6)
        .attr('y', 6)
        .attr('dy', '.75em');

      treepath.select('.sc-target')
        .attr('width', width)
        .attr('height', margin.top);

      //------------------------------------------------------------
      // Main Chart

      var gold = render();

      function render() {

        var grandparent_bind = g.selectAll('.sc-grandparent.sc-trans').data([ROOT]);
        var grandparent_entr = grandparent_bind.enter().append('g').attr('class', 'sc-grandparent sc-trans');
        var grandparent = g.selectAll('.sc-grandparent.sc-trans').merge(grandparent_entr);
        // We need to keep the old granparent around until transition ends
        // grandparent.exit().remove();

        grandparent
          .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
          .lower();

        // Parent group
        var parents_bind = grandparent.selectAll('g.sc-parent').data(ROOT.children);
        var parents_entr = parents_bind.enter().append('g').classed('sc-parent', true);
        var parents = grandparent.selectAll('.sc-parent').merge(parents_entr);
        parents_bind.exit().remove();

        // Child rectangles
        var children_bind = parents.selectAll('rect.sc-child').data(function(d) { return d.children || [d]; });
        var children_entr = children_bind.enter().append('rect').attr('class', 'sc-child');
        var children = parents.selectAll('.sc-child').merge(children_entr);
        children_bind.exit().remove();

        children
          .attr('class', classes)
          .attr('fill', function(d, i) {
            // while (d.depth > 1) {
            //   d = d.parent;
            // }
            // return color(groupBy(d));
            var iColor = (d.parent.colorIndex || NODES.indexOf(getKey(d.parent.data)) || i);
            return this.getAttribute('fill') || fill(d, iColor, NODES.length);
          })
            .call(rect);

        // Parent labels
        var label_bind = parents.selectAll('text.sc-label').data(function(d) { return [d]; });
        var label_entr = label_bind.enter().append('text').attr('class', 'sc-label')
              .attr('dy', '.75em');
        var label = parents.selectAll('.sc-label').merge(label_entr);
        label_bind.exit().remove();

        label
          .text(function(d) {
              return getKey(d.data);  //groupBy(d);
           })
            .call(text);

        // Parent event target
        var target_bind = parents.selectAll('rect.sc-target').data(function(d) { return [d]; });
        var target_entr = target_bind.enter().append('rect').attr('class', 'sc-target');
        var target = parents.selectAll('.sc-target').merge(target_entr);
        target_bind.exit().remove();

        target
            .call(rect);

        // Family tree path
        treepath.selectAll('text')
          .datum(ROOT)
            .text(crumbs);

        treepath.selectAll('rect')
            .data([ROOT.parent]);

        // -------------
        // Assign Events

        // Assign transition event for parents with children.
        target
          .filter(function(d) { return d.children; })
          .on('click', transition);

        // Assign navigate event for parents without children (leaves).
        target
          .filter(function(d) { return !(d.children); })
          .on('click', leafClick);

        // Tooltips
        target
          .on('mouseover', function(d, i) {
            d3.select(this).classed('hover', true);
            var eo = {
              point: d,
              pointIndex: i,
              id: id,
              e: d3.event
            };
            dispatch.call('elementMouseover', this, eo);
          })
          .on('mousemove', function(d, i) {
            var e = d3.event;
            dispatch.call('elementMousemove', this, e);
          })
          .on('mouseout', function(d, i) {
            d3.select(this).classed('hover', false);
            dispatch.call('elementMouseout', this);
          });

        children
          .on('mouseover', function(d, i) {
            d3.select(this).classed('hover', true);
            var eo = {
                label: getKey(d),
                value: getValue(d),
                point: d,
                pointIndex: i,
                e: d3.event,
                id: id
            };
            dispatch.call('elementMouseover', this, eo);
          })
          .on('mouseout', function(d, i) {
            d3.select(this).classed('hover', false);
            dispatch.call('elementMouseout', this);
          });

        return grandparent;
      }

      function transition(d) {
        var direction;
        var tup;
        var tdn;
        var gnew;

        // cleanup tooltips
        dispatch.call('elementMouseout', this);

        // If we are already transitioning, wait
        if (transitioning || !d) { return; }

        // Reset the root which will be used by render
        ROOT = d;

        transitioning = true;

        gold.classed('sc-trans', false);

        direction = d3.select(this).classed('sc-target') ? 'out' : 'in';

        // Create transitions for in and out
        tup = d3.transition('treemap-out')
                    .duration(duration)
                    .ease(d3.easeCubicIn);
        tdn = d3.transition('treemap-in')
                    .duration(duration)
                    .ease(d3.easeCubicIn);

        // render the new treemap
        gnew = render();

        // Update the domain only after entering new elements
        x.domain([d.x0, d.x1]);
        y.domain([d.y0, d.y1]);

        // Enable anti-aliasing during the transition
        container.style('shape-rendering', null);

        // Fade-in entering text so start at zero
        gnew.selectAll('text').style('fill-opacity', 0);

        // Select existing text and rectangles with transition
        // anything called by this selection will be run
        // continously until transtion completes
        gnew.selectAll('text').transition(tdn).style('fill-opacity', 1).call(text);
        gnew.selectAll('rect').transition(tdn).style('fill-opacity', 1).call(rect);
        gold.selectAll('text').transition(tup).style('fill-opacity', 0).call(text).remove();
        gold.selectAll('rect').transition(tup).style('fill-opacity', 0).call(rect)
          .on('end', function(d, i) {
            transitioning = false;
            container.style('shape-rendering', 'crispEdges');
            gold.selectAll('*').interrupt('treemap-out');
            gold.remove();
            gold = gnew;
          });
      }

      function text(text) {
        text
          .attr('x', function(d) {
            var xpos = direction === 'rtl' ? -1 : 1;
            return x(d.x0) + 6 * xpos;
          })
          .attr('y', function(d) {
            return y(d.y0) + 6;
          });
      }

      function rect(rect) {
        rect
          .attr('x', function(d) {
            return x(d.x0);
          })
          .attr('y', function(d) { return y(d.y0); })
          .attr('width', function(d) {
            return x(d.x1) - x(d.x0);
          })
          .attr('height', function(d) { return y(d.y1) - y(d.y0); });
      }

      function crumbs(d) {
        if (d.parent) {
          return crumbs(d.parent) + ' / ' + getKey(d.data);
        }
        return getKey(d.data);
      }
    });

    return chart;
  }


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  chart.dispatch = dispatch;

  chart.color = function(_) {
    if (!arguments.length) { return color; }
    color = _;
    return chart;
  };
  chart.fill = function(_) {
    if (!arguments.length) { return fill; }
    fill = _;
    return chart;
  };
  chart.classes = function(_) {
    if (!arguments.length) { return classes; }
    classes = _;
    return chart;
  };
  chart.gradient = function(_) {
    if (!arguments.length) { return gradient; }
    gradient = _;
    return chart;
  };

  chart.x = function(_) {
    if (!arguments.length) { return getX; }
    getX = _;
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) { return getY; }
    getY = _;
    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) { return margin; }
    margin.top    = typeof _.top    !== 'undefined' ? _.top    : margin.top;
    margin.right  = typeof _.right  !== 'undefined' ? _.right  : margin.right;
    margin.bottom = typeof _.bottom !== 'undefined' ? _.bottom : margin.bottom;
    margin.left   = typeof _.left   !== 'undefined' ? _.left   : margin.left;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) { return width; }
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) { return height; }
    height = _;
    return chart;
  };

  chart.xScale = function(_) {
    if (!arguments.length) { return x; }
    x = _;
    return chart;
  };

  chart.yScale = function(_) {
    if (!arguments.length) { return y; }
    y = _;
    return chart;
  };

  chart.xDomain = function(_) {
    if (!arguments.length) { return xDomain; }
    xDomain = _;
    return chart;
  };

  chart.yDomain = function(_) {
    if (!arguments.length) { return yDomain; }
    yDomain = _;
    return chart;
  };

  chart.leafClick = function(_) {
    if (!arguments.length) { return leafClick; }
    leafClick = _;
    return chart;
  };

  chart.getValue = function(_) {
    if (!arguments.length) { return getValue; }
    getValue = _;
    return chart;
  };

  chart.groupBy = function(_) {
    if (!arguments.length) { return groupBy; }
    groupBy = _;
    return chart;
  };

  chart.groups = function(_) {
    if (!arguments.length) { return NODES; }
    NODES = _;
    return chart;
  };

  chart.duration = function(_) {
    if (!arguments.length) { return duration; }
    duration = _;
    return chart;
  };

  chart.id = function(_) {
    if (!arguments.length) { return id; }
    id = _;
    return chart;
  };

  chart.direction = function(_) {
    if (!arguments.length) {
      return direction;
    }
    direction = _;
    return chart;
  };

  //============================================================


  return chart;
};

sucrose.models.treemapChart = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 10, right: 10, bottom: 10, left: 10},
      width = null,
      height = null,
      showTitle = false,
      showLegend = false,
      direction = 'ltr',
      tooltip = null,
      tooltips = true,
      tooltipContent = function(point) {
        var tt = '<h3>' + point.data.name + '</h3>' +
                 '<p>' + sucrose.utils.numberFormatSI(point.value) + '</p>';
        return tt;
      },
      colorData = 'default',
      //create a clone of the d3 array
      colorArray = d3.scaleOrdinal(d3.schemeCategory20).range().map( function(d) { return d; }),
      x, //can be accessed via chart.xScale()
      y, //can be accessed via chart.yScale()
      strings = {
        legend: {close: 'Hide legend', open: 'Show legend'},
        controls: {close: 'Hide controls', open: 'Show controls'},
        noData: 'No Data Available.',
        noLabel: 'undefined'
      },
      dispatch = d3.dispatch('tooltipShow', 'tooltipHide', 'tooltipMove', 'elementMousemove');


  var treemap = sucrose.models.treemap(),
      legend = sucrose.models.legend();

  //============================================================


  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var showTooltip = function(eo, offsetElement) {
    var content = tooltipContent(eo.point);
    tooltip = sucrose.tooltip.show(eo.e, content, null, null, offsetElement);
  };

  //============================================================


  function chart(selection) {
    selection.each(function(chartData) {

      var data = [chartData];

      var container = d3.select(this),
          that = this;

      var availableWidth = (width || parseInt(container.style('width'), 10) || 960) - margin.left - margin.right,
          availableHeight = (height || parseInt(container.style('height'), 10) || 400) - margin.top - margin.bottom;

      chart.update = function() { container.transition().duration(300).call(chart); };
      chart.container = this;

      //------------------------------------------------------------
      // Display noData message if there's nothing to show.

      if (!data || !data.length || !data.filter(function(d) { return d && d.children.length; }).length) {
        container.select('.sucrose.sc-wrap').remove();
        var noDataText = container.selectAll('.sc-noData').data([chart.strings().noData]);

        noDataText.enter().append('text')
          .attr('class', 'sucrose sc-noData')
          .attr('dy', '-.7em')
          .style('text-anchor', 'middle');

        noDataText
          .attr('x', margin.left + availableWidth / 2)
          .attr('y', margin.top + availableHeight / 2)
          .text(function(d) { return d; });

        return chart;
      } else {
        container.selectAll('.sc-noData').remove();
      }

      //------------------------------------------------------------

      //remove existing colors from default color array, if any
      // if (colorData === 'data') {
      //   removeColors(data[0]);
      // }

      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap_bind = container.selectAll('g.sc-wrap.sc-treemap-chart').data(data);
      var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-treemap-chart');
      var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
      var g_entr = wrap_entr.append('g').attr('class', 'sc-chart-wrap');
      var g = container.select('g.sc-chart-wrap').merge(g_entr);

      g_entr.append('rect').attr('class', 'sc-background')
        .attr('x', -margin.left)
        .attr('y', -margin.top)
        .attr('width', availableWidth + margin.left + margin.right)
        .attr('height', availableHeight + margin.top + margin.bottom)
        .attr('fill', '#FFF');

      var treemap_enter = g_entr.append('g').attr('class', 'sc-treemap-wrap');
      var treemap_wrap = g.select('.sc-treemap-wrap').merge(treemap_enter)

      wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      //------------------------------------------------------------
      // Title & Legend

      var titleHeight = 0,
          legendHeight = 0;

      if (showLegend) {
        g_entr.append('g').attr('class', 'sc-legendWrap');

        legend
          .id('legend_' + chart.id())
          .strings(chart.strings().legend)
          .width(availableWidth + margin.left)
          .height(availableHeight);

        g.select('.sc-legendWrap')
          .datum(data)
          .call(legend);

        legendHeight = legend.height() + 10;

        if (margin.top !== legendHeight + titleHeight) {
          margin.top = legendHeight + titleHeight;
          availableHeight = (height || parseInt(container.style('height'), 10) || 400) - margin.top - margin.bottom;
        }

        g.select('.sc-legendWrap')
          .attr('transform', 'translate(' + (-margin.left) + ',' + (-margin.top) + ')');
      }

      if (showTitle && properties.title) {
        g_entr.append('g').attr('class', 'sc-title-wrap');

        g.select('.sc-title').remove();

        g.select('.sc-title-wrap')
          .append('text')
            .attr('class', 'sc-title')
            .attr('x', 0)
            .attr('y', 0)
            .attr('text-anchor', 'start')
            .text(properties.title)
            .attr('stroke', 'none')
            .attr('fill', 'black');

        titleHeight = parseInt(g.select('.sc-title').style('height'), 10) +
          parseInt(g.select('.sc-title').style('margin-top'), 10) +
          parseInt(g.select('.sc-title').style('margin-bottom'), 10);

        if (margin.top !== titleHeight + legendHeight) {
          margin.top = titleHeight + legendHeight;
          availableHeight = (height || parseInt(container.style('height'), 10) || 400) - margin.top - margin.bottom;
        }

        g.select('.sc-title-wrap')
          .attr('transform', 'translate(0,' + (-margin.top + parseInt(g.select('.sc-title').style('height'), 10)) + ')');
      }

      //------------------------------------------------------------
      // Main Chart Component(s)

      treemap
        .width(availableWidth)
        .height(availableHeight);

      treemap_wrap
        .datum(data.filter(function(d) { return !d.disabled; }))
        .transition()
          .call(treemap);


      //============================================================
      // Event Handling/Dispatching (in chart's scope)
      //------------------------------------------------------------

      legend.dispatch.on('legendClick', function(d, i) {
        d.disabled = !d.disabled;

        if (!data.filter(function(d) { return !d.disabled; }).length) {
          data.map(function(d) {
            d.disabled = false;
            wrap.selectAll('.sc-series').classed('disabled', false);
            return d;
          });
        }

        container.transition().duration(300).call(chart);
      });

      dispatch.on('tooltipShow', function(eo) {
        if (tooltips) {
          showTooltip(eo, that.parentNode);
        }
      });

      dispatch.on('tooltipMove', function(e) {
        if (tooltip) {
          sucrose.tooltip.position(that.parentNode, tooltip, e);
        }
      });

      dispatch.on('tooltipHide', function() {
        if (tooltips) {
          sucrose.tooltip.cleanup();
        }
      });

      //============================================================

      // function removeColors(d) {
      //   var i, l;
      //   if (d.color && colorArray.indexOf(d.color) !== -1) {
      //     colorArray.splice(colorArray.indexOf(d.color), 1);
      //   }
      //   if (d.children) {
      //     l = d.children.length;
      //     for (i = 0; i < l; i += 1) {
      //       removeColors(d.children[i]);
      //     }
      //   }
      // }

    });

    return chart;
  }


  //============================================================
  // Event Handling/Dispatching (out of chart's scope)
  //------------------------------------------------------------

  treemap.dispatch.on('elementMouseover', function(eo) {
    dispatch.call('tooltipShow', this, eo);
  });

  treemap.dispatch.on('elementMousemove', function(e) {
    dispatch.call('tooltipMove', this, e);
  });

  treemap.dispatch.on('elementMouseout', function() {
    dispatch.call('tooltipHide', this);
  });

  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  // expose chart's sub-components
  chart.dispatch = dispatch;
  chart.legend = legend;
  chart.treemap = treemap;

  fc.rebind(chart, treemap, 'x', 'y', 'xDomain', 'yDomain', 'forceX', 'forceY', 'clipEdge', 'id', 'delay', 'leafClick', 'getValue', 'getName', 'groups', 'duration', 'color', 'fill', 'classes', 'gradient', 'direction');

  chart.colorData = function(_) {
    if (!arguments.length) { return colorData; }

    var type = arguments[0],
        params = arguments[1] || {};
    var color = function(d, i) {
          var c = (type === 'data' && d.color) ? {color: d.color} : {};
          return sucrose.utils.getColor(colorArray)(c, i);
        };
    var classes = function(d, i) {
          return 'sc-child';
        };

    switch (type) {
      case 'graduated':
        color = function(d, i, l) {
          return d3.interpolateHsl(d3.rgb(params.c1), d3.rgb(params.c2))(i / l);
        };
        break;
      case 'class':
        color = function() {
          return 'inherit';
        };
        classes = function(d, i) {
          var iClass = (i * (params.step || 1)) % 14;
          iClass = (iClass > 9 ? '' : '0') + iClass;
          return 'sc-child ' + (d.className || 'sc-fill' + iClass);
        };
        break;
    }

    var fill = (!params.gradient) ? color : function(d, i) {
      var p = {orientation: params.orientation || 'horizontal', position: params.position || 'base'};
      return treemap.gradient(d, i, p);
    };

    treemap.color(color);
    treemap.fill(fill);
    treemap.classes(classes);

    legend.color(color);
    legend.classes(classes);

    colorData = arguments[0];

    return chart;
  };

  chart.x = function(_) {
    if (!arguments.length) { return getX; }
    getX = _;
    treemap.x(_);
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) { return getY; }
    getY = _;
    treemap.y(_);
    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) { return margin; }
    margin.top    = typeof _.top    !== 'undefined' ? _.top    : margin.top;
    margin.right  = typeof _.right  !== 'undefined' ? _.right  : margin.right;
    margin.bottom = typeof _.bottom !== 'undefined' ? _.bottom : margin.bottom;
    margin.left   = typeof _.left   !== 'undefined' ? _.left   : margin.left;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) { return width; }
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) { return height; }
    height = _;
    return chart;
  };

  chart.showTitle = function(_) {
    if (!arguments.length) { return showTitle; }
    showTitle = _;
    return chart;
  };

  chart.showLegend = function(_) {
    if (!arguments.length) { return showLegend; }
    showLegend = _;
    return chart;
  };

  chart.tooltip = function(_) {
    if (!arguments.length) { return tooltip; }
    tooltip = _;
    return chart;
  };

  chart.tooltips = function(_) {
    if (!arguments.length) { return tooltips; }
    tooltips = _;
    return chart;
  };

  chart.tooltipContent = function(_) {
    if (!arguments.length) { return tooltipContent; }
    tooltipContent = _;
    return chart;
  };

  chart.strings = function(_) {
    if (!arguments.length) {
      return strings;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        strings[prop] = _[prop];
      }
    }
    return chart;
  };

  //============================================================

  return chart;
};
})();