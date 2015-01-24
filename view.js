"use strict";

/*  View: encapsulates viewing of a loop, full clip, or still image.
    Constructor defines helper functions and sets callbacks
    on the DOM elements passed to it.
    */
function View(playButton, seekButton,
              loopButton, loopStartInput, loopEndInput,
              video) {
    this.playButton = playButton;
    this.seekButton = seekButton;
    this.loopButton = loopButton;
    this.loopStartInput = loopStartInput;
    this.loopEndInput = loopEndInput;
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

    // handlers
    this.playButton.onclick = function () {
        if (view.video.paused) {
            view.video.play();
            view.playButton.innerText = "PAUSE";
        } else {
            view.video.pause();
            view.playButton.innerText = "PLAY";
        }
    };

    this.seekButton.onclick = function () { view.seek(30); };

    this.video.ontimeupdate = function () {
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
            view.loopButton.innerText = "End Loop";
        }
    };

    // underlying behaviour
    this.seek = function (time) {
        this.video.currentTime = time;
    };

    this.setLoop = function (loopstart, loopend) {
        this.loop.start = loopstart;
        this.loop.end = loopend;
        this.loop.active = true;
    };

    this.endLoop = function () {
        this.loop.active = false;
        this.loop.start = null;
        this.loop.end = null;
    };
}
