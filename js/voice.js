// =============== GLOBAL VARIABLES ===============

let peerConnections = {};
let remoteStreams = {};
let localStream;

let webcamVideo;
let remoteVideo;

let port;

// =============== UTIL FUNCTIONS ===============

function addVideoToDOM(userId) {
  const newVideoElem = remoteVideo.cloneNode(true);
  newVideoElem.id = userId;
  newVideoElem.srcObject = remoteStreams[userId];
  document.body.appendChild(newVideoElem);
}

function setupPeerConnection(userId) {
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
  peerConnections[userId] = new RTCPeerConnection(servers);

  // Send over gathered ice candidates to server
  peerConnections[userId].onicecandidate = (event) =>
    handleOnIceCandidate(event, userId);

  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
    peerConnections[userId].addTrack(track, localStream);
  });

  // Pull tracks from remote stream, add to video stream
  peerConnections[userId].ontrack = (event) => handleOnTrack(event, userId);
}

// =============== HANDLER FUNCTIONS ===============

function handlePortConnect(msg) {
  console.log("[Watch party voice] Received message from background: ", msg);
  if (msg.topic === "user:joined") handleUserJoined(msg);
  else if (msg.topic === "call:offer") handleOffer(msg);
  else if (msg.topic === "call:answer") handleAnswer(msg);
  else if (msg.topic === "call:candidate") handleCandidate(msg);
}

function handlePortDisconnect() {
  port = undefined;
  console.log("[Watch party voice] Port has disconnected");
}

async function handleUserJoined(msg) {
  const { userId } = msg.payload;
  setupPeerConnection(userId);
  addVideoToDOM(userId);
  const offerDescription = await peerConnections[userId].createOffer();
  await peerConnections[userId].setLocalDescription(offerDescription);
  port.postMessage({
    topic: "call:offer",
    payload: { offer: offerDescription, receiverId: userId },
  });
}

async function handleOffer(msg) {
  const { offer, senderId } = msg.payload;
  const offerDescription = new RTCSessionDescription(offer);
  setupPeerConnection(senderId);
  addVideoToDOM(senderId);
  peerConnections[senderId].setRemoteDescription(offerDescription);

  const answerDescription = await peerConnections[senderId].createAnswer();
  await peerConnections[senderId].setLocalDescription(answerDescription);
  port.postMessage({
    topic: "call:answer",
    payload: { answer: answerDescription, receiverId: senderId },
  });
}

function handleAnswer(msg) {
  const { answer, senderId } = msg.payload;
  const answerDescription = new RTCSessionDescription(answer);
  peerConnections[senderId].setRemoteDescription(answerDescription);
}

function handleCandidate(msg) {
  const { candidate, senderId } = msg.payload;
  const iceCandidate = new RTCIceCandidate(candidate);
  peerConnections[senderId].addIceCandidate(iceCandidate);
}

function handleOnIceCandidate(event, userId) {
  event.candidate &&
    port.postMessage({
      topic: "call:candidate",
      payload: { candidate: event.candidate.toJSON(), receiverId: userId },
    });
}

function handleOnTrack(event, userId) {
  remoteStreams[userId] = new MediaStream();
  event.streams[0].getTracks().forEach((track) => {
    remoteStreams[userId].addTrack(track);
  });
}

// =============== MAIN FUNCTIONS ===============

function getDOMElements() {
  webcamVideo = document.getElementById("webcamVideo");
  remoteVideo = document.getElementById("remoteVideo");
  remoteVideo.remove();
}

function setupPort() {
  port = chrome.runtime.connect({ name: "voice-background" });
  port.onMessage.addListener(handlePortConnect);
  port.onDisconnect.addListener(handlePortDisconnect);
}

async function setupLocalStream() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    // audio: true,
  });
  webcamVideo.srcObject = localStream;
}

function runCleanup() {
  localStream?.getTracks().forEach((track) => track.stop());
  Object.values(remoteStreams).forEach((rs) =>
    rs.getTracks().forEach((track) => track.stop()),
  );
  remoteStreams = {};
  Object.values(peerConnections).forEach((pc) => pc.close());
  peerConnections = {};

  port.disconnect();
  port = undefined;
}

function main() {
  getDOMElements();
  setupLocalStream().then(() => {
    setupPort();
  });
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
  console.log("[Watch party voice] Received message: ", msg);

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
