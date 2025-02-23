export class PubSub {
  #subscribers;

  constructor() {
    this.#subscribers = {};
  }

  subscribe(event, callback) {
    this.#subscribers[event] = callback;
  }

  publish(event, data) {
    const callback = this.#subscribers[event];
    if (callback) {
      callback(data);
    }
  }
}
