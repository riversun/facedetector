/*
 *
 * Copyright 2016-2017 Tom Misawa, riversun.org@gmail.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in the
 * Software without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
 * Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 *  INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */
var LowpassFilter = require('lowpassf');
var Face = require('./Face.js');
var ObjectDetect = require('./objectdetect.js');
var FrontalFaceAlt = require('./objectdetect.frontalface_alt.js');

/**
 * Face detector
 *
 * @author Tom Misawa
 */
var FaceDetector = (function () {

        /**
         * Multi Face Detector / Tracker
         *
         * @param params
         * @constructor
         */
        function FaceDetector(params) {

            //After detecting the face for more than a certain number(default is 50) of times,
            // when it stabilizes, the face integration logic starts.
            this.MIN_NUM_OF_PREPARE_DETECTION = 50;

            this.DEFAULT_MAX_MOVING_DISTANCE_RATIO = 0.15;

            //For example, if detectHeight = 60,
            //face search uses the rectangle image that is shrinked to 60pixels height.
            //The longer the length of the detectHeight, the greater the load , longer the processing time.

            this.detectHeight = 60;
            
            if (params && params.detectHeight) {
                this.detectHeight = params.detectHeight;
            }

            //this value will be automatically adjusted.
            this.detectWidth = null;

            this.video = params.video;

            //Booleanvalue for mirroring
            this.flipLeftRight = params.flipUpsideDown;

            //Boolean value for upside-down
            this.flipUpsideDown = params.flipUpsideDown;

            this._onFaceUpdatedCallback = null;
            this._onFaceAddedCallback = null;
            this._onFaceLostCallback = null;

            this._lowpassFilter4faceCount = new LowpassFilter();
            this._lowpassFilter4faceCount.setSamplingRange(200);

            this._cachedFaces = {};

            this._onSnapShotCallback = null;
            this._snapShotCanvas = null;
            this._snapShotContext = null;

            this._ttlFaceIndex = 0;

        }

        //[begin]setter for facial detection callback ///////////////////////////////

        /**
         * Set callback when face detection processing is updated
         *
         * @param callbackFunc
         */
        FaceDetector.prototype.setOnFaceUpdatedCallback = function (callbackFunc) {
            var _this = this;
            _this._onFaceUpdatedCallback = callbackFunc;
        };

        /**
         * Set callback when new face is found
         *
         * @param callbackFunc
         */
        FaceDetector.prototype.setOnFaceAddedCallback = function (callbackFunc) {
            var _this = this;
            _this._onFaceAddedCallback = callbackFunc;
        };

        /**
         * Set callback when face is lost
         *
         * @param callbackFunc
         */
        FaceDetector.prototype.setOnFaceLostCallback = function (callbackFunc) {
            var _this = this;
            _this._onFaceLostCallback = callbackFunc;
        };
        //[end]setter for facial detection callback ///////////////////////////////

        /**
         * Start face detection
         */
        FaceDetector.prototype.startDetecting = function () {
            var _this = this;
            requestAnimationFrame(_this.doRawDetectionLoop.bind(_this));
        };


        FaceDetector.prototype.doRawDetectionLoop = function () {

            //(Pay attention to call with "bind" on the caller so that following "this" points "FaceDetector")
            var _this = this;

            requestAnimationFrame(_this.doRawDetectionLoop.bind(_this));

            var video = _this.video;

            if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
                // - if video stream is ready

                if (!_this.detector) {
                    // - if detector is not instanciated

                    //Use the tilde (~~) to round the decimal point of the value
                    _this.detectWidth = ~~(_this.detectHeight * video.videoWidth / video.videoHeight);

                    //Once know the size of the video, prepare the detector:
                    _this.detector = new ObjectDetect.detector(_this.detectWidth, _this.detectHeight, 1.1, new FrontalFaceAlt());
                }


                if (_this._onSnapShotCallback) {
                    // - if snapshotCallback set

                    //capture image from media stream.
                    _this._snapShotContext.drawImage(video, 0, 0, _this._snapShotCanvas.width, _this._snapShotCanvas.height);
                    var snapshotImageData = _this._snapShotContext.getImageData(0, 0, _this._snapShotCanvas.width, _this._snapShotCanvas.height);

                    this._onSnapShotCallback(snapshotImageData);
                }

                // Perform the actual detection

                
                var coords = _this.detector.detect(video, 1);

                //detected faces
                var rawDetectedFaces = [];

                if (coords[0]) {
                    //- when one or more faces are found

                    var numOfFacesFound = coords.length;

                    for (var i = 0; i < numOfFacesFound; i++) {

                        //Coordinate information of the i-th face
                        var coord = coords[i];

                        var faceArea = {};

                        if (_this.flipUpsideDown) {

                            // - if do upside-down
                            // then coordinate (0,0) is set at (left,bottom)

                            if (_this.flipLeftRight) {
                                // - if flip left-right
                                // then the position that becomes the starting point of the position (x, y) is (left, bottom) of the face area.
                                faceArea = {
                                    x: (_this.detectWidth - coord[0]) - coord[2],
                                    y: (_this.detectHeight - (coord[1] + coord[3])),
                                    width: coord[2],
                                    height: coord[3],
                                    rawX: coord[0],
                                    rawY: coord[1],
                                };

                            } else {
                                //- if normal(non-mirrored)
                                faceArea = {
                                    x: coord[0],
                                    y: (_this.detectHeight - (coord[1] + coord[3])),
                                    width: coord[2],
                                    height: coord[3],
                                    rawX: coord[0],
                                    rawY: coord[1],
                                };

                            }
                        } else {

                            //- if normal(do not upside-down)

                            if (_this.flipLeftRight) {
                                // - if flip left-right
                                // then the position that becomes the starting point of the position (x, y) is (left, bottom) of the face area.
                                faceArea = {
                                    x: (_this.detectWidth - coord[0]) - coord[2],
                                    y: coord[1],
                                    width: coord[2],
                                    height: coord[3],
                                    rawX: coord[0],
                                    rawY: coord[1],
                                };

                            } else {
                                //- if normal(non-mirrored)
                                faceArea = {
                                    x: coord[0],
                                    y: coord[1],
                                    width: coord[2],
                                    height: coord[3],
                                    rawX: coord[0],
                                    rawY: coord[1],
                                };

                            }
                        }

                        //set coordinate range to (0.0-1.0)
                        faceArea.x = (faceArea.x / _this.detectWidth);
                        faceArea.y = (faceArea.y / _this.detectHeight);
                        faceArea.width = (faceArea.width / _this.detectWidth);
                        faceArea.height = (faceArea.height / _this.detectHeight);

                        if ((0 < faceArea.x && faceArea.x < 1.0 ) &&
                            (0 < faceArea.y && faceArea.y < 1.0)) {
                            //- When x, y are within the specified range
                            rawDetectedFaces.push(faceArea);
                        }

                    }

                    //Sort in ascending(small number->big number) order of x coordinates
                    rawDetectedFaces.sort(function (a, b) {
                        if (a.x < b.x) return -1;
                        if (a.x > b.x) return 1;
                        return 0;
                    });

                    _this.doTrackDetectedFaces(rawDetectedFaces);


                } else {

                    //- If there are 0 face detection
                    // return an empty array
                    _this.doTrackDetectedFaces([]);
                }
            }

        };


        /**
         * Track(follow) the movement of the face as much as possible
         * @param rawDetectedFaces (array)
         */
        FaceDetector.prototype.doTrackDetectedFaces = function (rawDetectedFaces) {
            var _this = this;

            //Number of faces detected NOW
            var numOfCrrDetectedFaces = rawDetectedFaces.length;

            //Smooth the number of detected faces by using lowpass filter(moving average filter)
            //Because a face may sometimes be lost or detect for a moment due to the influence of detection noise
            _this._lowpassFilter4faceCount.putValue(numOfCrrDetectedFaces);


            //After detecting the face for more than a certain number of times,
            // when it stabilizes, the face integration logic starts.
            if (_this._lowpassFilter4faceCount.getTotalCount() > _this.MIN_NUM_OF_PREPARE_DETECTION) {

                //Calculate moving average by chronologically counting the number of detected faces, and let it be the number of faces.
                //(The reason why the weighted average is adopted for the number of faces
                // is because the face suddenly increases or decreases due to noise / chattering.
                var averageFaceCount = _this._lowpassFilter4faceCount.getFilteredValue();

                //Round the average face number, if it is 1.5 or more, make two faces visible
                var averageFaceCountRounded = Math.round(averageFaceCount);

                var newFace, cachedFace;

                var trackingFaces = [];

                var cacheKey;

                for (cacheKey in _this._cachedFaces) {

                    cachedFace = _this._cachedFaces[cacheKey];

                    //A flag indicating whether or not the position of the cached face has been updated is first set to false
                    cachedFace._isUpdatedFacePosition = false;

                    // Update cacehed face's position.
                    // The detected face's position CLOSEST to the cached face's position is considered as the destination of the cached face.
                    var updateSuccess = cachedFace.updateFace(rawDetectedFaces);

                    if (updateSuccess) {
                        // - If cached face position update success

                        // then update flag is set to true
                        cachedFace._isUpdatedFacePosition = true;
                        trackingFaces.push(cachedFace);
                    }

                }

                //When lost face for a moment
                for (cacheKey in _this._cachedFaces) {

                    cachedFace = _this._cachedFaces[cacheKey];

                    if (cachedFace._isUpdatedFacePosition == false) {
                        //- If there are faces that have not been matched yet at this point

                        //Judging that it was lost for a moment, return currently cached face.
                        trackingFaces.push(cachedFace);
                    }

                }

                //Sort
                trackingFaces.sort(function (a, b) {
                    if (a.x < b.x) return -1;
                    if (a.x > b.x) return 1;
                    return 0;
                });


                //Confirm increase and decrease of face
                if (Object.keys(_this._cachedFaces).length < averageFaceCountRounded) {
                    //- when the number of faces increases
                    // (When the number of detected faces is larger than the cached face)

                    var addedFaces = [];

                    for (var i = 0; i < numOfCrrDetectedFaces; i++) {

                        newFace = rawDetectedFaces[i];

                        if (newFace.consumed) {
                            //- When this face has already been processed (After being registered to a cached face list)
                            continue;
                        } else {
                            //- Not registered yet
                            newFace.consumed = true;
                        }

                        //create Face object for newly discovered face
                        var newFaceToCache = new Face(
                            {trackingDistanceRatio: _this.DEFAULT_MAX_MOVING_DISTANCE_RATIO}
                        );

                        newFaceToCache.updatePos(newFace.x, newFace.y);
                        newFaceToCache.updateSize(newFace.width, newFace.height);

                        //Assign the face number for tracking
                        newFaceToCache.faceId = "FACE_" + _this._ttlFaceIndex;
                        newFaceToCache.faceIndex = _this._ttlFaceIndex;

                        //Increment the total number of faces found  (Since it is not identifying individual face,
                        // even if they are the same (person's) face. So after the same person goes out of the camera screen,
                        // and once they come back again, this library regard it as different face)
                        _this._ttlFaceIndex++;

                        _this._cachedFaces[newFaceToCache.faceId] = newFaceToCache;

                        //Cache a newly discovered face
                        addedFaces.push(newFaceToCache);
                    }

                    if (_this._onFaceAddedCallback) {
                        if (addedFaces.length > 0) {
                            _this._onFaceAddedCallback(addedFaces, trackingFaces);
                        }
                    }

                } else if (Object.keys(_this._cachedFaces).length > averageFaceCountRounded) {
                    //- When the number of faces has decreased
                    // (If the number of faces detected is less than the cached face)

                    var lostFaces = [];

                    for (cacheKey in _this._cachedFaces) {

                        // "cachedFaces" means "tracking faces"
                        cachedFace = _this._cachedFaces[cacheKey];

                        if (cachedFace._isUpdatedFacePosition == false) {
                            delete _this._cachedFaces[cacheKey];
                            lostFaces.push(cachedFace);
                        }
                    }


                    if (_this._onFaceLostCallback) {
                        if (lostFaces.length > 0) {
                            _this._onFaceLostCallback(lostFaces, trackingFaces);
                        }
                    }

                    //When losing a face, stop processing here and prevent calling "onFaceUpdatecallback"
                    return;
                }

                if (_this._onFaceUpdatedCallback) {
                    if (trackingFaces.length > 0) {
                        _this._onFaceUpdatedCallback(trackingFaces);
                    }
                }

            }
        };

        /**
         *
         * Set still image snapshot callback
         * @param callbackFunc
         * @param width width of captured image
         * @param height height of captured image
         */
        FaceDetector.prototype.setOnSnapShotCallback = function (callbackFunc, width, height) {
            var _this = this;
            _this._onSnapShotCallback = callbackFunc;

            this._snapShotCanvas = document.createElement("canvas");
            this._snapShotCanvas.width = width;
            this._snapShotCanvas.height = height;
            this._snapShotContext = this._snapShotCanvas.getContext("2d");

        };

        /**
         * (Optional)
         * Detect skin area from Input Image
         * @param inputImage
         * @param outputImage detected skin-area is set to 255,non-skin-area is set to zero.
         * @returns {*}
         *
         * Example code for creating outputImage
         *  <code>
         *    var ctx = canvas.getContext("2d");
         *    var outputImage=ctx.createImageData(inputImage);
         *  </code>
         */
        FaceDetector.prototype.detectSkinArea = function (inputImage, outputImage) {
            var inp = inputImage.data, out = outputImage.data;


            var r, g, b, h, s, v, colorVal;
            var i;
            for (i = 0; i < inp.length; i += 4) {

                r = inp[i];
                g = inp[i + 1];
                b = inp[i + 2];

                var h, // 0-360
                    s, // 0.0-1.0
                    v, // 0.0-1.0
                    max = Math.max(Math.max(r, g), b),
                    min = Math.min(Math.min(r, g), b);

                if (max == min) {
                    h = 0;
                } else if (max == r) {
                    h = 60 * (g - b) / (max - min) + 0;
                } else if (max == g) {
                    h = (60 * (b - r) / (max - min)) + 120;
                } else {
                    h = (60 * (r - g) / (max - min)) + 240;
                }

                while (h < 0) {
                    h += 360;
                }
                s = (max == 0) ? 0 : (max - min) / max;//* 255;
                v = max / 255;

                colorVal = 0;

                //specify skin-color range
                if (0 < h && h < 50 && 0.23 < s && s < 0.68) {
                    colorVal = 255;
                } else {
                    colorVal = 128;
                }

                out[i] = colorVal;     //red
                out[i + 1] = colorVal; //green
                out[i + 2] = colorVal; //blue
                out[i + 3] = 255;      //alpha
            }

            outputImage.width = inputImage.width;
            outputImage.height = inputImage.height;

            return outputImage;
        };

        return FaceDetector;
    }()
);

module.exports = FaceDetector;