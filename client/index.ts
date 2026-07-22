import Phaser from "phaser";
import { Client, Room, Callbacks } from "@colyseus/sdk";

const serverUrl = window.location.hostname === "localhost"
    ? "http://localhost:2567"
    : window.location.origin;

const client = new Client(serverUrl);

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

        const updateCount = () => {
            const count = room.state?.players?.size ?? 0;
            playerCountText.setText(`Spelare anslutna: ${count}`);
        };

        room.onStateChange(() => {
            updateCount();
        });

        updateCount();

        const callbacks = Callbacks.get(room);

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
    bulletEntities: {[bulletId: string]: any} = {};
    healthTexts: {[sessionId: string]: any} = {};

    inputPayload = {
        left: false,
        right: false,
        up: false,
        down: false,
    };

    cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
    wasdKeys: any;

    preload() {
        this.load.image('player', new URL('./public/assets/soldier1_gun.png', import.meta.url).toString());
        this.load.image('floor', new URL('./public/assets/tile_17.png', import.meta.url).toString());
        this.load.image('bullet', new URL('./public/assets/bullet.png', import.meta.url).toString());
    }

    create() {
        this.add.tileSprite(400, 300, 800, 600, 'floor');

        this.cursorKeys = this.input.keyboard.createCursorKeys();
        this.wasdKeys = this.input.keyboard.addKeys('W,A,S,D');

        this.input.on("pointerdown", () => {
            room.send("shoot");
        });

        const callbacks = Callbacks.get(room);

        const createPlayerEntity = (player: any, sessionId: string) => {
            const entity: any = this.physics.add.image(player.x, player.y, 'player');
            entity.targetX = player.x;
            entity.targetY = player.y;
            this.playerEntities[sessionId] = entity;

            const healthText = this.add.text(player.x, player.y - 30, `${player.hp} hp`, { fontSize: "14px", color: "#ffffff" }).setOrigin(0.5);
            this.healthTexts[sessionId] = healthText;

            callbacks.onChange(player, () => {
                entity.targetX = player.x;
                entity.targetY = player.y;
                entity.rotation = player.rotation;
                healthText.setText(`${player.hp} hp`);

                if (player.hp <= 0) {
                    entity.setAlpha(0.3);
                }
            });
        };

        room.state.players.forEach((player: any, sessionId: string) => {
            createPlayerEntity(player, sessionId);
        });

        callbacks.onAdd("players", (player: any, sessionId: string) => {
            if (this.playerEntities[sessionId]) return;
            createPlayerEntity(player, sessionId);
        });

        callbacks.onRemove("players", (player: any, sessionId: string) => {
            const entity = this.playerEntities[sessionId];
            if (entity) {
                entity.destroy();
                delete this.playerEntities[sessionId];
            }
            const healthText = this.healthTexts[sessionId];
            if (healthText) {
                healthText.destroy();
                delete this.healthTexts[sessionId];
            }
        });

        callbacks.onAdd("bullets", (bullet: any, bulletId: string) => {
            const entity = this.physics.add.image(bullet.x, bullet.y, 'bullet');
            entity.setScale(1.0);
            this.bulletEntities[bulletId] = entity;

            callbacks.onChange(bullet, () => {
                entity.x = bullet.x;
                entity.y = bullet.y;
            });
        });

        callbacks.onRemove("bullets", (bullet: any, bulletId: string) => {
            const entity = this.bulletEntities[bulletId];
            if (entity) {
                entity.destroy();
                delete this.bulletEntities[bulletId];
            }
        });
    }

    update(time: number, delta: number): void {
        if (!room) { return; }

        this.inputPayload.left = this.cursorKeys.left.isDown || this.wasdKeys.A.isDown;
        this.inputPayload.right = this.cursorKeys.right.isDown || this.wasdKeys.D.isDown;
        this.inputPayload.up = this.cursorKeys.up.isDown || this.wasdKeys.W.isDown;
        this.inputPayload.down = this.cursorKeys.down.isDown || this.wasdKeys.S.isDown;

        const myEntity = this.playerEntities[room.sessionId];
        let rotation = 0;
        if (myEntity) {
            rotation = Phaser.Math.Angle.Between(myEntity.x, myEntity.y, this.input.activePointer.worldX, this.input.activePointer.worldY);
        }

        room.send(0, {...this.inputPayload, rotation });

        for (const sessionId in this.playerEntities) {
            const entity: any = this.playerEntities[sessionId];
            entity.x = Phaser.Math.Linear(entity.x, entity.targetX, 0.1);
            entity.y = Phaser.Math.Linear(entity.y, entity.targetY, 0.1);

            const healthText = this.healthTexts[sessionId];
            if (healthText) {
                healthText.setPosition(entity.x, entity.y - 30);
            }
        }
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#3c9ad5',
    parent: 'phaser-example',
    physics: { default: "arcade" },
    pixelArt: true,
    scene: [ MenuScene, LobbyScene, GameScene ],
};

const game = new Phaser.Game(config);