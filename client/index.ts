import Phaser from "phaser";
import { Client, Room, Callbacks } from "@colyseus/sdk";

const client = new Client("http://localhost:2567");
let room: Room;

class MenuScene extends Phaser.Scene {
    constructor() {
        super("MenuScene");
    }

    create() {
        this.add.text(400, 150, "Rushfire", { fontSize: "48px", color: "#ffffff" }).setOrigin(0.5);

        const createButton = this.add.text(400, 300, "Skapa spel", { fontSize: "28px", color: "#ffffff", backgroundColor: "#333333", padding: { x: 20, y: 10 } })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        const joinButton = this.add.text(400, 380, "Gå med i spel", { fontSize: "28px", color: "#ffffff", backgroundColor: "#333333", padding: { x: 20, y: 10 } })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        createButton.on("pointerdown", async () => {
            room = await client.create("rushfire", { gameMode: "duel" });
            this.scene.start("LobbyScene");
        });

        joinButton.on("pointerdown", async () => {
            const code = prompt("Ange spelkod:");
            if (!code) return;

            try {
                room = await client.joinById(code);
                this.scene.start("LobbyScene");
            } catch (e) {
                alert("Kunde inte hitta spelet. Kolla koden och försök igen.");
            }
        });
    }
}

class LobbyScene extends Phaser.Scene {
    constructor() {
        super("LobbyScene");
    }

    create() {
        this.add.text(400, 100, "Väntrum", { fontSize: "36px", color: "#ffffff" }).setOrigin(0.5);
        this.add.text(400, 160, `Spelkod: ${room.roomId}`, { fontSize: "24px", color: "#ffff00" }).setOrigin(0.5);

        const playerCountText = this.add.text(400, 220, "", { fontSize: "20px", color: "#ffffff" }).setOrigin(0.5);

        const startButton = this.add.text(400, 320, "Starta spel", { fontSize: "28px", color: "#ffffff", backgroundColor: "#333333", padding: { x: 20, y: 10 } })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        startButton.on("pointerdown", () => {
            room.send("startGame");
        });

        const callbacks = Callbacks.get(room);

        const updateCount = () => {
            playerCountText.setText(`Spelare anslutna: ${room.state.players.size}`);
        };

        callbacks.onAdd("players", updateCount);
        callbacks.onRemove("players", updateCount);
        updateCount();

        callbacks.listen("phase", (currentPhase) => {
            if (currentPhase === "playing") {
                this.scene.start("GameScene");
            }
        });
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
    }

    playerEntities: {[sessionId: string]: any} = {};

    inputPayload = {
        left: false,
        right: false,
        up: false,
        down: false,
    };

    cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;

    preload() {
        this.load.image('ship_0001', 'https://cdn.jsdelivr.net/gh/colyseus/tutorial-phaser@master/client/dist/assets/ship_0001.png');
    }

    create() {
        this.cursorKeys = this.input.keyboard.createCursorKeys();

        const callbacks = Callbacks.get(room);

        room.state.players.forEach((player: any, sessionId: string) => {
            const entity: any = this.physics.add.image(player.x, player.y, 'ship_0001');
            entity.targetX = player.x;
            entity.targetY = player.y;
            this.playerEntities[sessionId] = entity;

            callbacks.onChange(player, () => {
                entity.targetX = player.x;
                entity.targetY = player.y;
            });
        });

        callbacks.onAdd("players", (player: any, sessionId: string) => {
            if (this.playerEntities[sessionId]) return;

            const entity: any = this.physics.add.image(player.x, player.y, 'ship_0001');
            entity.targetX = player.x;
            entity.targetY = player.y;
            this.playerEntities[sessionId] = entity;

            callbacks.onChange(player, () => {
                entity.targetX = player.x;
                entity.targetY = player.y;
            });
        });

        callbacks.onRemove("players", (player: any, sessionId: string) => {
            const entity = this.playerEntities[sessionId];
            if (entity) {
                entity.destroy();
                delete this.playerEntities[sessionId];
            }
        });
    }

    update(time: number, delta: number): void {
        if (!room) { return; }

        this.inputPayload.left = this.cursorKeys.left.isDown;
        this.inputPayload.right = this.cursorKeys.right.isDown;
        this.inputPayload.up = this.cursorKeys.up.isDown;
        this.inputPayload.down = this.cursorKeys.down.isDown;
        room.send(0, this.inputPayload);

        for (const sessionId in this.playerEntities) {
            const entity: any = this.playerEntities[sessionId];
            entity.x = Phaser.Math.Linear(entity.x, entity.targetX, 0.2);
            entity.y = Phaser.Math.Linear(entity.y, entity.targetY, 0.2);
        }
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#b6d53c',
    parent: 'phaser-example',
    physics: { default: "arcade" },
    pixelArt: true,
    scene: [ MenuScene, LobbyScene, GameScene ],
};

const game = new Phaser.Game(config);