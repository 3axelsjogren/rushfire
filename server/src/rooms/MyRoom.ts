import { Room, Client, CloseCode } from "colyseus";
import { MyRoomState, Player, Bullet } from "./schema/MyRoomState.js";

export class MyRoom extends Room {
  maxClients = 4;
  state = new MyRoomState();
  bulletIdCounter = 0;

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

      player.rotation = payload.rotation;
    },
    shoot: (client: Client) => {
      if (this.state.phase !== "playing") return;

      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const muzzleOffset = 20;
      const sideOffset = 8;

      const bullet = new Bullet();
      bullet.x = player.x + Math.cos(player.rotation) * muzzleOffset + Math.cos(player.rotation + Math.PI / 2) * sideOffset;
      bullet.y = player.y + Math.sin(player.rotation) * muzzleOffset + Math.sin(player.rotation + Math.PI / 2) * sideOffset;
      bullet.rotation = player.rotation;
      bullet.ownerId = client.sessionId;

      const bulletId = String(this.bulletIdCounter++);
      this.state.bullets.set(bulletId, bullet);
    },
    
    startGame: (client: Client) => {
      if (client.sessionId === this.state.players.keys().next().value) {
        this.state.phase = "playing";
      }
    }
  }

  onCreate (options: any) {
    if (options.gameMode) {
      this.state.gameMode = options.gameMode;
    }

    this.setSimulationInterval((deltaTime) => this.update(deltaTime));
  }

  update(deltaTime: number) {
    const bulletSpeed = 8;
    const mapWidth = 800;
    const mapHeight = 600;

    this.state.bullets.forEach((bullet, bulletId) => {
        bullet.x += Math.cos(bullet.rotation) * bulletSpeed;
        bullet.y += Math.sin(bullet.rotation) * bulletSpeed;

        if (bullet.x < 0 || bullet.x > mapWidth || bullet.y < 0 || bullet.y > mapHeight) {
          this.state.bullets.delete(bulletId);
        }
    });
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