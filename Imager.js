(function (window, document) {

    'use strict';

    var $, Imager;

    window.requestAnimationFrame =
    window.requestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    function (callback) {
        window.setTimeout(callback, 1000 / 60);
    };


    $ = (function (dollar) {
        if (dollar) {
            return dollar;
        }

        return function (selector) {
            return Array.prototype.slice.call(document.querySelectorAll(selector));
        };
    }(window.$));


    /*
        Construct a new Imager instance, passing an optional configuration object.

        Example usage:

            {
                // Available widths for your images
                availableWidths: [Number]

                // Selector to be used to locate your div placeholders
                selector: '',

                // Class name to give your resizable images.
                className: '',

                // Regular expression to match against your image endpoint's naming conventions
                // e.g. http://yourserver.com/image/horse/400
                regex: RegExp
            }

        @param {object} configuration settings
        @return {object} instance of Imager
     */
    window.Imager = Imager = function (opts) {
        var self = this;
            opts = opts || {};

        this.availableWidths  = opts.availableWidths || [160,320,640,1440];//{
        this.selector         = opts.selector || '.imager';
        this.className        = '.' + (opts.className || 'image-replace').replace(/^\.+/, '.');
        this.regex            = opts.regex || /\/image\/(\d)\/(\d+)\/(\d+)\/?(\d)?\/?([0-9a-fA-F]{3,6})?\/?(.+)$/i;
        this.gif              = document.createElement('img');
        this.gif.src          = 'data:image/gif;base64,R0lGODlhEAAJAIAAAP///wAAACH5BAEAAAAALAAAAAAQAAkAAAIKhI+py+0Po5yUFQA7';
        this.gif.className    = this.className.replace(/^[#.]/, '');
        this.divs             = $(this.selector);
        this.cache            = {};
        this.retina           = opts.retina === false ? false : true;
        this.isRetina         = false; // see init()
        this.debounce         = opts.debounce === false ? false : true;
        this.interval         = opts.interval || 200;
        this.preload          = opts.preload || false;
        this.events           = opts.events || false;
        this.eventsBubble     = opts.eventsBubble === false ? false : true;
        this.eventsCancelable = opts.eventsCancelable === false ? false : true;
        this.eventsRetina     = opts.eventsRetina === false ? false : true;
        this.cssBackground    = opts.cssBackground || false;

        if (this.cssBackground) {
            this.addClassNameToCSSBackgroundDivs();
        } else {
            this.changeDivsToEmptyImages();
        }

        window.requestAnimationFrame(function () {
            self.init();
        });
    };


    Imager.prototype.init = function () {
        var self = this;

        this.initialized = true;

        // init isRetina here rather than in opts init above so that the
        // retinaStatus event gets broadcast at initial page load
        this.isRetina = this.determineIfRetina();

        this.checkImagesNeedReplacing();

        if (this.debounce) {
            window.addEventListener('resize', this.debouncer(function () {
                self.isRetina = self.determineIfRetina();
                self.checkImagesNeedReplacing();
            }, self.interval, false), false);
        } else {
            window.addEventListener('resize', function () {
                self.isRetina = self.determineIfRetina();
                self.checkImagesNeedReplacing();
            }, false);
        }
    };


    Imager.prototype.addClassNameToCSSBackgroundDivs = function () {
        var bgs = this.divs,
            i = bgs.length;

        while (i--) {
            bgs[i].className += ' ' + this.className.replace(/^[#.]/, '');
        }

        if (this.initialized) {
            this.checkImagesNeedReplacing();
        }
    };


    Imager.prototype.changeDivsToEmptyImages = function () {
        var divs = this.divs,
            i = divs.length,
            gif,
            otherClassNames;

        while (i--) {
            gif = this.gif.cloneNode(false);
            gif.width = divs[i].getAttribute('data-width');
            gif.setAttribute('data-src', divs[i].getAttribute('data-src'));
            otherClassNames = divs[i].className.replace("imager ", "").trim();
            gif.className = this.className.replace(/^[#.]/, '') + ' ' + otherClassNames;
            if (divs[i].hasAttribute('id')) {
                gif.id = divs[i].id;
            }
            divs[i].parentNode.replaceChild(gif, divs[i]);
        }

        if (this.initialized) {
            this.checkImagesNeedReplacing();
        }
    };


    Imager.prototype.checkImagesNeedReplacing = function () {
        var images = $(this.className),
            i = images.length;

        if (!this.isResizing) {
            this.isResizing = true;

            if (images.length > 0) {
                this.announce('imagerjs.startReplacement', {count: images.length});
            }

            while (i--) {
                this.replaceImagesBasedOnScreenDimensions(images[i]);
            }

            this.isResizing = false;
        }
    };

    Imager.prototype.executeAfterImagePreload = function (callback, image, src, self) {
        var imageCache = new Image();
        // .onload MUST be defined BEFORE setting src otherwise
        // it won't be triggered if the image is already cached
        // http://fragged.org/preloading-images-using-javascript-the-right-way-and-without-frameworks_744.html
        imageCache.onload = function () {
            //IE6/7 Anim GIF protection: https://gist.github.com/eikes/3925183/#comment-851675
            this.onload = this.onabort = this.onerror = null;
            callback(image, src, self);
        };
        imageCache.src = src;
    };

    Imager.prototype.replaceImagesBasedOnScreenDimensions = function (image) {
        var src = this.determineAppropriateResolution(image),
            parent,
            replacedImage;

        if (this.cssBackground) {
            if (!this.preload) {
                this.replaceCSSBackgroundImage(image, src, this);
            } else {
                this.executeAfterImagePreload(this.replaceCSSBackgroundImage, image, src, this);
            }
            return;
        }

        if (this.cache[src]) {
            parent = image.parentNode;
            replacedImage = this.cache[src].cloneNode(false);
            replacedImage.width = image.getAttribute('width');
            parent.replaceChild(replacedImage, image);
            this.announce('imagerjs.imageUpdated', {image: replacedImage, newsrc: src, DOMcached: true});
        } else {
            if (!this.preload) {
                this.replaceImageNode(image, src, this);
            } else {
                this.executeAfterImagePreload(this.replaceImageNode, image, src, this);
            }
        }
    };


    Imager.prototype.replaceImageNode = function (image, src, self) {
        var replacedImage = image.cloneNode(false),
            parent = image.parentNode;
        replacedImage.src = src;
        self.cache[src] = replacedImage;
        parent.replaceChild(replacedImage, image);
        self.announce('imagerjs.imageUpdated', {image: replacedImage, newsrc: src, DOMcached: false});
    };


    Imager.prototype.replaceCSSBackgroundImage = function (elem, src, self) {
        elem.style.backgroundImage = 'url(' + src + ')';
        self.announce('imagerjs.imageUpdated', {image: elem, newsrc: src, DOMcached: false});
    };


    Imager.prototype.determineAppropriateResolution = function (image) {
        var src           = image.getAttribute('data-src'),
            imageWidth    = image.clientWidth,
            selectedWidth = this.availableWidths[0],
            i             = this.availableWidths.length;

        while (i--) {
            if (imageWidth <= this.availableWidths[i]) {
                selectedWidth = this.availableWidths[i];
            }
        }

        return this.changeImageSrcToUseNewImageDimensions(src, selectedWidth);
    };


    Imager.prototype.changeImageSrcToUseNewImageDimensions = function (src, selectedWidth) {
        var self = this;
        return src.replace(this.regex, function (match, mode, width, height, crop, bg, path, offset, whole) {
            if (self.retina && self.isRetina) {
                selectedWidth *= 2;
            }
            switch (mode) {
                case "0":
                    return '/image/0/' + path;
                case "1":
                case "4":
                    return '/image/' + mode + '/' + selectedWidth + '/0/' + path;
                case "2":
                case "3":
                    var newHeight = Math.ceil((selectedWidth / width) * parseInt(height, 10));
                    var newsrc = '/image/' + mode + '/' + selectedWidth + '/' + newHeight + '/' + crop + '/';
                    if (bg !== undefined) {
                        newsrc += bg + '/';
                    }
                    return newsrc + path;
            }
        });
    };


    Imager.prototype.determineIfRetina = function () {
        var isRetina = ( window.devicePixelRatio > 1.5 || (window.matchMedia && window.matchMedia("(-webkit-min-device-pixel-ratio: 1.5),(min--moz-device-pixel-ratio: 1.5),(-o-min-device-pixel-ratio: 3/2),(min-device-pixel-ratio: 1.5),(min-resolution: 114dpi),(min-resolution: 1.5dppx)").matches));
        if (this.events && this.eventsRetina) {
            this.announce('imagerjs.retinaStatus', {status: isRetina});
        }
        return isRetina;
    };


    Imager.prototype.debouncer = function (func, threshold, execAsap) {
        var timeout;
        return function debounced () {
            var obj = this, args = arguments;
            function delayed () {
                if (!execAsap)
                    func.apply(obj, args);
                timeout = null;
            }
            if (timeout) {
                clearTimeout(timeout);
            } else if (execAsap) {
                func.apply(obj, args);
            }
            timeout = setTimeout(delayed, threshold || 100);
        };
    };


    Imager.prototype.announce = function(name, detail) {
        if (this.events && window.CustomEvent) {
            var event = new CustomEvent(name, {detail: detail, bubbles: this.eventsBubble, cancelable: this.eventsCancelable});
            window.dispatchEvent(event);
        }
    };

}(window, document));

// IE 9/10 CustomEvent Polyfill
(function () {
    if (window.CustomEvent) { // prevent IE8 throwing its teddies out of the pram
        var CustomEvent = function( event, params ) {
            params = params || { bubbles: false, cancelable: false, detail: undefined };
            var evt = document.createEvent( 'CustomEvent' );
            evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
            return evt;
        };

        CustomEvent.prototype = window.CustomEvent.prototype;

        window.CustomEvent = CustomEvent;
    }
})();

