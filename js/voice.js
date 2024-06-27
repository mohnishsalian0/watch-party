// =============== GLOBAL VARIABLES ===============

let peerConnection;
let localStream;
let remoteStream = new MediaStream();

let webcamButton;
let webcamVideo;
let callButton;
let answerButton;
let remoteVideo;
let hangupButton;

let port;

// =============== UTIL FUNCTIONS ===============

// =============== HANDLER FUNCTIONS ===============

function handlePortConnect(msg) {
  console.log("[Watch party voice] Received message from background: ", msg);
  if (msg.topic === "call:offer") handleOffer(msg);
  else if (msg.topic === "call:answer") handleAnswer(msg);
  else if (msg.topic === "call:existingCandidates")
    handleExistingCandidatesList(msg);
  else if (msg.topic === "call:newCandidate") handleNewCandidate(msg);
}

function handlePortDisconnect() {
  port = undefined;
  console.log("[Watch party voice] Port has disconnected");
}

function handleOffer(msg) {
  const offerDescription = new RTCSessionDescription(msg.payload.offer);
  peerConnection.setRemoteDescription(offerDescription);
}

function handleAnswer(msg) {
  const answerDescription = new RTCSessionDescription(msg.payload.answer);
  peerConnection.setRemoteDescription(answerDescription);
}

function handleExistingCandidatesList(msg) {
  msg.payload.candidates.forEach((c) => {
    const candidate = new RTCIceCandidate(c);
    peerConnection.addIceCandidate(candidate);
  });
}

function handleNewCandidate(msg) {
  const candidate = new RTCIceCandidate(msg.payload);
  peerConnection.addIceCandidate(candidate);
}

function handleOnIceCandidate(event) {
  event.candidate &&
    port.postMessage({
      topic: "call:newCandidate",
      payload: event.candidate.toJSON(),
    });
}

function handleOnTrack(event) {
  // FIXME:
  console.log("Track received asdljflasdkjfalkj");
  event.streams[0].getTracks().forEach((track) => {
    remoteStream.addTrack(track);
  });
}

// =============== MAIN FUNCTIONS ===============

function getDOMElements() {
  webcamButton = document.getElementById("webcamButton");
  webcamVideo = document.getElementById("webcamVideo");
  callButton = document.getElementById("callButton");
  answerButton = document.getElementById("answerButton");
  remoteVideo = document.getElementById("remoteVideo");
  hangupButton = document.getElementById("hangupButton");
}

function setupPeerConnection() {
  const servers = {
    iceServers: [
      {
        urls: [
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
        ],
      },
    ],
    iceCandidatePoolSize: 10,
  };
  peerConnection = new RTCPeerConnection(servers);

  // Send over gathered ice candidates to server
  peerConnection.onicecandidate = handleOnIceCandidate;

  // Pull tracks from remote stream, add to video stream
  peerConnection.ontrack = handleOnTrack;
}

function setupPort() {
  port = chrome.runtime.connect({ name: "voice-background" });
  port.onMessage.addListener(handlePortConnect);
  port.onDisconnect.addListener(handlePortDisconnect);
}

async function attachDOMListeners() {
  // 1. Setup media sources

  webcamButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      // audio: true,
    });

    // Push tracks from local stream to peer connection
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    webcamVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;

    callButton.disabled = false;
    answerButton.disabled = false;
    webcamButton.disabled = true;
  };

  // 2. Create an offer
  callButton.onclick = async () => {
    // Create offer
    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);
    port.postMessage({
      topic: "call:offer",
      payload: { offer: offerDescription },
    });

    hangupButton.disabled = false;
  };

  // 3. Answer the call with the unique ID
  answerButton.onclick = async () => {
    peerConnection.onicecandidate = (event) => {
      event.candidate &&
        port.postMessage({
          topic: "call:candidate",
          payload: event.candidate.toJSON(),
        });
    };

    const answerDescription = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answerDescription);
    port.postMessage({
      topic: "call:answer",
      payload: { answer: answerDescription },
    });
  };
}

function runCleanup() {
  localStream?.getTracks().forEach((track) => track.stop());
  remoteStream?.getTracks().forEach((track) => track.stop());
  peerConnection?.close();
  peerConnection = undefined;

  port.disconnect();
  port = undefined;
}

function main() {
  getDOMElements();
  setupPeerConnection();
  setupPort();
  attachDOMListeners();
}

function init() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
}

// =============== INITIALIZATION ===============

init();

chrome.runtime.onMessage.addListener((msg) => {
  console.log("[Watch party voice] Received message from background: ", msg);

  if (msg.socketConnected) {
    console.log(
      "[Watch party voice] Socket has connected. Initializing setup...",
    );
    init();
  } else if (msg.socketDisconnected) {
    console.log(
      "[Watch party voice] Socket has disconnected. Running cleanup...",
    );
    runCleanup();
  }
});
