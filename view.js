"use strict";
/*  Copyright Ted Tibbetts 2015.  Licensed under the GPL.
    See file COPYING for details.
    */

/* Helper entities
*/

function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}

function ParseError(message) {
    this.message = message;
    this.stack = (new Error()).stack;
}
ParseError.prototype = Object.create(Error.prototype);
ParseError.prototype.name = "ParseError";

parseYoutubeHash = function (url) {
    // Returns the YouTube hash (value of the `v` param)
    // TODO: implement proper parsing using a URL parsing library
    var match = url.match(/[^a-zA-Z]v=[0-9a-zA-Z]*/);
    if (match) {
        return match[0].substr(3);
    } else {
        throw ParseError("Invalid Youtube URL.");
    }
};

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
    },
    button.toggle = function () {
        if (this.enabled) {
            this.setState(false);
        } else {
            this.setState(true);
        }
    }

    button.setState(enabled);
    button.onclick = button.toggle.bind(button);

    return button;
};

/*  View: encapsulates viewing of a loop, full clip, or still image.
    Constructor defines helper functions and sets callbacks
    on the DOM elements passed to it.
    */
function View() {

}

View.prototype = {
    controls: {};

    defaults: {
        source_url: "https://www.youtube.com/watch?v=2Tjp0mRb4XA",
        mp4source: "youtubeinmp4",
        paused: false,
        loop_enabled: false,
        loopstart: "36", loopend: "40.4",
        playback_speed: "1.0",
        current_time: "30",
        video_width: "720"
    },

    /*  Creates controls for the view.
        Static method (doesn't use `this`).
        `parentEl`: the DOM element under which the controls are created.
        Return: object containing the control nodes for the view.
        */
    createControls: function(parentEl) {
        var controls;

        function createTextElement(text) {
            var newElement = parentEl.ownerDocument.createTextElement(text);
            parentEl.appendNode(newElement);
            return newElement;
        };
        function createChildElement(parentEl, type) {
            var newElement = parentEl.ownerDocument.createElement(type);
            parentEl.appendNode(newElement);
            return newElement;
        };
        var createElement = createChildElement.bind(undefined, parentEl);
        function createOptionElement(selectElement, value, text) {
            var newElement = createChildElement(selectElement, "option");
            newElement.value = value;
            newElement.innerText = text;
            return newElement;
        };
        function createButtonElement(label) {
            var newElement = createElement("button");
            newElement.innerText = label;
            return newElement;
        };

        createTextElement("Youtube URL:");
        controls.sourceURL = createElement("input");
        createElement("br");
        createTextElement("MP4 Source:");
        controls.mp4Source = createElement("select");
        createOptionElement(controls.mp4Source, "youtubeinmp4",
            "Youtubeinmp4 (expect loading delays)");
        createOptionElement(controls.mp4Source, "localfile",
            "Local file (debug only)");
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
        // TODO: set Video url
        controls.video = createElement("video");

        return controls;
    },

    /*  Configures the view's control elements.
        Changes to control elements are not necessarily propagated
        to video behaviour; call applyControlsToVideo() to do that.
        `params`: parsed query string parameters.
    */
    configureControls: function (controls, params) {
        for (var param in params) {
            if (params.hasOwnProperty(param)) {
                switch (param) {
                    case "source_url":
                        controls.video.src = params[param]; break;
                    case "mp4source":
                        controls.mp4source.value = params[param]; break;
                    case "paused":
                        // TODO: make sure this doesn't trigger something
                        //       if that is important
                        controls.playButton.setValue(!params[param]); break;
                    case "loop_enabled":
                        controls.loopButton.setValue(params[param]); break;
                    case "loopstart":
                        controls.loopStartInput.value = params[param]; break;
                    case "loopend":
                        controls.loopEndInput.value = params[param]; break;
                    case "playback_speed":
                        controls.speedInput.value = params[param]; break;
                    case "current_time":
                        controls.currentTimeInput.value = params[param]; break;
                    case "video_width":
                        controls.video.width = params[param]; break;
                };
            };
        };

        return controls;
    },

    setEventHandlers: function (controls) {
        controls.sourceURL.onchange = function () {
            // Reset the video to defaults but keep the mp4source setting.
            this.updateVideoURL();
            var controlSettings = clone(this.defaults);
            delete controlSettings.mp4source;
            this.configureControls(controls, controlSettings);
            this.applyControlsToVideo();
        }.bind(this);

        controls.mp4Source.onchange = function() {
            // Keep all settings the same.
            // I think this requires applying them to the new video.
            this.applyControlsToVideo(controls);
        }.bind(this);

        controls.playButton.onenable = function () {
            controls.video.paused = false;
        };
        controls.playButton.ondisable = function () {
            controls.video.paused = true;
        };

        // loopButton doesn't need event handlers
        // ( other than that registered by toggleButton() )
        // because we just check its state in currentTimeInput.onchange()

        controls.speedInput.onchange = function () {
            controls.video.setPlaybackSpeed(controls.speedInput.value);
        };

        controls.currentTimeInput.onchange = function () {
            controls.video.currentTime = controls.currentTimeInput.value;
        };

        controls.video.ontimeupdate = function () {
            var loopEnabled = controls.loopButton.enabled;
            var loopStartTime = controls.loopStartInput.value;
            var currentTime = controls.video.currentTime;
            var loopEndTime = controls.loopEndInput.value;

            if (loopEnabled && currentTime >= loopEndTime) {
                controls.video.currentTime = loopStartTime;
            }

            controls.currentTimeInput.value = controls.video.currentTime;
        };
    },

    /*  Updates the URL of the video control
        based on the source URL and the mp4 source.
        */
    updateVideoURL: function () {
        var newVideoURL;
        switch (controls.mp4source.value) {
            "youtubeinmp4":
                newVideoURL = "http://www.youtubeinmp4.com/redirect.php?video="
                    + parseYoutubeHash(controls.sourceURL.value);
                break;
            "localfile":
                newVideoURL = "Acropedia Teacher Training Prereqs.mp4";
                break;
        };
        video.src = newVideoURL;
    },

    /*  Resets the controls to defaults.
        This doesn't propagate changes to the video.
        */
    resetControls: function (controls) {
        this.configureControls(controls, this.defaults)
    },

    /*  Sets properties of the video control
        to reflect settings of the other controls.
        Sets the URL first; this should allow the values of the other controls
        - current time, playback speed, etc. - to be applied to the new video.
        */
    applyControlsToVideo: function(controls) {
        var video = controls.video;

        // Save values of controls prior to changing video src property.
        // This is in case loading of the new video triggers events
        // - e.g. timeupdate -
        // whose handlers change control values.
        var playbackSpeed = controls.speedInput.value;
        var currentTime = controls.currentTimeInput.value;
        var paused = !controls.playButton.enabled;

        video.paused = true;
        this.updateVideoURL();
        // TODO: insert delay here?

        // loops are implemented via our event handlers,
        // so nothing needs to be done here for that
        video.playbackSpeed = playbackSpeed;
        video.currentTime = currentTime;
        video.paused = paused;
    }
};

////////////////////

function View(youtubeURL, useYoutubeInMP4, useLocalFile,
              playButton, seekButton, currentTimeInput,
              loopButton, loopStartInput, loopEndInput,
              speedInput,
              video) {
    this.youtubeURL = youtubeURL;
    this.useYoutubeInMP4 = useYoutubeInMP4;
    this.useLocalFile = useLocalFile;
    this.playButton = playButton;
    this.seekButton = seekButton;
    this.currentTimeInput = currentTimeInput;
    this.loopButton = loopButton;
    this.loopStartInput = loopStartInput;
    this.loopEndInput = loopEndInput;
    this.speedInput = speedInput;
    this.video = video;

    this.loop = {
        active: false,
        start: null,
        end: null
    };

    var view = this; //?? is this necessary?
        // IE what is `this` within the context of a local fn?
        //!!  This prevents prototypal inheritance from working.  Right?
        //    IE handlers need to be remapped when another view
        //      is cloned off of this one.

    /* UNDERLYING BEHAVIOUR ******
    */
    this.seek = function (time) {
        this.video.currentTime = time;
    };

    this.setLoop = function (loopstart, loopend) {
        this.loop.start = loopstart;
        this.loop.end = loopend;
    };

    this.startLoop = function () {
        this.loop.active = true;
    };

    this.endLoop = function () {
        this.loop.active = false;
    };

    this.setPlaybackSpeed = function (playbackSpeed) {
        this.video.playbackRate = playbackSpeed;
    };

    this.parseYoutubeHash = function (url) {
        // Returns the YouTube hash (value of the `v` param)
        // TODO: implement proper parsing using a URL parsing library
        var match = url.match(/[^a-zA-Z]v=[0-9a-zA-Z]*/);
        if (match) {
            return match[0].substr(3);
        } else {
            alert("Invalid Youtube URL.");
        }
    };

    this.MP4FetchMethods = {
        "youtubeinmp4": function (url) {
            return "http://www.youtubeinmp4.com/redirect.php?video="
                + this.parseYoutubeHash(url);
        }.bind(this),
        "localfile": function (url) {
            // This is just implemented for the TT prereqs, as a debug option
            return "Acropedia Teacher Training Prereqs.mp4";
        }.bind(this)
    };

    this.getMP4URL = function (url) {
        if (this.useYoutubeInMP4.checked) {
            return this.MP4FetchMethods.youtubeinmp4(url);
        }
        return this.MP4FetchMethods.localfile(url);
    };
    this.setVideoURL = function () {
        this.video.src = this.getMP4URL(this.youtubeURL.value);
        // TODO: encapsulate this
        this.loop.active = false;
        this.loopButton.innerText = "Loop";
        this.currentTimeInput.value = 0;

        // not sure if setting the video URL changes paused state.
        // keep the button synchronized with the possibly changing state.
        // TODO: encapsulate this
        if (this.video.paused) {
            this.playButton.innerText = "PLAY";
        } else {
            this.playButton.innerText = "PAUSE";
        }
    };

    /* HANDLERS ******
    */

    // Update the video URL whenever the source Youtube URL
    //  or the mp4 source changes
    this.useYoutubeInMP4.onchange = this.useLocalFile.onchange
        = this.youtubeURL.onchange = this.setVideoURL.bind(this);

    this.playButton.onclick = function () {
        if (view.video.paused) {
            view.video.play();
            view.playButton.innerText = "PAUSE";
        } else {
            view.video.pause();
            view.playButton.innerText = "PLAY";
        }
    };

    this.seekButton.onclick = function () { view.seek(30.6); };

    this.currentTimeInput.onchange = function () {
        this.seek(this.currentTimeInput.value);
    }.bind(this);

    this.video.ontimeupdate = function () {
        view.currentTimeInput.value = view.video.currentTime;
        if (view.loop.active && view.video.currentTime >= view.loop.end) {
            view.video.currentTime = view.loop.start;
        }
    };

    this.loopButton.onclick = function () {
        if (view.loop.active) {
            view.endLoop();
            view.loopButton.innerText = "Loop";
        } else {
            view.setLoop(view.loopStartInput.value, view.loopEndInput.value);
            view.startLoop();
            view.loopButton.innerText = "End Loop";
        }
    };
    this.loopStartInput.onchange = this.loopEndInput.onchange = function () {
        view.setLoop(view.loopStartInput.value, view.loopEndInput.value);
    };

    this.speedInput.onchange = function () {
        view.setPlaybackSpeed(view.speedInput.value);
    };

    /* SETUP CODE ******
    */

    this.setVideoURL();
}
