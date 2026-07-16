import { Room, Client, CloseCode } from "colyseus";
import { MyRoomState, Player } from "./schema/MyRoomState.js";

export class MyRoom extends Room {
  maxClients = 4;
  state = new MyRoomState();

  messages = {
    0: (client: Client, payload: any) => {
      if (this.state.phase !== "playing") return;

      const player = this.state.players.get(client.sessionId);
      const velocity = 2;

      if (payload.left) {
        player.x -= velocity;
      } else if (payload.right) {
        player.x += velocity;
      }

      if (payload.up) {
        player.y -= velocity;
      } else if (payload.down) {
        player.y += velocity;
      }
    },
    startGame: (client: Client) => {
      // Bara den som skapade rummet (första spelaren) får starta
      if (client.sessionId === this.state.players.keys().next().value) {
        this.state.phase = "playing";
      }
    }
  }

  onCreate (options: any) {
    if (options.gameMode) {
      this.state.gameMode = options.gameMode;
    }
  }

  onJoin (client: Client, options: any) {
    console.log(client.sessionId, "joined!");

    const mapWidth = 800;
    const mapHeight = 600;

    const player = new Player();
    player.x = Math.random() * mapWidth;
    player.y = Math.random() * mapHeight;

    this.state.players.set(client.sessionId, player);
  }

  onLeave (client: Client, code: CloseCode) {
    console.log(client.sessionId, "left!", code);
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }
}