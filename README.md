# Overview
facedetector is a javascript library for real-time face detection.

This library is based on the work of Martin Tschirsich's [js-objectdetect](https://github.com/mtschirs/js-objectdetect).

Watch [this video](https://www.youtube.com/watch?v=TP4lxliMHXY) for a short demonstration.

<a href="https://www.youtube.com/watch?v=TP4lxliMHXY"><img src="https://riversun.github.io/img/facedetector/facedetector_demo.gif"></a>

*facedetector* is distributed under [MIT license](https://opensource.org/licenses/MIT).
The included *.js files are subject to [their own licenses](https://raw.githubusercontent.com/riversun/facedetector/master/LICENSE.txt?token=ALNAhFnQvwD-8sIxK9_f-Hp1FdyKVJhVks5aGB9xwA%3D%3D).

# Functions
- Multiple faces can be detected
- Implemented a simple tracking algorithm

# Example
Online realtime-face-detecting example here.  
https://riversun.github.io/facedetector/example/index.html

# Usage

```javascript

var videoTag=document.getElementById("video");
var faceDetector = new FaceDetector(
      {
          video: videoTag,
          flipLeftRight: false,
          flipUpsideDown: false
      }
  );

  faceDetector.setOnFaceAddedCallback(function (addedFaces, detectedFaces) {
      for (var i = 0; i < addedFaces.length; i++) {
          console.log("[facedetector] New face detected id=" + addedFaces[i].faceId + " index=" + addedFaces[i].faceIndex);
      }
  });

  faceDetector.setOnFaceLostCallback(function (lostFaces, detectedFaces) {
      for (var i = 0; i < lostFaces.length; i++) {
          console.log("[facedetector] Face removed id=" + lostFaces[i].faceId + " index=" + lostFaces[i].faceIndex);
      }
  });

  faceDetector.setOnFaceUpdatedCallback(function (detectedFaces) {
      for (var i = 0; i < detectedFaces.length; i++) {
          var face = detectedFaces[i];
          console.log(face.faceId+" x="+face.x+" y="+face.y+" w="+ face.width+" h="+face.height );
      }
  });

  //after getUserMedia
  faceDetector.startDetecting();

```


## Run on node.js

You can import library with npm.

**Install**

```
npm install facedetector
```

## Run on browser


Download actual files  
- [FaceDetector.js](https://raw.githubusercontent.com/riversun/facedetector/master/dist/FaceDetector.js)

```
<script src="FaceDetector.js"></script>
```
