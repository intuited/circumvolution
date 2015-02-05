"use strict";
/*  Copyright Ted Tibbetts 2015.  Licensed under the GPL.
    See file COPYING for details.
    */

/* Helper entities
*/

function clone(obj) {
    var copy, attr;

    if (null === obj || "object" !== typeof obj) { return obj; }
    copy = obj.constructor();
    for (attr in obj) {
        if (obj.hasOwnProperty(attr)) { copy[attr] = obj[attr]; }
    }
    return copy;
}

function ParseError(message) {
    this.message = message;
    this.stack = (new Error()).stack;
}
ParseError.prototype = Object.create(Error.prototype);
ParseError.prototype.name = "ParseError";

function parseYoutubeHash(url) {
    // Returns the YouTube hash (value of the `v` param)
    // TODO: implement proper parsing using a URL parsing library
    var e, parsedQueryString = URI.parseQuery(URI.parse(url).query);
    try {
        return parsedQueryString.v;
    } catch (e) {
        throw new ParseError("Invalid Youtube URL.");
    }
}

/*  toggleButton: handles toggling a button between enabled and disabled states.
    Extends the button node returned by document.createElement,
        adding setState(), toggle(), and enabled
    `onenable` and `ondisable` handlers are called when the state changes.
    */
function toggleButton(button, enabledText, disabledText, enabled) {
    button.onenable = button.ondisable = undefined;

    button.setState = function (enabled) {
        this.enabled = enabled;
        if (enabled) {
            this.innerText = enabledText;
            if (this.onenable) {
                this.onenable();
            }
        } else {
            if (this.ondisable) {
                this.ondisable();
            }
            this.innerText = disabledText;
        }
    };
    button.toggle = function () {
        if (this.enabled) {
            this.setState(false);
        } else {
            this.setState(true);
        }
    };

    button.setState(enabled);
    button.onclick = button.toggle.bind(button);

    return button;
}

/*  View: encapsulates viewing of a loop, full clip, or still image.
    Constructor defines helper functions and sets callbacks
    on the DOM elements passed to it.
    */
function View(parentEl, options) {
    var option;

    for (option in this.defaults) {
        if (this.defaults.hasOwnProperty(option)) {
            if (!(option in options)) {
                options[option] = this.defaults[option];
            }
        }
    }

    this.createControls(parentEl)
    this.configureControls(options)
    this.applyControlsToVideo()
    this.setEventHandlers();
    return this;
}

View.prototype = {
    defaults: {
        source_url: "https://www.youtube.com/watch?v=2Tjp0mRb4XA",
        mp4source: "youtubeinmp4",
        paused: false,
        loop_enabled: false,
        loopstart: "36",
        loopend: "40.4",
        playback_speed: "1.0",
        current_time: "30.6",
        video_width: "720"
    },

    /*  Creates controls for the view.
        Static method (doesn't use `this`).
        `parentEl`: the DOM element under which the controls are created.
        Return: object containing the control nodes for the view.
        */
    createControls: function (parentEl) {
        var createElement, controls = {};

        function createTextElement(text) {
            var newElement = parentEl.ownerDocument.createTextNode(text);
            parentEl.appendChild(newElement);
            return newElement;
        }
        function createChildElement(parentEl, type) {
            var newElement = parentEl.ownerDocument.createElement(type);
            parentEl.appendChild(newElement);
            return newElement;
        }
        createElement = createChildElement.bind(undefined, parentEl);
        function createOptionElement(selectElement, value, text) {
            var newElement = createChildElement(selectElement, "option");
            newElement.value = value;
            newElement.innerText = text;
            return newElement;
        }
        function createButtonElement(label) {
            var newElement = createElement("button");
            newElement.innerText = label;
            return newElement;
        }

        createTextElement("Youtube URL:");
        controls.sourceURL = createElement("input");
        controls.sourceURL.size = 60;
        createElement("br");
        createTextElement("MP4 Source:");
        controls.mp4Source = createElement("select");
        createOptionElement(controls.mp4Source, "youtubeinmp4",
            "Youtubeinmp4 (expect loading delays)");
        createOptionElement(controls.mp4Source, "localfile",
            "Local file (debug only)");
        createElement("br");
        // TODO: some redundancy to kill here
        controls.playButton = toggleButton(createButtonElement("PLAY"),
            "PAUSE", "PLAY", false);
        controls.loopButton = toggleButton(createButtonElement("Loop"),
            "End loop", "Loop", false);
        createTextElement("from");
        controls.loopStartInput = createElement("input");
        createTextElement("to");
        controls.loopEndInput = createElement("input");
        createElement("br");
        createTextElement("Playback speed:");
        controls.speedInput = createElement("input");
        createTextElement("Current time:");
        controls.currentTimeInput = createElement("input");
        createElement("br");
        // TODO: set Video url
        controls.video = createElement("video");
        createElement("br");
        controls.generateURLButton = createElement("button");
        controls.generateURLButton.innerText = "Generate URL for current settings";
        controls.generatedURL = createElement("input");
        controls.generatedURL.size = 100;

        this.controls = controls;
        return this;
    },

    /*  Sets initial values for the view's control elements.
        Changes to control elements are not necessarily propagated
        to video behaviour; call applyControlsToVideo() to do that.
        `params`: parsed query string parameters.
    */
    configureControls: function (params) {
        var controls = this.controls,
            param;

        for (param in params) {
            if (params.hasOwnProperty(param)) {
                switch (param) {
                case "source_url":
                    controls.sourceURL.value = params[param];
                    break;
                case "mp4source":
                    controls.mp4Source.value = params[param];
                    break;
                case "paused":
                    // TODO: make sure this doesn't trigger something
                    //       if that is important
                    controls.playButton.setState(!Number(params[param]));
                    break;
                case "loop_enabled":
                    controls.loopButton.setState(Number(params[param]));
                    break;
                case "loopstart":
                    controls.loopStartInput.value = params[param];
                    break;
                case "loopend":
                    controls.loopEndInput.value = params[param];
                    break;
                case "playback_speed":
                    controls.speedInput.value = params[param];
                    break;
                case "current_time":
                    controls.currentTimeInput.value = params[param];
                    break;
                case "video_width":
                    controls.video.width = params[param];
                    break;
                }
            }
        }

        return this;
    },

    setEventHandlers: function () {
        var controls = this.controls;

        controls.sourceURL.onchange = function () {
            // Reset the video to defaults but keep the mp4source setting.
            this.updateVideoURL();
            var controlSettings = clone(this.defaults);
            delete controlSettings.mp4source;
            delete controlSettings.source_url;
            this.configureControls(controlSettings);
            this.applyControlsToVideo();
        }.bind(this);

        controls.mp4Source.onchange = function () {
            // Keep all settings the same.
            // I think this requires applying them to the new video.
            this.applyControlsToVideo(controls);
        }.bind(this);

        controls.playButton.onenable = function () {
            controls.video.play();
        };
        controls.playButton.ondisable = function () {
            controls.video.pause();
        };

        // loopButton doesn't need event handlers
        // ( other than that registered by toggleButton() )
        // because we just check its state in currentTimeInput.onchange()

        controls.speedInput.onchange = function () {
            controls.video.playbackRate = controls.speedInput.value;
        };

        controls.currentTimeInput.onchange = function () {
            controls.video.currentTime = controls.currentTimeInput.value;
        };

        controls.video.ontimeupdate = function () {
            var loopEnabled = controls.loopButton.enabled,
                loopStartTime = controls.loopStartInput.value,
                currentTime = controls.video.currentTime,
                loopEndTime = controls.loopEndInput.value;

            if (loopEnabled && currentTime >= loopEndTime) {
                controls.video.currentTime = loopStartTime;
            }

            controls.currentTimeInput.value = controls.video.currentTime;
        };

        controls.generateURLButton.onclick = function () {
            var url = URI(controls.video.ownerDocument.documentURI);
            url.query({
                "source_url": controls.sourceURL.value,
                "mp4source": controls.mp4Source.value,
                "paused": Number(!controls.playButton.enabled),
                "loop_enabled": Number(controls.loopButton.enabled),
                "loopstart": controls.loopStartInput.value,
                "loopend": controls.loopEndInput.value,
                "playback_speed": controls.speedInput.value,
                "current_time": controls.currentTimeInput.value,
                "video_width": controls.video.width
            });
            controls.generatedURL.value = url;
        };

        return this;
    },

    /*  Updates the URL of the video control
        based on the source URL and the mp4 source.
        */
    updateVideoURL: function () {
        var controls = this.controls,
            newVideoURL;

        switch (controls.mp4Source.value) {
        case "youtubeinmp4":
            newVideoURL = "http://www.youtubeinmp4.com/redirect.php?video="
                + parseYoutubeHash(controls.sourceURL.value);
            break;
        case "localfile":
            newVideoURL = "Acropedia Teacher Training Prereqs.mp4";
            break;
        // TODO: add default case
        }
        controls.video.src = newVideoURL;

        return this;
    },

    /*  Resets the controls to defaults.
        This doesn't propagate changes to the video.
        */
    resetControls: function () {
        this.configureControls(this.defaults);

        return this;
    },

    /*  Sets properties of the video control
        to reflect settings of the other controls.
        Sets the URL first; this should allow the values of the other controls
        - current time, playback speed, etc. - to be applied to the new video.
        */
    applyControlsToVideo: function () {
        // Save values of controls prior to changing video src property.
        // This is in case loading of the new video triggers events
        // - e.g. timeupdate -
        // whose handlers change control values.
        var controls = this.controls,
            video = controls.video,
            playbackRate = controls.speedInput.value,
            currentTime = controls.currentTimeInput.value,
            paused = !controls.playButton.enabled;

        video.pause();
        this.updateVideoURL();
        // TODO: insert delay here?

        // loops are implemented via our event handlers,
        // so nothing needs to be done here for that
        video.playbackRate = playbackRate;
        video.currentTime = currentTime;
        if (paused) { video.pause(); }
        else { video.play(); }

        return this;
    }
};
