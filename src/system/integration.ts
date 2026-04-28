/**
 * System integration contracts for Linux/Omarchy behavior.
 * TODO(AA-379): Implement suspend/wake listeners and notification transport adapters.
 */

export type SystemEvent =
  | { type: "suspend"; occurredAtIso: string }
  | { type: "wake"; occurredAtIso: string };

export interface SystemIntegration {
  watchSystemEvents(onEvent: (event: SystemEvent) => Promise<void>): Promise<StopWatching>;
  notify(input: NotificationInput): Promise<void>;
  playSound(input: SoundInput): Promise<void>;
}

export type StopWatching = () => Promise<void>;

export interface NotificationInput {
  title: string;
  message: string;
}

export interface SoundInput {
  name: "threshold";
}

const notImplementedError = (methodName: string): Error => {
  return new Error(`SystemIntegration.${methodName} is not implemented yet.`);
};

export class OmarchySystemIntegrationStub implements SystemIntegration {
  async watchSystemEvents(_onEvent: (event: SystemEvent) => Promise<void>): Promise<StopWatching> {
    // TODO(AA-379): Hook into Linux suspend/wake sources.
    return async () => Promise.resolve();
  }

  async notify(_input: NotificationInput): Promise<void> {
    throw notImplementedError("notify");
  }

  async playSound(_input: SoundInput): Promise<void> {
    throw notImplementedError("playSound");
  }
}
