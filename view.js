"use strict";
/*  Copyright Ted Tibbetts 2015.  Licensed under the GPL.
    See file COPYING for details.
    */

/*  View: encapsulates viewing of a loop, full clip, or still image.
    Constructor defines helper functions and sets callbacks
    on the DOM elements passed to it.
    */
function View(youtubeURL, useYoutubeInMP4, useLocalFile,
              playButton, seekButton,
              loopButton, loopStartInput, loopEndInput,
              speedInput,
              video) {
    this.youtubeURL = youtubeURL;
    this.useYoutubeInMP4 = useYoutubeInMP4;
    this.useLocalFile = useLocalFile;
    this.playButton = playButton;
    this.seekButton = seekButton;
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

    this.MP4FetchMethods = {
        "youtubeinmp4": function (url) {
            // for now, just return the URL for the TT prereqs
            return "http://www.youtubeinmp4.com/redirect.php?video=2Tjp0mRb4XA";
        },
        "localfile": function (url) {
            // This is just implemented for the TT prereqs, as a debug option
            return "Acropedia Teacher Training Prereqs.mp4";
        }
    };

    this.getMP4URL = function (url) {
        if (this.useYoutubeInMP4.checked) {
            return this.MP4FetchMethods.youtubeinmp4(url);
        }
        return this.MP4FetchMethods.localfile(url);
    };
    this.setVideoURL = function () {
        this.video.src = this.getMP4URL(this.youtubeURL.value);
    };

    /* HANDLERS ******
    */

    // Update the video URL whenever the source Youtube URL
    //  or the mp4 source changes
    this.useYoutubeInMP4.onchange = this.useLocalFile
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

    this.setVideoURL();
}
