import React from 'react';
import VideoCall from '../helpers/simple-peer';
import '../styles/video.css';
import io from 'socket.io-client';
import { getDisplayStream } from '../helpers/media-access';
import Peer from 'simple-peer'
import VideoItem from "./videoItem"
import SceneControls from "./SceneControls.js";
let userId = null

class Video extends React.Component {
  constructor() {
    super();
    this.state = {
      localStream: {},
      remoteStreamUrl: '',
      streamUrl: '',
      initiator: false,
      peer: {},
      connecting: false,
      waiting: true,
      micState: true,
      camState: true,
      peers: {},
      streams: {},
    };
  }
  videoCall = new VideoCall();

  componentDidMount() {
    const socket = io.connect("mysterious-dusk-60271.herokuapp.com");
    const component = this;
    this.setState({ socket });
    const { roomId } = this.props.match.params;
    this.getUserMedia().then(() => {
      socket.emit('join', { roomId });
      console.log("socket.on join", roomId)

    });

    socket.on('init', (data) => {

      console.log("socket.on init", data)

      userId = data.userId;
      socket.emit('ready', { room: roomId, userId });
    });

    socket.on("users", ({ initiator, users }) => {
      console.log("socket.on  users", users)

      Object.keys(users.sockets)
        .filter(
          sid =>
            !this.state.peers[sid] && sid !== userId)
        .forEach(sid => {
          const peer = new Peer({
            initiator: userId === initiator,
            config: {
              iceServers: [
                {
                  urls: "turn:turnserver.example.org",
                        username: "webrtc",
                        credential: "turnpassword" 
                                      }
              ]
            },
            // Allow the peer to receive video, even if it's not sending stream:
            // https://github.com/feross/simple-peer/issues/95
            offerConstraints: {
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            },
            stream: this.state.localStream,
          })

          peer.on('signal', data => {
            console.log("peer.on  signal", users)

            const signal = {
              userId: sid,
              signal: data
            };

            socket.emit('signal', signal);
          });
          peer.on('stream', stream => {
            console.log("peer.on  stream", stream)

            const streamsTemp = { ...this.state.streams }
            streamsTemp[sid] = stream

            this.setState({ streams: streamsTemp })
          });
          peer.on('error', function (err) {
            console.log("peer.on  error", err)

            console.log(err);
          });

          const peersTemp = { ...this.state.peers }
          peersTemp[sid] = peer

          this.setState({ peers: peersTemp })
        })
    })

    socket.on('signal', ({ userId, signal }) => {
      console.log("socket.on  signal userId", userId, "signal", signal)

      const peer = this.state.peers[userId]
      peer.signal(signal)
    })

    socket.on('disconnected', () => {
      component.setState({ initiator: true });
    });
  }


  getUserMedia(cb) {
    return new Promise((resolve, reject) => {
      navigator.mediaDevices.getUserMedia = navigator.getUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia || 
        navigator.mozGetUserMedia;
      const op = {
        video: {
          width: { min: 160, ideal: 640, max: 1280 },
          height: { min: 120, ideal: 360, max: 720 }
        },
        audio: true
      };
      navigator.getUserMedia(
        op,
        stream => {
          this.setState({ streamUrl: stream, localStream: stream });
          this.localVideo.srcObject = stream;
          resolve();
        },
        () => { }
      );
    });
  }

  setAudioLocal() {
    if (this.state.localStream.getAudioTracks().length > 0) {
      this.state.localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
    this.setState({
      micState: !this.state.micState
    })
  }

  setVideoLocal() {
    if (this.state.localStream.getVideoTracks().length > 0) {
      this.state.localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
    this.setState({
      camState: !this.state.camState
    })
  }

  getDisplay() {
    getDisplayStream().then(stream => {
      stream.oninactive = () => {
        Object.keys(this.state.peers).forEach((key)=>{
          this.state.peers[key].removeStream(this.state.localStream);
        })
        this.getUserMedia().then(() => {
          Object.keys(this.state.peers).forEach((key)=>{
            this.state.peers[key].addStream(this.state.localStream);
          })
        });
      };
      this.setState({ streamUrl: stream, localStream: stream });
      this.localVideo.srcObject = stream;
      Object.keys(this.state.peers).forEach((key)=>{
        this.state.peers[key].addStream(this.state.localStream);
      })
    });
  }

  render() {

    return (
      <div className='video-wrapper'>
        <div className='local-video-wrapper'>
          <video
            autoPlay
            id='localVideo' className="user-video"
            muted
            ref={video => (this.localVideo = video)}
          />
          {
            Object.keys(this.state.streams).map((key, id) => {
              return <VideoItem
                key={key}
                userId={key}
                stream={this.state.streams[key]}
              />
            })
          }
        </div>


       
<SceneControls 
screenaction={() => {
  this.getDisplay();
}} 
micaction={() => {
  this.setAudioLocal();
}} 
videoaction={() => {
  this.setVideoLocal();
}}
/>


        
      </div>
    );
  }
}

export default Video;
