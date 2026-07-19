import { MapSchema, Schema, type } from "@colyseus/schema";

export class Player extends Schema {
    @type("number") x: number;
    @type("number") y: number;
    @type("number") rotation: number = 0;
}

export class Bullet extends Schema {
    @type("number") x: number;
    @type("number") y: number;
    @type("number") rotation: number;
    @type("string") ownerId: string; // för senare
}

export class MyRoomState extends Schema {
    @type({map: Player}) players = new MapSchema<Player>();
    @type({map: Bullet}) bullets = new MapSchema<Bullet>();
    @type("string") phase: string = "lobby";
    @type("string") gameMode: string = "duel";
}