export type RoomParticipantRole = 'host' | 'guest';

/** Configuracion de una Live Room, generada 100% en el cliente (sin base de datos). */
export interface RoomConfig {
  id: string;
  code: string;
  hostLanguage: string;
  guestLanguage: string;
}

export interface RoomMessage {
  id: string;
  senderRole: RoomParticipantRole;
  originalText: string;
  translatedText: string;
  originalLanguage: string;
  translatedLanguage: string;
  /** Audio TTS en base64, relayado directamente por el Durable Object (sin storage). */
  audioBase64: string | null;
  mimeType: string | null;
  createdAt: string;
}

export type RoomSocketEvent =
  | { type: 'presence'; roles: RoomParticipantRole[] }
  | { type: 'message'; message: RoomMessage };
