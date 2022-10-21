import {
    AppMode,
    defaultAppMode,
    GameState,
    ToastWithId,
    Presence,
    defaultPresence,
    ModalType,
    GameMetadata,
} from "../types";

export type AppState = {
    appMode: AppMode;
    signedIn: boolean;
    profile: pxt.auth.UserProfile | undefined;
    gameId: string | undefined;
    playerSlot: number | undefined;
    joinCode: string | undefined;
    gameState: GameState | undefined;
    gameMetadata: GameMetadata | undefined;
    toasts: ToastWithId[];
    presence: Presence;
    modal: ModalType | undefined;
    reactions: {
        [clientId: string]:
            | {
                  id: string;
                  index: number;
              }
            | undefined;
    };
};

export const initialAppState: AppState = {
    appMode: { ...defaultAppMode },
    signedIn: false,
    profile: undefined,
    gameId: undefined,
    playerSlot: undefined,
    joinCode: undefined,
    gameState: undefined,
    gameMetadata: undefined,
    toasts: [],
    presence: { ...defaultPresence },
    modal: undefined,
    reactions: {},
};
