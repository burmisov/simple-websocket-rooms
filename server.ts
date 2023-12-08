import { WebSocketServer, WebSocket } from "ws";
import express from "express";

/*
  Listens to messages:
  1. {
    "action": "subscribe", "partyId": "some party id", "roomId": "abc"
  }
  2. { 
    "action": "message", "partyId": "some party id", "roomId": "abc",
    "toPartyId": "some other party id", "msg": "hello"
  }

  Sends messages:
  1. {
    "error": "some error message"
  }
  2. {
    "action": "presence", "fromPartyId": "some party id", "roomId": "abc",
    "online": true | false
  }
  3. {
    "action": "message", "fromPartyId": "some party id", "roomId": "abc",
    "msg": "hello"
  }
*/

const port = Number(process.env.PORT || 3000);

class Server {
  private wss: WebSocketServer;
  private sockets: Set<WebSocket>;
  private partyToSocket: Map<string, WebSocket>;
  private socketToParty: Map<WebSocket, string>;
  private rooms: Map<string, Set<string>>; // roomId -> Set<partyId>
  private partyToRoom: Map<string, string>; // partyId -> roomId

  constructor(port: number) {
    this.sockets = new Set();
    this.partyToSocket = new Map();
    this.socketToParty = new Map();
    this.rooms = new Map();
    this.partyToRoom = new Map();

    const app = express();
    app.get('*', (req, res) => res.send('hi!'));

    this.wss = new WebSocketServer({ server: app.listen(port) });
    this.wss.on("connection", this.onConnection.bind(this));

    console.log('Listening on port', port);
  }

  onConnection(socket: WebSocket) {
    this.sockets.add(socket);
    socket.on("message", this.onMessage.bind(this, socket));
    socket.on("close", this.onClose.bind(this, socket));
  }

  onMessage(socket: WebSocket, message: string) {
    try {
      const data = JSON.parse(message);
      if (data.action === "subscribe") {
        this.onSubscribe(socket, data);
      } else if (data.action === "message") {
        this.onMessageFromClient(socket, data);
      } else {
        this.onError(socket, "Invalid action");
      }
    } catch (e) {
      this.onError(socket, "Error processing message");
    }
  }

  onClose(socket: WebSocket) {
    this.sockets.delete(socket);
    const partyId = this.socketToParty.get(socket);

    if (partyId) {
      this.socketToParty.delete(socket);
      this.partyToSocket.delete(partyId);
      this.sendPresence(partyId, false);

      const roomId = this.partyToRoom.get(partyId);
      this.partyToRoom.delete(partyId);
      if (roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
          room.delete(partyId);
          if (room.size === 0) {
            this.rooms.delete(roomId);
          }
        }
      }
    }
  }

  onSubscribe(socket: WebSocket, data: any) {
    const { partyId, roomId } = data;
    if (!partyId || !roomId) {
      this.onError(socket, "Invalid partyId or roomId");
      return;
    }

    if (this.partyToSocket.has(partyId)) {
      this.onError(socket, "Already subscribed");
      return;
    }

    this.partyToSocket.set(partyId, socket);
    this.socketToParty.set(socket, partyId);
    this.partyToRoom.set(partyId, roomId);
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Set();
      this.rooms.set(roomId, room);
    }
    room.add(partyId);

    for (const partyId of room) {
      this.sendPresence(partyId, true);
    }
    // this.sendPresence(partyId, true);
  }

  onMessageFromClient(socket: WebSocket, data: any) {
    const { partyId, roomId, toPartyId, msg } = data;
    if (!partyId || !roomId || !toPartyId || !msg) {
      this.onError(socket, "Invalid partyId, roomId, toPartyId or msg");
      return;
    }

    const toSocket = this.partyToSocket.get(toPartyId);
    if (!toSocket) {
      this.onError(socket, "toPartyId not subscribed");
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.onError(socket, "roomId not found");
      return;
    }

    if (!room.has(partyId)) {
      this.onError(socket, "partyId not in roomId");
      return;
    }

    const fromPartyId = this.socketToParty.get(socket);
    if (fromPartyId !== partyId) {
      this.onError(socket, "partyId does not match");
      return;
    }

    const message = JSON.stringify({
      action: "message",
      fromPartyId,
      roomId,
      msg,
    });
    toSocket.send(message);
  }

  onError(socket: WebSocket, error: string) {
    const message = JSON.stringify({ error });
    socket.send(message);
  }

  sendPresence(partyId: string, online: boolean) {
    const roomId = this.partyToRoom.get(partyId);
    if (!roomId) {
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    const message = JSON.stringify({
      action: "presence",
      fromPartyId: partyId,
      roomId,
      online,
    });
    for (const otherPartyId of room) {
      if (otherPartyId === partyId) {
        continue;
      }
      const socket = this.partyToSocket.get(otherPartyId);
      if (socket) {
        socket.send(message);
      }
    }
  }
}

new Server(port);
