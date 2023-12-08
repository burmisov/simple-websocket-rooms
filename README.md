# Simple Websocket Rooms

An extremely simple websocket server to simulate p2p connections for
browser clients.

```
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
```
